// =============================================================================
// Tech Stack card generator — capability pillars
// =============================================================================
// Instead of an exhaustive logo wall, the card frames expertise as a 2x2 grid of
// capability "pillars" — what is actually architected — each with a one-line
// descriptor and a few signature tools. This reads as senior judgement rather
// than a badge collection; the README caption notes these are favorites, not an
// exhaustive list. Light/dark-aware via prefers-color-scheme.
//
// Brand marks are read from assets/logos/tech/*.svg (bundled locally). The data
// rarely changes, so this is a "static" asset: run the script when your focus
// shifts and commit assets/static/techstack.svg.
//
// Usage:  node scripts/techstack.mjs [out.svg]
// =============================================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const OUT = process.argv[2] || "assets/static/techstack.svg";
const ACCENT = "#588DF3";
const LOGO_DIR = new URL("../assets/logos/tech/", import.meta.url);

// 24-viewBox pillar glyphs (Material-style, tinted with the accent colour).
const CAT_ICONS = {
  ai: "M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3zM9 13c-.83 0-1.5-.67-1.5-1.5S8.17 10 9 10s1.5.67 1.5 1.5S9.83 13 9 13zm7-1.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zM8 15h8v2H8v-2z",
  cloud:
    "M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z",
  database:
    "M12 3C7.58 3 4 4.34 4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6c0-1.66-3.58-3-8-3zm6 15c0 .31-2.13 1.5-6 1.5s-6-1.19-6-1.5v-2.23c1.61.78 3.92 1.23 6 1.23s4.39-.45 6-1.23V18zm0-4.55c-1.3.95-3.58 1.55-6 1.55s-4.7-.6-6-1.55V11.3c1.61.78 3.92 1.2 6 1.2s4.39-.42 6-1.2v2.15zM12 11C8.13 11 6 9.81 6 9.5V7.27C7.61 8.05 9.92 8.5 12 8.5s4.39-.45 6-1.23V9.5c0 .31-2.13 1.5-6 1.5z",
  devices:
    "M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z",
};

// Four capability pillars. Each lists ONLY its signature tools — the README's
// "favorites, not limits" caption carries the long tail. `color` is the solid
// brand tile colour; the logo fill (white / ink) is chosen from its luminance.
const PILLARS = [
  {
    icon: "ai",
    title: "AI & Agentic Systems",
    blurb: "Multi-agent apps, RAG pipelines, and LLM orchestration.",
    items: [
      { name: "Claude", logo: "claude", color: "#D97757" },
      { name: "LangGraph", logo: "langchain", color: "#1C3C3C" },
      { name: "Python", logo: "python", color: "#3776AB" },
    ],
  },
  {
    icon: "cloud",
    title: "Cloud & Platform",
    blurb: "Scalable, secure cloud-native architecture and delivery.",
    items: [
      { name: "GCP", logo: "gcp", color: "#4285F4" },
      { name: "AWS", logo: "aws", color: "#FF9900" },
      { name: "Kubernetes", logo: "kubernetes", color: "#326CE5" },
    ],
  },
  {
    icon: "database",
    title: "Data & Backend",
    blurb: "Event-driven services and storage that scale.",
    items: [
      { name: "PostgreSQL", logo: "postgresql", color: "#4169E1" },
      { name: "Kafka", logo: "kafka", color: "#231F20" },
      { name: "Redis", logo: "redis", color: "#FF4438" },
    ],
  },
  {
    icon: "devices",
    title: "Product Engineering",
    blurb: "Web & mobile products, from prototype to production.",
    items: [
      { name: "Next.js", logo: "nextjs", color: "#000000" },
      { name: "Flutter", logo: "flutter", color: "#02569B" },
      { name: "TypeScript", logo: "typescript", color: "#3178C6" },
    ],
  },
];

// --- helpers -----------------------------------------------------------------

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Relative luminance → pick a legible logo fill for a given tile colour.
function logoFill(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.62 ? "#1f2328" : "#ffffff";
}

