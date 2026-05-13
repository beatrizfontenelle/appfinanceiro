// ── Data Agent: orchestrates all data collection ──────────
// Decides whether to load from Supabase cache or fetch fresh data.
// Cache is valid for one calendar day (São Paulo timezone).
async function loadAll(force = false) {
  showOv('verificando cache...');
  await loadSettings();

  const ok = !force && await cacheOk();

  if (ok) {
    console.log('[data-agent] cache hit — loading from Supabase');
    showOv('carregando do cache...');
    await loadCache();
    setSt('st-pl', 'ok', `pluggy: ${toBRL(tsP)} (cache)`);
    setSt('st-br', 'ok', `yahoo: ${toBRL(tsB)} (cache)`);
  } else {
    console.log('[data-agent] cache miss —', force ? 'forced refresh' : 'stale or empty');

    showOv('autenticando Pluggy...');
    await plAuth();

    showOv('buscando contas bancárias...');
    await fetchAccounts();

    showOv('buscando transações...');
    await fetchTransactions();

    showOv('buscando carteira de investimentos...');
    await fetchInvestments();

    const allTs = [...accounts, ...investments].map(x => x.updatedAt).filter(Boolean);
    if (allTs.length) tsP = allTs.reduce((a, b) => a > b ? a : b);

    const tickers = [...new Set(investments.filter(isRV).map(i => i.code).filter(Boolean))];
    showOv(`cotações Yahoo Finance (${tickers.length} ativos)...`);
    await fetchYahoo(tickers);

    showOv('benchmarks: Ibovespa, S&P 500, CDI...');
    await fetchBenchmarks();

    showOv('câmbio USD/BRL...');
    await fetchUsd();

    showOv('salvando cache...');
    await saveCache();

    setSt('st-pl', 'ok', `pluggy: ${toBRL(tsP)}`);
    setSt('st-br', 'ok', `yahoo: ${toBRL(tsB)}`);
    console.log('[data-agent] fresh data loaded and cached');
  }

  // Load yesterday's snapshot for delta KPI badges (fire-and-forget — doesn't block render)
  loadPrevSnapshot().then(() => renderOverview());

  renderAll();

  // Save today's snapshot after fresh data (always, cache or not)
  const sal = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const inv = investments.reduce((s, i) => s + (i.amount || i.balance || 0), 0);
  saveSnapshot(sal + inv + intBrl(), sal, inv, intBrl());

  document.getElementById('pmeta').textContent = 'dados de: ' + toBRL(tsP);
  document.getElementById('freshbar').innerHTML = [
    `<div class="fresh-item">🏦 <b>Pluggy</b> ${toBRL(tsP)}</div>`,
    `<div class="fresh-item">📈 <b>Yahoo Finance</b> ${toBRL(tsB)}</div>`,
    `<div class="fresh-item">💵 <b>USD/BRL</b> ${usdRate ? 'R$ ' + usdRate.toFixed(4) : '—'}</div>`,
    `<div class="fresh-item">💾 <b>Cache</b> ${ok ? 'hoje · instantâneo' : 'atualizado agora'}</div>`,
  ].join('');

  hideOv();
}

function forceReload() {
  console.log('[data-agent] force reload triggered');
  plKey = null; accounts = []; txAll = []; investments = [];
  BD = {}; BM = {};
  loadAll(true);
}
