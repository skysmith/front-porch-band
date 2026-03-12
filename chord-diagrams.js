import { CHORD_ALIASES, CHORD_LIBRARY } from "./chord-library.js";

function normalizeChordName(name) {
  return CHORD_ALIASES[name] || name;
}

function extractChordTokens(chartText) {
  const matches = chartText.match(/\b[A-G](?:[#b])?(?:\/[A-G](?:[#b])?)?(?:maj7|m7|sus2|sus4|m|6|7)?\*{0,2}\b/g) || [];
  const seen = new Set();

  return matches
    .map((match) => normalizeChordName(match))
    .filter((match) => {
      if (seen.has(match)) {
        return false;
      }
      seen.add(match);
      return true;
    });
}

function renderMutedLabel(value) {
  return value === "x" ? "x" : "o";
}

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  return el;
}

function buildDiagramSvg(instrument, chordName, shape) {
  const svg = svgEl("svg", {
    viewBox: "0 0 120 150",
    class: "chord-svg",
    role: "img",
    "aria-label": `${chordName} chord for ${instrument.label}`,
  });

  const topY = 40;
  const leftX = 18;
  const width = 84;
  const fretGap = 20;
  const stringGap = width / (shape.frets.length - 1);

  const title = svgEl("text", { x: 60, y: 18, "text-anchor": "middle", class: "chord-svg-name" });
  title.textContent = chordName;
  svg.append(title);

  if ((shape.baseFret || 1) > 1) {
    const base = svgEl("text", { x: 8, y: 56, class: "chord-svg-base" });
    base.textContent = `${shape.baseFret}fr`;
    svg.append(base);
  }

  for (let stringIndex = 0; stringIndex < shape.frets.length; stringIndex += 1) {
    const x = leftX + stringIndex * stringGap;
    svg.append(svgEl("line", { x1: x, y1: topY, x2: x, y2: topY + fretGap * 4, class: "chord-string-line" }));

    const openText = svgEl("text", {
      x,
      y: 30,
      "text-anchor": "middle",
      class: "chord-svg-open",
    });
    openText.textContent = renderMutedLabel(shape.frets[stringIndex]);
    svg.append(openText);

    const label = svgEl("text", {
      x,
      y: topY + fretGap * 4 + 18,
      "text-anchor": "middle",
      class: "chord-svg-label",
    });
    label.textContent = instrument.strings[stringIndex];
    svg.append(label);
  }

  for (let fret = 0; fret <= 4; fret += 1) {
    const y = topY + fret * fretGap;
    svg.append(svgEl("line", { x1: leftX, y1: y, x2: leftX + width, y2: y, class: fret === 0 && (shape.baseFret || 1) === 1 ? "chord-nut-line" : "chord-fret-line" }));
  }

  if (shape.barre) {
    const x1 = leftX + shape.barre.fromString * stringGap;
    const x2 = leftX + shape.barre.toString * stringGap;
    const y = topY + ((shape.barre.fret - (shape.baseFret || 1)) + 0.5) * fretGap;
    const barre = svgEl("rect", {
      x: x1 - 6,
      y: y - 6,
      width: x2 - x1 + 12,
      height: 12,
      rx: 6,
      class: "chord-finger-dot",
    });
    svg.append(barre);
  }

  shape.frets.forEach((fretValue, stringIndex) => {
    if (typeof fretValue !== "number" || fretValue <= 0) {
      return;
    }

    if (shape.barre && fretValue === shape.barre.fret && stringIndex >= shape.barre.fromString && stringIndex <= shape.barre.toString) {
      return;
    }

    const y = topY + ((fretValue - (shape.baseFret || 1)) + 0.5) * fretGap;
    const x = leftX + stringIndex * stringGap;
    svg.append(svgEl("circle", { cx: x, cy: y, r: 7, class: "chord-finger-dot" }));

    const finger = shape.fingers?.[stringIndex];
    if (finger) {
      const fingerLabel = svgEl("text", {
        x,
        y: y + 3,
        "text-anchor": "middle",
        class: "chord-finger-label",
      });
      fingerLabel.textContent = finger;
      svg.append(fingerLabel);
    }
  });

  return svg;
}

function buildUnsupportedCard(chordName, instrumentLabel) {
  const card = document.createElement("article");
  card.className = "chord-card chord-card-missing";

  const title = document.createElement("h4");
  title.className = "chord-card-title";
  title.textContent = chordName;

  const message = document.createElement("p");
  message.className = "chord-card-note";
  message.textContent = `No saved ${instrumentLabel.toLowerCase()} shape yet.`;

  card.append(title, message);
  return card;
}

function buildChordCard(instrumentId, chordName) {
  const instrument = CHORD_LIBRARY[instrumentId];
  const shape = instrument.shapes[chordName];
  if (!shape) {
    return buildUnsupportedCard(chordName, instrument.label);
  }

  const card = document.createElement("article");
  card.className = "chord-card";
  card.append(buildDiagramSvg(instrument, chordName, shape));
  return card;
}

export function getInstrumentChoices() {
  return Object.entries(CHORD_LIBRARY).map(([id, info]) => ({ id, label: info.label }));
}

export function getInstrumentLabel(instrumentId) {
  return CHORD_LIBRARY[instrumentId]?.label || instrumentId;
}

export function renderChordCards(container, chartText, instrumentId) {
  const chords = extractChordTokens(chartText).filter((chord) => chord in (CHORD_LIBRARY[instrumentId]?.shapes || {}) || chord);

  if (!chords.length) {
    container.replaceChildren();
    return 0;
  }

  const fragment = document.createDocumentFragment();
  chords.forEach((chordName) => {
    fragment.append(buildChordCard(instrumentId, chordName));
  });
  container.replaceChildren(fragment);
  return chords.length;
}
