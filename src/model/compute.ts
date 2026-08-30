import type {
  AdjustedComp,
  Dataset,
  MileagePoint,
  Model,
  MonthEntry,
  MonthRow,
  WhatIf,
  WorthPoint,
} from "../types";
import {
  addMonths,
  daysBetween,
  elapsedMonths,
  emptyStack,
  interpolateMonths,
  median,
  monthIndex,
  monthKey,
  parseDay,
  startOfMonth,
} from "./math";

function residualFraction(
  months: number,
  target36: number,
  tailAnnualPct: number,
): number {
  const target = target36 / 100;
  if (months <= 0) return 1;
  if (months <= 36) {
    const loss = 1 - target;
    return 1 - loss * (months / 36) ** 0.7;
  }
  const extraYears = (months - 36) / 12;
  return target * (1 - tailAnnualPct / 100) ** extraYears;
}

function monthStart(key: string): Date {
  return parseDay(`${key}-01`);
}

function n(value: number | null | undefined): number {
  return value ?? 0;
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

type CostField =
  | "fuel_eur"
  | "insurance_eur"
  | "tires_eur"
  | "maintenance_eur"
  | "other_eur";

/** Replay a cost into a future month from logged history. */
function projectCost(
  past: MonthEntry[],
  field: CostField,
  futureKey: string,
  fallback: "average" | "interval",
): number {
  const series = past.map((m) => ({ key: m.month, v: n(m[field]) }));
  const cal = futureKey.slice(5, 7);
  const same = series.filter((m) => m.key.slice(5, 7) === cal);
  const hits = same.filter((m) => m.v > 0);
  const reliability = same.length ? hits.length / same.length : 0;
  if (reliability > 0.5) return money(mean(hits.map((m) => m.v)));

  if (fallback === "average") {
    return money(mean(series.slice(-12).map((m) => m.v)));
  }

  const events = series.filter((m) => m.v > 0);
  if (!events.length) return 0;
  const last = events[events.length - 1];
  const gaps: number[] = [];
  for (let i = 1; i < events.length; i += 1) {
    gaps.push(monthIndex(events[i].key) - monthIndex(events[i - 1].key));
  }
  let gap = gaps.length ? Math.round(mean(gaps)) : 12;
  if (gap >= 11 && gap <= 14) gap = 12;
  if (gap < 1) gap = 12;
  const since = monthIndex(futureKey) - monthIndex(last.key);
  if (since > 0 && since % gap === 0) return money(last.v);
  return 0;
}

export function defaultWhatIf(data: Dataset): WhatIf {
  const litres = data.months.reduce((a, m) => a + n(m.fuel_litres), 0);
  const eur = data.months.reduce((a, m) => a + n(m.fuel_eur), 0);
  return {
    kmPerYear: data.lease.km_per_year,
    eurPerLitre: litres > 0 ? eur / litres : 1.4,
    keepAndBuyout: false,
  };
}

export function compute(
  data: Dataset,
  whatIf: WhatIf,
  asOfInput?: Date,
): Model {
  const leaseStart = parseDay(data.lease.start);
  const leaseEnd = addMonths(leaseStart, data.lease.term_months);
  const rawAsOf = asOfInput ?? new Date();
  const asOf = rawAsOf > leaseEnd ? leaseEnd : rawAsOf < leaseStart ? leaseStart : rawAsOf;
  const asOfKey = monthKey(asOf);

  const monthsElapsed = elapsedMonths(leaseStart, asOf);
  const monthsRemaining = Math.max(0, elapsedMonths(asOf, leaseEnd));

  const logged = new Map(data.months.map((m) => [m.month, m]));
  const lastLease =
    [...data.months].reverse().find((m) => n(m.lease_eur) > 0)?.lease_eur ??
    data.lease.monthly_eur;

  const odoMonths = data.months.filter((m) => m.odometer_km != null);
  const mileage: MileagePoint[] = odoMonths.map((m) => ({
    date: monthStart(m.month),
    km: m.odometer_km as number,
    source: "odometer" as const,
  }));
  const firstOdo = mileage[0];
  const startedAfterDelivery =
    firstOdo != null && firstOdo.date.getTime() > leaseStart.getTime();
  const startKm = startedAfterDelivery ? 0 : (firstOdo?.km ?? 0);
  if (startedAfterDelivery) {
    mileage.unshift({ date: leaseStart, km: 0, source: "odometer" });
  }
  const currentKm = mileage.length ? mileage[mileage.length - 1].km : 0;
  const drivenKm = Math.max(0, currentKm - startKm);

  const daysElapsed = Math.max(1, daysBetween(leaseStart, asOf));
  const daysTotal = Math.max(daysElapsed, daysBetween(leaseStart, leaseEnd));
  const daysRemaining = Math.max(0, daysBetween(asOf, leaseEnd));
  const allowanceTotal = data.lease.km_per_year * (data.lease.term_months / 12);
  const allowanceToDate = allowanceTotal * (daysElapsed / daysTotal);
  const kmPacePerYear = drivenKm / (daysElapsed / 365.25);
  const projectedDrivenAtEnd =
    drivenKm + whatIf.kmPerYear * (daysRemaining / 365.25);
  const projectedKmAtEnd = startKm + projectedDrivenAtEnd;
  const excessKmProjected = Math.max(0, projectedDrivenAtEnd - allowanceTotal);
  const excessEurAtRisk = excessKmProjected * data.lease.excess_eur_per_km;

  const fuelLitres = data.months.reduce((a, m) => a + n(m.fuel_litres), 0);
  const fuelEur = data.months.reduce((a, m) => a + n(m.fuel_eur), 0);
  const avgEurPerLitre = fuelLitres > 0 ? fuelEur / fuelLitres : whatIf.eurPerLitre;
  const actualLPer100 =
    fuelLitres > 0 && drivenKm > 0 ? (fuelLitres / drivenKm) * 100 : null;
  const extraVsWltpEur =
    actualLPer100 != null
      ? ((actualLPer100 - data.vehicle.wltp_l_per_100km) / 100) *
        drivenKm *
        avgEurPerLitre
      : null;
  const earliest = data.months[0]?.month
    ? monthStart(data.months[0].month)
    : startOfMonth(leaseStart);
  const first = earliest < startOfMonth(leaseStart) ? earliest : startOfMonth(leaseStart);
  const last = startOfMonth(leaseEnd);
  const monthDates: Date[] = [];
  for (let d = first; d <= last; d = addMonths(d, 1)) monthDates.push(d);

  const paymentsMade = data.months.filter(
    (m) => n(m.lease_eur) > 0 && m.month <= asOfKey,
  ).length;

  const past = data.months.filter((m) => m.month <= asOfKey);

  const months: MonthRow[] = [];
  let cumulative = 0;
  for (const d of monthDates) {
    const key = monthKey(d);
    const projected = key > asOfKey;
    const loggedRow: MonthEntry | undefined = logged.get(key);
    const amounts = emptyStack();
    if (key === monthKey(leaseStart)) {
      amounts.upfront = data.lease.initial_payment_eur;
    }
    if (loggedRow) {
      amounts.lease = n(loggedRow.lease_eur);
      amounts.fuel = n(loggedRow.fuel_eur);
      amounts.insurance = n(loggedRow.insurance_eur);
      amounts.tires = n(loggedRow.tires_eur);
      amounts.maintenance = n(loggedRow.maintenance_eur);
      amounts.other = n(loggedRow.other_eur);
    }
    if (projected && d >= startOfMonth(leaseStart)) {
      if (!amounts.lease) amounts.lease = lastLease;
      if (!amounts.fuel) amounts.fuel = projectCost(past, "fuel_eur", key, "average");
      if (!amounts.insurance) {
        amounts.insurance = projectCost(past, "insurance_eur", key, "interval");
      }
      if (!amounts.tires) amounts.tires = projectCost(past, "tires_eur", key, "interval");
      if (!amounts.maintenance) {
        amounts.maintenance = projectCost(past, "maintenance_eur", key, "interval");
      }
      if (!amounts.other) amounts.other = projectCost(past, "other_eur", key, "average");
    }
    const total = Object.values(amounts).reduce((a, b) => a + b, 0);
    cumulative += total;
    months.push({ key, date: d, projected, amounts, total, cumulative });
  }

  const historical = months.filter((m) => !m.projected);
  const sunk = {
    upfront: historical.reduce((a, m) => a + m.amounts.upfront, 0),
    lease: historical.reduce((a, m) => a + m.amounts.lease, 0),
    fuel: historical.reduce((a, m) => a + m.amounts.fuel, 0),
    insurance: historical.reduce((a, m) => a + m.amounts.insurance, 0),
    tires: historical.reduce((a, m) => a + m.amounts.tires, 0),
    maintenance: historical.reduce((a, m) => a + m.amounts.maintenance, 0),
    other: historical.reduce((a, m) => a + m.amounts.other, 0),
    total: 0,
  };
  sunk.total = Object.values(sunk).reduce((a, b) => a + b, 0) - sunk.total;

  const monthsForRate = Math.max(monthsElapsed, 1 / 30);
  const monthlyAllIn = sunk.total / monthsForRate;
  const recent = historical.filter((m) => m.date >= startOfMonth(leaseStart)).slice(-12);
  const runRateMonthly = recent.length
    ? recent.reduce((a, m) => a + (m.total - m.amounts.upfront), 0) / recent.length
    : lastLease;
  const leaseCash = sunk.upfront + sunk.lease;
  const monthlyLeaseOnly = leaseCash / monthsForRate;
  const amortizedMonthly =
    lastLease + data.lease.initial_payment_eur / data.lease.term_months;
  const eurPerKmAllIn = drivenKm > 0 ? sunk.total / drivenKm : null;
  const eurPerKmLeaseOnly = drivenKm > 0 ? leaseCash / drivenKm : null;

  const worth: WorthPoint[] = [];
  const horizonMonths = Math.max(data.lease.term_months + 12, 48);
  for (let m = 0; m <= horizonMonths; m += 1) {
    const date = addMonths(leaseStart, m);
    const opt =
      data.vehicle.list_price_eur *
      residualFraction(
        m,
        data.market.forecast.optimistic_pct_at_36m,
        data.market.forecast.tail_annual_pct,
      );
    const pess =
      data.vehicle.list_price_eur *
      residualFraction(
        m,
        data.market.forecast.pessimistic_pct_at_36m,
        data.market.forecast.tail_annual_pct,
      );
    worth.push({
      date,
      months: m,
      optimistic: Math.max(0, opt),
      pessimistic: Math.max(0, pess),
    });
  }

  const baselineEur = data.market.history_baseline_eur;
  const scale =
    baselineEur && baselineEur > 0 ? data.vehicle.list_price_eur / baselineEur : 1;
  const scaledHistory = (data.market.history ?? []).map((h) => ({
    ...h,
    median_eur:
      h.source === "backfill" ? Math.round(h.median_eur * scale) : h.median_eur,
  }));
  const historyByMonth = new Map(scaledHistory.map((h) => [h.month, h.median_eur]));
  const marketMedian = months.map((m) => historyByMonth.get(m.key) ?? null);
  const marketTrend = interpolateMonths(
    scaledHistory.map((h) => ({ month: h.month, value: h.median_eur })),
    months.map((m) => m.key),
  );
  const latestHist = scaledHistory.at(-1);
  const comps: AdjustedComp[] = data.market.comps
    .filter((c) => c.year === 2024)
    .map((c) => ({
      date: parseDay(c.date),
      asking_eur: c.asking_eur,
      adjusted_eur: c.asking_eur,
      km: c.km,
      year: c.year,
      engine: c.engine,
      url: c.url,
    }));
  const liveMedian = median(comps.map((c) => c.asking_eur));
  const worthNow = {
    median: latestHist?.median_eur ?? liveMedian,
    min: comps.length ? Math.min(...comps.map((c) => c.asking_eur)) : null,
    max: comps.length ? Math.max(...comps.map((c) => c.asking_eur)) : null,
    rawMedian: latestHist?.median_eur ?? liveMedian,
  };

  const lastWithRemaining = [...data.months]
    .reverse()
    .find((m) => m.remaining_eur != null);

  return {
    asOf,
    example: data.vehicle.example,
    leaseStart,
    leaseEnd,
    monthsElapsed,
    monthsRemaining,
    paymentsMade,
    currentKm,
    startKm,
    drivenKm,
    allowanceToDate,
    allowanceTotal,
    projectedKmAtEnd,
    excessKmProjected,
    excessEurAtRisk,
    kmPacePerYear,
    fuel: {
      litres: fuelLitres,
      eur: fuelEur,
      avgEurPerLitre,
      actualLPer100,
      wltpLPer100: data.vehicle.wltp_l_per_100km,
      extraVsWltpEur,
    },
    sunk,
    monthlyAllIn,
    runRateMonthly,
    monthlyLeaseOnly,
    eurPerKmAllIn,
    eurPerKmLeaseOnly,
    amortizedMonthly,
    months,
    mileage,
    worth,
    marketMedian,
    marketTrend,
    comps,
    worthNow,
    buyout: data.lease.buyout_eur,
    lastRemaining: lastWithRemaining?.remaining_eur ?? null,
    lastRemainingMonth: lastWithRemaining?.month ?? null,
    whatIf,
  };
}
