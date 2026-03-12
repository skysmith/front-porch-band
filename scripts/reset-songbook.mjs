import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseFlag(args, flag, fallback = "") {
  const index = args.findIndex((arg) => arg === flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const projectDir = path.resolve(__dirname, "..");
  const sourceDir = path.resolve(
    projectDir,
    parseFlag(process.argv.slice(2), "--source", "./private-charts"),
  );

  await mkdir(sourceDir, { recursive: true });

  const result = spawnSync(
    process.execPath,
    [path.join(projectDir, "scripts", "sync-charts.mjs"), "--source", sourceDir],
    {
      cwd: projectDir,
      stdio: "inherit",
      env: process.env,
    },
  );

  if (result.status !== 0) {
    process.exitCode = result.status || 1;
    return;
  }

  console.log("");
  console.log(`Songbook reset to source: ${sourceDir}`);
  console.log("Add charts there, then run validate/sync again whenever you want to refresh the site.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
