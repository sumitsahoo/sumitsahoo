// =============================================================================
// Career Journey card generator
// =============================================================================
// Renders a modern horizontal timeline SVG (light + dark aware via
// prefers-color-scheme) from the static CAREER data below. Each milestone is a
// white "logo tile" (kept white in both themes so brand marks always render
// correctly), connected by chevrons that animate left-to-right — a glowing
// "progress" sweep that conveys career progression.
//
// Brand marks are read from scripts/logos/*.svg (authentic vector logos, used
// to factually identify real employers). The data rarely changes, so this is a
// "static" asset: run the script when your career changes and commit the output
// to assets/static/career.svg.
//
// Usage:  node scripts/career.mjs [out.svg]
// =============================================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = process.argv[2] || "assets/static/career.svg";
const ACCENT = "#588DF3";
const LOGO_DIR = new URL("./logos/", import.meta.url);

// Bundled glyphs (0..24 viewBox) for non-company marks.
const GLYPHS = {
  cap: "M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z",
  sparkle: "M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z",
};

// Mark definitions. `file` reads a logo from scripts/logos/; `color` tints a
// monochrome logo (paths without their own fill). `box` is the fraction of the
// tile the mark occupies (wide logos like IBM need more width).
const MARKS = {
  kiit: { file: "kiit.svg", box: 0.62 },
  wipro: { file: "wipro.svg", box: 0.62 },
  ibm: { file: "ibm.svg", box: 0.78 },
  dell: { file: "dell.svg", color: "#007DB8", box: 0.56 },
  vodafone: { file: "vodafone.svg", color: "#E60000", box: 0.56 },
  future: { glyph: "sparkle", color: ACCENT, box: 0.46 },
};

// Each milestone. `org` renders the full organisation name under the company;
// `note` renders a small accent line; `future: true` styles an open chapter.
const CAREER = [
  { mark: "kiit", range: "Jun 2010", company: "KIIT University", role: "B.Tech, Computer Science" },
  {
    mark: "wipro",
    range: "Oct 2010 – Feb 2015",
    company: "Wipro Technologies",
    role: "Software Engineer",
    note: "IT journey begins",
  },
  { mark: "ibm", range: "Feb 2015 – Mar 2017", company: "IBM", role: "Application Developer" },
  {
    mark: "dell",
    range: "Apr 2017 – Feb 2020",
    company: "Dell Technologies",
    role: "Principal Software Engineer",
  },
  {
    mark: "vodafone",
    range: "Mar 2020 – Jul 2026",
    company: "VOIS",
    org: "Vodafone Intelligent Solutions",
    role: "Solution Architect",
  },
  {
    mark: "future",
    range: "Aug 2026 – Present",
    company: "New Chapter",
    role: "To Be Revealed",
    future: true,
  },
];

// --- helpers -----------------------------------------------------------------

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Greedy word-wrap into at most `maxLines` lines of ~`maxChars` characters.
function wrap(text, maxChars, maxLines = 2) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines[maxLines - 1] = lines.slice(maxLines - 1).join(" ");
    lines.length = maxLines;
  }
  return lines;
}

// Read a logo file → { viewBox, inner } with XML noise stripped. Handles
// Inkscape exports, whose namespaced (sodipodi:/inkscape:/rdf:) elements and
// attributes would otherwise make the embedding SVG invalid XML.
async function loadLogo(file) {
  let raw = await readFile(new URL(file, LOGO_DIR), "utf8");
  raw = raw
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<title>[\s\S]*?<\/title>/gi, "")
    .replace(/<desc>[\s\S]*?<\/desc>/gi, "")
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, "");
  const viewBox = (raw.match(/viewBox="([^"]*)"/i) || [])[1] || "0 0 24 24";
  let inner = (raw.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/i) || [])[1] || "";
  inner = inner
    // drop namespaced elements (e.g. sodipodi:namedview) — paired then empty
    .replace(/<(\w+):[\w-]+[^>]*>[\s\S]*?<\/\1:[\w-]+>/g, "")
    .replace(/<\w+:[\w-]+[^>]*\/?>/g, "")
    // drop namespaced attributes (inkscape:*, sodipodi:*), keeping xlink:*
    .replace(/\s(?!xlink:)[\w-]+:[\w-]+="[^"]*"/g, "")
    // drop empty defs
    .replace(/<defs[^>]*>\s*<\/defs>/gi, "")
    .replace(/<defs[^>]*\/>/gi, "");
  return { viewBox, inner: inner.trim() };
}

// Render a mark centred in a tile of side T at (cx, cy) as a nested <svg>.
async function renderMark(mark, cx, cy, T) {
  const box = (mark.box || 0.6) * T;
  const x = cx - box / 2;
  const y = cy - box / 2;
  const head = `<svg x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${box.toFixed(
    2
  )}" height="${box.toFixed(2)}" viewBox="VB" preserveAspectRatio="xMidYMid meet" overflow="visible">`;

  if (mark.glyph) {
    return head.replace("VB", "0 0 24 24") +
      `<path d="${GLYPHS[mark.glyph]}" fill="${mark.color}" /></svg>`;
  }

  const { viewBox, inner } = await loadLogo(mark.file);
  const body = mark.color ? `<g fill="${mark.color}">${inner}</g>` : inner;
  return head.replace("VB", viewBox) + body + `</svg>`;
}

