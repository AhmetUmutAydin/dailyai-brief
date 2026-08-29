const TEXT = new Set([
  "errors.*",
  "attention.*.title",
  "attention.*.why",
  "macro.*.topic",
  "macro.*.views.*.view",
  "macro.*.views.*.quote",
  "assets.*.name",
  "assets.*.why",
  "assets.*.mentions.*.quote",
  "persons.*.digest",
  "persons.*.items.*.title",
  "persons.*.items.*.summary",
  "persons.*.items.*.assets.*.note",
  "portfolio.holdings.*.why",
  "portfolio.holdings.*.mentions.*.quote",
  "portfolio.ideas.*.name",
  "portfolio.ideas.*.why",
]);

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const join = (a: string, b: string) => (a ? `${a}.${b}` : b);
const present = (v: unknown) => ((typeof v === "string" && v.length > 0) || (Array.isArray(v) && v.length > 0) ? "<text>" : "<empty>");

function blank(v: unknown, pattern: string): unknown {
  if (TEXT.has(pattern)) return present(v);
  if (Array.isArray(v)) return v.map((x) => blank(x, join(pattern, "*")));
  if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blank(x, join(pattern, k))]));
  return v;
}

const show = (v: unknown) => (Array.isArray(v) ? "[array]" : isObj(v) ? "[object]" : typeof v === "string" ? v : JSON.stringify(v));

function diff(a: unknown, b: unknown, path: string, out: string[]): void {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      out.push(`${path}: length ${a.length} ≠ ${b.length}`);
      return;
    }
    a.forEach((x, i) => diff(x, b[i], join(path, String(i)), out));
    return;
  }
  if (isObj(a) && isObj(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const p = join(path, k);
      if (!(k in a)) out.push(`${p}: missing in tr`);
      else if (!(k in b)) out.push(`${p}: missing in en`);
      else diff(a[k], b[k], p, out);
    }
    return;
  }
  if (a !== b) out.push(`${path}: ${show(a)} ≠ ${show(b)}`);
}

export function parityIssues(tr: unknown, en: unknown): string[] {
  const out: string[] = [];
  diff(blank(tr, ""), blank(en, ""), "", out);
  return out;
}
