// ── Parse Yahoo Finance v8 chart response ────────────────
function parseYfResult(r) {
  const res = r.chart?.result?.[0];
  if (!res) { console.warn('[market] parseYfResult: no result', r.chart?.error); return null; }
  const timestamps = res.timestamp || [];
  const closes = res.indicators?.adjclose?.[0]?.adjclose || res.indicators?.quote?.[0]?.close || [];
  const history = timestamps
    .map((ts, i) => ({ date: ts2d(ts), close: +(closes[i]) }))
    .filter(h => h.close > 0 && !isNaN(h.close))
    .sort((a, b) => a.date.localeCompare(b.date));
  const updatedAt = res.meta.regularMarketTime
    ? new Date(res.meta.regularMarketTime * 1000).toISOString()
    : null;
  return { price: res.meta.regularMarketPrice, updatedAt, history };
}

// ── Fetch Brazilian stock quotes via Vercel proxy ─────────
// BR stocks use .SA suffix; proxy required to avoid CORS
async function fetchYahoo(tickers) {
  if (!tickers.length) { console.log('[market] no tickers to fetch'); return; }
  console.log('[market] fetching Yahoo Finance for:', tickers);
  await Promise.all(tickers.map(async ticker => {
    try {
      const sym = ticker + '.SA';
      const url = `${YF_PROXY}?symbol=${encodeURIComponent(sym)}&range=1y&interval=1d`;
      const r = await fetch(url).then(r => r.json());
      const parsed = parseYfResult(r);
      if (!parsed) { console.warn('[market] no data for', sym); return; }
      BD[ticker] = { ...parsed, dividends: [] };
      console.log('[market]', ticker, '| price:', parsed.price, '| history:', parsed.history.length, 'pts | last:', parsed.history.slice(-1)[0]?.date);
    } catch (e) { console.error('[market] error for', ticker, e); }
  }));
  const times = Object.values(BD).filter(v => v.updatedAt).map(v => new Date(v.updatedAt).getTime());
  if (times.length) tsB = new Date(Math.max(...times)).toISOString();
  console.log('[market] done | tsB:', tsB, '| tickers in BD:', Object.keys(BD));
}
