// =============================================================================
// Self-hosted NPM downloads chip generator
// =============================================================================
// Replaces the third-party shields.io npm badges with self-hosted pill chips
// that match the profile stats card (assets/dynamic/stats.svg). One SVG is
// emitted per package so each chip can be wrapped in an <a> in the README and
// link straight to its npm page (GitHub strips <a> inside an <img> SVG, so the
// clickable region has to be a separate image — same pattern as the Featured
// Projects buttons). A leading "Total" chip links to the npm profile.
//
// Public npm download stats — no token required.
//
// Usage:  node scripts/npm.mjs <out-dir> <pkg> [<pkg> ...]
// =============================================================================

import { writeFile, mkdir } from "node:fs/promises";

const OUT_DIR = process.argv[2] || "assets/dynamic/npm";
const PKGS =
  process.argv.slice(3).length > 0
    ? process.argv.slice(3)
    : ["web-haptic-engine", "modern-barcode-scanner", "detect-primary-camera"];
const ACCENT = "#588DF3";

// 16x16 octicon glyphs.
const ICONS = {
  download:
    "M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Zm5.47-2.47-3.75-3.75a.75.75 0 0 1 1.06-1.06l2.72 2.72V1.75a.75.75 0 0 1 1.5 0v7.69l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.75 3.75a.75.75 0 0 1-1.06 0Z",
  package:
    "M8.878.392a1.75 1.75 0 0 0-1.756 0l-5.25 3.045A1.75 1.75 0 0 0 1 4.951v6.098c0 .624.332 1.2.872 1.514l5.25 3.045a1.75 1.75 0 0 0 1.756 0l5.25-3.045c.54-.313.872-.89.872-1.514V4.951c0-.624-.332-1.2-.872-1.514L8.878.392ZM7.875 1.69a.25.25 0 0 1 .25 0l4.63 2.685L8 7.133 3.245 4.375l4.63-2.685ZM2.5 5.677v5.372c0 .09.047.171.125.216l4.625 2.683V8.432Zm6.25 8.271 4.625-2.683a.25.25 0 0 0 .125-.216V5.677L8.75 8.432Z",
};

// --- npm registry ------------------------------------------------------------

async function lastYearDownloads(pkg) {
  const res = await fetch(
    `https://api.npmjs.org/downloads/point/last-year/${pkg}`,
    { headers: { "User-Agent": "sumitsahoo-readme" } }
  );
  if (!res.ok) throw new Error(`npm HTTP ${res.status} for ${pkg}`);
  const json = await res.json();
  return json.downloads ?? 0;
}

// --- SVG (chip styling mirrors scripts/stats.mjs) ----------------------------

const fmt = (n) => n.toLocaleString("en-US");

// Approximate text width without a font library — tuned for the chip fonts.
function textW(s, size) {
  let t = 0;
  for (const ch of s) {
    if ("iIl.,:;'|!ftj()[]/ ".includes(ch)) t += 0.34;
    else if ("mwMW".includes(ch)) t += 0.92;
    else if ("ABCDEFGHKNOPQRSUVXYZ".includes(ch)) t += 0.68;
    else if (ch >= "0" && ch <= "9") t += 0.56;
    else t += 0.53;
  }
  return t * size;
}

// One self-contained chip SVG. `cta` (e.g. "npm ↗") sits to the right of the
// value as a subtle call-to-action so the chip reads as a clickable link.
function buildChip(icon, value, label, cta) {
  const chipH = 52;
  const margin = 8; // breathing room so the drop shadow isn't clipped
  const bs = 32; // icon badge side
  const padL = 13;
  const badgeGap = 11;
  const padR = 16;
  const ctaGap = 12;

  const cy = chipH / 2;
  const textX = padL + bs + badgeGap;
  const valueW = textW(value, 21);
  const ctaW = cta ? Math.ceil(textW(cta, 12)) + ctaGap : 0;
  const labelW = textW(label, 11);
  const contentW = padL + bs + badgeGap + Math.max(valueW + ctaW, labelW) + padR;
  const W = Math.ceil(contentW) + margin * 2;
  const H = chipH + margin * 2;

  const ctaSvg = cta
    ? `<text x="${textX + valueW + ctaGap}" y="${cy - 3}" class="chip-cta">${cta}</text>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" role="img" aria-label="${label}: ${value} downloads in the last year">
  <defs>
    <filter id="chipShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#1f2328" flood-opacity="0.10" />
    </filter>
  </defs>
  <style>
    :root {
      --chip-bg: #ffffff;
      --chip-border: #e3e9f2;
      --value: #1f2328;
      --label: #656d76;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --chip-bg: #0f141b;
        --chip-border: #283446;
        --value: #e6edf3;
        --label: #8b949e;
      }
    }
    .chip { fill: var(--chip-bg); stroke: var(--chip-border); stroke-width: 1; }
    .chip-value { fill: var(--value); font: 800 21px 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; letter-spacing: .2px; }
    .chip-label { fill: var(--label); font: 500 11px 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; letter-spacing: .4px; }
    .chip-cta { fill: ${ACCENT}; font: 700 12px 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; letter-spacing: .3px; }
  </style>
  <g transform="translate(${margin},${margin})">
    <rect x="0" y="0" width="${W - margin * 2}" height="${chipH}" rx="12" class="chip" filter="url(#chipShadow)" />
    <rect x="${padL}" y="${cy - bs / 2}" width="${bs}" height="${bs}" rx="9" fill="${ACCENT}" fill-opacity="0.14" />
    <svg x="${padL + (bs - 17) / 2}" y="${cy - 17 / 2}" width="17" height="17" viewBox="0 0 16 16"><path d="${ICONS[icon]}" fill="${ACCENT}" /></svg>
    <text x="${textX}" y="${cy - 2}" class="chip-value">${value}</text>
    ${ctaSvg}
    <text x="${textX}" y="${cy + 13}" class="chip-label">${label}</text>
  </g>
</svg>`;
}

// --- main --------------------------------------------------------------------

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const items = [];
  for (const pkg of PKGS) {
    const downloads = await lastYearDownloads(pkg);
    items.push({ pkg, downloads });
  }

  // Per-package chips — each becomes an <a> to its npm page in the README.
  for (const it of items) {
    const svg = buildChip("package", fmt(it.downloads), it.pkg, "npm ↗");
    await writeFile(`${OUT_DIR}/${it.pkg}.svg`, svg, "utf8");
  }

  // Total chip — links to the npm profile.
  const total = items.reduce((s, it) => s + it.downloads, 0);
  await writeFile(
    `${OUT_DIR}/total.svg`,
    buildChip("download", fmt(total), "Total / year", "npm ↗"),
    "utf8"
  );

  console.log(`Wrote ${items.length + 1} chips to ${OUT_DIR}/`);
  console.log(items);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
