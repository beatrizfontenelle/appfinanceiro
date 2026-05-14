// ── Fundamentalist Agent — Task: prices ──────────────────
// Fetches and accumulates historical prices in asset_prices table.
// Sources: Yahoo Finance (via /api/yahoo) → fallback brapi.dev
// Strategy: fetch only the delta (new data since last DB entry).

window.FA = window.FA || {};
window.FA.tasks = window.FA.tasks || {};

FA.tasks.prices = (function () {

  async function getLastDate(ticker) {
    try {
      const { data } = await sbc.from('asset_prices')
        .select('date')
        .eq('ticker', ticker)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.date || null;
    } catch (e) { return null; }
  }

  async function fromYahoo(ticker, lastDate) {
    try {
      const sym = ticker.includes('.') ? ticker : ticker + '.SA';
      // Use 5y range; if we have recent data, 1y is enough to catch the delta
      const range = lastDate ? '1y' : '5y';
      const url = `/api/yahoo?symbol=${sym}&range=${range}&interval=1d`;
      const r = await fetch(url);
      if (!r.ok) return [];
      const d = await r.json();
      const result = d.chart?.result?.[0];
      if (!result) return [];

      const timestamps = result.timestamps || [];
      const quotes = result.indicators?.quote?.[0] || {};
      const closes = result.indicators?.adjclose?.[0]?.adjclose || quotes.close || [];

      const rows = [];
      for (let i = 0; i < timestamps.length; i++) {
        const dateStr = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
        if (lastDate && dateStr <= lastDate) continue;
        if (!closes[i]) continue;
        rows.push({
          ticker,
          date: dateStr,
          close: closes[i],
          open: quotes.open?.[i] || null,
          high: quotes.high?.[i] || null,
          low: quotes.low?.[i] || null,
          volume: quotes.volume?.[i] || null,
          source: 'yahoo',
        });
      }
      return rows;
    } catch (e) {
      console.warn('[FA:prices] yahoo error:', e.message);
      return [];
    }
  }

  async function fromBrapi(ticker, lastDate) {
    try {
      const range = lastDate ? '1y' : '5y';
      const url = `https://brapi.dev/api/quote/${ticker}?range=${range}&interval=1d`;
      const r = await fetch(url);
      if (!r.ok) return [];
      const d = await r.json();
      const hist = d.results?.[0]?.historicalDataPrice || [];
      const rows = hist
        .filter(h => {
          const dateStr = new Date(h.date * 1000).toISOString().slice(0, 10);
          return !lastDate || dateStr > lastDate;
        })
        .map(h => ({
          ticker,
          date: new Date(h.date * 1000).toISOString().slice(0, 10),
          close: h.close,
          open: h.open || null,
          high: h.high || null,
          low: h.low || null,
          volume: h.volume || null,
          source: 'brapi',
        }));
      return rows;
    } catch (e) {
      console.warn('[FA:prices] brapi error:', e.message);
      return [];
    }
  }

  async function saveRows(rows) {
    if (!rows.length) return;
    const { error } = await sbc.from('asset_prices').upsert(rows, { onConflict: 'ticker,date', ignoreDuplicates: true });
    if (error) console.warn('[FA:prices] upsert error:', error.message);
    else console.log(`[FA:prices] saved ${rows.length} price rows`);
  }

  async function sync(ticker) {
    console.log('[FA:prices] syncing prices for', ticker);
    const lastDate = await getLastDate(ticker);
    console.log('[FA:prices] last stored date:', lastDate || 'none');

    let rows = await fromYahoo(ticker, lastDate);
    if (!rows.length) {
      console.log('[FA:prices] yahoo returned 0 rows, trying brapi...');
      rows = await fromBrapi(ticker, lastDate);
    }

    await saveRows(rows);
    console.log(`[FA:prices] sync done: ${ticker} — ${rows.length} new rows`);
    return rows.length;
  }

  async function getHistory(ticker, days = 365) {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().slice(0, 10);

      const { data, error } = await sbc.from('asset_prices')
        .select('date, close, open, high, low, volume')
        .eq('ticker', ticker)
        .gte('date', cutoffStr)
        .order('date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('[FA:prices] getHistory error:', e.message);
      return [];
    }
  }

  async function getLatestPrice(ticker) {
    try {
      const { data } = await sbc.from('asset_prices')
        .select('close, date')
        .eq('ticker', ticker)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data || null;
    } catch (e) { return null; }
  }

  return { sync, getHistory, getLatestPrice };
})();