// Approximate text width (Segoe UI) in px for layout, as fractions of font size.
const NARROW = "iIl.,:;'|!ftj()[]/ ";
const WIDE = "mwMW";
const CAPS = "ABCDEFGHKNOPQRSUVXYZ";
function charW(ch) {
  if (WIDE.includes(ch)) return 0.95;
  if (NARROW.includes(ch)) return 0.34;
  if (CAPS.includes(ch)) return 0.7;
  if (ch >= "0" && ch <= "9") return 0.56;
  return 0.54;
}
function textW(s, size) {
  let t = 0;
  for (const ch of s) t += charW(ch);
  return t * size;
}

// Greedy word-wrap into at most `maxLines` lines of ~`maxChars` characters.
function wrap(text, maxChars, maxLines = 2) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const cand = line ? `${line} ${w}` : w;
    if (cand.length > maxChars && line) {
      lines.push(line);
      line = w;
    } else line = cand;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines[maxLines - 1] = lines.slice(maxLines - 1).join(" ");
    lines.length = maxLines;
  }
  return lines;
}

// Read a bundled logo → { viewBox, inner, fillRule }. Fills are stripped so the
// mark inherits a single tint from its wrapper <g>.
async function loadLogo(slug) {
  let raw = await readFile(new URL(`${slug}.svg`, LOGO_DIR), "utf8");
  raw = raw
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<title>[\s\S]*?<\/title>/gi, "");
  const viewBox = (raw.match(/viewBox="([^"]*)"/i) || [])[1] || "0 0 24 24";
  const fillRule = /fill-rule="evenodd"/i.test(raw) ? "evenodd" : "nonzero";
  let inner = (raw.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/i) || [])[1] || "";
  inner = inner.replace(/\sfill="[^"]*"/gi, "").trim();
  return { viewBox, inner, fillRule };
}

// --- layout ------------------------------------------------------------------

const W = 1000;
const PAD = 26;
const GAP_X = 22; // gap between pillar columns
const GAP_Y = 22; // gap between pillar rows
const CELL_W = (W - PAD * 2 - GAP_X) / 2;

const INP = 24; // inner padding inside each pillar panel
const BADGE = 34;
const ICON = 20;
const HEAD_GAP = 16; // header → blurb
const BLURB_LH = 18;
const BLURB_GAP = 18; // blurb → chips

const CHIP_H = 34;
const TILE = 24;
const LOGO = 15;
const CHIP_GAP = 9;
const ROW_GAP = 10;

const chipW = (name) => 6 + TILE + 9 + Math.ceil(textW(name, 13)) + 13;

function layoutRows(items, maxW) {
  const rows = [];
  let row = [];
  let x = 0;
  for (const it of items) {
    const w = chipW(it.name);
    if (row.length && x + w > maxW) {
      rows.push(row);
      row = [];
      x = 0;
    }
    row.push({ ...it, w, x });
    x += w + CHIP_GAP;
  }
  if (row.length) rows.push(row);
  return rows;
}

function computeCells() {
  const contentW = CELL_W - INP * 2;
  const maxChars = Math.floor(contentW / 6.4);
  const cells = PILLARS.map((p) => {
    const blurbLines = wrap(p.blurb, maxChars, 2);
    const rows = layoutRows(p.items, contentW);
    const chipsH = rows.length * CHIP_H + (rows.length - 1) * ROW_GAP;
    const cellH =
      INP +
      BADGE +
      HEAD_GAP +
      blurbLines.length * BLURB_LH +
      BLURB_GAP +
      chipsH +
      INP;
    return { p, blurbLines, rows, cellH };
  });
  const rowH = [
    Math.max(cells[0].cellH, cells[1].cellH),
    Math.max(cells[2].cellH, cells[3].cellH),
  ];
  const H = PAD + rowH[0] + GAP_Y + rowH[1] + PAD;
  return { cells, rowH, H };
}

// --- render ------------------------------------------------------------------

async function renderChip(it, x, y) {
  const { viewBox, inner, fillRule } = await loadLogo(it.logo);
  const ty = y + (CHIP_H - TILE) / 2;
  const lx = x + 6 + (TILE - LOGO) / 2;
  const ly = ty + (TILE - LOGO) / 2;
  const textX = x + 6 + TILE + 9;
  return `
    <rect x="${x}" y="${y}" width="${it.w}" height="${CHIP_H}" rx="10" class="chip" filter="url(#chipShadow)" />
    <rect x="${x + 6}" y="${ty}" width="${TILE}" height="${TILE}" rx="7" fill="${it.color}" />
    <svg x="${lx}" y="${ly}" width="${LOGO}" height="${LOGO}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet"><g fill="${logoFill(it.color)}" fill-rule="${fillRule}">${inner}</g></svg>
    <text x="${textX}" y="${y + CHIP_H / 2 + 4.5}" class="chip-label">${esc(it.name)}</text>`;
}

