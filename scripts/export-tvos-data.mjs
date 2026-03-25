import path from "node:path";
import { fileURLToPath } from "node:url";
import { exportTvOSResources } from "./lib/tvos-export.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, "..");

exportTvOSResources(projectDir).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
