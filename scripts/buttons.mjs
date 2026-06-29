// =============================================================================
// Reusable link-button generator
// =============================================================================
// Emits small, reusable light/dark-aware button SVGs into assets/static/buttons/
// in the same chip design language as techstack/social. Two variants:
//
//   • neutral  — a chip-button (brand icon tile + label), e.g. "View on GitHub"
//   • accent   — a solid-accent CTA (inline icon + label),  e.g. "Live Demo"
//
// SVGs embedded via <img> can't carry links, so the README wraps each button in
// its own <a href>. The same button image is reused across every project (the
// href differs per project), so adding a project needs no new asset.
//
// Usage:  node scripts/buttons.mjs [outDir]
// =============================================================================

import { readFile, writeFile, mkdir } from "node:fs/promises";

const OUT_DIR = process.argv[2] || "assets/static/buttons";
const SOCIAL_LOGO_DIR = new URL("../assets/logos/social/", import.meta.url);
const ACCENT = "#588DF3";

// Inline 24-viewBox glyphs that aren't pulled from a bundled brand logo.
const GLYPHS = {
  globe:
    "M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.91 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.65-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z",
};

// --- helpers (self-contained, mirroring techstack/social) --------------------

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
  let raw = await readFile(new URL(`${slug}.svg`, SOCIAL_LOGO_DIR), "utf8");
  raw = raw
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<title>[\s\S]*?<\/title>/gi, "");
  const viewBox = (raw.match(/viewBox="([^"]*)"/i) || [])[1] || "0 0 24 24";
  let inner = (raw.match(/<svg\b[^>]*>([\s\S]*)<\/svg>/i) || [])[1] || "";
  inner = inner.replace(/\sfill="[^"]*"/gi, "").trim();
  return { viewBox, inner };
}

// --- buttons -----------------------------------------------------------------

const BTN_H = 34;
const M = 5; // margin so the drop shadow isn't clipped

const SHADOW = `<filter id="s" x="-20%" y="-30%" width="140%" height="160%"><feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="#1f2328" flood-opacity="0.12" /></filter>`;

const THEME = `:root { --chip-bg: #ffffff; --chip-border: #e3e9f2; --chip-fg: #1f2328; }
    @media (prefers-color-scheme: dark) { :root { --chip-bg: #161b22; --chip-border: #283446; --chip-fg: #e6edf3; } }`;

// Neutral chip-button: brand icon tile + label (e.g. View on GitHub).
async function neutralButton(label, logoSlug, tileColor) {
  const tile = 22;
  const logo = 14;
  const padL = 6;
  const gap = 9;
  const padR = 13;
  const { viewBox, inner } = await loadLogo(logoSlug);

  const cw = padL + tile + gap + Math.ceil(textW(label, 13)) + padR;
  const W = cw + M * 2;
  const H = BTN_H + M * 2;
  const ty = M + (BTN_H - tile) / 2;
  const lx = M + padL + (tile - logo) / 2;
  const ly = ty + (tile - logo) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" role="img" aria-label="${esc(label)}">
  <defs>${SHADOW}</defs>
  <style>
    ${THEME}
    .btn { fill: var(--chip-bg); stroke: var(--chip-border); stroke-width: 1; }
    .btn-label { fill: var(--chip-fg); font: 600 13px 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; letter-spacing: .1px; }
  </style>
  <rect x="${M}" y="${M}" width="${cw}" height="${BTN_H}" rx="10" class="btn" filter="url(#s)" />
  <rect x="${M + padL}" y="${ty}" width="${tile}" height="${tile}" rx="7" fill="${tileColor}" />
  <svg x="${lx}" y="${ly}" width="${logo}" height="${logo}" viewBox="${viewBox}"><g fill="#ffffff">${inner}</g></svg>
  <text x="${M + padL + tile + gap}" y="${M + BTN_H / 2 + 4.5}" class="btn-label">${esc(label)}</text>
</svg>`;
}

// Accent CTA: solid-accent pill, inline white glyph + label (e.g. Live Demo).
function accentButton(label, glyph) {
  const icon = 16;
  const padL = 14;
  const gap = 8;
  const padR = 16;

  const cw = padL + icon + gap + Math.ceil(textW(label, 13)) + padR;
  const W = cw + M * 2;
  const H = BTN_H + M * 2;
  const iy = M + (BTN_H - icon) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" role="img" aria-label="${esc(label)}">
  <defs>${SHADOW}</defs>
  <style>
    .cta { fill: ${ACCENT}; }
    .cta-label { fill: #ffffff; font: 600 13px 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; letter-spacing: .1px; }
  </style>
  <rect x="${M}" y="${M}" width="${cw}" height="${BTN_H}" rx="10" class="cta" filter="url(#s)" />
  <svg x="${M + padL}" y="${iy}" width="${icon}" height="${icon}" viewBox="0 0 24 24"><path d="${GLYPHS[glyph]}" fill="#ffffff" /></svg>
  <text x="${M + padL + icon + gap}" y="${M + BTN_H / 2 + 4.5}" class="cta-label">${esc(label)}</text>
</svg>`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const files = {
    "view-on-github.svg": await neutralButton("View on GitHub", "github", "#181717"),
    "live-demo.svg": accentButton("Live Demo", "globe"),
  };
  for (const [name, svg] of Object.entries(files)) {
    await writeFile(`${OUT_DIR}/${name}`, svg, "utf8");
  }
  console.log(`Wrote ${Object.keys(files).length} buttons to ${OUT_DIR}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
