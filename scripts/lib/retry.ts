export async function retry<T>(fn: () => Promise<T>, attempts = 3, waitMs = 60_000): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!/HTTP (408|429|5\d\d)/.test((err as Error).message) || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, waitMs * (i + 1)));
    }
  }
  throw last;
}
