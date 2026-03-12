import { mkdir, readFile, rm, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listMarkdownFiles, parseChart, resolveSourceDir, slugify, validateChart } from "./lib/chart-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, "..");
const sourceDir = resolveSourceDir(projectDir);
const outputDir = path.join(projectDir, "charts");
const dataDir = path.join(projectDir, "data");

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await mkdir(dataDir, { recursive: true });

  const entries = await listMarkdownFiles(sourceDir);
  const songs = [];

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry);
    const sourceText = await readFile(sourcePath, "utf8");
    const validation = validateChart(sourceText);
    if (validation.errors.length) {
      const details = validation.errors.map((item) => `- ${item}`).join("\n");
      throw new Error(`Invalid chart: ${entry}\n${details}`);
    }

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
  console.log(`Synced ${songs.length} chart(s) from ${sourceDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
