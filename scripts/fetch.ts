import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fetchFeed, fetchTranscript, parseFeed, selectEntries } from "./lib/youtube.js";
import { fetchTweets, mapTweets } from "./lib/x.js";
import { loadSeen, saveSeen } from "./lib/seen.js";
import { geminiTranscript } from "./lib/gemini.js";

type Source = { name: string; youtube_channel_id?: string; x_handle?: string };

type RawItem = {
  id: string;
  person: string;
  platform: "youtube" | "x";
  url: string;
  title?: string;
  published_at: string;
  text: string | null;
  is_reply?: boolean;
};

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const hours = Number(arg("hours", "24"));
const date = arg("date", new Date().toISOString().slice(0, 10));
const since = new Date(Date.now() - hours * 3600 * 1000);
const minDate = since.toISOString().slice(0, 10);

const sources = JSON.parse(readFileSync("sources.json", "utf8")) as Source[];
const seenPath = "data/seen.json";
const seen = loadSeen(seenPath);
const items: RawItem[] = [];
const errors: string[] = [];
let reached = 0;

for (const s of sources) {
  if (s.youtube_channel_id) {
    try {
      const entries = selectEntries(parseFeed(await fetchFeed(s.youtube_channel_id)), { since, seen });
      reached++;
      for (const e of entries) {
        let text: string | null = null;
        let captionError = "";
        try {
          text = await fetchTranscript(e.id);
          if (text === null) captionError = "no captions";
        } catch (err) {
          captionError = (err as Error).message;
        }
        if (text === null && process.env.GEMINI_API_KEY) {
          try {
            text = await geminiTranscript(e.url);
          } catch (err) {
            errors.push(`youtube ${e.id}: captions: ${captionError}; gemini: ${(err as Error).message}`);
          }
        } else if (text === null) {
          errors.push(`youtube ${e.id}: ${captionError}`);
        }
        items.push({ id: e.id, person: s.name, platform: "youtube", url: e.url, title: e.title, published_at: e.published_at, text });
        seen.add(e.id);
      }
    } catch (err) {
      errors.push(`youtube ${s.name}: ${(err as Error).message}`);
    }
  }
  if (s.x_handle) {
    try {
      const tweets = mapTweets(await fetchTweets(s.x_handle, minDate), s.name);
      reached++;
      for (const t of tweets) {
        if (seen.has(`x:${t.id}`) || new Date(t.published_at) < since) continue;
        items.push({ ...t, title: undefined });
        seen.add(`x:${t.id}`);
      }
    } catch (err) {
      errors.push(`x ${s.name}: ${(err as Error).message}`);
    }
  }
}

mkdirSync(`data/${date}`, { recursive: true });
writeFileSync(
  `data/${date}/raw.json`,
  JSON.stringify({ date, generated_at: new Date().toISOString(), items, errors }, null, 2) + "\n",
);
saveSeen(seenPath, seen);
console.log(`${items.length} items, ${errors.length} errors → data/${date}/raw.json`);
for (const e of errors) console.error(e);
process.exit(reached === 0 ? 1 : 0);
