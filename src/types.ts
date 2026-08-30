export interface Lease {
  start: string;
  term_months: number;
  monthly_eur: number;
  monthly_note?: string;
  initial_payment_eur: number;
  km_per_year: number;
  excess_eur_per_km: number;
  included: {
    service: boolean;
    tires: boolean;
    insurance: boolean;
  };
  buyout_eur: number | null;
}

export interface Vehicle {
  name: string;
  trim: string;
  engine: string;
  power_ps: number;
  first_registration: string;
  wltp_l_per_100km: number;
  list_price_eur: number;
  paid_price_eur: number;
  color?: string;
  example: boolean;
}

export interface MonthEntry {
  month: string;
  lease_eur?: number;
  insurance_eur?: number;
  fuel_eur?: number;
  fuel_litres?: number;
  tires_eur?: number;
  maintenance_eur?: number;
  other_eur?: number;
  odometer_km?: number | null;
  remaining_eur?: number;
  note?: string;
}

export interface CarFile {
  id: string;
  owner: string;
  name: string;
  trim: string;
  engine: string;
  power_ps: number;
  first_registration: string;
  wltp_l_per_100km: number;
  list_price_eur: number;
  paid_price_eur: number;
  color?: string;
  example: boolean;
  lease: Lease;
}

export interface MarketComp {
  date: string;
  asking_eur: number;
  year: number;
  km: number;
  engine: string;
  url?: string;
}

export interface MarketSnapshot {
  polled_at: string | null;
  source: string;
  query?: string | null;
  error?: string | null;
  comps: MarketComp[];
}

export interface MarketMonth {
  month: string;
  median_eur: number;
  n: number;
  source: string;
  note?: string;
}

export interface Market {
  km_adjustment_eur_per_km: number;
  comps: MarketComp[];
  history: MarketMonth[];
  history_baseline_eur?: number;
  history_baseline_month?: string;
  snapshot?: MarketSnapshot;
  forecast: {
    optimistic_pct_at_36m: number;
    pessimistic_pct_at_36m: number;
    optimistic_assumed_km_per_year: number;
    pessimistic_assumed_km_per_year: number;
    tail_annual_pct: number;
  };
}

export interface Benchmark {
  id: string;
  source: string;
  date: string;
  monthly_eur?: number;
  eur_per_km?: number;
  residual_pct_36m?: number;
  note: string;
  url?: string;
}

export interface Dataset {
  id: string;
  owner: string;
  vehicle: Vehicle;
  lease: Lease;
  months: MonthEntry[];
  market: Market;
  benchmarks: Benchmark[];
}

export interface WhatIf {
  kmPerYear: number;
  eurPerLitre: number;
  keepAndBuyout: boolean;
}

export type StackCategory =
  | "upfront"
  | "lease"
  | "fuel"
  | "insurance"
  | "tires"
  | "maintenance"
  | "other";

export interface MonthRow {
  key: string;
  date: Date;
  projected: boolean;
  amounts: Record<StackCategory, number>;
  total: number;
  cumulative: number;
}

export interface MileagePoint {
  date: Date;
  km: number;
  source: "odometer" | "fuel";
}

export interface WorthPoint {
  date: Date;
  months: number;
  optimistic: number;
  pessimistic: number;
}

export interface AdjustedComp {
  date: Date;
  asking_eur: number;
  adjusted_eur: number;
  km: number;
  year: number;
  engine: string;
  url?: string;
}

export interface Model {
  asOf: Date;
  example: boolean;
  leaseStart: Date;
  leaseEnd: Date;
  monthsElapsed: number;
  monthsRemaining: number;
  paymentsMade: number;
  currentKm: number;
  startKm: number;
  drivenKm: number;
  allowanceToDate: number;
  allowanceTotal: number;
  projectedKmAtEnd: number;
  excessKmProjected: number;
  excessEurAtRisk: number;
  kmPacePerYear: number;
  fuel: {
    litres: number;
    eur: number;
    avgEurPerLitre: number;
    actualLPer100: number | null;
    wltpLPer100: number;
    extraVsWltpEur: number | null;
  };
  sunk: {
    upfront: number;
    lease: number;
    fuel: number;
    insurance: number;
    tires: number;
    maintenance: number;
    other: number;
    total: number;
  };
  monthlyAllIn: number;
  runRateMonthly: number;
  monthlyLeaseOnly: number;
  eurPerKmAllIn: number | null;
  eurPerKmLeaseOnly: number | null;
  amortizedMonthly: number;
  months: MonthRow[];
  mileage: MileagePoint[];
  worth: WorthPoint[];
  marketMedian: (number | null)[];
  marketTrend: (number | null)[];
  comps: AdjustedComp[];
  worthNow: {
    median: number | null;
    min: number | null;
    max: number | null;
    rawMedian: number | null;
  };
  buyout: number | null;
  lastRemaining: number | null;
  lastRemainingMonth: string | null;
  whatIf: WhatIf;
}

export interface FleetAverages {
  cars: number;
  monthlyAllIn: number | null;
  monthlyLease: number | null;
  eurPerKm: number | null;
  lPer100: number | null;
  byModel: { model: string; cars: number; monthlyAllIn: number | null }[];
}

export interface CarSummary {
  data: Dataset;
  model: Model;
}
