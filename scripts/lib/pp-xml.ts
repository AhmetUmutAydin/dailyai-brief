import { readFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";

export type Broker = "Scalable" | "Trade Republic";

export type Security = {
  index: number;
  uuid: string;
  name: string;
  isin: string | null;
  ticker: string | null;
  latestPrice: number | null;
  latestPriceDate: string | null;
};

export type CashTx = {
  uuid: string;
  date: string;
  type: string;
  amount: number;
  note: string;
  isin: string | null;
  name: string | null;
};

export type DepotTx = {
  uuid: string;
  date: string;
  type: string;
  amount: number;
  shares: number;
  securityIndex: number;
};

export type Account = {
  name: string;
  broker: Broker;
  cash: CashTx[];
  depot: DepotTx[];
  balance: number;
  tagesgeldInterest: number;
  lastDate: string | null;
};

export type Holding = {
  security: Security;
  broker: Broker;
  shares: number;
  cost: number;
  value: number | null;
};

export type PPData = {
  securities: Security[];
  accounts: Account[];
  holdings: Holding[];
  nameByIsin: Map<string, string>;
  hasTx: (date: string, csvType: string, isinOrName: string, amount: number) => boolean;
};

export const CSV_TYPE: Record<string, string> = {
  DEPOSIT: "Deposit",
  REMOVAL: "Removal",
  DIVIDENDS: "Dividend",
  INTEREST: "Interest",
  FEES: "Fees",
  TAXES: "Taxes",
  TAX_REFUND: "Tax Refund",
  BUY: "Buy",
  SELL: "Sell",
  TRANSFER_IN: "Transfer (Inbound)",
  TRANSFER_OUT: "Transfer (Outbound)",
  FEES_REFUND: "Fees Refund",
  INTEREST_CHARGE: "Interest Charge",
};

const CASH_IN = new Set(["DEPOSIT", "INTEREST", "DIVIDENDS", "SELL", "TAX_REFUND", "TRANSFER_IN", "FEES_REFUND"]);
const CASH_OUT = new Set(["REMOVAL", "FEES", "TAXES", "BUY", "TRANSFER_OUT", "INTEREST_CHARGE"]);
const DEPOT_IN = new Set(["BUY", "DELIVERY_INBOUND", "TRANSFER_IN"]);
const DEPOT_OUT = new Set(["SELL", "DELIVERY_OUTBOUND", "TRANSFER_OUT"]);
const ACCOUNT_TAGS = new Set(["account", "accountFrom", "accountTo", "referenceAccount"]);

type Node = Record<string, unknown>;

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function arr<T>(v: unknown): T[] {
  if (v === undefined || v === null || v === "") return [];
  return Array.isArray(v) ? (v as T[]) : [v as T];
}

function str(v: unknown): string {
  return v === undefined || v === null ? "" : String(v);
}

function isPointer(n: unknown): boolean {
  return typeof n === "object" && n !== null && "@_reference" in (n as Node);
}

function securityIndex(ref: unknown): number | null {
  const m = /securities\/security(?:\[(\d+)\])?$/.exec(str((ref as Node | undefined)?.["@_reference"]));
  return m ? Number(m[1] ?? "1") : null;
}

function collect(node: unknown, tags: Set<string>, out: Map<string, Node>, stop: Set<string>): void {
  if (Array.isArray(node)) {
    for (const n of node) collect(n, tags, out, stop);
    return;
  }
  if (typeof node !== "object" || node === null || isPointer(node)) return;
  for (const [k, v] of Object.entries(node as Node)) {
    if (stop.has(k)) continue;
    if (tags.has(k)) {
      for (const item of arr<Node>(v)) {
        if (isPointer(item)) continue;
        const uuid = str(item.uuid);
        if (!out.has(uuid)) out.set(uuid, item);
        collect(item, tags, out, stop);
      }
    } else {
      collect(v, tags, out, stop);
    }
  }
}

function brokerOf(accountName: string): Broker {
  if (accountName.startsWith("Scalable")) return "Scalable";
  if (accountName.startsWith("Trade Republic")) return "Trade Republic";
  throw new Error(`unknown account: ${accountName}`);
}

function rank(type: string): number {
  return DEPOT_IN.has(type) ? 0 : 1;
}

export function readPP(xmlPath: string): PPData {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    isArray: (name, jpath) =>
      jpath === "client.securities.security" || ["account", "price", "account-transaction", "portfolio-transaction"].includes(name),
  });
  const client = (parser.parse(readFileSync(xmlPath, "utf8")) as { client: Node }).client;

  const securities: Security[] = arr<Node>((client.securities as Node).security).map((s, i) => {
    const prices = arr<Node>((s.prices as Node | undefined)?.price);
    const last = prices.reduce<Node | null>((best, p) => (best === null || str(p["@_t"]) > str(best["@_t"]) ? p : best), null);
    return {
      index: i + 1,
      uuid: str(s.uuid),
      name: str(s.name),
      isin: s.isin ? str(s.isin) : null,
      ticker: s.tickerSymbol ? str(s.tickerSymbol) : null,
      latestPrice: last ? Number(last["@_v"]) / 1e8 : null,
      latestPriceDate: last ? str(last["@_t"]) : null,
    };
  });
  const byIndex = (i: number | null): Security | null => (i === null ? null : (securities[i - 1] ?? null));
  const nameByIsin = new Map<string, string>();
  for (const s of securities) if (s.isin) nameByIsin.set(s.isin, s.name);

  const accountDefs = new Map<string, Node>();
  collect(client.accounts, ACCOUNT_TAGS, accountDefs, new Set());
  const accountEntries = arr<Node>((client.accounts as Node).account).length;
  if (accountDefs.size < accountEntries) {
    throw new Error(`account pointer could not be resolved (${accountEntries} entries, ${accountDefs.size} definitions)`);
  }

  const accounts: Account[] = [...accountDefs.values()].map((a) => {
    const nested = ACCOUNT_TAGS;
    const cashMap = new Map<string, Node>();
    collect(a, new Set(["account-transaction", "accountTransaction"]), cashMap, nested);
    const depotMap = new Map<string, Node>();
    collect(a, new Set(["portfolio-transaction", "portfolioTransaction"]), depotMap, nested);
    const cash: CashTx[] = [...cashMap.values()].map((t) => {
      const sec = byIndex(securityIndex(t.security));
      return {
        uuid: str(t.uuid),
        date: str(t.date).slice(0, 10),
        type: str(t.type),
        amount: Number(t.amount) / 100,
        note: str(t.note),
        isin: sec?.isin ?? null,
        name: sec?.name ?? null,
      };
    });
    const depot: DepotTx[] = [...depotMap.values()].map((t) => {
      const idx = securityIndex(t.security);
      if (idx === null) throw new Error(`portfolio transaction ${str(t.uuid)} has no security`);
      return {
        uuid: str(t.uuid),
        date: str(t.date).slice(0, 10),
        type: str(t.type),
        amount: Number(t.amount) / 100,
        shares: Number(t.shares) / 1e8,
        securityIndex: idx,
      };
    });
    let balance = 0;
    let tagesgeldInterest = 0;
    for (const t of cash) {
      if (CASH_IN.has(t.type)) balance += t.amount;
      else if (CASH_OUT.has(t.type)) balance -= t.amount;
      else throw new Error(`unknown cash transaction type ${t.type} (${t.uuid})`);
      if ((t.type === "INTEREST" || t.type === "DEPOSIT") && /tagesgeld faizi/i.test(t.note)) tagesgeldInterest += t.amount;
    }
    const dates = [...cash.map((t) => t.date), ...depot.map((t) => t.date)].sort();
    const name = str(a.name);
    if (!name) throw new Error(`account without name (uuid ${str(a.uuid)})`);
    return {
      name,
      broker: brokerOf(name),
      cash,
      depot,
      balance: round2(balance),
      tagesgeldInterest: round2(tagesgeldInterest),
      lastDate: dates.length ? dates[dates.length - 1] : null,
    };
  });

  const holdings: Holding[] = [];
  for (const acc of accounts) {
    const bySec = new Map<number, DepotTx[]>();
    for (const t of acc.depot) bySec.set(t.securityIndex, [...(bySec.get(t.securityIndex) ?? []), t]);
    for (const [idx, txs] of bySec) {
      txs.sort((x, y) => x.date.localeCompare(y.date) || rank(x.type) - rank(y.type));
      const lots: { shares: number; cost: number }[] = [];
      for (const t of txs) {
        if (DEPOT_IN.has(t.type)) {
          lots.push({ shares: t.shares, cost: t.amount });
        } else if (DEPOT_OUT.has(t.type)) {
          let rem = t.shares;
          while (rem > 1e-9 && lots.length) {
            const lot = lots[0];
            const take = Math.min(rem, lot.shares);
            const c = (lot.cost * take) / lot.shares;
            lot.shares -= take;
            lot.cost -= c;
            rem -= take;
            if (lot.shares <= 1e-9) lots.shift();
          }
        } else {
          throw new Error(`unknown portfolio transaction type ${t.type} (${t.uuid})`);
        }
      }
      const shares = lots.reduce((s, l) => s + l.shares, 0);
      if (shares <= 1e-9) continue;
      const security = byIndex(idx);
      if (!security) throw new Error(`security index ${idx} not found`);
      const cost = lots.reduce((s, l) => s + l.cost, 0);
      holdings.push({
        security,
        broker: acc.broker,
        shares,
        cost: round2(cost),
        value: security.latestPrice === null ? null : round2(shares * security.latestPrice),
      });
    }
  }

  const keyIndex = new Map<string, number[]>();
  for (const acc of accounts) {
    for (const t of acc.cash) {
      const k = `${t.date}|${CSV_TYPE[t.type] ?? t.type}|${t.isin ?? t.name ?? ""}`;
      keyIndex.set(k, [...(keyIndex.get(k) ?? []), Math.abs(t.amount)]);
    }
  }
  const hasTx = (date: string, csvType: string, isinOrName: string, amount: number): boolean => {
    const amounts = keyIndex.get(`${date}|${csvType}|${isinOrName}`);
    if (!amounts) return false;
    const i = amounts.findIndex((a) => Math.abs(a - Math.abs(amount)) < 0.011);
    if (i < 0) return false;
    amounts.splice(i, 1);
    return true;
  };

  return { securities, accounts, holdings, nameByIsin, hasTx };
}
