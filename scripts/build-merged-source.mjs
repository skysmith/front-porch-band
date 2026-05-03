import { execFileSync } from "node:child_process";
import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, "..");
const outputDir = path.join(projectDir, "private-build", "merged-songbook-source");
const privateChartsDir = path.join(projectDir, "private-charts");

async function main() {
  const songs = JSON.parse(execFileSync("git", ["show", "HEAD:data/songs.json"], { encoding: "utf8" }));
  let restored = 0;
  let skipped = 0;

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  for (const song of songs) {
    const chartRepoPath = song.chartPath.replace(/^\.\//, "");
    let chartBody = "";
    try {
      chartBody = execFileSync("git", ["show", `HEAD:${chartRepoPath}`], { encoding: "utf8" }).trimEnd();
    } catch {
      skipped += 1;
      continue;
    }

    // Preserve leading section labels like `INTRO:` that parseChart would otherwise
    // treat as metadata and strip on the next sync.
    if (/^[A-Za-z][A-Za-z0-9 _-]*:\s*$/m.test(chartBody.split(/\r?\n/, 1)[0] ?? "")) {
      chartBody = ` ${chartBody}`;
    }

    const outputPath = path.join(outputDir, path.basename(chartRepoPath, ".txt") + ".md");
    const sourceText = `${song.title}

Artist: ${song.artist}

${chartBody}
`;

    await writeFile(outputPath, sourceText, "utf8");
    restored += 1;
  }

  await cp(privateChartsDir, outputDir, { recursive: true, force: true });

  console.log(`Prepared merged source with ${restored} restored bundled chart(s), ${skipped} skipped, plus private overlays at ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
