const listNode = document.querySelector("#song-list");
const titleNode = document.querySelector("#song-title");
const artistNode = document.querySelector("#song-artist");
const kickerNode = document.querySelector("#song-kicker");
const chartNode = document.querySelector("#chart-body");
const searchNode = document.querySelector("#song-search");
const fontUpNode = document.querySelector("#font-up");
const fontDownNode = document.querySelector("#font-down");
const qrImageNode = document.querySelector("#qr-image");
const qrCaptionNode = document.querySelector("#qr-caption");
const copyLinkNode = document.querySelector("#copy-link");

const FONT_KEY = "front-porch-band-font-scale";
const DEFAULT_FONT_SIZE = 1;
const FONT_STEP = 0.08;
const MIN_FONT_SIZE = 0.84;
const MAX_FONT_SIZE = 1.48;

let songs = [];
let currentSlug = "";

function currentShareUrl() {
  return window.location.href;
}

function updateQrCode() {
  const shareUrl = currentShareUrl();
  qrImageNode.src = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(shareUrl)}`;
  qrCaptionNode.textContent = currentSlug
    ? "Scan for the song currently on screen."
    : "Open this songbook on your phone.";
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

function createSongLink(song) {
  const link = document.createElement("a");
  link.className = "song-link";
  link.href = `#${song.slug}`;
  link.dataset.slug = song.slug;

  const title = document.createElement("span");
  title.className = "song-link-title";
  title.textContent = song.title;

  const artist = document.createElement("span");
  artist.className = "song-link-artist";
  artist.textContent = song.artist;

  link.append(title, artist);
  return link;
}

function renderSongList(filter = "") {
  const normalized = filter.trim().toLowerCase();
  const fragment = document.createDocumentFragment();

  songs
    .filter((song) => {
      if (!normalized) {
        return true;
      }

      return `${song.title} ${song.artist}`.toLowerCase().includes(normalized);
    })
    .forEach((song) => {
      fragment.append(createSongLink(song));
    });

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
    updateQrCode();
    return;
  }

  chartNode.textContent = await response.text();
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

copyLinkNode.addEventListener("click", async () => {
  const shareUrl = currentShareUrl();

  try {
    await navigator.clipboard.writeText(shareUrl);
    copyLinkNode.textContent = "Copied";
    window.setTimeout(() => {
      copyLinkNode.textContent = "Copy link";
    }, 1400);
  } catch {
    copyLinkNode.textContent = "Copy failed";
    window.setTimeout(() => {
      copyLinkNode.textContent = "Copy link";
    }, 1400);
  }
});

fontUpNode.addEventListener("click", () => {
  const current = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--chart-size"));
  setFontScale(current + FONT_STEP);
});

fontDownNode.addEventListener("click", () => {
  const current = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--chart-size"));
  setFontScale(current - FONT_STEP);
});

bootstrap().catch((error) => {
  titleNode.textContent = "Front Porch Band";
  artistNode.textContent = "Could not load chart index.";
  chartNode.textContent = String(error);
  updateQrCode();
});
