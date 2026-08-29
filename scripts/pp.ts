import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { readPP } from "./lib/pp-xml.js";

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

const [cmd] = process.argv.slice(2);

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
} else {
  console.error("usage: npm run pp -- state | csv <raw.json> [...] | snapshot");
  process.exit(1);
}
