import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseChart, slugify } from "./lib/chart-utils.mjs";

function parseFlag(args, flag, fallback = "") {
  const index = args.findIndex((arg) => arg === flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function parseConfig(projectDir, argv = process.argv.slice(2), env = process.env) {
  const repo = String(
    parseFlag(argv, "--repo", env.FRONT_PORCH_GITHUB_REPO || env.GITHUB_REPOSITORY || ""),
  ).trim();
  const token = String(
    parseFlag(argv, "--token", env.FRONT_PORCH_GITHUB_TOKEN || env.GITHUB_TOKEN || ""),
  ).trim();

  return {
    command: argv[0] || "list",
    target: argv[1] || "",
    chartsDir: path.resolve(
      projectDir,
      parseFlag(argv, "--charts", env.FRONT_PORCH_CHARTS_DIR || "./private-charts"),
    ),
    repo,
    token,
    label: parseFlag(argv, "--label", env.FRONT_PORCH_GITHUB_REVIEW_LABEL || "song-suggestion"),
  };
}

function assertConfig(config) {
  if (!config.repo || !config.repo.includes("/")) {
    throw new Error("Set FRONT_PORCH_GITHUB_REPO=owner/repo or pass --repo owner/repo.");
  }

  if (!config.token) {
    throw new Error("Set FRONT_PORCH_GITHUB_TOKEN or GITHUB_TOKEN, or pass --token.");
  }
}

async function githubRequest(config, url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "front-porch-band",
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub request failed (${response.status}): ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function listIssues(config) {
  const url =
    `https://api.github.com/repos/${config.repo}/issues?state=open&labels=${encodeURIComponent(config.label)}&per_page=100`;
  return githubRequest(config, url);
}

async function fetchIssue(config, issueNumber) {
  return githubRequest(config, `https://api.github.com/repos/${config.repo}/issues/${issueNumber}`);
}

async function addComment(config, issueNumber, body) {
  return githubRequest(config, `https://api.github.com/repos/${config.repo}/issues/${issueNumber}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

async function closeIssue(config, issueNumber) {
  return githubRequest(config, `https://api.github.com/repos/${config.repo}/issues/${issueNumber}`, {
    method: "PATCH",
    body: JSON.stringify({ state: "closed" }),
  });
}

function parseIssueSuggestion(text = "") {
  const clean = text.replace(/\r/g, "");
  const title = clean.match(/^Title:\s*(.+)$/m)?.[1]?.trim() || "Untitled suggestion";
  const artist = clean.match(/^Artist:\s*(.+)$/m)?.[1]?.trim() || "Unknown artist";
  const notes = clean.match(/^Notes:\s*(.+)$/m)?.[1]?.trim() || "";
  const submitted = clean.match(/^Submitted:\s*(.+)$/m)?.[1]?.trim() || "";
  const source = clean.match(/^Source:\s*(.+)$/m)?.[1]?.trim() || "";
  const chartBody =
    clean.match(/```text\n([\s\S]*?)\n```/)?.[1]?.trim() ||
    clean.match(/```\n([\s\S]*?)\n```/)?.[1]?.trim() ||
    "";

  return {
    title,
    artist,
    notes,
    submitted,
    source,
    body: chartBody,
  };
}

function toChartText(suggestion) {
  return `${suggestion.title}\n\nArtist: ${suggestion.artist}\n\n${suggestion.body.trim()}\n`;
}

function chartDestination(chartsDir, suggestion) {
  return path.join(chartsDir, `${slugify(suggestion.title)}.md`);
}

async function showIssue(issue) {
  const suggestion = parseIssueSuggestion(issue.body || "");
  console.log(`#${issue.number} ${issue.title}`);
  console.log(`GitHub URL: ${issue.html_url}`);
  console.log(`Title: ${suggestion.title}`);
  console.log(`Artist: ${suggestion.artist}`);
  if (suggestion.submitted) console.log(`Submitted: ${suggestion.submitted}`);
  if (suggestion.notes) console.log(`Notes: ${suggestion.notes}`);
  if (suggestion.source) console.log(`Source: ${suggestion.source}`);
  console.log("");
  console.log(suggestion.body || "(No chart block found)");
}

async function approveIssue(config, issue, chartsDir) {
  const suggestion = parseIssueSuggestion(issue.body || "");
  if (!suggestion.body.trim()) {
    throw new Error("This issue does not contain a chart block.");
  }

  const chartText = toChartText(suggestion);
  const destination = chartDestination(chartsDir, suggestion);
  parseChart(chartText);

  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, chartText, "utf8");

  await addComment(
    config,
    issue.number,
    `Approved into the chart library at \`${path.relative(process.cwd(), destination)}\`.`,
  );
  await closeIssue(config, issue.number);

  return { suggestion, destination };
}

async function rejectIssue(config, issue, reason = "") {
  const comment = reason
    ? `Not importing this one right now.\n\nReason: ${reason}`
    : "Closing this suggestion without importing it into the chart library.";
  await addComment(config, issue.number, comment);
  await closeIssue(config, issue.number);
}

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const projectDir = path.resolve(__dirname, "..");
  const config = parseConfig(projectDir);
  assertConfig(config);

  if (config.command === "list") {
    const issues = await listIssues(config);
    if (!issues.length) {
      console.log(`No open suggestion issues with label "${config.label}".`);
      return;
    }
    issues.forEach((issue) => console.log(`#${issue.number} ${issue.title}`));
    return;
  }

  if (!config.target) {
    throw new Error("Pick an issue number after the command.");
  }

  const issueNumber = Number.parseInt(config.target, 10);
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    throw new Error("Issue number must be a positive integer.");
  }

  const issue = await fetchIssue(config, issueNumber);

  if (config.command === "show") {
    await showIssue(issue);
    return;
  }

  if (config.command === "approve") {
    const result = await approveIssue(config, issue, config.chartsDir);
    console.log(`Approved: ${result.suggestion.artist} :: ${result.suggestion.title}`);
    console.log(`Chart: ${result.destination}`);
    console.log(`Closed issue: #${issue.number}`);
    return;
  }

  if (config.command === "reject") {
    const reason = parseFlag(process.argv.slice(2), "--reason", "");
    await rejectIssue(config, issue, reason);
    console.log(`Closed without import: #${issue.number}`);
    return;
  }

  throw new Error(`Unknown command: ${config.command}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
