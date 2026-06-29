// =============================================================================
// "Connect With Me" chip generator
// =============================================================================
// Emits one small light/dark-aware chip SVG per social platform into
// assets/static/social/. Each chip matches the Tech Stack chip language (neutral
// pill + solid brand-colour icon tile with a luminance-picked logo + label).
//
// SVGs embedded via <img> can't carry working links, so the README wraps each
// chip in its own <a href> — that's where the hyperlink lives.
//
// Brand marks are read from assets/logos/social/*.svg (bundled locally so an
// icon can never break). Run when the links change and commit the output.
//
// Usage:  node scripts/social.mjs [outDir]
// =============================================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";

const OUT_DIR = process.argv[2] || "assets/static/social";
const LOGO_DIR = new URL("../assets/logos/social/", import.meta.url);

// name = output file; logo = bundled slug; color = solid icon-tile colour.
// `url` is informational (the README owns the actual <a href>).
const LINKS = [
  { name: "github", logo: "github", label: "GitHub", color: "#181717", url: "https://github.com/sumitsahoo" },
  { name: "linkedin", logo: "linkedin", label: "LinkedIn", color: "#0A66C2", url: "https://www.linkedin.com/in/sumit-sahoo" },
  { name: "x", logo: "x", label: "X", color: "#000000", url: "https://x.com/sumitsahoo" },
  { name: "medium", logo: "medium", label: "Medium", color: "#000000", url: "https://medium.com/@sumitsahoo" },
  { name: "mastodon", logo: "mastodon", label: "Mastodon", color: "#6364FF", url: "https://mastodon.social/@sumitsahoo" },
  { name: "bluesky", logo: "bluesky", label: "Bluesky", color: "#0285FF", url: "https://bsky.app/profile/sumitsahoo.bsky.social" },
  { name: "stackoverflow", logo: "stackoverflow", label: "Stack Overflow", color: "#F58025", url: "https://stackoverflow.com/users/1293601/sumit-sahoo" },
  { name: "teambhp", logo: "teambhp", label: "Team-BHP", color: "#C8102E", url: "https://www.team-bhp.com/forum/members/newenergy.html" },
];

// --- helpers (kept self-contained, mirroring techstack.mjs) -------------------

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function logoFill(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return L > 0.62 ? "#1f2328" : "#ffffff";
}

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

const CHIP_H = 36;
const TILE = 24;
const LOGO = 15;
const M = 6; // margin so the drop shadow isn't clipped at the edges

const chipW = (label) => 6 + TILE + 9 + Math.ceil(textW(label, 13)) + 13;

async function buildChip(item) {
  const { viewBox, inner, fillRule } = await loadLogo(item.logo);
  const cw = chipW(item.label);
  const W = cw + M * 2;
  const H = CHIP_H + M * 2;

  const x = M;
  const y = M;
  const ty = y + (CHIP_H - TILE) / 2;
  const lx = x + 6 + (TILE - LOGO) / 2;
  const ly = ty + (TILE - LOGO) / 2;
  const textX = x + 6 + TILE + 9;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" role="img" aria-label="${esc(item.label)}">
  <defs>
    <filter id="s" x="-20%" y="-30%" width="140%" height="160%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="#1f2328" flood-opacity="0.12" />
    </filter>
  </defs>
  <style>
    :root { --chip-bg: #ffffff; --chip-border: #e3e9f2; --chip-fg: #1f2328; }
    @media (prefers-color-scheme: dark) {
      :root { --chip-bg: #161b22; --chip-border: #283446; --chip-fg: #e6edf3; }
    }
    .chip { fill: var(--chip-bg); stroke: var(--chip-border); stroke-width: 1; }
    .chip-label { fill: var(--chip-fg); font: 600 13px 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; letter-spacing: .1px; }
  </style>
  <rect x="${x}" y="${y}" width="${cw}" height="${CHIP_H}" rx="10" class="chip" filter="url(#s)" />
  <rect x="${x + 6}" y="${ty}" width="${TILE}" height="${TILE}" rx="7" fill="${item.color}" />
  <svg x="${lx}" y="${ly}" width="${LOGO}" height="${LOGO}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet"><g fill="${logoFill(item.color)}" fill-rule="${fillRule}">${inner}</g></svg>
  <text x="${textX}" y="${y + CHIP_H / 2 + 4.5}" class="chip-label">${esc(item.label)}</text>
</svg>`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const item of LINKS) {
    const svg = await buildChip(item);
    await writeFile(`${OUT_DIR}/${item.name}.svg`, svg, "utf8");
  }
  console.log(`Wrote ${LINKS.length} chips to ${OUT_DIR}/`);
  // Print ready-to-paste README markup.
  console.log("\n--- README markup ---");
  console.log(
    LINKS.map(
      (l) =>
        `<a href="${l.url}"><img src="${OUT_DIR}/${l.name}.svg" alt="${l.label}" height="40" /></a>`
    ).join("\n")
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
