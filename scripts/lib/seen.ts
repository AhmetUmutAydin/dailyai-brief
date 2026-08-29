import { existsSync, readFileSync, writeFileSync } from "node:fs";

export function loadSeen(path: string): Set<string> {
  if (!existsSync(path)) return new Set();
  return new Set(JSON.parse(readFileSync(path, "utf8")) as string[]);
}

export function saveSeen(path: string, seen: Set<string>): void {
  writeFileSync(path, JSON.stringify([...seen].sort(), null, 2) + "\n");
}
