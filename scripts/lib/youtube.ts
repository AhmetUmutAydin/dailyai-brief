import { XMLParser } from "fast-xml-parser";
import { getSubtitles } from "youtube-caption-extractor";
import { retry } from "./retry.js";

export type FeedEntry = {
  id: string;
  title: string;
  url: string;
  published_at: string;
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

export function parseFeed(xml: string): FeedEntry[] {
  const doc = parser.parse(xml);
  const raw = doc?.feed?.entry;
  const entries = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  return entries.map((e: any) => ({
    id: String(e["yt:videoId"]),
    title: String(e.title),
    url: String(e.link["@_href"]),
    published_at: String(e.published),
  }));
}

export function selectEntries(
  entries: FeedEntry[],
  opts: { since: Date; seen: Set<string> },
): FeedEntry[] {
  return entries.filter(
    (e) =>
      !e.url.includes("/shorts/") &&
      new Date(e.published_at) >= opts.since &&
      !opts.seen.has(e.id),
  );
}

export async function fetchFeed(channelId: string): Promise<string> {
  return retry(async () => {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
    if (!res.ok) throw new Error(`feed ${channelId}: HTTP ${res.status}`);
    return res.text();
  }, 3, 30_000, /HTTP (404|408|429|5\d\d)/);
}

export async function fetchTranscript(
  videoId: string,
  langs: string[] = ["tr", "en"],
): Promise<string | null> {
  for (const lang of langs) {
    const segments = await getSubtitles({ videoID: videoId, lang });
    if (segments.length > 0) {
      return segments.map((s) => s.text.trim()).filter(Boolean).join(" ");
    }
  }
  return null;
}

export type SearchHit = FeedEntry & { age_hours: number | null };

const AGE: Record<string, number> = {
  second: 1 / 3600, minute: 1 / 60, hour: 1, day: 24, week: 168, month: 720, year: 8760,
  saniye: 1 / 3600, dakika: 1 / 60, saat: 1, gün: 24, hafta: 168, ay: 720, yıl: 8760,
};

function parseAge(text: string): number | null {
  const m = /(\d+)\s+(second|minute|hour|day|week|month|year|saniye|dakika|saat|gün|hafta|ay|yıl)s?\s+(ago|önce)/.exec(text);
  return m ? Number(m[1]) * AGE[m[2]] : null;
}

export async function searchVideos(query: string): Promise<SearchHit[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=CAI%253D&hl=tr&gl=TR`;
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0", "accept-language": "tr-TR,tr;q=0.9,en;q=0.5" } });
  if (!res.ok) throw new Error(`youtube search "${query}": HTTP ${res.status}`);
  const html = await res.text();
  const start = html.indexOf("ytInitialData = ");
  if (start < 0) throw new Error(`youtube search "${query}": no ytInitialData`);
  const json = html.slice(start + 16, html.indexOf(";</script>", start));
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    const o = v as Record<string, any>;
    if (o.videoRenderer?.videoId && !seen.has(o.videoRenderer.videoId)) {
      const r = o.videoRenderer;
      seen.add(r.videoId);
      const title = (r.title?.runs ?? []).map((x: any) => x.text).join("");
      const published = r.publishedTimeText?.simpleText ?? "";
      const age = parseAge(published);
      hits.push({
        id: r.videoId,
        title,
        url: `https://www.youtube.com/watch?v=${r.videoId}`,
        published_at: age === null ? "" : new Date(Date.now() - age * 3600 * 1000).toISOString(),
        age_hours: age,
      });
    }
    Object.values(o).forEach(walk);
  };
  walk(JSON.parse(json));
  return hits;
}
