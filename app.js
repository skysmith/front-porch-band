import { getInstrumentChoices, getInstrumentLabel, renderChordCards } from "./chord-diagrams.js";

const listNode = document.querySelector("#song-list");
const titleNode = document.querySelector("#song-title");
const artistNode = document.querySelector("#song-artist");
const chartNode = document.querySelector("#chart-body");
const searchNode = document.querySelector("#song-search");
const fontUpNode = document.querySelector("#font-up");
const fontDownNode = document.querySelector("#font-down");
const mobileQrToggleNode = document.querySelector("#mobile-qr-toggle");
const transposeSelectNode = document.querySelector("#transpose-select");
const capoSelectNode = document.querySelector("#capo-select");
const customToggleNode = document.querySelector("#custom-toggle");
const customKeyWrapNode = document.querySelector("#custom-key-wrap");
const customKeySelectNode = document.querySelector("#custom-key-select");
const capoHintNode = document.querySelector("#capo-hint");
const resetTransposeNode = document.querySelector("#reset-transpose");
const toggleRailNode = document.querySelector("#toggle-rail");
const showRailNode = document.querySelector("#show-rail");
const qrImageNode = document.querySelector("#qr-image");
const pageShellNode = document.querySelector(".page-shell");
const chordGridNode = document.querySelector("#chord-grid");
const instrumentSelectNode = document.querySelector("#instrument-select");
const chordHelperCountNode = document.querySelector("#chord-helper-count");
const chordHelperNode = document.querySelector("#chord-helper");
const chordShapesNode = document.querySelector("#chord-shapes");
const chartCardNode = document.querySelector(".chart-card");
const homeCardNode = document.querySelector("#home-card");
const suggestionFormNode = document.querySelector("#suggestion-form");
const suggestionTitleNode = document.querySelector("#suggestion-title");
const suggestionArtistNode = document.querySelector("#suggestion-artist");
const suggestionNotesNode = document.querySelector("#suggestion-notes");
const suggestionBodyNode = document.querySelector("#suggestion-body");
const suggestionSubmitNode = document.querySelector("#suggestion-submit");
const suggestionStatusNode = document.querySelector("#suggestion-status");

const FONT_KEY = "front-porch-band-font-scale";
const RAIL_KEY = "front-porch-band-rail-collapsed";
const INSTRUMENT_KEY = "front-porch-band-instrument";
const MOBILE_QR_KEY = "front-porch-band-mobile-qr";
const TRANSPOSE_KEY = "front-porch-band-transpose";
const CUSTOM_OPEN_KEY = "front-porch-band-custom-open";
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
const CAPO_SHAPES = ["G", "C", "D", "A", "E"];

let songs = [];
let currentSlug = "";
let currentChartText = "";
let currentRawChartText = "";
let currentSong = null;

function splitChartSections(text) {
  return text
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((section) => section.trimEnd())
    .filter(Boolean);
}

function shouldUseDesktopColumns(text, sections) {
  if (isMobileLayout()) {
    return false;
  }

  if (window.innerWidth < 1180) {
    return false;
  }

  const lineCount = text.split("\n").length;
  return lineCount >= 46 && sections.length >= 6;
}

function renderChartBlocks(text) {
  const sections = splitChartSections(text);
  const useColumns = shouldUseDesktopColumns(text, sections);
  const fragment = document.createDocumentFragment();

  chartNode.classList.toggle("chart-body-columns", useColumns);

  sections.forEach((section) => {
    const block = document.createElement("pre");
    block.className = "chart-section";
    block.textContent = section;
    fragment.append(block);
  });

  if (!sections.length) {
    chartNode.textContent = text;
    chartNode.classList.remove("chart-body-columns");
    return;
  }

  chartNode.replaceChildren(fragment);
}

function setSuggestionStatus(message, tone = "") {
  if (!suggestionStatusNode) {
    return;
  }

  suggestionStatusNode.textContent = message;
  suggestionStatusNode.dataset.tone = tone;
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 860px)").matches;
}

