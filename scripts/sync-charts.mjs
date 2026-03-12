import { mkdir, readdir, readFile, rm, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, "..");
const sourceDir = path.resolve(projectDir, "..", "charts");
const outputDir = path.join(projectDir, "charts");
const dataDir = path.join(projectDir, "data");

async function listMarkdownFiles(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relPath = prefix ? path.join(prefix, entry.name) : entry.name;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(fullPath, relPath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(relPath);
    }
  }

  return files;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseChart(fileText) {
  const lines = fileText.split(/\r?\n/);
  const title = lines[0]?.trim() ?? "";
  const artistLine = lines.find((line) => line.startsWith("Artist:")) ?? "";
  const artist = artistLine.replace(/^Artist:\s*/, "").trim();
  const chartStart = lines.findIndex((line) => line.startsWith("Artist:"));
  const body = lines.slice(chartStart + 2).join("\n").trimEnd();
  const keyMatch = body.match(/\b([A-G][#b]?(?:m|maj7|m7|7|sus2|sus4|6)?)\b/);

  return {
    title,
    artist,
    body,
    key: keyMatch?.[1] ?? "",
  };
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await mkdir(dataDir, { recursive: true });

  const entries = await listMarkdownFiles(sourceDir);
  const songs = [];

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry);
    const sourceText = await readFile(sourcePath, "utf8");
    const parsed = parseChart(sourceText);
    const slug = slugify(entry.replace(/\.md$/, "").replace(/[\\/]/g, "-"));
    const chartFile = `${slug}.txt`;
    const outputPath = path.join(outputDir, chartFile);

    await writeFile(outputPath, parsed.body + "\n", "utf8");

    songs.push({
      slug,
      title: parsed.title,
      artist: parsed.artist,
      key: parsed.key,
      chartPath: `./charts/${chartFile}`,
      sourcePath: `../charts/${entry.replace(/\\/g, "/")}`,
    });
  }

  await writeFile(path.join(dataDir, "songs.json"), JSON.stringify(songs, null, 2) + "\n", "utf8");
  await copyFile(path.join(projectDir, "index.html"), path.join(projectDir, "404.html"));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
