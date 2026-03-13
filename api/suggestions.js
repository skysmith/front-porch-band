const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");

function slugify(input) {
  return String(input || "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function pickReviewDir() {
  if (process.env.FRONT_PORCH_SUGGESTIONS_DIR) {
    return {
      dir: process.env.FRONT_PORCH_SUGGESTIONS_DIR,
      storage: "durable",
    };
  }

  if (!process.env.VERCEL) {
    return {
      dir: path.join(process.cwd(), "private-build", "suggestions"),
      storage: "durable",
    };
  }

  return {
    dir: path.join(os.tmpdir(), "front-porch-band-suggestions"),
    storage: "ephemeral",
  };
}

function getGitHubConfig() {
  const repo = String(
    process.env.FRONT_PORCH_GITHUB_REPO || process.env.GITHUB_REPOSITORY || "",
  ).trim();
  const token = String(
    process.env.FRONT_PORCH_GITHUB_TOKEN || process.env.GITHUB_TOKEN || "",
  ).trim();

  if (!repo || !token || !repo.includes("/")) {
    return null;
  }

  const [owner, name] = repo.split("/", 2);
  const labels = String(process.env.FRONT_PORCH_GITHUB_LABELS || "song-suggestion")
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean);

  return { owner, repo: name, token, labels };
}

function issueTitle({ title, artist }) {
  const cleanTitle = title || "Untitled song";
  const cleanArtist = artist || "Unknown artist";
  return `Song suggestion: ${cleanTitle} - ${cleanArtist}`;
}

function issueBody({ title, artist, body, submittedAt }) {
  return [
    "<!-- front-porch-band:suggestion -->",
    `Title: ${title || "Unknown title"}`,
    `Artist: ${artist || "Unknown artist"}`,
    `Submitted: ${submittedAt}`,
    "",
    "```text",
    body.trim(),
    "```",
    "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function createGitHubIssue(config, suggestion) {
  const response = await fetch(
    `https://api.github.com/repos/${config.owner}/${config.repo}/issues`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "front-porch-band",
      },
      body: JSON.stringify({
        title: issueTitle(suggestion),
        body: issueBody(suggestion),
        labels: config.labels,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub issue create failed (${response.status}): ${text}`);
  }

  return response.json();
}

function toMarkdown({ title, artist, body, submittedAt }) {
  return [
    `Title: ${title || "Unknown title"}`,
    `Artist: ${artist || "Unknown artist"}`,
    `Submitted: ${submittedAt}`,
    "",
    body.trim(),
    "",
  ]
    .filter(Boolean)
    .join("\n");
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Use POST." });
    return;
  }

  const title = String(req.body?.title || "").trim();
  const artist = String(req.body?.artist || "").trim();
  const body = String(req.body?.body || "").trim();
  const company = String(req.body?.company || "").trim();
  const startedAt = String(req.body?.startedAt || "").trim();

  if (company) {
    res.status(200).json({ ok: true, storage: "discarded", message: "Sent to the review inbox." });
    return;
  }

  if (!body || body.length < 24) {
    res.status(400).json({ error: "Paste a little more of the chart before sending it in." });
    return;
  }

  if (body.length > 20000) {
    res.status(400).json({ error: "That suggestion is too large for one paste. Trim it a bit and try again." });
    return;
  }

  const submittedAt = new Date().toISOString();
  const startedMs = Date.parse(startedAt);
  const submittedMs = Date.parse(submittedAt);
  if (!Number.isFinite(startedMs) || submittedMs - startedMs < 2500 || submittedMs - startedMs > 1000 * 60 * 60 * 24) {
    res.status(400).json({ error: "That submission looked incomplete. Give it another try." });
    return;
  }

  const suggestion = {
    title,
    artist,
    body,
    submittedAt,
  };

  const github = getGitHubConfig();
  if (github) {
    try {
      const issue = await createGitHubIssue(github, suggestion);
      res.status(200).json({
        ok: true,
        storage: "github-issues",
        message: "Sent to the review inbox.",
        issueNumber: issue.number,
        issueUrl: issue.html_url,
      });
      return;
    } catch (error) {
      res.status(502).json({
        error: "Could not send that suggestion to GitHub yet.",
        detail: error.message,
      });
      return;
    }
  }

  const { dir, storage } = pickReviewDir();
  const stamp = submittedAt.replaceAll(":", "-");
  const label = [artist, title].filter(Boolean).join(" - ") || "song-suggestion";
  const filename = `${stamp}-${slugify(label) || "song-suggestion"}.md`;
  const content = toMarkdown(suggestion);

  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), content, "utf8");

    res.status(200).json({
      ok: true,
      storage,
      message:
        storage === "ephemeral"
          ? "Saved to the review inbox for now. Add GitHub issue env vars or a durable suggestions directory later."
          : "Saved to the local review inbox.",
    });
  } catch {
    res.status(500).json({ error: "Could not save that suggestion yet." });
  }
};
