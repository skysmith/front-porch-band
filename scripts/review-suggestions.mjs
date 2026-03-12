import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseChart, slugify } from "./lib/chart-utils.mjs";

function parseFlag(args, flag, fallback = "") {
  const index = args.findIndex((arg) => arg === flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function resolveReviewOptions(projectDir, argv = process.argv.slice(2), env = process.env) {
  return {
    command: argv[0] || "list",
    target: argv[1] || "",
    suggestionsDir: path.resolve(
      projectDir,
      parseFlag(argv, "--suggestions", env.FRONT_PORCH_SUGGESTIONS_DIR || "./private-build/suggestions"),
    ),
    chartsDir: path.resolve(
      projectDir,
      parseFlag(argv, "--charts", env.FRONT_PORCH_CHARTS_DIR || "./private-charts"),
    ),
    archiveDir: path.resolve(
      projectDir,
      parseFlag(argv, "--archive", env.FRONT_PORCH_SUGGESTIONS_ARCHIVE || "./private-build/suggestions-archive"),
    ),
  };
}

async function listSuggestionFiles(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function parseSuggestion(text) {
  const lines = text.replace(/\r/g, "").split("\n");
  const header = new Map();
  let bodyIndex = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      bodyIndex = index + 1;
      break;
    }

    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) {
      bodyIndex = index;
      break;
    }
    header.set(match[1].trim().toLowerCase(), match[2].trim());
  }

  const body = lines.slice(bodyIndex).join("\n").trim();

  return {
    title: header.get("title") || "Untitled suggestion",
    artist: header.get("artist") || "Unknown artist",
    notes: header.get("notes") || "",
    submitted: header.get("submitted") || "",
    source: header.get("source") || "",
    body,
  };
}

function toChartText(suggestion) {
  return `${suggestion.title}\n\nArtist: ${suggestion.artist}\n\n${suggestion.body.trim()}\n`;
}

function chartDestination(chartsDir, suggestion) {
  return path.join(chartsDir, `${slugify(suggestion.title)}.md`);
}

async function showSuggestion(filePath) {
  const text = await readFile(filePath, "utf8");
  const suggestion = parseSuggestion(text);
  console.log(`Title: ${suggestion.title}`);
  console.log(`Artist: ${suggestion.artist}`);
  if (suggestion.submitted) console.log(`Submitted: ${suggestion.submitted}`);
  if (suggestion.notes) console.log(`Notes: ${suggestion.notes}`);
  if (suggestion.source) console.log(`Source: ${suggestion.source}`);
  console.log("");
  console.log(suggestion.body);
}

async function approveSuggestion(filePath, chartsDir, archiveDir) {
  const text = await readFile(filePath, "utf8");
  const suggestion = parseSuggestion(text);
  const chartText = toChartText(suggestion);
  const destination = chartDestination(chartsDir, suggestion);
  const parsed = parseChart(chartText);

  await mkdir(path.dirname(destination), { recursive: true });
  await mkdir(archiveDir, { recursive: true });
  await writeFile(destination, chartText, "utf8");

  const archivedPath = path.join(archiveDir, path.basename(filePath));
  await rename(filePath, archivedPath);

  return { suggestion, destination, archivedPath, parsed };
}

async function rejectSuggestion(filePath, archiveDir) {
  await mkdir(archiveDir, { recursive: true });
  const archivedPath = path.join(archiveDir, path.basename(filePath));
  await rename(filePath, archivedPath);
  return archivedPath;
}

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const projectDir = path.resolve(__dirname, "..");
  const options = resolveReviewOptions(projectDir);
  const files = await listSuggestionFiles(options.suggestionsDir);

  if (options.command === "list") {
    if (!files.length) {
      console.log(`No pending suggestions in ${options.suggestionsDir}`);
      return;
    }
    files.forEach((file, index) => console.log(`${index + 1}. ${file}`));
    return;
  }

  if (!options.target) {
    throw new Error("Pick a suggestion filename after the command.");
  }

  const filePath = path.join(options.suggestionsDir, options.target);

  if (options.command === "show") {
    await showSuggestion(filePath);
    return;
  }

  if (options.command === "approve") {
    const result = await approveSuggestion(filePath, options.chartsDir, options.archiveDir);
    console.log(`Approved: ${result.suggestion.artist} :: ${result.suggestion.title}`);
    console.log(`Chart: ${result.destination}`);
    console.log(`Archived suggestion: ${result.archivedPath}`);
    return;
  }

  if (options.command === "reject") {
    const archivedPath = await rejectSuggestion(filePath, options.archiveDir);
    console.log(`Archived without import: ${archivedPath}`);
    return;
  }

  throw new Error(`Unknown command: ${options.command}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
