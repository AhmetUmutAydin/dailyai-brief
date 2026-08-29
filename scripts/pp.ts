import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readPP } from "./lib/pp-xml.js";
import { convert, securitiesCsv, toCsv, type Page } from "./lib/pp-csv.js";

const HOME = homedir();
export const XML = process.env.PP_XML ?? join(HOME, "Documents/PortfolioPerformance/umut.xml");
export const IMPORT_DIR = process.env.PP_IMPORT_DIR ?? join(HOME, "Documents/PortfolioPerformance/import");
export const VAULT_DIR = process.env.VAULT_DIR ?? join(HOME, "Library/Mobile Documents/iCloud~md~obsidian/Documents/vault");
export const today = new Date().toISOString().slice(0, 10);

function load() {
  if (!existsSync(XML)) {
    console.error(`umut.xml not found: ${XML}`);
    process.exit(1);
  }
  return readPP(XML);
}

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const value = process.argv[i + 1];
  return value === undefined || value.startsWith("--") ? undefined : value;
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const [cmd, arg] = process.argv.slice(2);

if (cmd === "state") {
  const pp = load();
  const acc = (b: string) => pp.accounts.find((a) => a.broker === b);
  console.log(
    JSON.stringify(
      {
        last_scalable_date: acc("Scalable")?.lastDate ?? null,
        last_tr_date: acc("Trade Republic")?.lastDate ?? null,
        scalable_cash: acc("Scalable")?.balance ?? 0,
        tr_cash: acc("Trade Republic")?.balance ?? 0,
        tagesgeld_interest_booked: acc("Scalable")?.tagesgeldInterest ?? 0,
        holdings: pp.holdings.map((h) => ({
          name: h.security.name,
          isin: h.security.isin,
          broker: h.broker,
          shares: h.shares,
          value: h.value,
          price_date: h.security.latestPriceDate,
        })),
      },
      null,
      2,
    ),
  );
} else if (cmd === "csv") {
  if (!arg) {
    console.error("usage: npm run pp -- csv <raw.json> [--tagesgeld B --accrued A] [--no-dedupe] [--out-dir DIR]");
    process.exit(1);
  }
  const tagesgeld = flag("tagesgeld");
  const accrued = flag("accrued");
  if (has("tagesgeld") || has("accrued")) {
    const invalid = (v: string | undefined): boolean => v === undefined || !Number.isFinite(Number(v));
    if ((has("tagesgeld") && invalid(tagesgeld)) || (has("accrued") && invalid(accrued))) {
      console.error("--tagesgeld and --accrued need numeric values");
      process.exit(1);
    }
    if (has("tagesgeld") !== has("accrued")) {
      console.error("--tagesgeld and --accrued must be given together");
      process.exit(1);
    }
  }
  if (has("out-dir") && flag("out-dir") === undefined) {
    console.error("--out-dir needs a directory");
    process.exit(1);
  }
  const pages = JSON.parse(readFileSync(arg, "utf8")) as unknown;
  if (!Array.isArray(pages)) {
    console.error("raw file must be a JSON array of page objects");
    process.exit(1);
  }
  const pp = load();
  const res = convert(pages as Page[], pp, {
    dedupe: !has("no-dedupe"),
    today,
    tagesgeld: tagesgeld === undefined ? undefined : Number(tagesgeld),
    accrued: accrued === undefined ? undefined : Number(accrued),
  });
  const byType: Record<string, number> = {};
  for (const r of res.rows) byType[r.type] = (byType[r.type] ?? 0) + 1;
  console.log(`rows: ${res.rows.length} ${JSON.stringify(byType)}`);
  console.log(`skipped: not settled ${res.skipped.cancelled}, internal transfer ${res.skipped.internal}, already in PP ${res.skipped.duplicate}`);
  if (res.reconciliation) console.log(`tagesgeld: ${res.reconciliation}`);
  for (const u of res.unmapped) console.log(`UNMAPPED: ${u}`);
  if (res.rows.length === 0) {
    console.log("nothing to import");
    process.exit(0);
  }
  const outDir = flag("out-dir") ?? IMPORT_DIR;
  mkdirSync(outDir, { recursive: true });
  const txPath = join(outDir, `${today}-account-transactions.csv`);
  writeFileSync(txPath, toCsv(res.rows));
  console.log(`wrote ${txPath}`);
  if (res.securities.length) {
    const sPath = join(outDir, `${today}-securities.csv`);
    writeFileSync(sPath, securitiesCsv(res.securities));
    console.log(`wrote ${sPath} (import this first)`);
  }
} else {
  console.error("usage: npm run pp -- state | csv <raw.json> [...] | snapshot");
  process.exit(1);
}
