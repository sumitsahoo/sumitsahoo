// =============================================================================
// Reusable link-button generator
// =============================================================================
// Emits small, reusable light/dark-aware button SVGs into assets/static/buttons/
// in the SAME chip design language as the stats / npm / techstack cards: a
// white-or-dark rounded card with a 1px border + soft shadow, an accent-tinted
// rounded-square icon badge, and a label. Two ready-made buttons:
//
//   • view-on-github.svg — GitHub mark badge + "View on GitHub"
//   • live-<key>.svg      — globe badge + production URL + a trailing ↗
//
// SVGs embedded via <img> can't carry links, so the README wraps each button in
// its own <a href>. "View on GitHub" is identical for every project (only the
// href differs), so it stays a single reusable file.
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

// --- unified chip-button -----------------------------------------------------

const BTN_H = 34;
const M = 5; // margin so the drop shadow isn't clipped
const BADGE = 24; // accent-tinted icon tile
const ICON = 14;
const PAD_L = 6;
const GAP = 9;
const PAD_R = 13;
const ARROW = "↗";
const ARROW_GAP = 6;

const SHADOW = `<filter id="s" x="-20%" y="-30%" width="140%" height="160%"><feDropShadow dx="0" dy="1.5" stdDeviation="2.5" flood-color="#1f2328" flood-opacity="0.12" /></filter>`;

const THEME = `:root { --chip-bg: #ffffff; --chip-border: #e3e9f2; --chip-fg: #1f2328; }
    @media (prefers-color-scheme: dark) { :root { --chip-bg: #161b22; --chip-border: #283446; --chip-fg: #e6edf3; } }`;

// Intrinsic content width of a chip-button (no fixed-width override).
function chipButtonW(label, trailing = "") {
  const labelW = Math.ceil(textW(label, 13));
  const trailW = trailing ? ARROW_GAP + Math.ceil(textW(trailing, 13)) : 0;
  return PAD_L + BADGE + GAP + labelW + trailW + PAD_R;
}

// White/dark chip card + accent icon badge + label (+ optional trailing glyph).
// `viewBox`/`inner` render the icon, recoloured to the accent. Pass `fixedCw` to
// force a shared card width across a set (e.g. the live buttons): the label
// stays left-aligned and the trailing glyph is pinned to the right edge so the
// buttons line up uniformly.
function chipButton(label, viewBox, inner, trailing = "", fixedCw = 0) {
  const labelW = Math.ceil(textW(label, 13));
  const cw = fixedCw || chipButtonW(label, trailing);
  const W = cw + M * 2;
  const H = BTN_H + M * 2;

  const cy = M + BTN_H / 2;
  const badgeX = M + PAD_L;
  const badgeY = cy - BADGE / 2;
  const iconX = badgeX + (BADGE - ICON) / 2;
  const iconY = cy - ICON / 2;
  const textX = M + PAD_L + BADGE + GAP;
  const trailW = trailing ? Math.ceil(textW(trailing, 13)) : 0;
  // Pin the glyph to the right edge when a shared width is forced; otherwise it
  // sits right after the label.
  const trailX = fixedCw
    ? M + cw - PAD_R - trailW
    : textX + labelW + ARROW_GAP;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" role="img" aria-label="${esc(label)}">
  <defs>${SHADOW}</defs>
  <style>
    ${THEME}
    .btn { fill: var(--chip-bg); stroke: var(--chip-border); stroke-width: 1; }
    .btn-label { fill: var(--chip-fg); font: 600 13px 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; letter-spacing: .1px; }
    .btn-arrow { fill: ${ACCENT}; font: 700 13px 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; }
  </style>
  <rect x="${M}" y="${M}" width="${cw}" height="${BTN_H}" rx="10" class="btn" filter="url(#s)" />
  <rect x="${badgeX}" y="${badgeY}" width="${BADGE}" height="${BADGE}" rx="7" fill="${ACCENT}" fill-opacity="0.14" />
  <svg x="${iconX}" y="${iconY}" width="${ICON}" height="${ICON}" viewBox="${viewBox}"><g fill="${ACCENT}">${inner}</g></svg>
  <text x="${textX}" y="${cy + 4.5}" class="btn-label">${esc(label)}</text>
  ${trailing ? `<text x="${trailX}" y="${cy + 4.5}" class="btn-arrow">${esc(trailing)}</text>` : ""}
</svg>`;
}

// Live-site CTAs show the real production URL so it's memorable.
const LIVE = [
  { key: "cloakpdf", domain: "pdf.cloakyard.com" },
  { key: "cloakresume", domain: "resume.cloakyard.com" },
  { key: "cloakimg", domain: "img.cloakyard.com" },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const gh = await loadLogo("github");
  const globe = { viewBox: "0 0 24 24", inner: `<path d="${GLYPHS.globe}" />` };

  const files = {
    "view-on-github.svg": chipButton("View on GitHub", gh.viewBox, gh.inner),
  };
  // One shared width (from the longest domain) so every live button is uniform.
  const liveCw = Math.max(...LIVE.map((p) => chipButtonW(p.domain, ARROW)));
  for (const p of LIVE) {
    files[`live-${p.key}.svg`] = chipButton(
      p.domain,
      globe.viewBox,
      globe.inner,
      ARROW,
      liveCw
    );
  }

  for (const [name, svg] of Object.entries(files)) {
    await writeFile(`${OUT_DIR}/${name}`, svg, "utf8");
  }
  console.log(`Wrote ${Object.keys(files).length} buttons to ${OUT_DIR}/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