function updatePageMode() {
  const onHome = !currentSlug;
  pageShellNode.classList.toggle("mobile-home", isMobileLayout() && onHome);
  pageShellNode.classList.toggle("mobile-song", isMobileLayout() && !onHome);
  updateMobileQrState();
}

function isMobileQrEnabled() {
  return window.localStorage.getItem(MOBILE_QR_KEY) === "1";
}

function updateMobileQrState() {
  const enabled = isMobileLayout() && isMobileQrEnabled();
  pageShellNode.classList.toggle("mobile-qr-visible", enabled);

  if (mobileQrToggleNode) {
    mobileQrToggleNode.textContent = enabled ? "QR on" : "QR off";
    mobileQrToggleNode.setAttribute("aria-pressed", enabled ? "true" : "false");
  }
}

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
  if (isMobileLayout()) {
    return;
  }
  pageShellNode.classList.toggle("rail-collapsed", collapsed);
  toggleRailNode.textContent = collapsed ? "Show songs" : "Hide songs";
  toggleRailNode.setAttribute("aria-label", collapsed ? "Show song list" : "Collapse song list");
  showRailNode.setAttribute("aria-hidden", collapsed ? "false" : "true");
  window.localStorage.setItem(RAIL_KEY, collapsed ? "1" : "0");
}

function restoreRailState() {
  if (isMobileLayout()) {
    pageShellNode.classList.remove("rail-collapsed");
    return;
  }
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
  if (capoSelectNode?.value && capoSelectNode.value !== "original") {
    return capoSelectNode.value;
  }

  if (transposeSelectNode?.value && transposeSelectNode.value !== "original") {
    return transposeSelectNode.value;
  }

  if (customKeySelectNode?.value && customKeySelectNode.value !== "original") {
    return customKeySelectNode.value;
  }

  return "original";
}

function isInstrumentTranspose(target = currentTransposeTarget()) {
  return ["bb-instrument", "eb-instrument", "f-instrument"].includes(target);
}

function isCapoTarget(target = currentTransposeTarget()) {
  return target.startsWith("capo:");
}

function capoShapeFromTarget(target = currentTransposeTarget()) {
  return isCapoTarget(target) ? target.split(":")[1] || "" : "";
}

