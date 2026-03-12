import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { slugify } from "./chart-utils.mjs";
import { IMPORT_ORIGINAL_ARTISTS, IMPORT_TITLE_ARTISTS, IMPORT_TITLE_CANONICAL } from "./import-config.mjs";

export const SUPPORTED_IMPORT_EXTENSIONS = new Set([".md", ".txt", ".docx", ".rtf"]);

export function parseFlag(args, flag, fallback) {
  const index = args.findIndex((arg) => arg === flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

export function resolveImportOptions(projectDir, argv = process.argv.slice(2), env = process.env) {
  return {
    inboxDir: path.resolve(projectDir, parseFlag(argv, "--inbox", env.FRONT_PORCH_IMPORT_INBOX || "./private-build/import")),
    chartsDir: path.resolve(projectDir, parseFlag(argv, "--charts", env.FRONT_PORCH_CHARTS_DIR || "./private-charts")),
    archiveDir: path.resolve(
      projectDir,
      parseFlag(argv, "--archive", env.FRONT_PORCH_IMPORT_ARCHIVE || "./private-build/import-archive"),
    ),
  };
}

export async function listImportFiles(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const relPath = prefix ? path.join(prefix, entry.name) : entry.name;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listImportFiles(fullPath, relPath)));
    } else if (entry.isFile() && SUPPORTED_IMPORT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(relPath);
    }
  }

  return files;
}

export function titleFromFilename(filePath) {
  return path
    .basename(filePath, path.extname(filePath))
    .replace(/\s+-\s+.+$/, "")
    .replace(/\s+Chord Chart$/i, "")
    .replace(/\s+Chords?\s+by.+$/i, "")
    .trim();
}

export function titleCase(value) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function canonicalTitle(rawTitle) {
  const cleaned = rawTitle
    .replace(/\u00a0/g, " ")
    .replace(/\s+Chords?\s+by.+$/i, "")
    .trim();
  return IMPORT_TITLE_CANONICAL[slugify(cleaned)] || cleaned;
}

export function convertRichTextToText(filePath) {
  return execFileSync("textutil", ["-convert", "txt", "-stdout", filePath], { encoding: "utf8" });
}

export async function readImportSourceText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".docx" || ext === ".rtf") {
    return convertRichTextToText(filePath);
  }
  return readFile(filePath, "utf8");
}

export function stripExistingHeader(lines, fallbackTitle) {
  let title = fallbackTitle;
  let artist = "";
  let startIndex = 0;

  while (startIndex < lines.length && !lines[startIndex].trim()) {
    startIndex += 1;
  }

  if (lines[startIndex]?.trim()) {
    const maybeTitle = lines[startIndex].trim();
    if (!/[|]/.test(maybeTitle) && !/^[A-G][#b]?(?:m|maj7|m7|sus2|sus4|6|7)?(?:\s+[A-G])/.test(maybeTitle)) {
      title = maybeTitle;
      startIndex += 1;
    }
  }

  while (startIndex < lines.length && !lines[startIndex].trim()) {
    startIndex += 1;
  }

  if (lines[startIndex]?.trim().startsWith("Artist:")) {
    artist = lines[startIndex].trim().replace(/^Artist:\s*/, "").trim();
    startIndex += 1;
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
  if (artist && bodyLines[0]?.trim().toLowerCase() === artist.toLowerCase()) {
    bodyLines.shift();
    if (!bodyLines[0]?.trim()) {
      bodyLines.shift();
    }
  }

  return { title, artist, body: bodyLines.join("\n").replace(/\n{3,}/g, "\n\n").trim() };
}

export function inferArtistFromPath(filePath, inboxDir, explicitArtist) {
  if (explicitArtist) {
    return explicitArtist;
  }

  const inferredTitle = titleCase(canonicalTitle(titleFromFilename(filePath)));
  if (IMPORT_TITLE_ARTISTS[inferredTitle]) {
    return IMPORT_TITLE_ARTISTS[inferredTitle];
  }

  const rel = path.relative(inboxDir, filePath).split(path.sep).map((part) => part.toLowerCase());
  const first = rel[0] || "";

  if (IMPORT_ORIGINAL_ARTISTS.has(first)) {
    return IMPORT_ORIGINAL_ARTISTS.get(first);
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

export function destinationForArtist(chartsDir, artist, title) {
  const baseDir = artist === "Tony Grove" ? path.join(chartsDir, "tony-grove") : chartsDir;
  return path.join(baseDir, `${slugify(title)}.md`);
}

export function completenessScore(text) {
  const chordMatches = text.match(/\b[A-G](?:[#b])?(?:\/[A-G](?:[#b])?)?(?:maj7|m7|sus2|sus4|m|6|7)?\b/g) || [];
  const sectionMatches = text.match(/^\[[^\]]+\]$|^(Verse|Chorus|Bridge|Intro|Outro|Refrain|Arrangement|Capo|Key)\b/gm) || [];
  const barMatches = text.match(/\|/g) || [];
  return text.length + chordMatches.length * 4 + sectionMatches.length * 12 + barMatches.length * 3;
}

export async function choosePreferredText(destination, incomingText) {
  try {
    const existingText = await readFile(destination, "utf8");
    return completenessScore(existingText) >= completenessScore(incomingText) ? existingText : incomingText;
  } catch {
    return incomingText;
  }
}

export async function importInbox({ inboxDir, chartsDir, archiveDir }) {
  await mkdir(chartsDir, { recursive: true });
  await mkdir(path.join(chartsDir, "tony-grove"), { recursive: true });
  await mkdir(inboxDir, { recursive: true });
  await mkdir(archiveDir, { recursive: true });

  const inboxFiles = await listImportFiles(inboxDir);
  if (!inboxFiles.length) {
    return { processed: [], inboxDir, archiveBatchDir: "" };
  }

  const archiveStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archiveBatchDir = path.join(archiveDir, archiveStamp);
  await mkdir(archiveBatchDir, { recursive: true });

  const processed = [];

  for (const relPath of inboxFiles) {
    const sourcePath = path.join(inboxDir, relPath);
    const fallbackTitle = titleFromFilename(sourcePath);
    const rawText = await readImportSourceText(sourcePath);
    const normalized = stripExistingHeader(rawText.replace(/\r/g, "").split("\n"), fallbackTitle);
    const artist = inferArtistFromPath(sourcePath, inboxDir, normalized.artist);
    const title = canonicalTitle(normalized.title || fallbackTitle);
    const destination = destinationForArtist(chartsDir, artist, title);
    const nextText = `${title}\n\nArtist: ${artist}\n\n${normalized.body}\n`;
    const finalText = await choosePreferredText(destination, nextText);

    await mkdir(path.dirname(destination), { recursive: true });
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

  return { processed, inboxDir, archiveBatchDir };
}
