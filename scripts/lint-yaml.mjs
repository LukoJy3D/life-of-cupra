import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import yaml from "js-yaml";

const root = join(import.meta.dirname, "..");
const skip = new Set(["node_modules", "dist", ".git"]);

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, acc);
    else if (/\.ya?ml$/i.test(entry.name)) acc.push(path);
  }
  return acc;
}

const files = walk(root);
let failed = 0;
for (const file of files) {
  try {
    yaml.load(readFileSync(file, "utf8"), { filename: file });
  } catch (error) {
    console.error(relative(root, file));
    console.error(error instanceof Error ? error.message : error);
    failed += 1;
  }
}

if (failed) {
  console.error(`\n${failed} YAML file(s) failed`);
  process.exit(1);
}
console.log(`ok ${files.length} YAML file(s)`);
