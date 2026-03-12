import { mkdir, access, copyFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
  console.log(`ready: ${dir}`);
}

async function maybeCopySample(fromPath, toPath) {
  try {
    await access(toPath);
    return false;
  } catch {
    await copyFile(fromPath, toPath);
    return true;
  }
}

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const projectDir = path.resolve(__dirname, "..");
  const privateChartsDir = path.join(projectDir, "private-charts");
  const privateBuildDir = path.join(projectDir, "private-build");
  const importDir = path.join(privateBuildDir, "import");
  const archiveDir = path.join(privateBuildDir, "import-archive");
  const suggestionsDir = path.join(privateBuildDir, "suggestions");
  const suggestionsArchiveDir = path.join(privateBuildDir, "suggestions-archive");
  const envExamplePath = path.join(projectDir, ".env.example");
  const envPath = path.join(projectDir, ".env");
  const sampleChartPath = path.join(projectDir, "examples", "sample-songbook", "welcome-to-the-porch.md");
  const starterChartPath = path.join(privateChartsDir, "welcome-to-the-porch.md");

  await ensureDir(privateChartsDir);
  await ensureDir(importDir);
  await ensureDir(archiveDir);
  await ensureDir(suggestionsDir);
  await ensureDir(suggestionsArchiveDir);

  const copiedSample = await maybeCopySample(sampleChartPath, starterChartPath);
  console.log(copiedSample ? `seeded: ${starterChartPath}` : `kept existing: ${starterChartPath}`);

  const copiedEnv = await maybeCopySample(envExamplePath, envPath);
  console.log(copiedEnv ? `seeded: ${envPath}` : `kept existing: ${envPath}`);

  console.log("");
  console.log("Next steps:");
  console.log("1. Edit .env if you want GitHub Issues for suggestions.");
  console.log("2. Drop private charts into ./private-charts or imports into ./private-build/import.");
  console.log("3. Run: node scripts/validate-charts.mjs");
  console.log("4. Run: node scripts/sync-charts.mjs");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
