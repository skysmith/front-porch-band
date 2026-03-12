import path from "node:path";
import { fileURLToPath } from "node:url";
import { importInbox, resolveImportOptions } from "./lib/import-utils.mjs";

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const projectDir = path.resolve(__dirname, "..");
  const options = resolveImportOptions(projectDir);
  const result = await importInbox(options);

  if (!result.processed.length) {
    console.log(`No import files found in ${options.inboxDir}`);
    return;
  }

  console.log(`Imported ${result.processed.length} files from ${options.inboxDir}`);
  console.log(`Charts directory: ${options.chartsDir}`);
  console.log(`Archive batch: ${result.archiveBatchDir}`);
  for (const item of result.processed) {
    console.log(`${item.artist} :: ${item.title}`);
    console.log(`  -> ${item.destination}`);
    console.log(`  archived -> ${item.archived}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
