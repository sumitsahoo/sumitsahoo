// =============================================================================
// Profile stats chip strip generator
// =============================================================================
// Self-hosted replacement for the default shields row. Fetches followers, total
// stars, public repos, and lifetime contributions from GitHub's GraphQL API and
// renders a light/dark-aware strip of pill chips matching the other cards.
//
// Uses public data only — the built-in GITHUB_TOKEN is sufficient.
//
// Usage:  GITHUB_TOKEN=<token> node scripts/stats.mjs <username> <out.svg>
// =============================================================================

import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const USER = process.argv[2] || "sumitsahoo";
const OUT = process.argv[3] || "assets/dynamic/stats.svg";
const TOKEN = process.env.GITHUB_TOKEN;
const ACCENT = "#588DF3";

if (!TOKEN) {
  console.error("GITHUB_TOKEN is required");
  process.exit(1);
}

// 16x16 octicon glyphs.
const ICONS = {
  people:
    "M2 5.5a3.5 3.5 0 1 1 5.898 2.549 5.508 5.508 0 0 1 3.034 4.084.75.75 0 1 1-1.482.235 4 4 0 0 0-7.9 0 .75.75 0 0 1-1.482-.236A5.507 5.507 0 0 1 3.102 8.05 3.493 3.493 0 0 1 2 5.5ZM11 4a3.001 3.001 0 0 1 2.22 5.018 5.01 5.01 0 0 1 2.56 3.012.749.749 0 0 1-.885.954.752.752 0 0 1-.549-.514 3.507 3.507 0 0 0-2.522-2.372.75.75 0 0 1-.574-.73v-.352a.75.75 0 0 1 .416-.672A1.5 1.5 0 0 0 11 5.5.75.75 0 0 1 11 4Zm-5.5-.5a2 2 0 1 0-.001 3.999A2 2 0 0 0 5.5 3.5Z",
  star:
    "M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z",
  repo:
    "M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z",
  pulse:
    "M6 2c.306 0 .582.187.696.471L10 10.731l1.304-3.26A.751.751 0 0 1 12 7h3.25a.75.75 0 0 1 0 1.5h-2.742l-1.812 4.528a.751.751 0 0 1-1.392 0L6 4.77 4.696 8.03A.75.75 0 0 1 4 8.5H.75a.75.75 0 0 1 0-1.5h2.742l1.812-4.529A.751.751 0 0 1 6 2Z",
  eye:
    "M8 2c1.981 0 3.671.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.45.678-1.367 1.932-2.637 3.023C11.67 13.008 9.981 14 8 14c-1.981 0-3.671-.992-4.933-2.078C1.797 10.831.88 9.577.43 8.899a1.62 1.62 0 0 1 0-1.798c.45-.678 1.367-1.932 2.637-3.023C4.33 2.992 6.019 2 8 2Zm0 1.5c-1.473 0-2.825.742-3.955 1.715-1.124.967-1.954 2.096-2.366 2.717a.119.119 0 0 0 0 .136c.412.621 1.242 1.75 2.366 2.717C5.175 11.758 6.527 12.5 8 12.5c1.473 0 2.825-.742 3.955-1.715 1.124-.967 1.954-2.096 2.366-2.717a.119.119 0 0 0 0-.136c-.412-.621-1.242-1.75-2.366-2.717C10.825 4.242 9.473 3.5 8 3.5ZM8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z",
};

// --- GitHub GraphQL ----------------------------------------------------------

async function gql(query, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": USER,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(`GraphQL: ${JSON.stringify(json.errors)}`);
  return json.data;
}

async function getProfile(login) {
  const data = await gql(
    `query($login:String!){
       user(login:$login){
         createdAt
         followers { totalCount }
         repositories(privacy: PUBLIC, ownerAffiliations: OWNER){ totalCount }
         topRepos: repositories(ownerAffiliations: OWNER, first: 100, orderBy:{field: STARGAZERS, direction: DESC}){
           nodes { stargazerCount }
         }
       }
     }`,
    { login }
  );
  const u = data.user;
  const stars = u.topRepos.nodes.reduce((s, r) => s + r.stargazerCount, 0);
  return {
    followers: u.followers.totalCount,
    repos: u.repositories.totalCount,
    stars,
    createdYear: new Date(u.createdAt).getUTCFullYear(),
  };
}

