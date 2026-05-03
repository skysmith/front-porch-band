import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, "..");
const buildDir = path.join(projectDir, "private-build", "american-songbag");
const chartsDir = path.join(projectDir, "private-charts", "american-songbag");
const sourceTextPath = path.join(buildDir, "american-songbag.txt");
const sourcePdfPath = path.join(buildDir, "american-songbag.pdf");

const TXT_URL =
  "https://archive.org/download/americansongbag0000carl/americansongbag0000carl_djvu.txt";
const PDF_URL = "https://archive.org/download/americansongbag0000carl/americansongbag0000carl.pdf";

function hasFlag(flag) {
  return process.argv.slice(2).includes(flag);
}

function download(url, destination) {
  execFileSync("curl", ["-sSL", url, "-o", destination], { stdio: "inherit" });
}

function normalizeQuotes(value) {
  return value
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, "-");
}

function normalizeTitle(value) {
  return normalizeQuotes(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isUppercaseish(line) {
  return /^[A-Z0-9 "'!?:;,.()\-\/&$]+$/.test(normalizeQuotes(line));
}

function cleanTitle(rawTitle) {
  return normalizeQuotes(rawTitle)
    .replace(/\s+/g, " ")
    .replace(/\s+\(\s+/g, " (")
    .replace(/\s+\)/g, ")")
    .replace(/\bPpooR\b/g, "POOR")
    .replace(/\$+/g, "")
    .trim();
}

function parseTitles(text) {
  const firstTocIndex = text.indexOf("TABLE OF CONTENTS");
  const lastIndexEntry = text.indexOf("INDEX 1493", firstTocIndex);
  if (firstTocIndex < 0 || lastIndexEntry < 0) {
    throw new Error("Could not find the American Songbag table of contents.");
  }

  const tocText = text.slice(firstTocIndex, lastIndexEntry);
  const lines = tocText.split(/\r?\n/).map((line) => line.trim());
  const titles = [];
  let buffer = "";

  for (const line of lines) {
    if (!line || line === "TABLE OF CONTENTS") {
      continue;
    }

    if (/^[xvi]+$/i.test(line)) {
      continue;
    }

    if (/^\$?[0-9&]+$/.test(line) && buffer) {
      titles.push(cleanTitle(buffer));
      buffer = "";
      continue;
    }

    if (/[0-9]/.test(line)) {
      const working = cleanTitle(buffer ? `${buffer} ${line}` : line);
      const matches = [...working.matchAll(/([^0-9]+?)\s+\$?[0-9&]+/g)];

      if (matches.length) {
        for (const match of matches) {
          const title = cleanTitle(match[1]);
          if (title) {
            titles.push(title);
          }
        }
        buffer = "";
        continue;
      }
    }

    if (isUppercaseish(line)) {
      buffer = buffer ? `${buffer} ${line}` : line;
      continue;
    }

    buffer = "";
  }

  return [...new Set(titles)];
}

function findSegments(lines, titles, searchStart = 0) {
  const normalizedLines = lines.map((line) => normalizeTitle(line));
  const segments = [];
  let cursor = searchStart;

  for (const title of titles) {
    const normalizedTitle = normalizeTitle(title);
    let start = -1;

    for (let index = cursor; index < normalizedLines.length; index += 1) {
      const rawLine = normalizeQuotes(lines[index].trim());
      const prevLine = normalizeQuotes((lines[index - 1] ?? "").trim());
      if (
        normalizedLines[index] === normalizedTitle &&
        isUppercaseish(rawLine) &&
        (!prevLine || /^\d+$/.test(prevLine) || /^[xvi]+$/i.test(prevLine))
      ) {
        start = index;
        break;
      }
    }

    if (start < 0) {
      continue;
    }

    segments.push({ title, start });
    cursor = start + 1;
  }

  return segments.map((segment, index) => ({
    ...segment,
    end: index + 1 < segments.length ? segments[index + 1].start : lines.length,
  }));
}

function findContentStartLine(text) {
  const firstTocIndex = text.indexOf("TABLE OF CONTENTS");
  const lastIndexEntry = text.indexOf("INDEX 1493", firstTocIndex);
  if (lastIndexEntry < 0) {
    return 0;
  }

  return text.slice(0, lastIndexEntry).split(/\r?\n/).length;
}

function cleanupSegment(lines, title) {
  const bodyLines = [];

  for (const rawLine of lines) {
    const line = normalizeQuotes(rawLine).replace(/\t/g, " ").trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      bodyLines.push("");
      continue;
    }

    if (/^\d+$/.test(trimmed)) {
      continue;
    }

    if (/^[xvi]+$/i.test(trimmed)) {
      continue;
    }

    if (normalizeTitle(trimmed) === normalizeTitle(title)) {
      continue;
    }

    bodyLines.push(line);
  }

  const joined = bodyLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return joined;
}

async function main() {
  const refresh = hasFlag("--refresh");

  await mkdir(buildDir, { recursive: true });
  await mkdir(path.join(projectDir, "private-charts"), { recursive: true });

  if (refresh) {
    await rm(sourceTextPath, { force: true });
    await rm(sourcePdfPath, { force: true });
  }

  try {
    await readFile(sourceTextPath, "utf8");
  } catch {
    download(TXT_URL, sourceTextPath);
  }

  try {
    await readFile(sourcePdfPath);
  } catch {
    download(PDF_URL, sourcePdfPath);
  }

  const sourceText = await readFile(sourceTextPath, "utf8");
  const titles = parseTitles(sourceText);
  const lines = sourceText.split(/\r?\n/);
  const contentStartLine = findContentStartLine(sourceText);
  const segments = findSegments(lines, titles, contentStartLine);

  await rm(chartsDir, { recursive: true, force: true });
  await mkdir(chartsDir, { recursive: true });

  let created = 0;
  const missing = [];

  for (const { title, start, end } of segments) {
    const body = cleanupSegment(lines.slice(start, end), title);
    if (!body) {
      missing.push(title);
      continue;
    }

    const chartText = `${title}

Artist: Traditional
Source: The American Songbag (public domain, Carl Sandburg)
Collection: American Songbag

${body}
`;

    await writeFile(path.join(chartsDir, `${slugify(title)}.md`), chartText, "utf8");
    created += 1;
  }

  const missingTitles = titles.filter((title) => !segments.some((segment) => segment.title === title));
  const indexBody = [
    "The American Songbag import summary",
    "",
    `Imported ${created} chart(s) from the public-domain OCR text.`,
    `Matched ${segments.length} title section(s) from ${titles.length} table-of-contents entries.`,
    "",
    "Source files:",
    `- OCR text: ${path.relative(projectDir, sourceTextPath)}`,
    `- PDF: ${path.relative(projectDir, sourcePdfPath)}`,
    "",
    "Notes:",
    "- These are best-effort OCR imports from scanned sheet music, so formatting and lyrics may need cleanup.",
    "- The entries preserve notes and lyrics text, but they do not infer guitar chords from notation.",
  ];

  if (missingTitles.length) {
    indexBody.push("", "Titles not matched automatically:", ...missingTitles.map((title) => `- ${title}`));
  }

  if (missing.length) {
    indexBody.push("", "Matched titles with empty extracted bodies:", ...missing.map((title) => `- ${title}`));
  }

  await writeFile(
    path.join(chartsDir, "american-songbag-index.md"),
    `American Songbag Index

Artist: Carl Sandburg

${indexBody.join("\n")}
`,
    "utf8",
  );

  console.log(`Imported ${created} American Songbag chart(s) into ${chartsDir}`);
  console.log(`Wrote source files to ${buildDir}`);
  console.log(`Unmatched titles: ${missingTitles.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
