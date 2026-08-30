import {
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  ScatterController,
  Tooltip,
} from "chart.js";
import type { TooltipItem } from "chart.js";
import type { Dataset, Model, StackCategory } from "../types";
import { monthKey } from "../model/math";
import { eur, monthLabel, num } from "./format";

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip,
  Legend,
  ScatterController,
);

const ink = "#ede6dc";
const muted = "#8a8074";
const grid = "rgba(237, 230, 220, 0.08)";

const STACK: { key: StackCategory; label: string; color: string }[] = [
  { key: "upfront", label: "Upfront", color: "#8a5a3a" },
  { key: "lease", label: "Lease", color: "#c4784a" },
  { key: "fuel", label: "Fuel", color: "#d4a017" },
  { key: "insurance", label: "Insurance", color: "#6b8cae" },
  { key: "tires", label: "Tires", color: "#7d8a6a" },
  { key: "maintenance", label: "Maintenance", color: "#9a7b9a" },
  { key: "other", label: "Other", color: "#5c6560" },
];

const defaults = {
  color: muted,
  borderColor: grid,
  font: { family: "'IBM Plex Sans', sans-serif", size: 11 },
};

Chart.defaults.color = defaults.color;
Chart.defaults.font.family = defaults.font.family;
Chart.defaults.font.size = defaults.font.size;
Chart.defaults.plugins.legend.labels.boxWidth = 10;
Chart.defaults.plugins.legend.labels.boxHeight = 10;
Chart.defaults.plugins.tooltip.backgroundColor = "#1c1a17";
Chart.defaults.plugins.tooltip.titleColor = ink;
Chart.defaults.plugins.tooltip.bodyColor = ink;
Chart.defaults.plugins.tooltip.borderColor = "rgba(196, 120, 74, 0.4)";
Chart.defaults.plugins.tooltip.borderWidth = 1;

const live: Chart[] = [];

function ctx(id: string): CanvasRenderingContext2D {
  const el = document.getElementById(id);
  if (!(el instanceof HTMLCanvasElement)) {
    throw new Error(`Missing canvas #${id}`);
  }
  const c = el.getContext("2d");
  if (!c) throw new Error(`No 2d context for #${id}`);
  return c;
}

export function destroyCharts(): void {
  while (live.length) live.pop()?.destroy();
}

function todayIndex(model: Model): number {
  const key = `${model.asOf.getUTCFullYear()}-${String(model.asOf.getUTCMonth() + 1).padStart(2, "0")}`;
  return model.months.findIndex((m) => m.key === key);
}

const todayLine = {
  id: "todayLine",
  afterDraw(chart: Chart) {
    const idx = Number(chart.options.plugins && (chart.options.plugins as { todayIndex?: number }).todayIndex);
    if (!Number.isFinite(idx) || idx < 0) return;
    const meta = chart.getDatasetMeta(0);
    const pt = meta.data[idx];
    if (!pt) return;
    const { ctx: c, chartArea } = chart;
    c.save();
    c.fillStyle = "rgba(196, 120, 74, 0.08)";
    c.fillRect(pt.x, chartArea.top, chartArea.right - pt.x, chartArea.bottom - chartArea.top);
    c.strokeStyle = "rgba(196, 120, 74, 0.7)";
    c.setLineDash([3, 3]);
    c.beginPath();
    c.moveTo(pt.x, chartArea.top);
    c.lineTo(pt.x, chartArea.bottom);
    c.stroke();
    c.fillStyle = "#c4784a";
    c.setLineDash([]);
    c.font = "10px 'IBM Plex Sans', sans-serif";
    c.fillText("today", pt.x + 4, chartArea.top + 12);
    if (chartArea.right - pt.x > 72) {
      c.fillText("projection →", pt.x + 8, chartArea.top + 26);
    }
    c.restore();
  },
};

Chart.register(todayLine);

