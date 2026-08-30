import type { Dataset, Model } from "../types";
import { eur, included, iso, km, num } from "./format";

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderPage(root: HTMLElement, data: Dataset, model: Model): void {
  const v = data.vehicle;
  const l = data.lease;
  const leftover = model.allowanceToDate - model.drivenKm;

  root.innerHTML = `
    <header class="mast">
      <p class="eyebrow">Life of Cupra${model.example ? ' <span class="pill">example data</span>' : ""}</p>
      <h1>${esc(v.name)} <em>${esc(v.trim)}</em></h1>
      <p class="lede">
        ${esc(v.engine)} · ${v.power_ps} PS · private lease ${iso(model.leaseStart)} → ${iso(model.leaseEnd)}.
        You do not own this car. Sunk cash is use, not depreciation.
        ${model.drivenKm === 0 ? " Fuel and odometer not logged yet." : ""}
      </p>
    </header>

    <section class="kpis" aria-label="Headline numbers">
      ${kpi("Sunk so far", eur(model.sunk.total), `${model.paymentsMade} lease payments + extras. Includes the €8k down payment.`)}
      ${kpi("Typical month", eur(model.runRateMonthly), "Last 12 months, without the down payment")}
      ${kpi("Last lease", eur(l.monthly_eur, true), "Euribor-linked bank total")}
      ${kpi("Lease left", `${num(model.monthsRemaining, 1)} mo`, leftover >= 0 ? `${km(leftover)} under allowance so far` : `${km(-leftover)} over allowance so far`)}
    </section>

    <section class="panel">
      <h2>Cash</h2>
      <p class="hint">
        Running total from your months. The copper wash after <strong>today</strong> is a projection
        from past months: last lease rate, typical fuel for that calendar month, and
        insurance / tires / service when those months usually have them.
        Hover a month for that month’s breakdown.
      </p>
      <div class="chart-wrap tall"><canvas id="chart-spend"></canvas></div>
    </section>

    <section class="split">
      <article class="panel">
        <h2>Mileage</h2>
        <p class="statline">
          ${model.drivenKm > 0 ? `Pace ${km(model.kmPacePerYear)} / year ·` : "No odometer yet ·"}
          contract ${km(l.km_per_year)} / year
        </p>
        <div class="chart-wrap"><canvas id="chart-km"></canvas></div>
      </article>
      <article class="panel">
        <h2>Fuel</h2>
        <dl class="stack">
          <div><dt>Logged</dt><dd>${num(model.fuel.litres, 1)} L · ${eur(model.fuel.eur)}</dd></div>
          <div><dt>Actual</dt><dd>${model.fuel.actualLPer100 != null ? `${num(model.fuel.actualLPer100, 1)} L/100 km` : "—"}</dd></div>
          <div><dt>WLTP</dt><dd>${num(model.fuel.wltpLPer100, 1)} L/100 km</dd></div>
        </dl>
      </article>
    </section>

    <section class="panel">
      <h2>Worth</h2>
      <p class="hint">
        What a similar car might be worth, from list ${eur(v.list_price_eur)}.
        The <strong>upper</strong> line is the kinder residual (about ${num(data.market.forecast.optimistic_pct_at_36m, 0)}% left after 3 years).
        The <strong>lower</strong> line is the steeper drop (about ${num(data.market.forecast.pessimistic_pct_at_36m, 0)}% left).
        White is the monthly market average for a 2024 VZ 310 (pre-facelift), <strong>scaled to your list ${eur(v.list_price_eur)}</strong>.
        The path includes the 2025 facelift hit on pre-facelift asking prices.
        Dots are months we have; the line connects them. It updates when history or a live poll is added.
        Blue is remaining financed from your months. Gold is the contract buyout.
        Asking ≠ sold.
      </p>
      <p class="statline">
        Market now ${model.worthNow.rawMedian != null ? eur(model.worthNow.rawMedian) : "—"}
        ${model.lastRemaining != null ? `· remaining ${eur(model.lastRemaining)}` : ""}
        ${model.buyout != null ? `· buyout ${eur(model.buyout)}` : ""}
      </p>
      <div class="chart-wrap tall"><canvas id="chart-worth"></canvas></div>
      ${historyTable(data, model)}
    </section>

    <section class="panel">
      <h2>Months</h2>
      <p class="hint">One row per calendar month in <code>data/cars/${esc(data.id)}/months.yaml</code>.</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th class="num">Lease</th>
              <th class="num">Insurance</th>
              <th class="num">Fuel</th>
              <th class="num">Other</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            ${monthTable(data, model)}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel facts">
      <h2>Contract</h2>
      <p class="hint">
        Remaining financed value is the unpaid slice of the car on the bank schedule — not the market price.
        Buyout is the agreed price to keep the car at the end.
      </p>
      <dl>
        <div><dt>Upfront</dt><dd>${eur(l.initial_payment_eur)}</dd></div>
        <div><dt>Last lease total</dt><dd>${eur(l.monthly_eur, true)}</dd></div>
        ${model.lastRemaining != null
          ? `<div><dt>Remaining financed value</dt><dd>${eur(model.lastRemaining)} <span class="sub">after ${esc(model.lastRemainingMonth ?? "")}</span></dd></div>`
          : ""}
        <div><dt>Buyout at term</dt><dd>${l.buyout_eur != null ? eur(l.buyout_eur) : "not stated"}</dd></div>
        <div><dt>Included km</dt><dd>${km(l.km_per_year)} / year</dd></div>
        <div><dt>Service / tires / insurance</dt><dd>${included(l.included.service)} / ${included(l.included.tires)} / ${included(l.included.insurance)}</dd></div>
      </dl>
    </section>

    <footer class="foot">
      <p>Open ledger. Residual band is a guess, not a dealer bid.</p>
    </footer>
  `;
}

