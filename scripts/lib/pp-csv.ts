import { round2, type PPData } from "./pp-xml.js";

export type ConnectorItem = {
  id: string;
  kind: "security" | "cash";
  status: string;
  lastEventAt: string;
  description: string;
  security: { isin: string; quantity: string; amount: string; side: "BUY" | "SELL" } | null;
  cash: { relatedIsin: string | null; transactionType: string; amount: string } | null;
};

export type ConnectorCrypto = {
  id: string;
  status: string;
  lastEventAt: string;
  description: string;
  ticker: string;
  coinQuantity: string;
  quantity: string;
  amount: string;
  side: "BUY" | "SELL";
};

export type Page = { transactions?: ConnectorItem[]; crypto?: { transactions?: ConnectorCrypto[] } };

export type Row = {
  date: string;
  time: string;
  type: string;
  value: string;
  isin: string;
  name: string;
  shares: string;
  note: string;
  depot: boolean;
};

export type ConvertOptions = { dedupe: boolean; today: string; tagesgeld?: number; accrued?: number };

export type ConvertResult = {
  rows: Row[];
  securities: { isin: string; name: string }[];
  skipped: { cancelled: number; internal: number; duplicate: number };
  unmapped: string[];
  reconciliation: string | null;
};

export const HEADER = "Date,Type,Value,Transaction Currency,ISIN,Security Name,Shares,Fees,Taxes,Note,Cash Account,Securities Account";

const CASH_TYPES: Record<string, string> = {
  DISTRIBUTION: "Dividend",
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Removal",
  FEE: "Fees",
  INTEREST: "Interest",
  TAX: "Taxes",
  TAX_REFUND: "Tax Refund",
};

const SIDE_TYPE: Record<string, "Buy" | "Sell" | undefined> = { BUY: "Buy", SELL: "Sell" };

const CRYPTO_ETP: Record<string, { isin: string; name: string }> = {
  ETH: { isin: "GB00BLD4ZM24", name: "CoinShares Physical Staked Ethereum (ETH ETP)" },
  AVAX: { isin: "CH1135202088", name: "21shares Avalanche ETP (AVAX)" },
  BTC: { isin: "", name: "Bitcoin ETP via Scalable (BTC)" },
};

