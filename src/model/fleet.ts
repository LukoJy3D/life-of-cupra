import type { CarSummary, Dataset, FleetAverages } from "../types";
import { compute, defaultWhatIf } from "./compute";
import { median } from "./math";

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function summarizeCars(cars: Dataset[]): CarSummary[] {
  return cars.map((data) => ({
    data,
    model: compute(data, defaultWhatIf(data)),
  }));
}

export function fleetAverages(summaries: CarSummary[]): FleetAverages {
  const live = summaries.filter((s) => !s.data.vehicle.example);
  const monthlyAllIn = live.map((s) => s.model.monthlyAllIn);
  const monthlyLease = live.map((s) => s.model.monthlyLeaseOnly);
  const eurPerKm = live
    .map((s) => s.model.eurPerKmAllIn)
    .filter((n): n is number => n != null);
  const lPer100 = live
    .map((s) => s.model.fuel.actualLPer100)
    .filter((n): n is number => n != null);

  const models = new Map<string, number[]>();
  for (const s of live) {
    const name = s.data.vehicle.name;
    const list = models.get(name) ?? [];
    list.push(s.model.monthlyAllIn);
    models.set(name, list);
  }

  return {
    cars: live.length,
    monthlyAllIn: avg(monthlyAllIn),
    monthlyLease: avg(monthlyLease),
    eurPerKm: eurPerKm.length ? median(eurPerKm) : null,
    lPer100: lPer100.length ? avg(lPer100) : null,
    byModel: [...models.entries()]
      .map(([model, vals]) => ({
        model,
        cars: vals.length,
        monthlyAllIn: avg(vals),
      }))
      .sort((a, b) => a.model.localeCompare(b.model)),
  };
}
