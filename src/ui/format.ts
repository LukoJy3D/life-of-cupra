const eurFmt = new Intl.NumberFormat("lt-LT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const eurExact = new Intl.NumberFormat("lt-LT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numFmt = new Intl.NumberFormat("lt-LT", { maximumFractionDigits: 0 });

export function eur(n: number, exact = false): string {
  return (exact ? eurExact : eurFmt).format(n);
}

export function km(n: number): string {
  return `${numFmt.format(Math.round(n))} km`;
}

export function num(n: number, digits = 0): string {
  return new Intl.NumberFormat("lt-LT", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);
}

export function perKm(n: number | null): string {
  if (n == null) return "—";
  return `${num(n, 2)} €/km`;
}

export function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dateLabel(date: Date): string {
  return monthLabel(
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
  );
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const names = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${names[Number(m) - 1]} ${y.slice(2)}`;
}

export function included(flag: boolean): string {
  return flag ? "in lease" : "you pay";
}