export function drawCharts(model: Model, data: Dataset): void {
  destroyCharts();
  const labels = model.months.map((m) => monthLabel(m.key));
  const todayIdx = todayIndex(model);

  const running: Record<StackCategory, number> = {
    upfront: 0,
    lease: 0,
    fuel: 0,
    insurance: 0,
    tires: 0,
    maintenance: 0,
    other: 0,
  };
  const cumulativeByCat = model.months.map((m) => {
    for (const s of STACK) running[s.key] += m.amounts[s.key];
    return { ...running };
  });

  live.push(
    new Chart(ctx("chart-spend"), {
      type: "line",
      data: {
        labels,
        datasets: STACK.map((s) => ({
          label: s.label,
          data: cumulativeByCat.map((row) => row[s.key]),
          borderColor: s.color,
          backgroundColor: `${s.color}cc`,
          fill: true,
          tension: 0.2,
          pointRadius: 0,
          borderWidth: 1,
          stack: "cash",
          segment: {
            borderDash: (ctx: { p1DataIndex: number }) =>
              ctx.p1DataIndex > todayIdx ? [4, 4] : undefined,
          },
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          todayIndex: todayIdx,
          tooltip: {
            filter: (item: TooltipItem<"line">) => {
              const key = STACK[item.datasetIndex]?.key;
              return Boolean(key && model.months[item.dataIndex].amounts[key]);
            },
            callbacks: {
              label: (item: TooltipItem<"line">) => {
                const i = item.dataIndex;
                const key = STACK[item.datasetIndex]?.key;
                if (!key) return "";
                const monthAmt = model.months[i].amounts[key];
                const soFar = cumulativeByCat[i][key];
                if (!monthAmt) return "";
                return `${item.dataset.label}: ${eur(monthAmt, true)} this month · ${eur(soFar)} so far`;
              },
              title: (items: TooltipItem<"line">[]) => {
                const i = items[0]?.dataIndex ?? 0;
                const m = model.months[i];
                return m.projected ? `${labels[i]} · projection` : labels[i];
              },
              footer: (items: TooltipItem<"line">[]) => {
                const i = items[0]?.dataIndex ?? 0;
                const chart = items[0]?.chart;
                const visible = STACK.filter((_, idx) =>
                  chart ? chart.isDatasetVisible(idx) : true,
                ).map((s) => s.key);
                const keys = visible.length ? visible : STACK.map((s) => s.key);
                const monthSum = keys.reduce((a, k) => a + model.months[i].amounts[k], 0);
                const soFar = keys.reduce((a, k) => a + cumulativeByCat[i][k], 0);
                const prefix = model.months[i].projected ? "Projected · " : "";
                return `${prefix}This month ${eur(monthSum)} · running total ${eur(soFar)}`;
              },
            },
          },
        } as never,
        scales: {
          x: { grid: { color: grid }, ticks: { maxTicksLimit: 10 } },
          y: {
            stacked: true,
            beginAtZero: true,
            grid: { color: grid },
            ticks: { callback: (v) => eur(Number(v)) },
          },
        },
      },
    }),
  );

  const allowance = model.months.map((m) => {
    const t = (m.date.getTime() - model.leaseStart.getTime()) /
      (model.leaseEnd.getTime() - model.leaseStart.getTime());
    return model.startKm + model.allowanceTotal * Math.min(1, Math.max(0, t));
  });

  live.push(
    new Chart(ctx("chart-km"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Odometer",
            data: model.months.map((m) => {
              if (m.projected) return null;
              const pts = model.mileage.filter((p) => p.date <= addMonthEnd(m.date));
              return pts.length ? pts[pts.length - 1].km : null;
            }),
            borderColor: "#ede6dc",
            backgroundColor: "transparent",
            tension: 0.15,
            pointRadius: 0,
            borderWidth: 2,
            spanGaps: true,
          },
          {
            label: "Contract allowance",
            data: allowance,
            borderColor: "#c4784a",
            borderDash: [5, 4],
            pointRadius: 0,
            borderWidth: 1.5,
            fill: false,
          },
          {
            label: "Projected end",
            data: model.months.map((m) =>
              m.projected ? model.projectedKmAtEnd : null,
            ),
            borderColor: "#8a8074",
            borderDash: [2, 3],
            pointRadius: 0,
            spanGaps: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { todayIndex: todayIdx } as never,
        scales: {
          x: { grid: { color: grid }, ticks: { maxTicksLimit: 10 } },
          y: {
            grid: { color: grid },
            ticks: { callback: (v) => num(Number(v)) },
          },
        },
      },
    }),
  );

  const worthByKey = new Map(model.worth.map((w) => [monthKey(w.date), w]));

  live.push(
    new Chart(ctx("chart-worth"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Higher residual (keeps more value)",
            data: model.months.map((m) => worthByKey.get(m.key)?.optimistic ?? null),
            borderColor: "#6a9e6e",
            backgroundColor: "rgba(106, 158, 110, 0.18)",
            fill: "+1",
            tension: 0.25,
            pointRadius: 0,
            borderWidth: 1.5,
            spanGaps: true,
          },
          {
            label: "Lower residual (steeper drop)",
            data: model.months.map((m) => worthByKey.get(m.key)?.pessimistic ?? null),
            borderColor: "#c45c4a",
            backgroundColor: "transparent",
            fill: false,
            tension: 0.25,
            pointRadius: 0,
            borderWidth: 1.5,
            spanGaps: true,
          },
          {
            label: "Market average",
            data: model.marketTrend,
            borderColor: "#ede6dc",
            backgroundColor: "#ede6dc",
            fill: false,
            tension: 0.15,
            pointRadius: model.marketMedian.map((v) => (v != null ? 3 : 0)),
            borderWidth: 2,
            spanGaps: true,
          },
          {
            label: "Remaining financed",
            data: model.months.map((m) => {
              const row = data.months.find((r) => r.month === m.key);
              return row?.remaining_eur ?? null;
            }),
            borderColor: "#6b8cae",
            backgroundColor: "transparent",
            fill: false,
            tension: 0.1,
            pointRadius: 0,
            borderWidth: 1.5,
            spanGaps: true,
          },
          ...(model.buyout != null
            ? [
                {
                  label: "Contract buyout",
                  data: model.months.map((m) =>
                    worthByKey.has(m.key) ? model.buyout : null,
                  ),
                  borderColor: "#d4a017",
                  borderDash: [6, 4],
                  pointRadius: 0,
                  borderWidth: 1.5,
                  fill: false,
                  spanGaps: true,
                },
              ]
            : []),
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { todayIndex: todayIdx } as never,
        scales: {
          x: {
            type: "category",
            grid: { color: grid },
            ticks: { maxTicksLimit: 10 },
          },
          y: {
            grid: { color: grid },
            ticks: { callback: (v) => eur(Number(v)) },
          },
        },
      },
    }),
  );
}

function addMonthEnd(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}