function capoFretForShape(baseKey, shapeKey) {
  const baseIndex = NOTE_INDEX[baseKey];
  const shapeIndex = NOTE_INDEX[shapeKey];
  if (baseIndex === undefined || shapeIndex === undefined) {
    return null;
  }
  return (baseIndex - shapeIndex + 12) % 12;
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

  if (target.startsWith("capo:")) {
    const shapeKey = target.split(":")[1] || "";
    const fret = capoFretForShape(baseKey, shapeKey);
    return {
      key: shapeKey,
      label: fret === null ? "" : `Capo ${fret}`,
      fret,
      shapeKey,
    };
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

function setCustomMode(open) {
  if (!customKeyWrapNode || !customToggleNode) {
    return;
  }

  customKeyWrapNode.hidden = !open;
  customToggleNode.setAttribute("aria-expanded", open ? "true" : "false");
  customToggleNode.classList.toggle("active", open);
  window.localStorage.setItem(CUSTOM_OPEN_KEY, open ? "1" : "0");
}

function restoreCustomMode() {
  setCustomMode(window.localStorage.getItem(CUSTOM_OPEN_KEY) === "1");
}

function renderSimpleTransposeChoices(song, rawText) {
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

  transposeSelectNode.replaceChildren(fragment);
  transposeSelectNode.disabled = !baseKey;
  transposeSelectNode.value = isInstrumentTranspose(saved) ? saved : "original";
  transposeSelectNode.classList.toggle("instrument-target", isInstrumentTranspose(transposeSelectNode.value));
}

function renderCapoChoices(song, rawText) {
  const baseKey = extractBaseKey(song, rawText);
  const saved = window.localStorage.getItem(TRANSPOSE_KEY) || "original";
  const fragment = document.createDocumentFragment();

  const original = document.createElement("option");
  original.value = "original";
  original.textContent = "Original shapes";
  fragment.append(original);

  if (baseKey) {
    CAPO_SHAPES.forEach((shapeKey) => {
      const fret = capoFretForShape(baseKey, shapeKey);
      if (fret === null || fret === 0) {
        return;
      }
      const option = document.createElement("option");
      option.value = `capo:${shapeKey}`;
      option.textContent = `${shapeKey} shapes (capo ${fret})`;
      fragment.append(option);
    });
  }

  capoSelectNode.replaceChildren(fragment);
  capoSelectNode.disabled = !baseKey;
  capoSelectNode.value = isCapoTarget(saved) ? saved : "original";
}

function renderCustomKeyChoices(song, rawText) {
  const baseKey = extractBaseKey(song, rawText);
  const saved = window.localStorage.getItem(TRANSPOSE_KEY) || "original";
  const fragment = document.createDocumentFragment();

  const original = document.createElement("option");
  original.value = "original";
  original.textContent = baseKey ? `Original (${baseKey})` : "Original";
  fragment.append(original);

  for (const note of NOTE_NAMES) {
    const option = document.createElement("option");
    option.value = note;
    option.textContent = note;
    fragment.append(option);
  }

  customKeySelectNode.replaceChildren(fragment);
  customKeySelectNode.disabled = !baseKey;
  customKeySelectNode.value = !isInstrumentTranspose(saved) && !isCapoTarget(saved) ? saved : "original";
}

function renderTransposeChoices(song, rawText) {
  const saved = window.localStorage.getItem(TRANSPOSE_KEY) || "original";
  renderSimpleTransposeChoices(song, rawText);
  renderCapoChoices(song, rawText);
  renderCustomKeyChoices(song, rawText);
  if (!isInstrumentTranspose(saved) && !isCapoTarget(saved) && saved !== "original") {
    setCustomMode(true);
  } else {
    restoreCustomMode();
  }
  resetTransposeNode.disabled = currentTransposeTarget() === "original";
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
  chordHelperCountNode.textContent = count
    ? `${count} chord shape${count === 1 ? "" : "s"} for this song.`
    : `No saved ${getInstrumentLabel(instrumentId).toLowerCase()} shapes for this chart yet.`;
  if (chordShapesNode) {
    chordShapesNode.hidden = !count;
  }
}

function updateCapoHint() {
  if (!capoHintNode) {
    return;
  }

  const target = currentTransposeTarget();
  if (!currentSong || !currentRawChartText || !isCapoTarget(target)) {
    capoHintNode.hidden = true;
    capoHintNode.textContent = "";
    return;
  }

  const baseKey = extractBaseKey(currentSong, currentRawChartText);
  const resolved = resolveTransposeTarget(baseKey, target);
  if (!baseKey || !resolved.shapeKey || resolved.fret === null) {
    capoHintNode.hidden = true;
    capoHintNode.textContent = "";
    return;
  }

  capoHintNode.hidden = false;
  capoHintNode.textContent = `Capo ${resolved.fret}. Play ${resolved.shapeKey} shapes to sound in ${baseKey}.`;
}

function renderCurrentChart() {
  const steps = transposeStepsForSong(currentSong, currentRawChartText);
  currentChartText = transposeChartText(currentRawChartText, steps);
  renderChartBlocks(currentChartText);

  const target = currentTransposeTarget();
  resetTransposeNode.disabled = target === "original";
  transposeSelectNode.classList.toggle("instrument-target", isInstrumentTranspose(target));
  updateCapoHint();
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

function showHome() {
  currentSong = null;
  currentSlug = "";
  currentChartText = "";
  currentRawChartText = "";
  titleNode.textContent = "Front Porch Band";
  artistNode.textContent = "Phone-first charts built for quick jams and easy sharing.";
  chartNode.replaceChildren();
  chartNode.classList.remove("chart-body-columns");
  chordGridNode.replaceChildren();
  chordHelperCountNode.textContent = "Open a song to see transposition and chord shapes.";
  transposeSelectNode.replaceChildren();
  transposeSelectNode.disabled = true;
  capoSelectNode.replaceChildren();
  capoSelectNode.disabled = true;
  customKeySelectNode.replaceChildren();
  customKeySelectNode.disabled = true;
  setCustomMode(false);
  capoHintNode.hidden = true;
  capoHintNode.textContent = "";
  resetTransposeNode.disabled = true;
  chordHelperNode.hidden = true;
  if (chordShapesNode) {
    chordShapesNode.hidden = true;
    chordShapesNode.open = false;
  }
  chartCardNode.hidden = true;
  homeCardNode.hidden = false;
  updateActiveLink();
  updatePageMode();
  updateQrCode();
}

async function loadSong(song) {
  currentSong = song;
  currentSlug = song.slug;
  updateActiveLink();

  titleNode.textContent = song.title;
  artistNode.textContent = song.artist;
  chartNode.textContent = "Loading chart...";
  chartNode.classList.remove("chart-body-columns");
  chordHelperNode.hidden = false;
  chartCardNode.hidden = false;
  homeCardNode.hidden = true;
  updatePageMode();

  const response = await fetch(song.chartPath);
  if (!response.ok) {
    chartNode.textContent = `Could not load ${song.title}.`;
    chartNode.classList.remove("chart-body-columns");
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
  if (!slug) {
    showHome();
    return;
  }

  const match = songs.find((song) => song.slug === slug);

  if (!match) {
    showHome();
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
  restoreCustomMode();
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

window.addEventListener("resize", () => {
  restoreRailState();
  updatePageMode();
});

mobileQrToggleNode?.addEventListener("click", () => {
  const next = isMobileQrEnabled() ? "0" : "1";
  window.localStorage.setItem(MOBILE_QR_KEY, next);
  updateMobileQrState();
});

instrumentSelectNode.addEventListener("change", () => {
  window.localStorage.setItem(INSTRUMENT_KEY, instrumentSelectNode.value);
  updateChordHelper();
});

transposeSelectNode.addEventListener("change", () => {
  capoSelectNode.value = "original";
  customKeySelectNode.value = "original";
  window.localStorage.setItem(TRANSPOSE_KEY, transposeSelectNode.value);
  transposeSelectNode.classList.toggle("instrument-target", isInstrumentTranspose(transposeSelectNode.value));
  renderCurrentChart();
});

capoSelectNode.addEventListener("change", () => {
  transposeSelectNode.value = "original";
  customKeySelectNode.value = "original";
  window.localStorage.setItem(TRANSPOSE_KEY, capoSelectNode.value);
  renderCurrentChart();
});

customToggleNode?.addEventListener("click", () => {
  setCustomMode(customKeyWrapNode.hidden);
});

customKeySelectNode?.addEventListener("change", () => {
  transposeSelectNode.value = "original";
  capoSelectNode.value = "original";
  window.localStorage.setItem(TRANSPOSE_KEY, customKeySelectNode.value);
  renderCurrentChart();
});

resetTransposeNode.addEventListener("click", () => {
  transposeSelectNode.value = "original";
  capoSelectNode.value = "original";
  customKeySelectNode.value = "original";
  window.localStorage.setItem(TRANSPOSE_KEY, "original");
  transposeSelectNode.classList.remove("instrument-target");
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

suggestionFormNode?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    title: suggestionTitleNode?.value?.trim() || "",
    artist: suggestionArtistNode?.value?.trim() || "",
    notes: suggestionNotesNode?.value?.trim() || "",
    body: suggestionBodyNode?.value?.trim() || "",
  };

  if (!payload.body) {
    setSuggestionStatus("Paste a chart or lyric sheet first.", "error");
    suggestionBodyNode?.focus();
    return;
  }

  suggestionSubmitNode.disabled = true;
  setSuggestionStatus("Sending to the review inbox...", "pending");

  try {
    const response = await fetch("/api/suggestions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || "Could not send suggestion.");
    }

    suggestionFormNode.reset();
    setSuggestionStatus(result.message || "Saved for review.", result.storage === "ephemeral" ? "warning" : "success");
  } catch (error) {
    setSuggestionStatus(error.message || "Could not send suggestion.", "error");
  } finally {
    suggestionSubmitNode.disabled = false;
  }
});