// Lifetime contributions = sum of each year's calendar total (one aliased query).
async function getContributions(login, fromYear) {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  let fields = "";
  for (let y = fromYear; y <= currentYear; y++) {
    const from = `${y}-01-01T00:00:00Z`;
    const to = y === currentYear ? now.toISOString() : `${y}-12-31T23:59:59Z`;
    fields += `y${y}: contributionsCollection(from:"${from}",to:"${to}"){ contributionCalendar{ totalContributions } }\n`;
  }
  const data = await gql(
    `query($login:String!){ user(login:$login){ ${fields} } }`,
    { login }
  );
  return Object.values(data.user).reduce(
    (s, c) => s + c.contributionCalendar.totalContributions,
    0
  );
}

// Profile views are read from komarev's counter badge (the only thing that can
// count README loads). A hidden 1px komarev image in the README keeps the count
// incrementing on real visits; this just reads the current value at build time.
async function getProfileViews(login) {
  try {
    const res = await fetch(`https://komarev.com/ghpvc/?username=${login}`, {
      headers: { "User-Agent": login },
    });
    if (!res.ok) return null;
    const svg = await res.text();
    const texts = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) =>
      m[1].trim().replace(/,/g, "")
    );
    const num = texts.find((t) => /^\d+$/.test(t));
    return num ? parseInt(num, 10) : null;
  } catch {
    return null;
  }
}

// --- SVG ---------------------------------------------------------------------

const fmt = (n) => n.toLocaleString("en-US");

function chip(x, w, h, icon, value, label) {
  const cy = h / 2;
  // Accent-tinted rounded-square icon badge.
  const bs = 32; // badge side
  const bx = x + 13;
  const by = cy - bs / 2;
  const iconSize = 17;
  const textX = bx + bs + 11;
  return `
    <rect x="${x}" y="0" width="${w}" height="${h}" rx="12" class="chip" filter="url(#chipShadow)" />
    <rect x="${bx}" y="${by}" width="${bs}" height="${bs}" rx="9" fill="${ACCENT}" fill-opacity="0.14" />
    <svg x="${bx + (bs - iconSize) / 2}" y="${by + (bs - iconSize) / 2}" width="${iconSize}" height="${iconSize}" viewBox="0 0 16 16"><path d="${ICONS[icon]}" fill="${ACCENT}" /></svg>
    <text x="${textX}" y="${cy - 2}" class="chip-value">${value}</text>
    <text x="${textX}" y="${cy + 13}" class="chip-label">${label}</text>`;
}

function buildSvg(s) {
  const chips = [
    { icon: "people", value: fmt(s.followers), label: "Followers" },
    { icon: "star", value: fmt(s.stars), label: "Total Stars" },
    { icon: "repo", value: fmt(s.repos), label: "Public Repos" },
    { icon: "pulse", value: fmt(s.contributions), label: "Contributions" },
  ];
  if (s.views != null) {
    chips.push({ icon: "eye", value: fmt(s.views), label: "Profile Views" });
  }

  const chipW = 150;
  const chipH = 52;
  const gap = 12;
  const margin = 8; // breathing room so the drop shadow isn't clipped at the edges

  let body = "";
  chips.forEach((c, i) => {
    const x = i * (chipW + gap);
    body += chip(x, chipW, chipH, c.icon, c.value, c.label);
  });

  const contentW = chips.length * chipW + (chips.length - 1) * gap;
  const W = contentW + margin * 2;
  const H = chipH + margin * 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" role="img" aria-label="GitHub profile stats">
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
  </style>
  <g transform="translate(${margin},${margin})">${body}</g>
</svg>`;
}

// --- main --------------------------------------------------------------------

async function main() {
  const profile = await getProfile(USER);
  const contributions = await getContributions(USER, profile.createdYear);
  const views = await getProfileViews(USER);
  const stats = { ...profile, contributions, views };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, buildSvg(stats), "utf8");
  console.log(`Wrote ${OUT}`);
  console.log(stats);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
