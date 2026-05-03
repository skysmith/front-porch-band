import { access, cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { slugify } from "./lib/chart-utils.mjs";

function parseFlag(args, flag, fallback = "") {
  const index = args.findIndex((arg) => arg === flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

async function ensureMissing(targetDir) {
  try {
    await access(targetDir);
    throw new Error(`Destination already exists: ${targetDir}`);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const projectDir = path.resolve(__dirname, "..");
  const args = process.argv.slice(2);
  const from = parseFlag(args, "--from");
  const label = parseFlag(args, "--name");
  const into = parseFlag(args, "--into", "./private-charts/from-friends");

  if (!from) {
    throw new Error("Usage: node scripts/merge-library-folder.mjs --from /path/to/friend-library [--name alex]");
  }

  const sourceDir = path.resolve(projectDir, from);
  const baseName = label || path.basename(sourceDir);
  const safeName = slugify(baseName);

  if (!safeName) {
    throw new Error("Could not derive a destination folder name. Pass --name <label>.");
  }

  const importRoot = path.resolve(projectDir, into);
  const destinationDir = path.join(importRoot, safeName);

  await ensureMissing(destinationDir);
  await mkdir(importRoot, { recursive: true });
  await cp(sourceDir, destinationDir, { recursive: true });

  console.log(`Merged library source into: ${destinationDir}`);
  console.log("");
  console.log("Next steps:");
  console.log(`1. Review the copied charts in ${path.relative(projectDir, destinationDir)}`);
  console.log("2. Run: node scripts/validate-charts.mjs --source ./private-charts");
  console.log("3. Run: node scripts/sync-charts.mjs --source ./private-charts");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