export function convert(pages: Page[], pp: PPData, opts: ConvertOptions): ConvertResult {
  const rows: Row[] = [];
  const unmapped: string[] = [];
  const skipped = { cancelled: 0, internal: 0, duplicate: 0 };
  const push = (r: Row, label: string): void => {
    const raw = String(r.value ?? "").trim();
    const value = Number(raw);
    if (raw === "" || !Number.isFinite(value)) {
      unmapped.push(`${label} ${r.date} ${r.type} amount=${JSON.stringify(r.value)} not a finite number`);
      return;
    }
    if (opts.dedupe && pp.hasTx(r.date, r.type, r.isin || r.name, value)) {
      skipped.duplicate++;
      return;
    }
    rows.push(r);
  };
  const nameFor = (isin: string, fallback: string): string => pp.nameByIsin.get(isin) ?? fallback;

  for (const page of pages) {
    for (const t of page.transactions ?? []) {
      const date = t.lastEventAt.slice(0, 10);
      const time = t.lastEventAt;
      if (t.status !== "SETTLED") {
        skipped.cancelled++;
        continue;
      }
      if (t.kind === "security" && t.security) {
        const type: "Buy" | "Sell" | undefined = SIDE_TYPE[t.security.side];
        if (!type) {
          unmapped.push(`${t.id} ${date} side=${t.security.side} ${t.security.amount} ${t.description}`);
          continue;
        }
        push(
          {
            date,
            time,
            type,
            value: t.security.amount,
            isin: t.security.isin,
            name: nameFor(t.security.isin, t.description),
            shares: t.security.quantity,
            note: "Scalable",
            depot: true,
          },
          `${t.id} ${t.description}`,
        );
      } else if (t.kind === "cash" && t.cash) {
        const tt = t.cash.transactionType;
        if (tt === "CASH_TRANSFER_IN" || tt === "CASH_TRANSFER_OUT") {
          skipped.internal++;
          continue;
        }
        const type = CASH_TYPES[tt];
        if (!type) {
          unmapped.push(`${t.id} ${date} ${tt} ${t.cash.amount} ${t.description}`);
          continue;
        }
        if (tt === "DISTRIBUTION") {
          const isin = t.cash.relatedIsin ?? "";
          push(
            { date, time, type, value: t.cash.amount, isin, name: nameFor(isin, t.description), shares: "", note: t.description, depot: true },
            `${t.id} ${t.description}`,
          );
        } else {
          push(
            { date, time, type, value: t.cash.amount, isin: "", name: "", shares: "", note: t.description || "Scalable", depot: false },
            `${t.id} ${t.description}`,
          );
        }
      } else {
        unmapped.push(`${t.id} ${date} ${t.kind} ${t.description}`);
      }
    }
    for (const c of page.crypto?.transactions ?? []) {
      const date = c.lastEventAt.slice(0, 10);
      if (c.status !== "SETTLED") {
        skipped.cancelled++;
        continue;
      }
      const etp = CRYPTO_ETP[c.ticker];
      if (!etp) {
        unmapped.push(`${c.id} ${date} crypto ${c.ticker} ${c.side} ${c.amount}`);
        continue;
      }
      const type: "Buy" | "Sell" | undefined = SIDE_TYPE[c.side];
      if (!type) {
        unmapped.push(`${c.id} ${date} crypto side=${c.side} ${c.amount} ${c.description}`);
        continue;
      }
      push(
        {
          date,
          time: c.lastEventAt,
          type,
          value: c.amount,
          isin: etp.isin,
          name: etp.name,
          shares: c.quantity,
          note: `Scalable crypto ${c.ticker} ${c.coinQuantity} coin`,
          depot: true,
        },
        `${c.id} ${c.description}`,
      );
    }
  }
  rows.sort((a, b) => a.time.localeCompare(b.time));

  let reconciliation: string | null = null;
  if (opts.tagesgeld !== undefined && opts.accrued !== undefined) {
    const scalable = pp.accounts.find((a) => a.broker === "Scalable");
    if (!scalable) throw new Error("Scalable account not found in PP");
    const projected = round2(scalable.balance + rows.reduce((s, r) => s + Number(r.value), 0));
    if (!Number.isFinite(projected)) {
      throw new Error(`projected Scalable balance is not finite (PP balance ${scalable.balance}, ${rows.length} rows)`);
    }
    const diff = round2(opts.tagesgeld - projected);
    const interestDelta = round2(opts.accrued - scalable.tagesgeldInterest);
    const added: Row[] = [];
    const base = { date: opts.today, time: `${opts.today}T23:59:59.999Z`, isin: "", name: "", shares: "", depot: false };
    if (interestDelta > 0.005) {
      added.push({ ...base, type: "Interest", value: interestDelta.toFixed(2), note: "Tagesgeld faizi" });
    }
    const remainder = round2(diff - Math.max(interestDelta, 0));
    if (Math.abs(remainder) >= 0.005) {
      added.push({ ...base, type: remainder > 0 ? "Deposit" : "Removal", value: remainder.toFixed(2), note: "Tagesgeld eşitleme" });
    }
    if (added.length === 0) {
      reconciliation = `eşit: PP ${projected.toFixed(2)} = Tagesgeld ${opts.tagesgeld.toFixed(2)}`;
    } else {
      rows.push(...added);
      const parts = added.map((r) => `${r.type} ${r.value} (${r.note})`).join(" + ");
      reconciliation = `${parts}; PP ${projected.toFixed(2)} → Tagesgeld ${opts.tagesgeld.toFixed(2)}`;
    }
  }

  const known = new Set(pp.securities.map((s) => s.isin).filter((x): x is string => x !== null));
  const newSecurities = new Map<string, string>();
  for (const r of rows) if (r.isin && !known.has(r.isin) && !newSecurities.has(r.isin)) newSecurities.set(r.isin, r.name);

  return {
    rows,
    securities: [...newSecurities].map(([isin, name]) => ({ isin, name })),
    skipped,
    unmapped,
    reconciliation,
  };
}

function cell(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Row[]): string {
  const lines = rows.map((r) =>
    [r.date, r.type, r.value, "EUR", r.isin, r.name, r.shares, "0", "0", r.note, "Scalable Cash", r.depot ? "Scalable Depot" : ""].map(cell).join(","),
  );
  return [HEADER, ...lines].join("\n") + "\n";
}

export function securitiesCsv(list: { isin: string; name: string }[]): string {
  return ["ISIN,Security Name,Currency", ...list.map((s) => [s.isin, s.name, "EUR"].map(cell).join(","))].join("\n") + "\n";
}
