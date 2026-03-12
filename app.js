import { getInstrumentChoices, getInstrumentLabel, renderChordCards } from "./chord-diagrams.js";

const listNode = document.querySelector("#song-list");
const titleNode = document.querySelector("#song-title");
const artistNode = document.querySelector("#song-artist");
const kickerNode = document.querySelector("#song-kicker");
const chartNode = document.querySelector("#chart-body");
const searchNode = document.querySelector("#song-search");
const fontUpNode = document.querySelector("#font-up");
const fontDownNode = document.querySelector("#font-down");
const toggleRailNode = document.querySelector("#toggle-rail");
const qrImageNode = document.querySelector("#qr-image");
const pageShellNode = document.querySelector(".page-shell");
const chordGridNode = document.querySelector("#chord-grid");
const instrumentSelectNode = document.querySelector("#instrument-select");
const chordHelperMetaNode = document.querySelector("#chord-helper-meta");
const chordHelperCountNode = document.querySelector("#chord-helper-count");

const FONT_KEY = "front-porch-band-font-scale";
const RAIL_KEY = "front-porch-band-rail-collapsed";
const INSTRUMENT_KEY = "front-porch-band-instrument";
const DEFAULT_FONT_SIZE = 1;
const FONT_STEP = 0.08;
const MIN_FONT_SIZE = 0.84;
const MAX_FONT_SIZE = 1.48;

let songs = [];
let currentSlug = "";
let currentChartText = "";

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
  window.localStorage.setItem(RAIL_KEY, collapsed ? "1" : "0");
}

function restoreRailState() {
  setRailCollapsed(window.localStorage.getItem(RAIL_KEY) === "1");
}

function currentInstrument() {
  return instrumentSelectNode.value || window.localStorage.getItem(INSTRUMENT_KEY) || "guitar";
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
  currentSlug = song.slug;
  updateActiveLink();

  titleNode.textContent = song.title;
  artistNode.textContent = song.artist;
  kickerNode.textContent = song.key ? `Key: ${song.key}` : "Chord chart";
  chartNode.textContent = "Loading chart...";

  const response = await fetch(song.chartPath);
  if (!response.ok) {
    chartNode.textContent = `Could not load ${song.title}.`;
    currentChartText = "";
    updateChordHelper();
    updateQrCode();
    return;
  }

  currentChartText = await response.text();
  chartNode.textContent = currentChartText;
  updateChordHelper();
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

bootstrap().catch((error) => {
  titleNode.textContent = "Front Porch Band";
  artistNode.textContent = "Could not load chart index.";
  chartNode.textContent = String(error);
  updateQrCode();
});
