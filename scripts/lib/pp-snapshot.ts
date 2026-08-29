import type { Holding, PPData } from "./pp-xml.js";
import type { Portfolio } from "../../schema/portfolio.js";

export const VAULT_CREATED = "2026-09-12";

const r2 = (n: number): number => Math.round(n * 100) / 100;
const r4 = (n: number): number => Math.round(n * 10000) / 10000;
const eur = (n: number): string => n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (n: number): string => n.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
const pct = (f: number): string => `%${(f * 100).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

export function buildSnapshot(pp: PPData, today: string): { json: Portfolio; md: string; total: number; unpriced: Holding[] } {
  const priced = pp.holdings.filter((h) => h.value !== null);
  const unpriced = pp.holdings.filter((h) => h.value === null);
  const scalableCash = pp.accounts.find((a) => a.broker === "Scalable")?.balance ?? 0;
  const trCash = pp.accounts.find((a) => a.broker === "Trade Republic")?.balance ?? 0;
  const cash = scalableCash + trCash;
  const total = priced.reduce((s, h) => s + (h.value as number), 0) + cash;
  const sorted = [...priced].sort((a, b) => (b.value as number) - (a.value as number));
  const priceDate = sorted.map((h) => h.security.latestPriceDate as string).sort()[0] ?? today;

  const json: Portfolio = {
    updated_at: today,
    price_date: priceDate,
    holdings: sorted.map((h) => ({
      isin: h.security.isin,
      name: h.security.name,
      ticker: h.security.ticker,
      broker: h.broker,
      weight: r4((h.value as number) / total),
    })),
    cash_weight: r4(cash / total),
  };

  const rows = sorted.map((h) => {
    const value = h.value as number;
    return `| ${h.security.name} | ${h.security.isin ?? ""} | ${h.broker} | ${qty(h.shares)} | ${eur(h.cost / h.shares)} | ${eur(h.security.latestPrice as number)} | ${eur(value)} | ${pct((value - h.cost) / h.cost)} | ${pct(value / total)} |`;
  });
  const missing = unpriced.map(
    (h) => `| ${h.security.name} | ${h.security.isin ?? ""} | ${h.broker} | ${qty(h.shares)} | ${eur(h.cost / h.shares)} | fiyat yok | | | |`,
  );
  const md = [
    "---",
    "type: finans",
    "status: active",
    `created: ${VAULT_CREATED}`,
    "tags: [portfoy, otomatik]",
    "---",
    "",
    "# Portföy (otomatik)",
    "",
    "`npm run pp -- snapshot` üretir, her çalıştırmada üstüne yazılır; elle düzenleme. Kaynak: PP `umut.xml`, fiyatlar PP'nin son Update Quotes'u.",
    "",
    `Güncelleme: ${today}, fiyat tarihi: ${priceDate}`,
    "",
    "| Kağıt | ISIN | Broker | Adet | Ort. maliyet | Fiyat | Değer | K/Z | Ağırlık |",
    "|---|---|---|---|---|---|---|---|---|",
    ...rows,
    ...missing,
    "",
    `Nakit: Scalable (Tagesgeld) ${eur(scalableCash)} € (${pct(scalableCash / total)}), Trade Republic ${eur(trCash)} €`,
    `Toplam: ${eur(total)} €`,
    "",
  ].join("\n");

  return { json, md, total: r2(total), unpriced };
}
