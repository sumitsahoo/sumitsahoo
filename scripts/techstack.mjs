// =============================================================================
// Tech Stack card generator
// =============================================================================
// Renders a single light/dark-aware card (via prefers-color-scheme) that groups
// the technologies into categories. Each technology is a neutral "chip" holding
// a small solid brand-colour icon tile (the logo is knocked out in white or ink
// depending on the tile's luminance, so contrast is always guaranteed) followed
// by its name — matching the chip/tile design language of stats.svg & career.svg.
//
// Brand marks are read from assets/logos/tech/*.svg (bundled locally so an icon
// can never break). The data rarely changes, so this is a "static" asset: run
// the script when your stack changes and commit assets/static/techstack.svg.
//
// Usage:  node scripts/techstack.mjs [out.svg]
// =============================================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const OUT = process.argv[2] || "assets/static/techstack.svg";
const ACCENT = "#588DF3";
const LOGO_DIR = new URL("../assets/logos/tech/", import.meta.url);

// 24-viewBox category glyphs (Material-style, tinted with the accent colour).
const CAT_ICONS = {
  ai: "M20 9V7c0-1.1-.9-2-2-2h-3c0-1.66-1.34-3-3-3S9 3.34 9 5H6c-1.1 0-2 .9-2 2v2c-1.66 0-3 1.34-3 3s1.34 3 3 3v4c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-4c1.66 0 3-1.34 3-3s-1.34-3-3-3zM9 13c-.83 0-1.5-.67-1.5-1.5S8.17 10 9 10s1.5.67 1.5 1.5S9.83 13 9 13zm7-1.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zM8 15h8v2H8v-2z",
  code: "M9.4 16.6 4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0 4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z",
  devices:
    "M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z",
  cloud:
    "M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z",
  database:
    "M12 3C7.58 3 4 4.34 4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6c0-1.66-3.58-3-8-3zm6 15c0 .31-2.13 1.5-6 1.5s-6-1.19-6-1.5v-2.23c1.61.78 3.92 1.23 6 1.23s4.39-.45 6-1.23V18zm0-4.55c-1.3.95-3.58 1.55-6 1.55s-4.7-.6-6-1.55V11.3c1.61.78 3.92 1.2 6 1.2s4.39-.42 6-1.2v2.15zM12 11C8.13 11 6 9.81 6 9.5V7.27C7.61 8.05 9.92 8.5 12 8.5s4.39-.45 6-1.23V9.5c0 .31-2.13 1.5-6 1.5z",
};