// --- SVG ---------------------------------------------------------------------

async function buildSvg(entries) {
  const W = 1000;
  const H = 248;
  const pad = 40;

  const n = entries.length;
  const colW = (W - pad * 2) / n;
  const cx = (i) => pad + colW * (i + 0.5);
  const tileY = 124;
  const T = 56;

  const lineSvg = `<line x1="${cx(0)}" y1="${tileY}" x2="${cx(
    n - 1
  )}" y2="${tileY}" class="track" stroke-width="2" />`;

  // Chevron arrows in the gaps; staggered animation delay makes the glow sweep
  // left-to-right like a progress indicator.
  let chevrons = "";
  for (let i = 0; i < n - 1; i++) {
    const gx = (cx(i) + cx(i + 1)) / 2;
    const delay = (i * 0.16).toFixed(2);
    chevrons += `<path d="M${(gx - 4).toFixed(1)},${tileY - 6} L${(gx + 4).toFixed(
      1
    )},${tileY} L${(gx - 4).toFixed(1)},${tileY + 6}" class="chevron" style="animation-delay:${delay}s" />`;
  }

  let tilesSvg = "";
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const x = cx(i);
    const mark = MARKS[e.mark];

    tilesSvg += `<text x="${x}" y="80" text-anchor="middle" class="range">${esc(
      e.range
    )}</text>`;

    const tileCls = e.future ? "tile tile-future" : "tile";
    tilesSvg += `<rect x="${x - T / 2}" y="${tileY - T / 2}" width="${T}" height="${T}" rx="14" class="${tileCls}" filter="url(#tileShadow)" />`;
    tilesSvg += await renderMark(mark, x, tileY, T);

    tilesSvg += `<text x="${x}" y="182" text-anchor="middle" class="company">${esc(
      e.company
    )}</text>`;

    let yLine = 200;
    if (e.org) {
      tilesSvg += `<text x="${x}" y="${yLine}" text-anchor="middle" class="org">${esc(
        e.org
      )}</text>`;
      yLine += 16;
    }

    const roleLines = wrap(e.role, 18, 2);
    roleLines.forEach((ln) => {
      tilesSvg += `<text x="${x}" y="${yLine}" text-anchor="middle" class="role">${esc(
        ln
      )}</text>`;
      yLine += 15;
    });

    if (e.note) {
      tilesSvg += `<text x="${x}" y="${yLine}" text-anchor="middle" class="note">${esc(
        e.note
      )}</text>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" role="img" aria-label="Career journey">
  <defs>
    <filter id="tileShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="#1f2328" flood-opacity="0.16" />
    </filter>
  </defs>
  <style>
    :root {
      --bg: #ffffff;
      --border: #d0d7de;
      --title: #1f2328;
      --company: #1f2328;
      --label: #656d76;
      --track: #d8dee4;
      --tile-stroke: #e4e7eb;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0d1117;
        --border: #30363d;
        --title: #e6edf3;
        --company: #e6edf3;
        --label: #8b949e;
        --track: #2d333b;
        --tile-stroke: #c9d1d9;
      }
    }
    .card { fill: var(--bg); stroke: var(--border); }
    .title { fill: var(--title); font: 600 20px 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; }
    .title-accent { fill: ${ACCENT}; }
    .icon { fill: var(--title); }
    .range { fill: var(--label); font: 600 12px 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; letter-spacing: .2px; }
    .company { fill: var(--company); font: 700 15px 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; }
    .org { fill: var(--label); font: 600 10.5px 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; }
    .role { fill: var(--label); font: 400 12px 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; }
    .note { fill: ${ACCENT}; font: 600 11px 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; }
    .track { stroke: var(--track); }
    .tile { fill: #ffffff; stroke: var(--tile-stroke); stroke-width: 1; }
    .tile-future { stroke: ${ACCENT}; stroke-width: 1.6; stroke-dasharray: 4 3; animation: ants 1.1s linear infinite; }

    .chevron {
      fill: none; stroke: ${ACCENT}; stroke-width: 2.4;
      stroke-linecap: round; stroke-linejoin: round; opacity: .22;
      filter: drop-shadow(0 0 2.5px rgba(88,141,243,.85));
      animation: sweep 2.6s ease-in-out infinite;
    }
    @keyframes sweep {
      0%   { opacity: .22; }
      10%  { opacity: 1; stroke-width: 3; }
      26%  { opacity: .22; stroke-width: 2.4; }
      100% { opacity: .22; }
    }
    @keyframes ants { to { stroke-dashoffset: -14; } }

    @media (prefers-reduced-motion: reduce) {
      .chevron { animation: none; opacity: .7; }
      .tile-future { animation: none; }
    }
  </style>

  <rect class="card" x="1" y="1" width="${W - 2}" height="${H - 2}" rx="16" stroke-width="1.5" />

  <g transform="translate(${pad},44)">
    <path class="icon" transform="translate(0,-17) scale(0.95)" d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z" />
    <text x="32" y="0" class="title">Career <tspan class="title-accent">Journey</tspan></text>
  </g>

  ${lineSvg}
  ${chevrons}
  ${tilesSvg}
</svg>`;
}

// --- main --------------------------------------------------------------------

async function main() {
  const svg = await buildSvg(CAREER);
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, svg, "utf8");
  console.log(`Wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
