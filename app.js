import { getInstrumentChoices, getInstrumentLabel, renderChordCards } from "./chord-diagrams.js";

const listNode = document.querySelector("#song-list");
const titleNode = document.querySelector("#song-title");
const artistNode = document.querySelector("#song-artist");
const kickerNode = document.querySelector("#song-kicker");
const chartNode = document.querySelector("#chart-body");
const searchNode = document.querySelector("#song-search");
const fontUpNode = document.querySelector("#font-up");
const fontDownNode = document.querySelector("#font-down");
const transposeSelectNode = document.querySelector("#transpose-select");
const resetTransposeNode = document.querySelector("#reset-transpose");
const toggleRailNode = document.querySelector("#toggle-rail");
const showRailNode = document.querySelector("#show-rail");
const qrImageNode = document.querySelector("#qr-image");
const pageShellNode = document.querySelector(".page-shell");
const chordGridNode = document.querySelector("#chord-grid");
const instrumentSelectNode = document.querySelector("#instrument-select");
const chordHelperMetaNode = document.querySelector("#chord-helper-meta");
const chordHelperCountNode = document.querySelector("#chord-helper-count");

const FONT_KEY = "front-porch-band-font-scale";
const RAIL_KEY = "front-porch-band-rail-collapsed";
const INSTRUMENT_KEY = "front-porch-band-instrument";
const TRANSPOSE_KEY = "front-porch-band-transpose";
const DEFAULT_FONT_SIZE = 1;
const FONT_STEP = 0.08;
const MIN_FONT_SIZE = 0.84;
const MAX_FONT_SIZE = 1.48;
const NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const NOTE_INDEX = {
  C: 0,
  "B#": 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  F: 5,
  "E#": 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};

let songs = [];
let currentSlug = "";
let currentChartText = "";
let currentRawChartText = "";
let currentSong = null;

function currentShareUrl() {
  return window.location.href;
}

