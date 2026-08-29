import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const PortfolioSchema = z.object({
  updated_at: date,
  price_date: date,
  holdings: z.array(
    z.object({
      isin: z.string().nullable(),
      name: z.string().min(1),
      ticker: z.string().nullable(),
      broker: z.enum(["Scalable", "Trade Republic"]),
      weight: z.number().min(0).max(1),
    }),
  ),
  cash_weight: z.number().min(0).max(1),
});

export type Portfolio = z.infer<typeof PortfolioSchema>;