// Each tech: name, the bundled logo file (slug.svg), and the solid brand colour
// used for its icon tile. The logo fill (white / ink) is chosen automatically
// from the tile's luminance, so every mark stays legible in both themes.
const CATEGORIES = [
  {
    label: "AI & Agentic Frameworks",
    icon: "ai",
    items: [
      { name: "OpenAI", logo: "openai", color: "#74AA9C" },
      { name: "Gemini", logo: "gemini", color: "#8E75B2" },
      { name: "Claude", logo: "claude", color: "#D97757" },
      { name: "LangChain", logo: "langchain", color: "#1C3C3C" },
      { name: "LangGraph", logo: "langchain", color: "#1C3C3C" },
      { name: "LangSmith", logo: "langchain", color: "#1C3C3C" },
      { name: "Langfuse", logo: "langfuse", color: "#E11D48" },
      { name: "LlamaIndex", logo: "llamaindex", color: "#8A2BE2" },
      { name: "ADK", logo: "adk", color: "#4285F4" },
      { name: "HuggingFace", logo: "huggingface", color: "#FFD21E" },
      { name: "Streamlit", logo: "streamlit", color: "#FF4B4B" },
      { name: "Gradio", logo: "gradio", color: "#FF7C00" },
      { name: "Ollama", logo: "ollama", color: "#1A1A1A" },
      { name: "LM Studio", logo: "lmstudio", color: "#4338CA" },
    ],
  },
  {
    label: "Programming Languages",
    icon: "code",
    items: [
      { name: "Python", logo: "python", color: "#3776AB" },
      { name: "TypeScript", logo: "typescript", color: "#3178C6" },
      { name: "JavaScript", logo: "javascript", color: "#F7DF1E" },
      { name: "Kotlin", logo: "kotlin", color: "#7F52FF" },
      { name: "Java", logo: "java", color: "#ED8B00" },
      { name: "Dart", logo: "dart", color: "#0175C2" },
    ],
  },
  {
    label: "Web & Mobile",
    icon: "devices",
    items: [
      { name: "Next.js", logo: "nextjs", color: "#000000" },
      { name: "React", logo: "react", color: "#61DAFB" },
      { name: "Flutter", logo: "flutter", color: "#02569B" },
      { name: "Android", logo: "android", color: "#3DDC84" },
      { name: "iOS", logo: "ios", color: "#000000" },
      { name: "Tailwind", logo: "tailwind", color: "#06B6D4" },
    ],
  },
  {
    label: "Databases",
    icon: "database",
    items: [
      { name: "PostgreSQL", logo: "postgresql", color: "#4169E1" },
      { name: "MySQL", logo: "mysql", color: "#4479A1" },
      { name: "MongoDB", logo: "mongodb", color: "#47A248" },
      { name: "Redis", logo: "redis", color: "#FF4438" },
      { name: "Elasticsearch", logo: "elasticsearch", color: "#005571" },
      { name: "Cassandra", logo: "cassandra", color: "#1287B1" },
      { name: "Neo4j", logo: "neo4j", color: "#4581C3" },
      { name: "pgvector", logo: "vector", color: "#4169E1" },
      { name: "Pinecone", logo: "vector", color: "#2E8B8B" },
      { name: "Chroma", logo: "vector", color: "#F9A03F" },
    ],
  },
  {
    label: "Infrastructure & Cloud",
    icon: "cloud",
    items: [
      { name: "GCP", logo: "gcp", color: "#4285F4" },
      { name: "AWS", logo: "aws", color: "#FF9900" },
      { name: "Azure", logo: "azure", color: "#0078D4" },
      { name: "Oracle OCI", logo: "oracle", color: "#C74634" },
      { name: "Docker", logo: "docker", color: "#2496ED" },
      { name: "K8s", logo: "kubernetes", color: "#326CE5" },
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

// Approximate text width (Segoe UI semibold) in px for layout. Per-char widths
// are fractions of the font size; good enough to size chips without a font lib.
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

// --- SVG ---------------------------------------------------------------------

const W = 1000;
const PAD = 28;
const TOP_PAD = 14; // top whitespace inside the card (no in-card header)

const GUTTER = 196; // left category-label column width
const COL_GAP = 18; // gutter → chips gap

const CHIP_H = 36;
const TILE = 24;
const LOGO = 15;
const CHIP_GAP = 9;
const ROW_GAP = 10;
const ROW_PAD_V = 22;

const chipW = (name) => 6 + TILE + 9 + Math.ceil(textW(name, 13)) + 13;

// Lay items out into wrapped rows within `maxW`.
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

// Compute geometry only: each category's wrapped chip rows + block height, and
// the overall card height. Rendering (which reads logo files) happens later.
function computeGeometry() {
  const rightW = W - PAD * 2 - GUTTER - COL_GAP;
  const labelMaxChars = Math.floor((GUTTER - 40) / 8);

  const blocks = [];
  for (const cat of CATEGORIES) {
    const rows = layoutRows(cat.items, rightW);
    const chipsH = rows.length * CHIP_H + (rows.length - 1) * ROW_GAP;
    const labelLines = wrap(cat.label, labelMaxChars, 2);
    const labelH = Math.max(30, labelLines.length * 18);
    const blockH = Math.max(chipsH, labelH);
    blocks.push({ cat, rows, chipsH, labelLines, blockH });
  }

  let y = TOP_PAD;
  for (const b of blocks) y += ROW_PAD_V + b.blockH + ROW_PAD_V;
  return { H: y + 6, blocks };
}

async function main() {
  const geo = computeGeometry();
  const bodyStr = await assembleBody(geo);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${geo.H}" viewBox="0 0 ${W} ${geo.H}" fill="none" role="img" aria-label="Tech stack">
  <defs>
    <filter id="chipShadow" x="-20%" y="-30%" width="140%" height="160%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="#1f2328" flood-opacity="0.12" />
    </filter>
  </defs>
  <style>
    :root {
      --bg: #ffffff; --border: #d0d7de; --cat: #1f2328;
      --chip-bg: #ffffff; --chip-border: #e3e9f2; --chip-fg: #1f2328;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0d1117; --border: #30363d; --cat: #e6edf3;
        --chip-bg: #161b22; --chip-border: #283446; --chip-fg: #e6edf3;
      }
    }
    .card { fill: var(--bg); stroke: var(--border); }
    .cat { fill: var(--cat); font: 600 13.5px 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; }
    .chip { fill: var(--chip-bg); stroke: var(--chip-border); stroke-width: 1; }
    .chip-label { fill: var(--chip-fg); font: 600 13px 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; letter-spacing: .1px; }
  </style>

  <rect class="card" x="1" y="1" width="${W - 2}" height="${geo.H - 2}" rx="16" stroke-width="1.5" />

  ${bodyStr}
</svg>`;

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, svg, "utf8");
  console.log(`Wrote ${OUT} (${W}x${geo.H})`);
}

// Rebuild the body, replacing chip placeholders with rendered chip SVG.
async function assembleBody(geo) {
  const badgeS = 30;
  const iconS = 18;
  const labelX = PAD + 40;

  // First pass over geometry to find each category icon's centre Y. The label +
  // icon are top-aligned with the category's FIRST chip row (not the block's
  // vertical middle).
  const centers = [];
  {
    let y = TOP_PAD;
    for (const b of geo.blocks) {
      const top = y + ROW_PAD_V;
      const chipsTop = top + (b.blockH - b.chipsH) / 2;
      centers.push(chipsTop + CHIP_H / 2);
      y = top + b.blockH + ROW_PAD_V;
    }
  }

  let body = "";
  let y = TOP_PAD;
  for (let i = 0; i < geo.blocks.length; i++) {
    const b = geo.blocks[i];
    const top = y + ROW_PAD_V;
    const blockMid = centers[i];
    const badgeY = blockMid - badgeS / 2;

    body += `<rect x="${PAD}" y="${badgeY}" width="${badgeS}" height="${badgeS}" rx="9" fill="${ACCENT}" fill-opacity="0.14" />`;
    body += `<svg x="${PAD + (badgeS - iconS) / 2}" y="${badgeY + (badgeS - iconS) / 2}" width="${iconS}" height="${iconS}" viewBox="0 0 24 24"><path d="${CAT_ICONS[b.cat.icon]}" fill="${ACCENT}" /></svg>`;
    const lblTop = blockMid - ((b.labelLines.length - 1) * 18) / 2 + 5;
    b.labelLines.forEach((ln, k) => {
      body += `<text x="${labelX}" y="${lblTop + k * 18}" class="cat">${esc(ln)}</text>`;
    });

    const chipsTop = top + (b.blockH - b.chipsH) / 2;
    for (let r = 0; r < b.rows.length; r++) {
      const ry = chipsTop + r * (CHIP_H + ROW_GAP);
      for (const it of b.rows[r]) {
        body += await renderChip(it, PAD + GUTTER + COL_GAP + it.x, ry);
      }
    }
    y = top + b.blockH + ROW_PAD_V;
  }
  return body;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