function updateQrCode() {
  const shareUrl = currentShareUrl();
  qrImageNode.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(shareUrl)}`;
}

function slugFromLocation() {
  return window.location.hash.replace(/^#/, "");
}

function setFontScale(nextScale) {
  const clamped = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, nextScale));
  document.documentElement.style.setProperty("--chart-size", `${clamped}rem`);
  window.localStorage.setItem(FONT_KEY, String(clamped));
}

function restoreFontScale() {
  const saved = Number(window.localStorage.getItem(FONT_KEY));
  setFontScale(Number.isFinite(saved) && saved > 0 ? saved : DEFAULT_FONT_SIZE);
}

function setRailCollapsed(collapsed) {
  pageShellNode.classList.toggle("rail-collapsed", collapsed);
  toggleRailNode.textContent = collapsed ? "Show songs" : "Hide songs";
  toggleRailNode.setAttribute("aria-label", collapsed ? "Show song list" : "Collapse song list");
  showRailNode.setAttribute("aria-hidden", collapsed ? "false" : "true");
  window.localStorage.setItem(RAIL_KEY, collapsed ? "1" : "0");
}

function restoreRailState() {
  setRailCollapsed(window.localStorage.getItem(RAIL_KEY) === "1");
}

function currentInstrument() {
  return instrumentSelectNode.value || window.localStorage.getItem(INSTRUMENT_KEY) || "guitar";
}

function parseChordToken(token) {
  const match = token.match(/^([A-G](?:#|b)?)(.*)$/);
  if (!match) {
    return null;
  }

  return {
    root: match[1],
    suffix: match[2] || "",
  };
}

function transposeRoot(root, steps) {
  const index = NOTE_INDEX[root];
  if (index === undefined) {
    return root;
  }
  return NOTE_NAMES[(index + steps + 120) % 12];
}

function transposeChordToken(token, steps) {
  if (!steps) {
    return token;
  }

  const [main, bass] = token.split("/");
  const parsedMain = parseChordToken(main);
  if (!parsedMain) {
    return token;
  }

  const nextMain = `${transposeRoot(parsedMain.root, steps)}${parsedMain.suffix}`;
  if (!bass) {
    return nextMain;
  }

  const parsedBass = parseChordToken(bass);
  if (!parsedBass) {
    return nextMain;
  }

  return `${nextMain}/${transposeRoot(parsedBass.root, steps)}`;
}

function extractBaseKey(song, rawText) {
  const fromSong = song?.key?.match(/^([A-G](?:#|b)?)/)?.[1];
  if (fromSong) {
    return fromSong;
  }

  const fromChart = rawText.match(/\b([A-G](?:#|b)?)(?:\/[A-G](?:#|b)?)?(?:maj7|m7|sus2|sus4|m|6|7)?\b/);
  return fromChart?.[1] || "";
}

function currentTransposeTarget() {
  return transposeSelectNode.value || "original";
}

function isInstrumentTranspose(target = currentTransposeTarget()) {
  return ["bb-instrument", "eb-instrument", "f-instrument"].includes(target);
}

function resolveTransposeTarget(baseKey, target) {
  if (!baseKey || target === "original") {
    return { key: "", label: "" };
  }

  if (target === "bb-instrument") {
    return { key: transposeRoot(baseKey, 2), label: "Bb inst" };
  }

  if (target === "eb-instrument") {
    return { key: transposeRoot(baseKey, 9), label: "Eb inst" };
  }

  if (target === "f-instrument") {
    return { key: transposeRoot(baseKey, 7), label: "F inst" };
  }

  return { key: target, label: "" };
}

function transposeStepsForSong(song, rawText) {
  const target = currentTransposeTarget();
  const baseKey = extractBaseKey(song, rawText);
  if (!baseKey || target === "original") {
    return 0;
  }

  const baseIndex = NOTE_INDEX[baseKey];
  const resolvedTarget = resolveTransposeTarget(baseKey, target).key;
  const targetIndex = NOTE_INDEX[resolvedTarget];
  if (baseIndex === undefined || targetIndex === undefined) {
    return 0;
  }

  return targetIndex - baseIndex;
}

function transposeChartText(text, steps) {
  if (!steps) {
    return text;
  }

  return text.replace(/\b[A-G](?:#|b)?(?:\/[A-G](?:#|b)?)?(?:maj7|m7|sus2|sus4|m|6|7)?\b/g, (token) =>
    transposeChordToken(token, steps),
  );
}

function renderTransposeChoices(song, rawText) {
  const baseKey = extractBaseKey(song, rawText);
  const saved = window.localStorage.getItem(TRANSPOSE_KEY) || "original";
  const fragment = document.createDocumentFragment();

  const original = document.createElement("option");
  original.value = "original";
  original.textContent = baseKey ? `Orig (${baseKey})` : "Original";
  fragment.append(original);

  for (const shortcut of [
    { value: "bb-instrument", label: "Bb instrument" },
    { value: "eb-instrument", label: "Eb instrument" },
    { value: "f-instrument", label: "F instrument" },
  ]) {
    const option = document.createElement("option");
    option.value = shortcut.value;
    option.textContent = shortcut.label;
    fragment.append(option);
  }

  for (const note of NOTE_NAMES) {
    const option = document.createElement("option");
    option.value = note;
    option.textContent = note;
    fragment.append(option);
  }

  transposeSelectNode.replaceChildren(fragment);
  transposeSelectNode.disabled = !baseKey;
  transposeSelectNode.value = baseKey && saved !== "original" ? saved : "original";
  resetTransposeNode.disabled = transposeSelectNode.value === "original";
  transposeSelectNode.classList.toggle("instrument-target", isInstrumentTranspose(transposeSelectNode.value));
}

function renderInstrumentChoices() {
  const choices = getInstrumentChoices();
  const preferred = window.localStorage.getItem(INSTRUMENT_KEY) || "guitar";
  const fragment = document.createDocumentFragment();

  choices.forEach((choice) => {
    const option = document.createElement("option");
    option.value = choice.id;
    option.textContent = choice.label;
    option.selected = choice.id === preferred;
    fragment.append(option);
  });

  instrumentSelectNode.replaceChildren(fragment);
}

function updateChordHelper() {
  const instrumentId = currentInstrument();
  const count = renderChordCards(chordGridNode, currentChartText, instrumentId);
  chordHelperMetaNode.textContent = getInstrumentLabel(instrumentId);
  chordHelperCountNode.textContent = count
    ? `${count} chord shape${count === 1 ? "" : "s"} for this song.`
    : `No saved ${getInstrumentLabel(instrumentId).toLowerCase()} shapes for this chart yet.`;
}

function renderCurrentChart() {
  const steps = transposeStepsForSong(currentSong, currentRawChartText);
  currentChartText = transposeChartText(currentRawChartText, steps);
  chartNode.textContent = currentChartText;

  const baseKey = extractBaseKey(currentSong, currentRawChartText);
  const target = currentTransposeTarget();
  const resolvedTarget = resolveTransposeTarget(baseKey, target);
  resetTransposeNode.disabled = target === "original";
  transposeSelectNode.classList.toggle("instrument-target", isInstrumentTranspose(target));
  if (baseKey && target !== "original") {
    kickerNode.textContent = resolvedTarget.label
      ? `Key: ${baseKey} -> ${resolvedTarget.key} (${resolvedTarget.label})`
      : `Key: ${baseKey} -> ${resolvedTarget.key}`;
  } else if (baseKey) {
    kickerNode.textContent = `Key: ${baseKey}`;
  } else {
    kickerNode.textContent = "Chord chart";
  }

  updateChordHelper();
}

function createSongLink(song) {
  const link = document.createElement("a");
  link.className = "song-link";
  link.href = `#${song.slug}`;
  link.dataset.slug = song.slug;

  const title = document.createElement("span");
  title.className = "song-link-title";
  title.textContent = song.title;

  link.append(title);
  return link;
}

