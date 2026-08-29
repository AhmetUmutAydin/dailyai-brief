import { readFileSync } from "node:fs";
import { ReportSchema } from "../schema/report.js";

const date = process.argv[2];
if (!date) {
  console.error("usage: npm run validate <YYYY-MM-DD>");
  process.exit(1);
}

const path = `data/${date}.json`;
const parsed = ReportSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
if (parsed.success) {
  console.log(`${path} valid`);
  process.exit(0);
}
for (const issue of parsed.error.issues) {
  console.error(`${issue.path.join(".")}: ${issue.message}`);
}
process.exit(1);
