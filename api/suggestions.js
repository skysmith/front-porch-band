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

function toMarkdown({ title, artist, notes, body, submittedAt, source }) {
  return [
    `Title: ${title || "Unknown title"}`,
    `Artist: ${artist || "Unknown artist"}`,
    `Submitted: ${submittedAt}`,
    `Source: ${source}`,
    notes ? `Notes: ${notes}` : "",
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
  const notes = String(req.body?.notes || "").trim();
  const body = String(req.body?.body || "").trim();

  if (!body || body.length < 24) {
    res.status(400).json({ error: "Paste a little more of the chart before sending it in." });
    return;
  }

  if (body.length > 20000) {
    res.status(400).json({ error: "That suggestion is too large for one paste. Trim it a bit and try again." });
    return;
  }

  const { dir, storage } = pickReviewDir();
  const submittedAt = new Date().toISOString();
  const stamp = submittedAt.replaceAll(":", "-");
  const label = [artist, title].filter(Boolean).join(" - ") || "song-suggestion";
  const filename = `${stamp}-${slugify(label) || "song-suggestion"}.md`;
  const content = toMarkdown({
    title,
    artist,
    notes,
    body,
    submittedAt,
    source: req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown",
  });

  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), content, "utf8");

    res.status(200).json({
      ok: true,
      storage,
      message:
        storage === "ephemeral"
          ? "Saved to the review inbox for now. Add a durable suggestions directory later to keep submissions between deployments."
          : "Saved to the review inbox.",
    });
  } catch (error) {
    res.status(500).json({ error: "Could not save that suggestion yet." });
  }
};
