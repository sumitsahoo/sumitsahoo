// =============================================================================
// Self-hosted GitHub Activity card generator
// =============================================================================
// Pulls contribution data from GitHub's own GraphQL API, computes streaks and
// totals, and renders a modern SVG card (light + dark aware via
// prefers-color-scheme). No third-party runtime widget — the README just points
// at the committed static SVG.
//
// Usage:  GITHUB_TOKEN=<token> node scripts/activity.mjs <username> <out.svg>
// =============================================================================

const USER = process.argv[2] || "sumitsahoo";
const OUT = process.argv[3] || "assets/dynamic/activity.svg";
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
  console.error("GITHUB_TOKEN is required");
  process.exit(1);
}

const ACCENT = "#588DF3";

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

// Account creation date — bounds how many yearly windows we fetch.
async function getCreatedAt(login) {
  const data = await gql(
    `query($login:String!){ user(login:$login){ createdAt } }`,
    { login }
  );
  return new Date(data.user.createdAt);
}

// contributionCalendar is capped at a 1-year span, so we query year by year.
// `viewer.restrictedContributionsCount` is the count of PRIVATE contributions
// in the window — GitHub exposes no per-day data for these, only this total,
// and only when the authenticated token belongs to `login`.
async function getYearData(login, from, to) {
  const data = await gql(
    `query($login:String!,$from:DateTime!,$to:DateTime!){
       user(login:$login){
         contributionsCollection(from:$from,to:$to){
           contributionCalendar{
             weeks{ contributionDays{ date contributionCount } }
           }
         }
       }
       viewer{
         login
         contributionsCollection(from:$from,to:$to){
           contributionCalendar{
             weeks{ contributionDays{ date contributionCount } }
           }
           restrictedContributionsCount
         }
       }
     }`,
    { login, from: from.toISOString(), to: to.toISOString() }
  );
  // When the token belongs to this user, read the calendar via `viewer` — a
  // fine-grained PAT has full access to its own data but limited access to the
  // user(login) object (which returns a partial calendar). Otherwise fall back
  // to the public user(login) calendar.
  const isSelf = data.viewer.login.toLowerCase() === login.toLowerCase();
  const coll = isSelf
    ? data.viewer.contributionsCollection
    : data.user.contributionsCollection;
  const days = coll.contributionCalendar.weeks.flatMap((w) =>
    w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount }))
  );
  const restricted = isSelf
    ? data.viewer.contributionsCollection.restrictedContributionsCount
    : 0;
  return { days, restricted };
}

// Private contribution count for an arbitrary window (used for "this month").
async function getRestricted(login, from, to) {
  const data = await gql(
    `query($from:DateTime!,$to:DateTime!){
       viewer{ login contributionsCollection(from:$from,to:$to){ restrictedContributionsCount } }
     }`,
    { from: from.toISOString(), to: to.toISOString() }
  );
  return data.viewer.login.toLowerCase() === login.toLowerCase()
    ? data.viewer.contributionsCollection.restrictedContributionsCount
    : 0;
}

// --- Stats -------------------------------------------------------------------

function computeStats(days) {
  // Dedupe by date (year windows can overlap at boundaries) and sort ascending.
  const byDate = new Map();
  for (const d of days) byDate.set(d.date, d.count);
  const sorted = [...byDate.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yearStr = todayStr.slice(0, 4);
  const monthStr = todayStr.slice(0, 7);

  let total = 0;
  let thisYear = 0;
  let thisMonth = 0;
  let bestDay = 0;

  for (const { date, count } of sorted) {
    total += count;
    if (date.startsWith(yearStr)) thisYear += count;
    if (date.startsWith(monthStr)) thisMonth += count;
    if (count > bestDay) bestDay = count;
  }

  // Current streak: walk backwards from today. Today counting 0 doesn't break
  // the streak (the day isn't over yet); any earlier zero does.
  let current = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const { date, count } = sorted[i];
    if (count > 0) {
      current += 1;
    } else if (date === todayStr) {
      continue;
    } else {
      break;
    }
  }

  // Last ~30 days for the sparkline.
  const spark = sorted.slice(-30).map((d) => d.count);

  return { total, thisYear, thisMonth, current, bestDay, spark };
}

// --- SVG ---------------------------------------------------------------------

const fmt = (n) => n.toLocaleString("en-US");

// Approximate text width (Segoe UI semibold) in px — used to size the identity
// pill without a font library.
const NARROW = "iIl.,:;'|!ftj()[]/ ";
const WIDE = "mwMW";
const CAPS = "ABCDEFGHKNOPQRSUVXYZ";
function charW(ch) {
  if (ch === "@") return 0.74;
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

function sparklinePath(values, x, y, w, h) {
  if (values.length === 0) return "";
  const max = Math.max(1, ...values);
  const step = w / (values.length - 1 || 1);
  return values
    .map((v, i) => {
      const px = x + i * step;
      const py = y + h - (v / max) * h;
      return `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(" ");
}

function sparklineBars(values, x, y, w, h) {
  if (values.length === 0) return "";
  const max = Math.max(1, ...values);
  const gap = 3;
  const bw = (w - gap * (values.length - 1)) / values.length;
  return values
    .map((v, i) => {
      const bh = Math.max(2, (v / max) * h);
      const bx = x + i * (bw + gap);
      const by = y + h - bh;
      return `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(
        1
      )}" height="${bh.toFixed(1)}" rx="2" fill="var(--bar)" />`;
    })
    .join("");
}

function statBlock(x, value, label, w) {
  const cx = x + w / 2;
  return `
    <text x="${cx}" y="0" text-anchor="middle" class="stat-value">${value}</text>
    <text x="${cx}" y="26" text-anchor="middle" class="stat-label">${label}</text>`;
}

