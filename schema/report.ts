import { z } from "zod";

const url = z.string().url();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDateTime = z.string().datetime({ offset: true });

export const MentionSchema = z.object({
  person: z.string().min(1),
  sentiment: z.enum(["positive", "negative", "neutral"]),
  quote: z.string().min(1),
  source_url: url,
});

export const PortfolioSectionSchema = z.object({
  cash_weight: z.number().min(0).max(1),
  holdings: z.array(
    z.object({
      isin: z.string().nullable(),
      name: z.string().min(1),
      weight: z.number().min(0).max(1),
      mentions: z.array(MentionSchema),
      action: z.enum(["hold", "sell", "buy_more"]),
      why: z.string().min(1),
    }),
  ),
  ideas: z
    .array(
      z.object({
        symbol: z.string().min(1),
        name: z.string().min(1),
        why: z.string().min(1),
        source_url: url,
      }),
    )
    .max(3),
});

export const ReportSchema = z.object({
  date,
  generated_at: isoDateTime,
  errors: z.array(z.string()).optional(),
  attention: z.array(
    z.object({
      title: z.string().min(1),
      person: z.string().min(1),
      why: z.string().min(1),
      source_url: url,
    }),
  ),
  macro: z.array(
    z.object({
      topic: z.string().min(1),
      views: z.array(
        z.object({
          person: z.string().min(1),
          view: z.string().min(1),
          quote: z.string().min(1),
          source_url: url,
        }),
      ),
    }),
  ),
  assets: z.array(
    z.object({
      symbol: z.string().min(1),
      name: z.string().min(1),
      priority: z.enum(["high", "medium", "low"]).optional(),
      why: z.string().optional(),
      mentions: z.array(MentionSchema).min(1),
    }),
  ),
  persons: z.array(
    z.object({
      name: z.string().min(1),
      group: z.string().optional(),
      digest: z.union([z.string(), z.array(z.string().min(1))]).optional(),
      items: z.array(
        z.object({
          platform: z.enum(["youtube", "x"]),
          title: z.string().min(1),
          url,
          published_at: isoDateTime,
          summary: z.string().min(1),
          assets: z.array(
            z.object({
              symbol: z.string().min(1),
              sentiment: z.enum(["positive", "negative", "neutral"]),
              note: z.string().min(1),
            }),
          ),
        }),
      ),
    }),
  ),
  portfolio: PortfolioSectionSchema.optional(),
});

export type Report = z.infer<typeof ReportSchema>;
