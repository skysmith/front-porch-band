import { access, readdir } from "node:fs/promises";
import path from "node:path";

export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function listMarkdownFiles(dir, prefix = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const relPath = prefix ? path.join(prefix, entry.name) : entry.name;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(fullPath, relPath)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(relPath);
    }
  }

  return files;
}

export function parseChart(fileText) {
  const lines = fileText.split(/\r?\n/);
  const title = lines[0]?.trim() ?? "";
  const artistLine = lines.find((line) => line.startsWith("Artist:")) ?? "";
  const artist = artistLine.replace(/^Artist:\s*/, "").trim();
  const artistIndex = lines.findIndex((line) => line.startsWith("Artist:"));
  let bodyStart = -1;

  if (artistIndex >= 0) {
    for (let index = artistIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line.trim()) {
        continue;
      }
      if (/^[A-Za-z][A-Za-z0-9 _-]*:\s*/.test(line)) {
        continue;
      }
      bodyStart = index;
      break;
    }
  }

  const body = bodyStart >= 0 ? lines.slice(bodyStart).join("\n").trimEnd() : "";
  const keyMatch = body.match(/\b([A-G][#b]?(?:m|maj7|m7|7|sus2|sus4|6)?)\b/);

  return {
    title,
    artist,
    body,
    key: keyMatch?.[1] ?? "",
  };
}

export function validateChart(fileText) {
  const parsed = parseChart(fileText);
  const errors = [];
  const warnings = [];

  if (!parsed.title) {
    errors.push("Missing title on line 1.");
  }

  if (!fileText.includes("Artist:")) {
    errors.push("Missing `Artist:` line.");
  } else if (!parsed.artist) {
    errors.push("Artist line is present but empty.");
  }

  if (!parsed.body.trim()) {
    errors.push("Missing chart body after the artist header.");
  }

  if (parsed.body && !/\b[A-G](?:#|b)?(?:\/[A-G](?:#|b)?)?(?:maj7|m7|sus2|sus4|m|6|7)?\b/.test(parsed.body)) {
    warnings.push("No chord tokens detected in the chart body.");
  }

  if (parsed.title && parsed.title.startsWith("#")) {
    warnings.push("Title still starts with `#`; prefer plain text for line 1.");
  }

  return { parsed, errors, warnings };
}

export function resolveSourceDir(projectDir, argv = process.argv.slice(2), env = process.env) {
  const sourceArgIndex = argv.findIndex((arg) => arg === "--source");
  if (sourceArgIndex >= 0 && argv[sourceArgIndex + 1]) {
    return path.resolve(projectDir, argv[sourceArgIndex + 1]);
  }

  if (env.FRONT_PORCH_CHARTS_DIR) {
    return path.resolve(projectDir, env.FRONT_PORCH_CHARTS_DIR);
  }

  return path.resolve(projectDir, "./private-charts");
}

export async function resolveSourceDirWithFallback(projectDir, argv = process.argv.slice(2), env = process.env) {
  const sourceArgIndex = argv.findIndex((arg) => arg === "--source");
  if (sourceArgIndex >= 0 && argv[sourceArgIndex + 1]) {
    return path.resolve(projectDir, argv[sourceArgIndex + 1]);
  }

  if (env.FRONT_PORCH_CHARTS_DIR) {
    return path.resolve(projectDir, env.FRONT_PORCH_CHARTS_DIR);
  }

  const repoLocal = path.resolve(projectDir, "./private-charts");
  try {
    await access(repoLocal);
    return repoLocal;
  } catch {
    return path.resolve(projectDir, "..", "charts");
  }
}
