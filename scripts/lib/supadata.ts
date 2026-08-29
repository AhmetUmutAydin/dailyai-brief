let lastCall = 0;

export async function supadataTranscript(videoId: string, lang = "tr"): Promise<string | null> {
  const key = process.env.SUPADATA_API_KEY;
  if (!key) throw new Error("SUPADATA_API_KEY not set");
  const wait = lastCall + 1_100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const res = await fetch(
    `https://api.supadata.ai/v1/youtube/transcript?videoId=${encodeURIComponent(videoId)}&lang=${lang}&text=true`,
    { headers: { "x-api-key": key } },
  );
  if (res.status === 206 || res.status === 404) return null;
  if (!res.ok) throw new Error(`supadata ${videoId}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { content?: string };
  const text = (json.content ?? "").trim();
  return text.length > 0 ? text : null;
}
