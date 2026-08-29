import { XMLParser } from "fast-xml-parser";
import { getSubtitles } from "youtube-caption-extractor";

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
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
  if (!res.ok) throw new Error(`feed ${channelId}: HTTP ${res.status}`);
  return res.text();
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
