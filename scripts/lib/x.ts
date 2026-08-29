import { retry } from "./retry.js";

export type ApifyTweet = {
  id: string;
  permalink: string;
  username: string;
  text: string;
  createdAt: string;
  isRetweet: boolean;
  replyingTo?: string[];
};

export type XItem = {
  id: string;
  person: string;
  platform: "x";
  url: string;
  published_at: string;
  text: string;
  is_reply: boolean;
};

const ACTOR = "igolaizola~x-twitter-scraper-ppe";

export function mapTweets(raw: ApifyTweet[], person: string): XItem[] {
  return raw
    .filter((t) => !t.isRetweet)
    .map((t) => ({
      id: String(t.id),
      person,
      platform: "x" as const,
      url: t.permalink,
      published_at: new Date(t.createdAt).toISOString(),
      text: t.text,
      is_reply: (t.replyingTo ?? []).length > 0,
    }));
}

export async function fetchTweets(
  handle: string,
  minDate: string,
  maxItems = 50,
): Promise<ApifyTweet[]> {
  return retry(async () => {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?timeout=240`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(process.env.APIFY_TOKEN ? { authorization: `Bearer ${process.env.APIFY_TOKEN}` } : {}),
        },
        body: JSON.stringify({ username: handle, minDate, maxItems, retweets: "exclude" }),
      },
    );
    if (!res.ok) throw new Error(`apify ${handle}: HTTP ${res.status} ${await res.text()}`);
    return (await res.json()) as ApifyTweet[];
  });
}

export async function fetchTweetsBatch(handles: string[], minDate: string, maxItems = 600): Promise<ApifyTweet[]> {
  const query = handles.map((h) => `from:${h}`).join(" OR ");
  return retry(async () => {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?timeout=280`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(process.env.APIFY_TOKEN ? { authorization: `Bearer ${process.env.APIFY_TOKEN}` } : {}),
        },
        body: JSON.stringify({ query, minDate, maxItems, retweets: "exclude" }),
      },
    );
    if (!res.ok) throw new Error(`apify batch: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
    return (await res.json()) as ApifyTweet[];
  });
}
