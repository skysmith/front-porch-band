import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseChart, slugify } from "./lib/chart-utils.mjs";

function parseFlag(args, flag, fallback = "") {
  const index = args.findIndex((arg) => arg === flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function parseIssueSuggestion(text = "") {
  const clean = text.replace(/\r/g, "");
  const hasMarker = clean.includes("<!-- front-porch-band:suggestion -->");
  const title = clean.match(/^Title:\s*(.+)$/m)?.[1]?.trim() || "Untitled suggestion";
  const artist = clean.match(/^Artist:\s*(.+)$/m)?.[1]?.trim() || "Unknown artist";
  const notes = clean.match(/^Notes:\s*(.+)$/m)?.[1]?.trim() || "";
  const submitted = clean.match(/^Submitted:\s*(.+)$/m)?.[1]?.trim() || "";
  const chartBody =
    clean.match(/```text\n([\s\S]*?)\n```/)?.[1]?.trim() ||
    clean.match(/```\n([\s\S]*?)\n```/)?.[1]?.trim() ||
    "";

  return {
    hasMarker,
    title,
    artist,
    notes,
    submitted,
    body: chartBody,
  };
}

function toSourceChartText(suggestion) {
  const lines = [suggestion.title, "", `Artist: ${suggestion.artist}`];

  if (suggestion.notes) {
    lines.push(`Notes: ${suggestion.notes}`);
  }

  lines.push("", suggestion.body.trim(), "");
  return lines.join("\n");
}

async function readEventIssue(eventPath) {
  const event = JSON.parse(await readFile(eventPath, "utf8"));
  if (!event.issue?.body) {
    throw new Error("Could not find an issue body in the GitHub event payload.");
  }
  return event.issue;
}

async function loadSongs(songsPath) {
  try {
    return JSON.parse(await readFile(songsPath, "utf8"));
  } catch {
    return [];
  }
}

function sortSongs(songs) {
  return songs.sort((left, right) => {
    const titleCompare = left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
    if (titleCompare !== 0) {
      return titleCompare;
    }
    return left.artist.localeCompare(right.artist, undefined, { sensitivity: "base" });
  });
}

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const projectDir = path.resolve(__dirname, "..");
  const argv = process.argv.slice(2);
  const eventPath = path.resolve(projectDir, parseFlag(argv, "--event", process.env.GITHUB_EVENT_PATH || ""));
  if (!eventPath) {
    throw new Error("Pass --event or set GITHUB_EVENT_PATH.");
  }

  const issue = await readEventIssue(eventPath);
  const suggestion = parseIssueSuggestion(issue.body || "");
  if (!suggestion.hasMarker) {
    throw new Error("Issue is not a Front Porch Band suggestion.");
  }
  if (!suggestion.body.trim()) {
    throw new Error("Suggestion issue does not include a chart block.");
  }

  const slug = slugify(suggestion.title);
  const sourceChartText = toSourceChartText(suggestion);
  const parsed = parseChart(sourceChartText);
  const approvedDir = path.join(projectDir, "approved-charts");
  const chartsDir = path.join(projectDir, "charts");
  const dataDir = path.join(projectDir, "data");
  const songsPath = path.join(dataDir, "songs.json");
  const sourcePath = path.join(approvedDir, `${slug}.md`);
  const chartPath = path.join(chartsDir, `${slug}.txt`);

  await mkdir(approvedDir, { recursive: true });
  await mkdir(chartsDir, { recursive: true });
  await mkdir(dataDir, { recursive: true });

  await writeFile(sourcePath, sourceChartText, "utf8");
  await writeFile(chartPath, `${parsed.body}\n`, "utf8");

  const songs = await loadSongs(songsPath);
  const nextSong = {
    slug,
    title: parsed.title,
    artist: parsed.artist,
    key: parsed.key,
    chartPath: `./charts/${slug}.txt`,
    sourcePath: `./approved-charts/${slug}.md`,
  };

  const existingIndex = songs.findIndex((song) => song.slug === slug);
  if (existingIndex >= 0) {
    songs.splice(existingIndex, 1, nextSong);
  } else {
    songs.push(nextSong);
  }

  await writeFile(songsPath, `${JSON.stringify(sortSongs(songs), null, 2)}\n`, "utf8");

  console.log(`Imported approved issue #${issue.number}`);
  console.log(`Title: ${parsed.title}`);
  console.log(`Artist: ${parsed.artist}`);
  console.log(`Slug: ${slug}`);
  console.log(`Source chart: ${sourcePath}`);
  console.log(`Generated chart: ${chartPath}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
