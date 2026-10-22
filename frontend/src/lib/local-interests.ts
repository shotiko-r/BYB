// Device-only browsing context. No network calls, prices, names or free-text searches.
export interface LocalInterest { kind: 'category' | 'product'; id: string; market: string; seenAt: number }
const KEY = 'byb-interests-v1';
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
export function readInterests(now = Date.now()): LocalInterest[] {
  try {
    const entries: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(entries)) return [];
    return entries.filter((entry): entry is LocalInterest => Boolean(entry && typeof entry === 'object'
      && ['category', 'product'].includes(entry.kind) && typeof entry.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(entry.id)
      && typeof entry.market === 'string' && /^[A-Z]{2}$/.test(entry.market)
      && Number.isFinite(entry.seenAt) && entry.seenAt <= now && entry.seenAt > now - MAX_AGE)).slice(0, 12);
  } catch { return []; }
}
export function rememberInterest(interest: Omit<LocalInterest, 'seenAt'>): void {
  try {
    const entries = [{ ...interest, seenAt: Date.now() }, ...readInterests().filter(entry =>
      entry.kind !== interest.kind || entry.id !== interest.id || entry.market !== interest.market)].slice(0, 12);
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch { /* Storage-disabled browsers keep working. */ }
}
export function clearInterests(): void {
  try { localStorage.removeItem(KEY); } catch { /* No storage is also a cleared state. */ }
}
