// ── Supabase CRUD ─────────────────────────────────────────
async function dbGet(k) {
  try {
    const { data } = await sbc.from('user_settings').select('value').eq('key', k).maybeSingle();
    return data ? JSON.parse(data.value) : null;
  } catch (e) { console.warn('[cache] dbGet error', k, e); return null; }
}

async function dbSet(k, v) {
  try {
    await sbc.from('user_settings').upsert(
      { key: k, value: JSON.stringify(v), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
  } catch (e) { console.warn('[cache] dbSet error', k, e); }
}

// ── Cache version — bump this string whenever the data schema changes
//    so old caches are automatically invalidated on next visit
const CACHE_VERSION = 'v2-dividends';

// ── Cache validity ────────────────────────────────────────
async function cacheOk() {
  const [d, mk, ver] = await Promise.all([dbGet('cache_date'), dbGet('cache_market'), dbGet('cache_version')]);
  const valid = d === todayKey() && mk && Object.keys(mk).length > 0 && ver === CACHE_VERSION;
  console.log('[cache] valid:', valid, '| date:', d, '| version:', ver, '| today:', todayKey(), '| tickers:', mk ? Object.keys(mk).length : 0);
  return valid;
}

// ── Persist all state to Supabase ────────────────────────
async function saveCache() {
  console.log('[cache] saving to Supabase...');
  await Promise.all([
    dbSet('cache_accounts', accounts),
    dbSet('cache_transactions', txAll),
    dbSet('cache_investments', investments),
    dbSet('cache_market', BD),
    dbSet('cache_benchmarks', BM),
    dbSet('cache_usd', usdRate),
    dbSet('cache_ts_pluggy', tsP),
    dbSet('cache_ts_market', tsB),
    dbSet('cache_date', todayKey()),
    dbSet('cache_version', CACHE_VERSION),
  ]);
  console.log('[cache] saved');
}

// ── Load all state from Supabase ──────────────────────────
async function loadCache() {
  console.log('[cache] loading from Supabase...');
  const [ac, tx, iv, mk, bm, usd, tp, tb] = await Promise.all([
    dbGet('cache_accounts'), dbGet('cache_transactions'), dbGet('cache_investments'),
    dbGet('cache_market'), dbGet('cache_benchmarks'), dbGet('cache_usd'),
    dbGet('cache_ts_pluggy'), dbGet('cache_ts_market'),
  ]);
  if (ac) { accounts = ac; console.log('[cache] accounts:', ac.length); }
  if (tx) { txAll = tx; console.log('[cache] transactions:', tx.length); }
  if (iv) { investments = iv; console.log('[cache] investments:', iv.length); }
  if (mk) { BD = mk; console.log('[cache] market tickers:', Object.keys(mk)); }
  if (bm) { BM = bm; console.log('[cache] benchmarks:', Object.keys(bm)); }
  if (usd) usdRate = usd;
  if (tp) tsP = tp;
  if (tb) tsB = tb;
}

// ── Daily patrimônio snapshots (for KPI delta badges) ─────
// Saves a compact snapshot keyed by date; loads yesterday's for comparison.
// Keeps the last 30 days to avoid unbounded growth in Supabase.
async function saveSnapshot(total, saldo, investimentos, internacional) {
  const today = todayKey();
  const snap = { total, saldo, investimentos, internacional, savedAt: new Date().toISOString() };
  await dbSet('snap_' + today, snap);
  console.log('[cache] snapshot saved for', today, '| total:', total);
  // Best-effort cleanup: remove snapshots older than 30 days (fire-and-forget)
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
  for (let i = 1; i <= 30; i++) {
    const d = new Date(cutoff); d.setDate(d.getDate() - i);
    const k = 'snap_' + d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    dbSet(k, null); // null removes the entry effectively (will just be null on read)
  }
}

async function loadPrevSnapshot() {
  // Try yesterday first, then up to 3 days back (weekends, holidays)
  for (let i = 1; i <= 3; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = 'snap_' + d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const s = await dbGet(k);
    if (s && s.total) {
      prevSnapshot = s;
      console.log('[cache] prev snapshot loaded from', k, '| total:', s.total);
      return;
    }
  }
  console.log('[cache] no previous snapshot found');
}
