export function monthIndex(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return y * 12 + (m - 1);
}

/** Linear interpolation between observed YYYY-MM values. No extrapolation. */
export function interpolateMonths(
  observed: { month: string; value: number }[],
  keys: string[],
): (number | null)[] {
  const pts = [...observed]
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => a.month.localeCompare(b.month));
  if (!pts.length) return keys.map(() => null);
  return keys.map((key) => {
    const exact = pts.find((p) => p.month === key);
    if (exact) return exact.value;
    const idx = monthIndex(key);
    let prev = pts[0];
    let next = pts[pts.length - 1];
    for (let i = 0; i < pts.length - 1; i += 1) {
      if (monthIndex(pts[i].month) <= idx && monthIndex(pts[i + 1].month) >= idx) {
        prev = pts[i];
        next = pts[i + 1];
        break;
      }
    }
    const a = monthIndex(prev.month);
    const b = monthIndex(next.month);
    if (idx < a || idx > b || a === b) return null;
    const t = (idx - a) / (b - a);
    return Math.round(prev.value + (next.value - prev.value) * t);
  });
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function parseDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const day = date.getUTCDate();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, last)));
}

export function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function monthKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 86_400_000;
}

export function elapsedMonths(start: Date, asOf: Date): number {
  const days = Math.max(0, daysBetween(start, asOf));
  return days / 30.4375;
}

export function emptyStack(): Record<
  "upfront" | "lease" | "fuel" | "insurance" | "tires" | "maintenance" | "other",
  number
> {
  return {
    upfront: 0,
    lease: 0,
    fuel: 0,
    insurance: 0,
    tires: 0,
    maintenance: 0,
    other: 0,
  };
}
