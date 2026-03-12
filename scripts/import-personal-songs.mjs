import { execFileSync } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, "..");
const chartsDir = path.resolve(projectDir, "..", "charts");
const sourceRoot = "/Users/sky/Documents/Personal Projects/Songs";

const COVER_ARTISTS = {
  "Days Aren't Long Enough": "Cover",
  "First Day of my Life": "Bright Eyes",
  "Freckled Girl": "Cover",
  "I Will Follow You into the Dark": "Death Cab for Cutie",
  "I'm Yours": "Jason Mraz",
  Judgement: "Cover",
  "Seashell Tale": "Cover",
  "Spring Cleaning": "Cover",
  "Such Great Heights": "The Postal Service",
  "The Trapeze Swinger": "Iron & Wine",
  "Wagon Wheel": "Old Crow Medicine Show",
  "Waitin for a Superman": "The Flaming Lips",
  "You Belong to Me": "Cover",
  "You are your Mother's Child": "Cover",
  Lullaby: "Andi Walker",
};

const SKIP_ROOT_FILES = new Set(["Space Age.docx"]);
const DOCX_EXTENSION = ".docx";

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stemFromFilename(filename) {
  return filename.replace(new RegExp(`${DOCX_EXTENSION}$`), "");
}

function displayTitleFromStem(stem) {
  return stem.replace(/\s+-\s+.+$/, "").replace(/\s+Chord Chart$/, "").trim();
}

function inferArtist(filenameStem, isCover) {
  if (!isCover) {
    return "Tony Grove";
  }

  const explicit = filenameStem.match(/\s+-\s+(.+)$/);
  if (explicit) {
    return explicit[1].trim();
  }

  const title = displayTitleFromStem(filenameStem);
  return COVER_ARTISTS[title] || "Cover";
}

function convertDocxToText(filePath) {
  return execFileSync("textutil", ["-convert", "txt", "-stdout", filePath], { encoding: "utf8" });
}

function normalizeBody(text, title) {
  const lines = text.replace(/\r/g, "").split("\n");
  const firstContentIndex = lines.findIndex((line) => line.trim());

  if (firstContentIndex >= 0 && lines[firstContentIndex].trim().toLowerCase() === title.toLowerCase()) {
    lines.splice(firstContentIndex, 1);
    if (lines[firstContentIndex]?.trim() === "") {
      lines.splice(firstContentIndex, 1);
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function importDirectory(directoryPath, isCover) {
  const entries = (await readdir(directoryPath))
    .filter((entry) => entry.endsWith(DOCX_EXTENSION))
    .filter((entry) => !entry.startsWith("~$"))
    .filter((entry) => !(!isCover && SKIP_ROOT_FILES.has(entry)))
    .sort();

  const imported = [];

  for (const entry of entries) {
    const sourcePath = path.join(directoryPath, entry);
    const filenameStem = stemFromFilename(entry);
    const title = displayTitleFromStem(filenameStem);
    const artist = inferArtist(filenameStem, isCover);
    const body = normalizeBody(convertDocxToText(sourcePath), title);
    const destination = path.join(chartsDir, `${slugify(title)}.md`);
    const fileText = `${title}\n\nArtist: ${artist}\n\n${body}\n`;

    await writeFile(destination, fileText, "utf8");
    imported.push(path.basename(destination));
  }

  return imported;
}

async function main() {
  await mkdir(chartsDir, { recursive: true });

  const importedRoot = await importDirectory(sourceRoot, false);
  const importedCovers = await importDirectory(path.join(sourceRoot, "Covers"), true);

  console.log(`Imported ${importedRoot.length} originals and ${importedCovers.length} covers.`);
  for (const name of [...importedRoot, ...importedCovers]) {
    console.log(name);
  }
  console.log("Skipped non-docx files, Office temp files, and Space Age.docx in favor of Space Age Chord Chart.docx.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
