import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const carsDir = join(root, "data", "cars");

function load(path) {
  return yaml.load(readFileSync(path, "utf8"));
}

const cars = readdirSync(carsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
  .map((e) => {
    const car = load(join(carsDir, e.name, "car.yaml"));
    const months = load(join(carsDir, e.name, "months.yaml"));
    return { id: e.name, car, months: months.months ?? [] };
  });

const live = cars.filter((c) => !c.car.example);
const summary = {
  generated_at: new Date().toISOString(),
  cars: live.length,
  ids: live.map((c) => c.id),
};

for (const dir of [join(root, "public"), join(root, "dist")]) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
}

console.log("wrote summary.json", summary);
