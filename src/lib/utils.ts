export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function isValidUsername(username: string) {
  return /^[a-zA-Z0-9_]{3,30}$/.test(username);
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function searchRelevance(query: string, name: string): number {
  const q = query.trim().toLowerCase();
  const n = name.toLowerCase();
  if (!q) return 0;
  if (n === q) return 100;
  if (n.startsWith(q)) return 80;
  if (n.includes(q)) return 50;
  const tokens = q.split(/\s+/);
  let hits = 0;
  for (const t of tokens) {
    if (t && n.includes(t)) hits += 1;
  }
  return hits > 0 ? 20 + hits * 5 : 0;
}
