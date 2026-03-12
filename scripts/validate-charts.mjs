import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listMarkdownFiles, resolveSourceDir, validateChart } from "./lib/chart-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, "..");
const sourceDir = resolveSourceDir(projectDir);

async function main() {
  const entries = await listMarkdownFiles(sourceDir);
  if (!entries.length) {
    console.log(`No chart files found in ${sourceDir}`);
    return;
  }

  let warningCount = 0;
  let errorCount = 0;

  for (const entry of entries) {
    const fullPath = path.join(sourceDir, entry);
    const fileText = await readFile(fullPath, "utf8");
    const result = validateChart(fileText);

    if (!result.errors.length && !result.warnings.length) {
      continue;
    }

    console.log(entry);
    for (const error of result.errors) {
      errorCount += 1;
      console.log(`  error: ${error}`);
    }
    for (const warning of result.warnings) {
      warningCount += 1;
      console.log(`  warning: ${warning}`);
    }
  }

  if (!errorCount && !warningCount) {
    console.log(`Validated ${entries.length} chart(s) in ${sourceDir} with no issues.`);
    return;
  }

  console.log(`Validation finished with ${errorCount} error(s) and ${warningCount} warning(s).`);
  if (errorCount) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
