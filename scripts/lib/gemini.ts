const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
const PROMPT =
  "Bu videoda konuşulan her şeyi, konuşulduğu dilde, olduğu gibi tam metin olarak yaz. Özetleme, yorum ekleme, başlık koyma. Sadece konuşma metni.";

function key(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY not set");
  return k;
}

async function viaGenerateContent(url: string): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
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

async function viaInteractions(url: string): Promise<string> {
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key() },
    body: JSON.stringify({
      model: MODEL,
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
  try {
    return await viaGenerateContent(url);
  } catch (first) {
    console.error(`gemini generateContent failed, trying interactions: ${(first as Error).message}`);
    try {
      return await viaInteractions(url);
    } catch (second) {
      throw new Error(`${(first as Error).message} | ${(second as Error).message}`);
    }
  }
}