async function renderCell(cell, cx, cy, h) {
  const { p, blurbLines, rows } = cell;
  let s = `<rect x="${cx}" y="${cy}" width="${CELL_W}" height="${h}" rx="14" class="panel" />`;

  // Header: accent badge + headline.
  const badgeX = cx + INP;
  const badgeY = cy + INP;
  s += `<rect x="${badgeX}" y="${badgeY}" width="${BADGE}" height="${BADGE}" rx="9" fill="${ACCENT}" fill-opacity="0.14" />`;
  s += `<svg x="${badgeX + (BADGE - ICON) / 2}" y="${badgeY + (BADGE - ICON) / 2}" width="${ICON}" height="${ICON}" viewBox="0 0 24 24"><path d="${CAT_ICONS[p.icon]}" fill="${ACCENT}" /></svg>`;
  s += `<text x="${badgeX + BADGE + 13}" y="${badgeY + BADGE / 2 + 5.5}" class="title">${esc(p.title)}</text>`;

  // Blurb.
  const blurbTop = cy + INP + BADGE + HEAD_GAP + 13;
  blurbLines.forEach((ln, i) => {
    s += `<text x="${cx + INP}" y="${blurbTop + i * BLURB_LH}" class="blurb">${esc(ln)}</text>`;
  });

  // Signature chips.
  const chipsTop = cy + INP + BADGE + HEAD_GAP + blurbLines.length * BLURB_LH + BLURB_GAP;
  for (let r = 0; r < rows.length; r++) {
    const ry = chipsTop + r * (CHIP_H + ROW_GAP);
    for (const it of rows[r]) s += await renderChip(it, cx + INP + it.x, ry);
  }
  return s;
}

async function main() {
  const geo = computeCells();

  let body = "";
  const positions = [
    [PAD, PAD, 0, 0],
    [PAD + CELL_W + GAP_X, PAD, 0, 1],
    [PAD, PAD + geo.rowH[0] + GAP_Y, 1, 2],
    [PAD + CELL_W + GAP_X, PAD + geo.rowH[0] + GAP_Y, 1, 3],
  ];
  for (const [cx, cy, r, idx] of positions) {
    body += await renderCell(geo.cells[idx], cx, cy, geo.rowH[r]);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${geo.H}" viewBox="0 0 ${W} ${geo.H}" fill="none" role="img" aria-label="Tech stack capabilities">
  <defs>
    <filter id="chipShadow" x="-20%" y="-30%" width="140%" height="160%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="#1f2328" flood-opacity="0.12" />
    </filter>
  </defs>
  <style>
    :root {
      --bg: #ffffff; --border: #d0d7de;
      --panel: #f7f9fc; --panel-border: #e6ebf3;
      --title: #1f2328; --muted: #59636e;
      --chip-bg: #ffffff; --chip-border: #e3e9f2; --chip-fg: #1f2328;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0d1117; --border: #30363d;
        --panel: #11161d; --panel-border: #283446;
        --title: #e6edf3; --muted: #8b949e;
        --chip-bg: #161b22; --chip-border: #283446; --chip-fg: #e6edf3;
      }
    }
    .card { fill: var(--bg); stroke: var(--border); }
    .panel { fill: var(--panel); stroke: var(--panel-border); stroke-width: 1; }
    .title { fill: var(--title); font: 700 16px 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; }
    .blurb { fill: var(--muted); font: 400 12.5px 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; }
    .chip { fill: var(--chip-bg); stroke: var(--chip-border); stroke-width: 1; }
    .chip-label { fill: var(--chip-fg); font: 600 13px 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; letter-spacing: .1px; }
  </style>

  <rect class="card" x="1" y="1" width="${W - 2}" height="${geo.H - 2}" rx="16" stroke-width="1.5" />

  ${body}
</svg>`;

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, svg, "utf8");
  console.log(`Wrote ${OUT} (${W}x${geo.H})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
