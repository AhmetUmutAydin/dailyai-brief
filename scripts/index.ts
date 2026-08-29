import { readdirSync, writeFileSync } from "node:fs";

const dates = readdirSync("data")
  .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .map((f) => f.slice(0, 10))
  .sort()
  .reverse();

writeFileSync("data/index.json", JSON.stringify({ dates }, null, 2) + "\n");
console.log(`index: ${dates.length} dates`);
