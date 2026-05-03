const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

function slugify(input) {
  return String(input || "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function runNodeScript(projectDir, scriptName, args = []) {
  await execFileAsync(process.execPath, [path.join(projectDir, "scripts", scriptName), ...args], {
    cwd: projectDir,
  });
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Use POST." });
    return;
  }

  if (process.env.VERCEL) {
    res.status(501).json({ error: "Song import is only available in a writable local workspace." });
    return;
  }

  const title = String(req.body?.title || "").trim();
  const artist = String(req.body?.artist || "").trim();
  const body = String(req.body?.body || "").trim();
  const source = String(req.body?.source || "").trim();

  if (!title || !artist || !body) {
    res.status(400).json({ error: "Missing title, artist, or chart body." });
    return;
  }

  const projectDir = process.cwd();
  const chartsDir = path.join(projectDir, "private-charts");
  const slug = slugify(title);
  const destination = path.join(chartsDir, `${slug}.md`);

  try {
    await fs.access(destination);
    res.status(409).json({
      error: "A chart with that title already exists in your library.",
      slug,
      chartPath: `./charts/${slug}.txt`,
    });
    return;
  } catch {}

  const chartText = `${title}

Artist: ${artist}
Source: ${source || "Imported from American Songbag"}

${body}
`;

  try {
    await fs.mkdir(chartsDir, { recursive: true });
    await fs.writeFile(destination, chartText, "utf8");
    await runNodeScript(projectDir, "build-merged-source.mjs");
    await runNodeScript(projectDir, "sync-charts.mjs", ["--source", "./private-build/merged-songbook-source"]);

    res.status(200).json({
      ok: true,
      message: "Imported into your library.",
      song: {
        slug,
        title,
        artist,
        key: "",
        chartPath: `./charts/${slug}.txt`,
        sourcePath: `../charts/${path.basename(destination)}`,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Could not import that song yet.",
      detail: error.message,
    });
  }
};
