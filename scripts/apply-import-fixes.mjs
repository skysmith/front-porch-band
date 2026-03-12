import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listMarkdownFiles, parseChart, slugify } from "./lib/chart-utils.mjs";
import {
  canonicalTitle,
  destinationForArtist,
  inferArtistFromPath,
  listImportFiles,
  parseFlag,
  readImportSourceText,
  stripExistingHeader,
  titleFromFilename,
} from "./lib/import-utils.mjs";

function defaultPath(projectDir, relativePath) {
  return path.resolve(projectDir, relativePath);
}

function resolveOptions(projectDir, argv = process.argv.slice(2), env = process.env) {
  return {
    inboxDir: defaultPath(projectDir, parseFlag(argv, "--inbox", env.FRONT_PORCH_IMPORT_INBOX || "../import")),
    archiveDir: defaultPath(projectDir, parseFlag(argv, "--archive", env.FRONT_PORCH_IMPORT_ARCHIVE || "../import-archive")),
    libraryDir: defaultPath(projectDir, parseFlag(argv, "--library", env.FRONT_PORCH_LIBRARY_DIR || "../charts")),
    approvedDir: defaultPath(projectDir, parseFlag(argv, "--approved", env.FRONT_PORCH_APPROVED_DIR || "./approved-charts")),
    generatedDir: defaultPath(projectDir, parseFlag(argv, "--generated", env.FRONT_PORCH_GENERATED_DIR || "./charts")),
    songsPath: defaultPath(projectDir, parseFlag(argv, "--songs", env.FRONT_PORCH_SONGS_JSON || "./data/songs.json")),
  };
}

async function loadSongs(songsPath) {
  try {
    return JSON.parse(await readFile(songsPath, "utf8"));
  } catch {
    return [];
  }
}

function sortSongs(songs) {
  return songs.sort((left, right) => {
    const titleCompare = left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
    if (titleCompare !== 0) {
      return titleCompare;
    }
    return left.artist.localeCompare(right.artist, undefined, { sensitivity: "base" });
  });
}

function relPathForSource(rootDir, filePath) {
  return path.relative(rootDir, filePath).replace(/\\/g, "/");
}

function slugForLibraryPath(libraryDir, filePath) {
  const relPath = relPathForSource(libraryDir, filePath).replace(/\.md$/, "").replace(/[\\/]/g, "-");
  return slugify(relPath);
}

async function findLibraryMatch(libraryDir, title, artist) {
  const slug = slugify(title);
  const entries = await listMarkdownFiles(libraryDir);
  const candidates = entries.filter((entry) => path.basename(entry, ".md") === slug);

  if (!candidates.length) {
    return "";
  }

  if (candidates.length === 1 || !artist) {
    return path.join(libraryDir, candidates[0]);
  }

  const normalizedArtist = artist.trim().toLowerCase();
  for (const entry of candidates) {
    const fullPath = path.join(libraryDir, entry);
    const parsed = parseChart(await readFile(fullPath, "utf8"));
    if (parsed.artist.trim().toLowerCase() === normalizedArtist) {
      return fullPath;
    }
  }

  return path.join(libraryDir, candidates[0]);
}

async function chooseDestination(options, title, artist) {
  const approvedPath = path.join(options.approvedDir, `${slugify(title)}.md`);
  try {
    await readFile(approvedPath, "utf8");
    return { kind: "approved", path: approvedPath };
  } catch {
    // continue
  }

  const libraryMatch = await findLibraryMatch(options.libraryDir, title, artist);
  if (libraryMatch) {
    return { kind: "library", path: libraryMatch };
  }

  return {
    kind: "library",
    path: destinationForArtist(options.libraryDir, artist, title),
  };
}

function makeSourceText(title, artist, body) {
  return `${title}\n\nArtist: ${artist}\n\n${body.trim()}\n`;
}