function kpi(label: string, value: string, note: string): string {
  return `<article class="kpi"><p class="kpi-label">${esc(label)}</p><p class="kpi-value">${esc(value)}</p><p class="kpi-note">${esc(note)}</p></article>`;
}

function sourceLabel(source: string): string {
  if (source === "backfill") return "Average (scaled to list)";
  if (source === "autoscout24-wayback") return "AutoScout24 archive";
  if (source === "autoscout24") return "AutoScout24";
  return source;
}

function historyTable(data: Dataset, model: Model): string {
  const rows = data.market.history ?? [];
  if (!rows.length) return "";
  const scaled = new Map(model.months.map((m, i) => [m.key, model.marketMedian[i]]));
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>Month</th><th class="num">For this car</th><th>Note</th><th>Source</th></tr>
        </thead>
        <tbody>
          ${[...rows].reverse().map((h) => `
            <tr>
              <td>${esc(h.month)}</td>
              <td class="num">${eur(scaled.get(h.month) ?? h.median_eur)}</td>
              <td>${esc(h.note ?? "")}</td>
              <td>${esc(sourceLabel(h.source))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>`;
}

function monthTable(data: Dataset, model: Model): string {
  const asOfKey = iso(model.asOf).slice(0, 7);
  return [...data.months]
    .reverse()
    .map((m) => {
      const future = m.month > asOfKey;
      const other =
        (m.tires_eur ?? 0) + (m.maintenance_eur ?? 0) + (m.other_eur ?? 0);
      return `
      <tr class="${future ? "future" : ""}">
        <td>${esc(m.month)}</td>
        <td class="num">${m.lease_eur ? eur(m.lease_eur, true) : "—"}</td>
        <td class="num">${m.insurance_eur ? eur(m.insurance_eur, true) : "—"}</td>
        <td class="num">${m.fuel_eur ? eur(m.fuel_eur, true) : "—"}</td>
        <td class="num">${other ? eur(other, true) : "—"}</td>
        <td>${esc(m.note ?? "")}</td>
      </tr>`;
    })
    .join("");
}
