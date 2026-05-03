import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const CHORD_TOKEN_PATTERN = /\b[A-G](?:[#b])?(?:\/[A-G](?:[#b])?)?(?:maj7|m7|sus2|sus4|m|6|7)?\*{0,2}\b/g;

function normalizeSortKey(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function artistAliasesForSong(song) {
  const parts = String(song.artist || "Unknown")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);

  return [...new Set(parts.length ? parts : ["Unknown"])];
}

function libraryIdForSong(song) {
  return song?.slug?.startsWith("american-songbag-") ? "american-songbag" : "front-porch";
}

function coerceShape(shape) {
  return {
    frets: (shape.frets || []).map((value) => String(value)),
    fingers: Array.isArray(shape.fingers) ? shape.fingers : [],
    baseFret: shape.baseFret || 1,
    aliasOf: shape.aliasOf || "",
    barre: shape.barre
      ? {
          fret: shape.barre.fret,
          fromString: shape.barre.fromString,
          toString: shape.barre.toString,
        }
      : null,
  };
}

async function loadChordLibraryData(projectDir) {
  const sourcePath = path.join(projectDir, "chord-library.js");
  const source = await readFile(sourcePath, "utf8");
  const transformed = `${source
    .replace("export const CHORD_LIBRARY =", "const CHORD_LIBRARY =")
    .replace("export const CHORD_ALIASES =", "const CHORD_ALIASES =")}
module.exports = { CHORD_LIBRARY, CHORD_ALIASES };
`;

  const sandbox = { module: { exports: {} }, exports: {} };
  vm.runInNewContext(transformed, sandbox, { filename: sourcePath });

  const { CHORD_LIBRARY, CHORD_ALIASES } = sandbox.module.exports;
  const instruments = Object.fromEntries(
    Object.entries(CHORD_LIBRARY).map(([id, instrument]) => [
      id,
      {
        id,
        label: instrument.label,
        strings: instrument.strings,
        shapes: Object.fromEntries(
          Object.entries(instrument.shapes || {}).map(([name, shape]) => [name, coerceShape(shape)]),
        ),
      },
    ]),
  );

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    instruments,
    aliases: CHORD_ALIASES,
  };
}

function extractChordTokens(chartText, chordAliases) {
  const seen = new Set();
  const matches = chartText.match(CHORD_TOKEN_PATTERN) || [];

  return matches
    .map((match) => chordAliases[match] || match)
    .filter((match) => {
      if (seen.has(match)) {
        return false;
      }
      seen.add(match);
      return true;
    });
}

export async function exportTvOSResources(projectDir, songs = null) {
  const dataDir = path.join(projectDir, "data");
  const resourcesDir = path.join(projectDir, "tvos", "Resources");
  const catalogSongs =
    songs ||
    JSON.parse(await readFile(path.join(dataDir, "songs.json"), "utf8"));
  const chordLibrary = await loadChordLibraryData(projectDir);

  const exportedSongs = [];
  for (const song of catalogSongs) {
    const chartPath = path.join(projectDir, song.chartPath.replace(/^\.\//, ""));
    const chartText = await readFile(chartPath, "utf8");

    exportedSongs.push({
      slug: song.slug,
      title: song.title,
      artist: song.artist,
      artistAliases: artistAliasesForSong(song),
      libraryId: libraryIdForSong(song),
      baseKey: song.key || "",
      hasChords: Boolean(song.hasChords),
      chartText: chartText.trimEnd(),
      chordTokens: extractChordTokens(chartText, chordLibrary.aliases),
      sortTitle: normalizeSortKey(song.title),
      sortArtist: normalizeSortKey(song.artist),
      spotifyTrackID: song.spotifyTrackId || null,
      spotifyURLString: song.spotifyUrl || null,
    });
  }

  const songCatalog = {
    version: 1,
    generatedAt: new Date().toISOString(),
    songs: exportedSongs,
  };

  await mkdir(resourcesDir, { recursive: true });
  await writeFile(path.join(resourcesDir, "SongCatalog.json"), JSON.stringify(songCatalog, null, 2) + "\n", "utf8");
  await writeFile(path.join(resourcesDir, "ChordLibrary.json"), JSON.stringify(chordLibrary, null, 2) + "\n", "utf8");
}