function buildSongRecord(destinationInfo, parsed, options) {
  const sourceRel =
    destinationInfo.kind === "approved"
      ? `./approved-charts/${path.basename(destinationInfo.path)}`
      : `../charts/${relPathForSource(options.libraryDir, destinationInfo.path)}`;

  const slug =
    destinationInfo.kind === "approved"
      ? slugify(parsed.title)
      : slugForLibraryPath(options.libraryDir, destinationInfo.path);

  return {
    slug,
    title: parsed.title,
    artist: parsed.artist,
    key: parsed.key,
    chartPath: `./charts/${slug}.txt`,
    sourcePath: sourceRel,
  };
}

async function archiveImport(sourcePath, inboxDir, archiveBatchDir) {
  const relPath = path.relative(inboxDir, sourcePath);
  const archiveTarget = path.join(archiveBatchDir, relPath);
  await mkdir(path.dirname(archiveTarget), { recursive: true });
  await rename(sourcePath, archiveTarget);
  return archiveTarget;
}

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const projectDir = path.resolve(__dirname, "..");
  const options = resolveOptions(projectDir);

  await mkdir(options.inboxDir, { recursive: true });
  await mkdir(options.archiveDir, { recursive: true });
  await mkdir(options.libraryDir, { recursive: true });
  await mkdir(options.approvedDir, { recursive: true });
  await mkdir(options.generatedDir, { recursive: true });
  await mkdir(path.dirname(options.songsPath), { recursive: true });

  const inboxFiles = await listImportFiles(options.inboxDir);
  if (!inboxFiles.length) {
    console.log(`No import files found in ${options.inboxDir}`);
    return;
  }

  const archiveStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archiveBatchDir = path.join(options.archiveDir, archiveStamp);
  await mkdir(archiveBatchDir, { recursive: true });

  const songs = await loadSongs(options.songsPath);
  const processed = [];

  for (const relPath of inboxFiles) {
    const sourcePath = path.join(options.inboxDir, relPath);
    const fallbackTitle = titleFromFilename(sourcePath);
    const rawText = await readImportSourceText(sourcePath);
    const normalized = stripExistingHeader(rawText.replace(/\r/g, "").split("\n"), fallbackTitle);
    const title = canonicalTitle(normalized.title || fallbackTitle);
    const artist = inferArtistFromPath(sourcePath, options.inboxDir, normalized.artist);
    const destinationInfo = await chooseDestination(options, title, artist);
    const sourceText = makeSourceText(title, artist, normalized.body);
    const parsed = parseChart(sourceText);
    const nextSong = buildSongRecord(destinationInfo, parsed, options);
    const outputPath = path.join(options.generatedDir, `${nextSong.slug}.txt`);

    await mkdir(path.dirname(destinationInfo.path), { recursive: true });
    await writeFile(destinationInfo.path, sourceText, "utf8");
    await writeFile(outputPath, `${parsed.body}\n`, "utf8");

    const existingIndex = songs.findIndex((song) => song.slug === nextSong.slug);
    if (existingIndex >= 0) {
      songs.splice(existingIndex, 1, nextSong);
    } else {
      songs.push(nextSong);
    }

    const archived = await archiveImport(sourcePath, options.inboxDir, archiveBatchDir);
    processed.push({
      title,
      artist,
      destination: destinationInfo.path,
      generated: outputPath,
      archived,
    });
  }

  await writeFile(options.songsPath, `${JSON.stringify(sortSongs(songs), null, 2)}\n`, "utf8");

  console.log(`Processed ${processed.length} import fix${processed.length === 1 ? "" : "es"} from ${options.inboxDir}`);
  console.log(`Archive batch: ${archiveBatchDir}`);
  for (const item of processed) {
    console.log(`${item.artist} :: ${item.title}`);
    console.log(`  source -> ${item.destination}`);
    console.log(`  chart  -> ${item.generated}`);
    console.log(`  archived -> ${item.archived}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
