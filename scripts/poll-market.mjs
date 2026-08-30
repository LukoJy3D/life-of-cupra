import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const snapshotPath = join(root, "data", "market-snapshot.json");
const historyPath = join(root, "data", "market-history.yaml");
const market = yaml.load(readFileSync(join(root, "data", "market.yaml"), "utf8"));
const poll = market.poll ?? {};

const yearMin = Number(poll.year_min ?? 2023);
const yearMax = Number(poll.year_max ?? 2025);
const hpMin = Number(poll.power_ps_min ?? 300);
const hpMax = Number(poll.power_ps_max ?? 330);
const kwMin = Number(poll.power_kw_min ?? Math.round(hpMin * 0.735));
const kwMax = Number(poll.power_kw_max ?? Math.round(hpMax * 0.735));
const limit = Number(poll.limit ?? 12);
const needles = (poll.engine_needles ?? []).map((s) => String(s).toLowerCase());
const exclude = (poll.exclude_needles ?? []).map((s) => String(s).toLowerCase());

const query = new URL("https://www.autoscout24.com/lst/cupra/formentor");
query.searchParams.set("atype", "C");
query.searchParams.set("desc", "0");
query.searchParams.set("sort", "price");
query.searchParams.set("ustate", "N,U");
query.searchParams.set("powertype", "kw");
query.searchParams.set("powerfrom", String(kwMin));
query.searchParams.set("powerto", String(kwMax));
query.searchParams.set("fregfrom", String(yearMin));
query.searchParams.set("fregto", String(yearMax));

function writeSnapshot(payload) {
  writeFileSync(snapshotPath, `${JSON.stringify(payload, null, 2)}\n`);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function formatHistoryRow(row) {
  const lines = [
    `  - month: "${row.month}"`,
    `    median_eur: ${row.median_eur}`,
    `    n: ${row.n}`,
    `    source: ${row.source}`,
  ];
  if (row.note) {
    const safe = String(row.note).replace(/"/g, '\\"');
    lines.push(`    note: "${safe}"`);
  }
  return lines.join("\n");
}

function upsertHistory(month, medianEur, n) {
  let doc = { months: [] };
  try {
    doc = yaml.load(readFileSync(historyPath, "utf8")) ?? { months: [] };
  } catch {
    /* first run */
  }
  const existing = (doc.months ?? []).find((row) => row.month === month);
  if (existing?.source === "backfill") return;
  const months = (doc.months ?? []).filter((row) => row.month !== month);
  months.push({
    month,
    median_eur: Math.round(medianEur),
    n,
    source: "autoscout24",
  });
  months.sort((a, b) => a.month.localeCompare(b.month));
  const header = [
    "# Typical MY24 Formentor VZ 2.0 ~310 hp average asking path.",
    "# Scaled in the model to each car's list price. Poll does not overwrite source: backfill.",
  ];
  if (doc.baseline_eur != null) header.push(`baseline_month: "${doc.baseline_month ?? ""}"`);
  if (doc.baseline_eur != null) header.push(`baseline_eur: ${doc.baseline_eur}`);
  writeFileSync(
    historyPath,
    `${header.join("\n")}\nmonths:\n${months.map(formatHistoryRow).join("\n")}\n`,
  );
}

function detail(listing, label, icon) {
  const rows = listing.vehicleDetails ?? [];
  const byAria = rows.find((d) => d.ariaLabel === label);
  if (byAria?.data) return byAria.data;
  const byIcon = rows.find((d) => d.iconName === icon);
  return byIcon?.data ?? "";
}

function parsePrice(listing) {
  const raw = Number(listing.price?.priceRaw);
  if (Number.isFinite(raw) && raw > 0) return raw;
  const digits = String(listing.price?.priceFormatted ?? "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

function parseKm(text) {
  const n = String(text).replace(/[^\d]/g, "");
  return n ? Number(n) : null;
}

function parseYear(text) {
  const m = String(text).match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

function parseHp(text) {
  const m = String(text).match(/(\d+)\s*hp/i);
  return m ? Number(m[1]) : null;
}

function blob(listing) {
  return [
    listing.vehicle?.motorTypeName,
    listing.vehicle?.modelVersionInput,
    listing.vehicle?.modelVersionCustom,
    ...(listing.vehicleDetails ?? []).map((d) => d.data),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function keep(listing) {
  const text = blob(listing);
  if (
    needles.length &&
    !needles.every((n) =>
      n === "2.0" ? text.includes("2.0") || text.includes("2,0") : text.includes(n),
    )
  ) {
    return false;
  }
  if (exclude.some((n) => text.includes(n))) return false;
  const year = parseYear(detail(listing, "First registration", "calendar"));
  if (year != null && (year < yearMin || year > yearMax)) return false;
  const hp = parseHp(detail(listing, "Power", "speedometer"));
  if (hp != null && (hp < hpMin || hp > hpMax)) return false;
  return parsePrice(listing) != null;
}

function toComp(listing) {
  const year = parseYear(detail(listing, "First registration", "calendar"));
  const km = parseKm(
    listing.vehicle?.mileageInKm ?? detail(listing, "Mileage", "mileage_road"),
  );
  const path = listing.url?.startsWith("http")
    ? listing.url
    : `https://www.autoscout24.com${listing.url ?? ""}`;
  return {
    date: new Date().toISOString().slice(0, 10),
    asking_eur: parsePrice(listing),
    year: year ?? yearMin,
    km: km ?? 0,
    engine: listing.vehicle?.modelVersionInput || listing.vehicle?.motorTypeName || "Formentor",
    url: path,
  };
}

try {
  const res = await fetch(query, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      "accept-language": "en-GB,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`AutoScout24 HTTP ${res.status}`);
  const html = await res.text();
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/,
  );
  if (!match) throw new Error("AutoScout24 page had no listing payload");
  const page = JSON.parse(match[1]);
  const listings = page?.props?.pageProps?.listings ?? [];
  const comps = listings.filter(keep).slice(0, limit).map(toComp);
  writeSnapshot({
    polled_at: new Date().toISOString(),
    source: "autoscout24",
    query: query.toString(),
    error: comps.length ? null : "No listings matched VZ 2.0 ~310 filters",
    comps,
  });
  const mid = median(comps.map((c) => c.asking_eur));
  if (mid != null) {
    const month = new Date().toISOString().slice(0, 7);
    upsertHistory(month, mid, comps.length);
  }
  console.log(`poll-market: ${comps.length} comps from ${listings.length} listings; median ${mid}`);
} catch (err) {
  const previous = JSON.parse(readFileSync(snapshotPath, "utf8"));
  writeSnapshot({
    ...previous,
    error: String(err.message ?? err),
  });
  console.error("poll-market failed, kept previous snapshot:", err.message);
  process.exitCode = 0;
}
