import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, "..");
const musicDir = path.resolve(projectDir, "..");
const chartsDir = path.join(musicDir, "charts");
const tonyGroveDir = path.join(chartsDir, "tony-grove");
const inboxDir = path.join(musicDir, "import");
const archiveDir = path.join(musicDir, "import-archive");

const SUPPORTED_EXTENSIONS = new Set([".md", ".txt", ".docx", ".rtf"]);
const TITLE_ARTISTS = {
  "First Day Of My Life": "Bright Eyes",
  "Freckled Girl": "Iron & Wine",
  "I'm Yours": "Jason Mraz",
  "I Will Follow You Into The Dark": "Death Cab for Cutie",
  Judgement: "Iron & Wine",
  "Seashell Tale": "M. Ward",
  "Spring Cleaning": "Bright Eyes / Neva Dinova",
  "Flightless Bird": "Iron & Wine",
  "Flightless Bird, American Mouth": "Iron & Wine",
};

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleFromFilename(filePath) {
  return path
    .basename(filePath, path.extname(filePath))
    .replace(/\s+-\s+.+$/, "")
    .replace(/\s+Chord Chart$/i, "")
    .trim();
}

function titleCase(value) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function convertDocxToText(filePath) {
  return execFileSync("textutil", ["-convert", "txt", "-stdout", filePath], { encoding: "utf8" });
}

async function readSourceText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".docx" || ext === ".rtf") {
    return convertDocxToText(filePath);
  }
  return readFile(filePath, "utf8");
}

function stripExistingHeader(lines, fallbackTitle) {
  let title = fallbackTitle;
  let artist = "";
  let startIndex = 0;

  while (startIndex < lines.length && !lines[startIndex].trim()) {
    startIndex += 1;
  }

  if (lines[startIndex]?.trim()) {
    const maybeTitle = lines[startIndex].trim();
    const nextLine = lines[startIndex + 1]?.trim() || "";
    if (!/[|]/.test(maybeTitle) && !/^[A-G][#b]?(?:m|maj7|m7|sus2|sus4|6|7)?(?:\s+[A-G])/.test(maybeTitle)) {
      title = maybeTitle;
      startIndex += 1;
    }

    if (nextLine.startsWith("Artist:")) {
      artist = nextLine.replace(/^Artist:\s*/, "").trim();
      startIndex += 2;
    } else if (lines[startIndex]?.trim().startsWith("Artist:")) {
      artist = lines[startIndex].trim().replace(/^Artist:\s*/, "").trim();
      startIndex += 1;
    }
  }

  while (startIndex < lines.length && !lines[startIndex].trim()) {
    startIndex += 1;
  }

  const bodyLines = lines.slice(startIndex);
  if (bodyLines[0]?.trim().toLowerCase() === title.toLowerCase()) {
    bodyLines.shift();
    if (!bodyLines[0]?.trim()) {
      bodyLines.shift();
    }
  }

  return { title, artist, body: bodyLines.join("\n").replace(/\n{3,}/g, "\n\n").trim() };
}

function inferArtistFromPath(filePath, explicitArtist) {
  if (explicitArtist) {
    return explicitArtist;
  }

  const inferredTitle = titleCase(titleFromFilename(filePath));
  if (TITLE_ARTISTS[inferredTitle]) {
    return TITLE_ARTISTS[inferredTitle];
  }

  const rel = path.relative(inboxDir, filePath).split(path.sep).map((part) => part.toLowerCase());
  const first = rel[0] || "";

  if (first === "tony-grove" || first === "originals") {
    return "Tony Grove";
  }

  if (first === "covers" && rel.length > 1) {
    return "Cover";
  }

  if (first && path.extname(first) === "") {
    return first
      .split(/[-_ ]+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  return "Cover";
}

function destinationForArtist(artist, title) {
  const baseDir = artist === "Tony Grove" ? tonyGroveDir : chartsDir;
  return path.join(baseDir, `${slugify(title)}.md`);
}

function completenessScore(text) {
  const chordMatches = text.match(/\b[A-G](?:[#b])?(?:\/[A-G](?:[#b])?)?(?:maj7|m7|sus2|sus4|m|6|7)?\b/g) || [];
  const sectionMatches = text.match(/^\[[^\]]+\]$|^(Verse|Chorus|Bridge|Intro|Outro|Refrain|Arrangement|Capo|Key)\b/gm) || [];
  const barMatches = text.match(/\|/g) || [];
  return text.length + chordMatches.length * 4 + sectionMatches.length * 12 + barMatches.length * 3;
}

async function choosePreferredText(destination, incomingText) {
  try {
    const existingText = await readFile(destination, "utf8");
    return completenessScore(existingText) >= completenessScore(incomingText) ? existingText : incomingText;
  } catch {
    return incomingText;
  }
}

async function listFiles(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const relPath = prefix ? path.join(prefix, entry.name) : entry.name;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath, relPath)));
    } else if (entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(relPath);
    }
  }

  return files;
}

async function main() {
  await mkdir(chartsDir, { recursive: true });
  await mkdir(tonyGroveDir, { recursive: true });
  await mkdir(inboxDir, { recursive: true });
  await mkdir(archiveDir, { recursive: true });

  const inboxFiles = await listFiles(inboxDir);
  if (!inboxFiles.length) {
    console.log(`No import files found in ${inboxDir}`);
    return;
  }

  const archiveStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archiveBatchDir = path.join(archiveDir, archiveStamp);
  await mkdir(archiveBatchDir, { recursive: true });

  const processed = [];

  for (const relPath of inboxFiles) {
    const sourcePath = path.join(inboxDir, relPath);
    const fallbackTitle = titleFromFilename(sourcePath);
    const rawText = await readSourceText(sourcePath);
    const normalized = stripExistingHeader(rawText.replace(/\r/g, "").split("\n"), fallbackTitle);
    const artist = inferArtistFromPath(sourcePath, normalized.artist);
    const title = normalized.title || fallbackTitle;
    const destination = destinationForArtist(artist, title);
    const nextText = `${title}\n\nArtist: ${artist}\n\n${normalized.body}\n`;
    const finalText = await choosePreferredText(destination, nextText);

    await writeFile(destination, finalText, "utf8");

    const archiveTarget = path.join(archiveBatchDir, relPath);
    await mkdir(path.dirname(archiveTarget), { recursive: true });
    await rename(sourcePath, archiveTarget);

    processed.push({
      title,
      artist,
      destination,
      archived: archiveTarget,
    });
  }

  console.log(`Imported ${processed.length} files from ${inboxDir}`);
  for (const item of processed) {
    console.log(`${item.artist} :: ${item.title}`);
    console.log(`  -> ${item.destination}`);
    console.log(`  archived -> ${item.archived}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
