import { existsSync, readFileSync } from "node:fs";
import { ReportSchema } from "../schema/report.js";
import { parityIssues } from "./lib/parity.js";

const date = process.argv[2];
if (!date) {
  console.error("usage: npm run validate <YYYY-MM-DD>");
  process.exit(1);
}

let ok = true;
const reports: Partial<Record<"tr" | "en", unknown>> = {};
for (const lang of ["tr", "en"] as const) {
  const path = `data/${date}.${lang}.json`;
  if (!existsSync(path)) {
    console.error(`${path}: missing`);
    ok = false;
    continue;
  }
  const parsed = ReportSchema.safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (parsed.success) {
    console.log(`${path} valid`);
    reports[lang] = parsed.data;
    continue;
  }
  ok = false;
  for (const issue of parsed.error.issues) {
    console.error(`${path} ${issue.path.join(".")}: ${issue.message}`);
  }
}
if (ok) {
  const issues = parityIssues(reports.tr, reports.en);
  for (const i of issues) console.error(`parity: ${i}`);
  if (issues.length === 0) console.log("parity ok");
  ok = issues.length === 0;
}
process.exit(ok ? 0 : 1);
