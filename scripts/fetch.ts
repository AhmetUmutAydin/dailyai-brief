import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fetchFeed, fetchTranscript, parseFeed, searchVideos, selectEntries } from "./lib/youtube.js";
import { fetchTweets, fetchTweetsBatch, mapTweets, type ApifyTweet } from "./lib/x.js";
import { supadataTranscript } from "./lib/supadata.js";
import { loadSeen, saveSeen } from "./lib/seen.js";
import { geminiTranscript } from "./lib/gemini.js";

type Source = { name: string; youtube_channel_id?: string; youtube_search?: string; x_handle?: string; group?: string };

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

async function addVideo(s: Source, e: { id: string; title: string; url: string; published_at: string }): Promise<void> {
  let text: string | null = null;
  let captionError = "";
  try {
    text = await fetchTranscript(e.id);
    if (text === null) captionError = "no captions";
  } catch (err) {
    captionError = (err as Error).message;
  }
  const attempts: string[] = [`captions: ${captionError}`];
  if (text === null && process.env.SUPADATA_API_KEY) {
    try {
      text = await supadataTranscript(e.id);
      if (text === null) attempts.push("supadata: no transcript");
    } catch (err) {
      attempts.push(`supadata: ${(err as Error).message}`);
    }
  }
  if (text === null && process.env.GEMINI_API_KEY) {
    try {
      text = await geminiTranscript(e.url);
    } catch (err) {
      attempts.push(`gemini: ${(err as Error).message}`);
    }
  }
  if (text === null) errors.push(`youtube ${e.id}: ${attempts.join("; ")}`);
  items.push({ id: e.id, person: s.name, platform: "youtube", url: e.url, title: e.title, published_at: e.published_at, text });
  seen.add(e.id);
}

for (const s of sources) {
  if (s.youtube_channel_id) {
    try {
      const entries = selectEntries(parseFeed(await fetchFeed(s.youtube_channel_id)), { since, seen });
      reached++;
      for (const e of entries) await addVideo(s, e);
    } catch (err) {
      errors.push(`youtube ${s.name}: ${(err as Error).message}`);
    }
  }
  if (s.youtube_search) {
    try {
      const needle = s.youtube_search.toLowerCase();
      const hits = (await searchVideos(s.youtube_search)).filter(
        (h) => h.age_hours !== null && h.age_hours <= hours && h.title.toLowerCase().includes(needle) && !seen.has(h.id),
      );
      reached++;
      for (const h of hits) await addVideo(s, h);
    } catch (err) {
      errors.push(`youtube search ${s.name}: ${(err as Error).message}`);
    }
  }
}

const xSources = sources.filter((s) => s.x_handle);
const BATCH = 6;
const batch = new Map<string, ApifyTweet[]>();
const batched = new Set<string>();
for (let i = 0; i < xSources.length; i += BATCH) {
  const group = xSources.slice(i, i + BATCH);
  const handles = group.map((s) => (s.x_handle as string));
  try {
    const raw = await fetchTweetsBatch(handles, minDate, BATCH * 50);
    for (const t of raw) {
      const k = (t.username ?? "").toLowerCase();
      batch.set(k, [...(batch.get(k) ?? []), t]);
    }
    handles.forEach((h) => batched.add(h.toLowerCase()));
    reached++;
  } catch (err) {
    errors.push(`x batch ${handles.join(",")}: ${(err as Error).message.slice(0, 200)}; falling back to per-account runs`);
  }
}
for (const s of xSources) {
  const h = (s.x_handle as string).toLowerCase();
  try {
    let raw: ApifyTweet[];
    if (batched.has(h)) {
      raw = batch.get(h) ?? [];
    } else {
      raw = await fetchTweets(s.x_handle as string, minDate);
      reached++;
    }
    for (const t of mapTweets(raw, s.name)) {
      if (seen.has(`x:${t.id}`) || new Date(t.published_at) < since) continue;
      items.push({ ...t, title: undefined });
      seen.add(`x:${t.id}`);
    }
  } catch (err) {
    errors.push(`x ${s.name}: ${(err as Error).message}`);
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