function renderSongList(filter = "") {
  const normalized = filter.trim().toLowerCase();
  const fragment = document.createDocumentFragment();
  const filteredSongs = songs.filter((song) => {
    if (!normalized) {
      return true;
    }

    return `${song.title} ${song.artist}`.toLowerCase().includes(normalized);
  });

  const groups = new Map();
  filteredSongs.forEach((song) => {
    const key = song.artist || "Unknown";
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(song);
  });

  for (const [artist, artistSongs] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const group = document.createElement("details");
    group.className = "artist-group";
    group.open = Boolean(normalized) || artistSongs.some((song) => song.slug === currentSlug);

    const summary = document.createElement("summary");
    summary.className = "artist-summary";

    const name = document.createElement("span");
    name.className = "artist-name";
    name.textContent = artist;

    const count = document.createElement("span");
    count.className = "artist-count";
    count.textContent = `${artistSongs.length}`;

    summary.append(name, count);

    const songWrap = document.createElement("div");
    songWrap.className = "artist-songs";
    artistSongs
      .sort((a, b) => a.title.localeCompare(b.title))
      .forEach((song) => {
        songWrap.append(createSongLink(song));
      });

    group.append(summary, songWrap);
    fragment.append(group);
  }

  listNode.replaceChildren(fragment);
  updateActiveLink();
}

function updateActiveLink() {
  for (const link of listNode.querySelectorAll(".song-link")) {
    link.classList.toggle("active", link.dataset.slug === currentSlug);
  }
}

async function loadSong(song) {
  currentSong = song;
  currentSlug = song.slug;
  updateActiveLink();

  titleNode.textContent = song.title;
  artistNode.textContent = song.artist;
  chartNode.textContent = "Loading chart...";

  const response = await fetch(song.chartPath);
  if (!response.ok) {
    chartNode.textContent = `Could not load ${song.title}.`;
    currentChartText = "";
    currentRawChartText = "";
    renderTransposeChoices(song, "");
    updateChordHelper();
    updateQrCode();
    return;
  }

  currentRawChartText = await response.text();
  renderTransposeChoices(song, currentRawChartText);
  renderCurrentChart();
  updateQrCode();
}

async function selectSongBySlug(slug) {
  const fallback = songs[0];
  const match = songs.find((song) => song.slug === slug) || fallback;

  if (!match) {
    titleNode.textContent = "No charts yet";
    artistNode.textContent = "Add charts to ../charts and run the sync script.";
    chartNode.textContent = "";
    return;
  }

  if (window.location.hash !== `#${match.slug}`) {
    window.location.hash = match.slug;
    return;
  }

  await loadSong(match);
}

async function bootstrap() {
  restoreFontScale();
  restoreRailState();
  renderInstrumentChoices();

  const response = await fetch("./data/songs.json");
  songs = await response.json();

  renderSongList();
  await selectSongBySlug(slugFromLocation());
}

searchNode.addEventListener("input", () => {
  renderSongList(searchNode.value);
});

window.addEventListener("hashchange", () => {
  selectSongBySlug(slugFromLocation());
});

instrumentSelectNode.addEventListener("change", () => {
  window.localStorage.setItem(INSTRUMENT_KEY, instrumentSelectNode.value);
  updateChordHelper();
});

transposeSelectNode.addEventListener("change", () => {
  window.localStorage.setItem(TRANSPOSE_KEY, transposeSelectNode.value);
  transposeSelectNode.classList.toggle("instrument-target", isInstrumentTranspose(transposeSelectNode.value));
  renderCurrentChart();
});

resetTransposeNode.addEventListener("click", () => {
  transposeSelectNode.value = "original";
  window.localStorage.setItem(TRANSPOSE_KEY, "original");
  renderCurrentChart();
});

fontUpNode.addEventListener("click", () => {
  const current = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--chart-size"));
  setFontScale(current + FONT_STEP);
});

fontDownNode.addEventListener("click", () => {
  const current = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--chart-size"));
  setFontScale(current - FONT_STEP);
});

toggleRailNode.addEventListener("click", () => {
  setRailCollapsed(!pageShellNode.classList.contains("rail-collapsed"));
});

showRailNode.addEventListener("click", () => {
  setRailCollapsed(false);
});

bootstrap().catch((error) => {
  titleNode.textContent = "Front Porch Band";
  artistNode.textContent = "Could not load chart index.";
  chartNode.textContent = String(error);
  updateQrCode();
});
