import { retry } from "./retry.js";

const MODELS = (process.env.GEMINI_MODELS ?? "gemini-3.8-flash,gemini-3.5-flash-lite,gemini-2.5-flash").split(",").map((m) => m.trim()).filter(Boolean);
const GAP_MS = 12_000;
let lastCall = 0;

async function pace(): Promise<void> {
  const wait = lastCall + GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}
const PROMPT =
  "Bu videoda konuşulan her şeyi, konuşulduğu dilde, olduğu gibi tam metin olarak yaz. Özetleme, yorum ekleme, başlık koyma. Sadece konuşma metni.";

function key(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY not set");
  return k;
}

async function viaGenerateContent(url: string, model: string): Promise<string> {
  await pace();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key() },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }, { file_data: { file_uri: url } }] }],
    }),
  });
  if (!res.ok) throw new Error(`generateContent HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  if (!text) throw new Error("generateContent returned no text");
  return text;
}

async function viaInteractions(url: string, model: string): Promise<string> {
  await pace();
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key() },
    body: JSON.stringify({
      model,
      input: [
        { type: "text", text: PROMPT },
        { type: "video", uri: url },
      ],
    }),
  });
  if (!res.ok) throw new Error(`interactions HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const texts: string[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.text === "string" && o.type !== "text_input") texts.push(o.text);
      Object.values(o).forEach(walk);
    }
  };
  walk(json.output ?? json.outputs ?? json);
  const text = texts.join("").trim();
  if (!text) throw new Error(`interactions returned no text: ${JSON.stringify(json).slice(0, 300)}`);
  return text;
}

export async function geminiTranscript(url: string): Promise<string> {
  const failures: string[] = [];
  for (const model of MODELS) {
    try {
      return await retry(() => viaGenerateContent(url, model), 2, 60_000);
    } catch (err) {
      failures.push(`${model}: ${(err as Error).message.slice(0, 160)}`);
      if (!/HTTP (429|503)/.test((err as Error).message)) {
        try {
          return await retry(() => viaInteractions(url, model), 2, 60_000);
        } catch (err2) {
          failures.push(`${model}/interactions: ${(err2 as Error).message.slice(0, 160)}`);
        }
      }
    }
  }
  throw new Error(`gemini failed on all models | ${failures.join(" | ")}`);
}
