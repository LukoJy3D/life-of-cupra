import marketYaml from "../data/market.yaml";
import benchmarksYaml from "../data/benchmarks.yaml";
import snapshotJson from "../data/market-snapshot.json";
import historyYaml from "../data/market-history.yaml";
import type {
  Benchmark,
  CarFile,
  Dataset,
  Market,
  MarketMonth,
  MarketSnapshot,
  MonthEntry,
  Vehicle,
} from "./types";

const carModules = import.meta.glob("../data/cars/*/car.yaml", { eager: true });
const monthModules = import.meta.glob("../data/cars/*/months.yaml", {
  eager: true,
});

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") return value as Record<string, unknown>;
  throw new Error("YAML root must be a mapping");
}

function folderId(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 2] ?? "";
}

function defaultExport(mod: unknown): unknown {
  if (mod && typeof mod === "object" && "default" in mod) {
    return (mod as { default: unknown }).default;
  }
  return mod;
}

function sharedMarket(): Market {
  const market = asRecord(marketYaml) as unknown as Market;
  const snapshot = snapshotJson as MarketSnapshot;
  if (snapshot.comps?.length) market.comps = snapshot.comps;
  market.snapshot = snapshot;
  const histRoot = asRecord(historyYaml);
  market.history = ((histRoot.months ?? []) as MarketMonth[]).sort((a, b) =>
    a.month.localeCompare(b.month),
  );
  if (typeof histRoot.baseline_eur === "number") {
    market.history_baseline_eur = histRoot.baseline_eur;
  }
  if (typeof histRoot.baseline_month === "string") {
    market.history_baseline_month = histRoot.baseline_month;
  }
  return market;
}

function sharedBenchmarks(): Benchmark[] {
  return (asRecord(benchmarksYaml).items ?? []) as Benchmark[];
}

function toDataset(raw: CarFile, months: MonthEntry[], market: Market, benchmarks: Benchmark[]): Dataset {
  const vehicle: Vehicle = {
    name: raw.name,
    trim: raw.trim,
    engine: raw.engine,
    power_ps: raw.power_ps,
    first_registration: raw.first_registration,
    wltp_l_per_100km: raw.wltp_l_per_100km,
    list_price_eur: raw.list_price_eur,
    paid_price_eur: raw.paid_price_eur,
    color: raw.color,
    example: raw.example,
  };
  return {
    id: raw.id,
    owner: raw.owner,
    vehicle,
    lease: raw.lease,
    months: [...months].sort((a, b) => a.month.localeCompare(b.month)),
    market,
    benchmarks,
  };
}

export function loadCars(): Dataset[] {
  const market = sharedMarket();
  const benchmarks = sharedBenchmarks();
  const monthsById = new Map<string, MonthEntry[]>();
  for (const [path, mod] of Object.entries(monthModules)) {
    const id = folderId(path);
    if (id.startsWith("_")) continue;
    const root = asRecord(defaultExport(mod));
    monthsById.set(id, (root.months ?? []) as MonthEntry[]);
  }

  const cars: Dataset[] = [];
  for (const [path, mod] of Object.entries(carModules)) {
    const folder = folderId(path);
    if (folder.startsWith("_")) continue;
    const raw = asRecord(defaultExport(mod)) as unknown as CarFile;
    if (raw.id !== folder) {
      throw new Error(`car.yaml id "${raw.id}" must match folder "${folder}"`);
    }
    cars.push(toDataset(raw, monthsById.get(raw.id) ?? [], market, benchmarks));
  }
  return cars.sort((a, b) => a.id.localeCompare(b.id));
}

export function loadCar(id: string): Dataset | undefined {
  return loadCars().find((c) => c.id === id);
}