function buildSvg(s) {
  const W = 1000;
  // No in-card title (the README already has a "GitHub Activity" heading); only
  // the username + GitHub mark sit at the top-right, content shifted up to suit.
  const H = 200;
  const pad = 40;

  const stats = [
    { value: fmt(s.total), label: "Total Contributions" },
    { value: fmt(s.thisYear), label: "This Year" },
    { value: fmt(s.thisMonth), label: "This Month" },
    { value: `${fmt(s.current)} ${s.current === 1 ? "day" : "days"}`, label: "Current Streak" },
    { value: fmt(s.bestDay), label: "Best Day" },
  ];

  const colW = (W - pad * 2) / stats.length;
  const statY = 74;
  let statsSvg = "";
  stats.forEach((st, i) => {
    const x = pad + i * colW;
    statsSvg += `<g transform="translate(${x},${statY})">${statBlock(
      0,
      st.value,
      st.label,
      colW
    )}</g>`;
    if (i < stats.length - 1) {
      const dx = pad + (i + 1) * colW;
      statsSvg += `<line x1="${dx}" y1="${statY - 18}" x2="${dx}" y2="${
        statY + 30
      }" class="divider" />`;
    }
  });

  // Top-right identity pill: GitHub mark + @username (replaces the removed
  // title). Left-anchored inside a right-aligned pill, so spacing is exact.
  const uname = `@${USER}`;
  const idLogo = 15;
  const idGap = 8;
  const idPadL = 12;
  const idPadR = 14;
  const pillH = 28;
  const pillW = idPadL + idLogo + idGap + Math.ceil(textW(uname, 13)) + idPadR;
  const pillX = W - pad - pillW;
  const pillY = 22;
  const pillCY = pillY + pillH / 2;

  // Sparkline of last 30 days across the bottom.
  const sparkX = pad;
  const sparkY = 150;
  const sparkW = W - pad * 2;
  const sparkH = 28;
  const bars = sparklineBars(s.spark, sparkX, sparkY, sparkW, sparkH);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" role="img" aria-label="GitHub activity for ${USER}">
  <style>
    :root {
      --bg: #ffffff;
      --border: #d0d7de;
      --title: #1f2328;
      --value: #1f2328;
      --label: #656d76;
      --divider: #d8dee4;
      --bar: ${ACCENT};
      --track: #eef2f7;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0d1117;
        --border: #30363d;
        --title: #e6edf3;
        --value: #e6edf3;
        --label: #8b949e;
        --divider: #21262d;
        --bar: ${ACCENT};
        --track: #161b22;
      }
    }
    .card { fill: var(--bg); stroke: var(--border); }
    .identity { fill: var(--title); font: 600 13px 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; }
    .id-pill { fill: var(--track); stroke: var(--border); stroke-width: 1; }
    .gh-logo { fill: var(--title); }
    .stat-value { fill: var(--value); font: 700 26px 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; }
    .stat-label { fill: var(--label); font: 400 12px 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; letter-spacing: .3px; }
    .divider { stroke: var(--divider); stroke-width: 1; }
    .spark-label { fill: var(--label); font: 400 11px 'Segoe UI', Ubuntu, Helvetica, Arial, sans-serif; }
  </style>

  <rect class="card" x="1" y="1" width="${W - 2}" height="${H - 2}" rx="16" stroke-width="1.5" />

  <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" class="id-pill" />
  <svg x="${pillX + idPadL}" y="${pillCY - idLogo / 2}" width="${idLogo}" height="${idLogo}" viewBox="0 0 24 24"><path class="gh-logo" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
  <text x="${pillX + idPadL + idLogo + idGap}" y="${pillCY + 4.5}" class="identity">${uname}</text>

  ${statsSvg}

  <text x="${pad}" y="${sparkY - 8}" class="spark-label">Last 30 days</text>
  ${
    s.inclPrivate
      ? `<text x="${W - pad}" y="${sparkY - 8}" text-anchor="end" class="spark-label">Totals include private contributions</text>`
      : ""
  }
  ${bars}
</svg>`;
}

// --- Main --------------------------------------------------------------------

async function main() {
  const createdAt = await getCreatedAt(USER);
  const now = new Date();

  const allDays = [];
  let totalRestricted = 0;
  let thisYearRestricted = 0;
  const currentYear = now.getUTCFullYear();
  for (let year = createdAt.getUTCFullYear(); year <= currentYear; year++) {
    const from = new Date(Date.UTC(year, 0, 1));
    const to = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
    // Clamp the first window to the account creation date.
    const start = from < createdAt ? createdAt : from;
    const end = to > now ? now : to;
    if (start > end) continue;
    const { days, restricted } = await getYearData(USER, start, end);
    allDays.push(...days);
    totalRestricted += restricted;
    if (year === currentYear) thisYearRestricted = restricted;
  }

  // Private count for the current month (no per-day data exists for these).
  const monthStart = new Date(Date.UTC(currentYear, now.getUTCMonth(), 1));
  const thisMonthRestricted = await getRestricted(USER, monthStart, now);

  // Public daily stats drive streak / best day / sparkline (no private daily
  // data exists); the headline totals add the private aggregates on top.
  const pub = computeStats(allDays);
  const stats = {
    ...pub,
    total: pub.total + totalRestricted,
    thisYear: pub.thisYear + thisYearRestricted,
    thisMonth: pub.thisMonth + thisMonthRestricted,
    inclPrivate: totalRestricted > 0,
  };
  const svg = buildSvg(stats);

  const { writeFile, mkdir } = await import("node:fs/promises");
  const { dirname } = await import("node:path");
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, svg, "utf8");

  console.log(`Wrote ${OUT}`);
  console.log(stats);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
