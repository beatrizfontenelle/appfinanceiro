// ── Current market price ──────────────────────────────────
function bprice(code) { return BD[code]?.price ?? null; }

// ── Historical price N calendar days ago ─────────────────
// Walks back through history to find the last close on or before target date
function hprice(code, daysAgo) {
  const h = BD[code]?.history;
  if (!h?.length) return null;
  const t = new Date(); t.setDate(t.getDate() - daysAgo);
  const ts = t.toISOString().slice(0, 10);
  for (let i = h.length - 1; i >= 0; i--) { if (h[i].date <= ts) return h[i].close; }
  return null;
}

// ── Historical benchmark price N calendar days ago ────────
function bmhprice(key, daysAgo) {
  const h = BM[key]?.history;
  if (!h?.length) return null;
  const t = new Date(); t.setDate(t.getDate() - daysAgo);
  const ts = t.toISOString().slice(0, 10);
  for (let i = h.length - 1; i >= 0; i--) { if (h[i].date <= ts) return h[i].close; }
  return null;
}

// ── Price at specific date for TWR ───────────────────────
// Returns the first available trading day price on or after the given date.
// Used to calculate Time-Weighted Return since purchase date.
function hpriceAt(code, dateStr) {
  const h = BD[code]?.history;
  if (!h?.length) return null;
  for (let i = 0; i < h.length; i++) { if (h[i].date >= dateStr) return h[i].close; }
  return null;
}

// ── Period return % ───────────────────────────────────────
function calcRet(code, days) {
  const c = bprice(code), o = hprice(code, days);
  if (c == null || o == null) return null;
  return (c - o) / o * 100;
}

function calcBmRet(key, days) {
  const c = BM[key]?.price ?? BM[key]?.history?.slice(-1)[0]?.close;
  const o = bmhprice(key, days);
  if (c == null || o == null) return null;
  return (c - o) / o * 100;
}
