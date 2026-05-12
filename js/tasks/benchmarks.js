// ── Fetch market benchmarks ───────────────────────────────
// Ibovespa and S&P 500 via Yahoo Finance proxy (CORS required)
// CDI via BrasilAPI (has CORS, returns current rate)
async function fetchBenchmarks() {
  console.log('[benchmarks] fetching BVSP and GSPC...');
  try {
    const [rBvsp, rGspc] = await Promise.all([
      fetch(`${YF_PROXY}?symbol=${encodeURIComponent('^BVSP')}&range=1y&interval=1d`).then(r => r.json()),
      fetch(`${YF_PROXY}?symbol=${encodeURIComponent('^GSPC')}&range=1y&interval=1d`).then(r => r.json()),
    ]);
    const bvsp = parseYfResult(rBvsp);
    const gspc = parseYfResult(rGspc);
    if (bvsp) { BM.BVSP = bvsp; console.log('[benchmarks] BVSP:', bvsp.price, '|', bvsp.history.length, 'pts'); }
    else console.warn('[benchmarks] BVSP fetch failed');
    if (gspc) { BM.GSPC = gspc; console.log('[benchmarks] GSPC:', gspc.price, '|', gspc.history.length, 'pts'); }
    else console.warn('[benchmarks] GSPC fetch failed');
  } catch (e) { console.error('[benchmarks] index fetch error', e); }

  // BrasilAPI returns CDI with Access-Control-Allow-Origin: * — safe to call from browser
  console.log('[benchmarks] fetching CDI from BrasilAPI...');
  try {
    const cdi = await fetch('https://brasilapi.com.br/api/taxas/v1/cdi').then(r => r.json());
    BM.CDI = { rate: cdi.valor ?? 14.75 };
    console.log('[benchmarks] CDI rate:', BM.CDI.rate, '% a.a.');
  } catch (e) {
    console.warn('[benchmarks] CDI fetch failed, fallback 14.75%', e);
    BM.CDI = { rate: 14.75 };
  }
}

// ── Fetch USD/BRL exchange rate ───────────────────────────
async function fetchUsd() {
  try {
    const r = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
    const d = await r.json();
    usdRate = parseFloat(d.USDBRL.bid);
    console.log('[benchmarks] USD/BRL:', usdRate);
  } catch (e) {
    console.warn('[benchmarks] USD fetch failed, fallback 5.75', e);
    usdRate = 5.75;
  }
}
