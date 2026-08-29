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

export const ReportSchema = z.object({
  date,
  generated_at: isoDateTime,
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
      mentions: z.array(MentionSchema).min(1),
    }),
  ),
  persons: z.array(
    z.object({
      name: z.string().min(1),
      items: z.array(
        z.object({
          platform: z.enum(["youtube", "x"]),
          title: z.string().min(1),
          url,
          published_at: isoDateTime,
          summary: z.string().min(1),
        }),
      ),
    }),
  ),
});

export type Report = z.infer<typeof ReportSchema>;
