// ── Fundamentalist Agent — Task: financials-cvm ──────────
// DRE, Balanço, DFC — fontes primária: Dados de Mercado
//                      fallback:        CVM Dados Abertos
// All results TTL-cached via FA.tasks.cache.

window.FA = window.FA || {};
window.FA.tasks = window.FA.tasks || {};

FA.tasks.financials = (function () {

  const DDM_BASE = 'https://dadosdemercado.com.br/api/v1/companies';

  // ── Dados de Mercado helpers ─────────────────────────────

  async function ddmFetch(ticker, endpoint) {
    try {
      const url = `${DDM_BASE}/${ticker}/${endpoint}`;
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!r.ok) { console.warn(`[FA:financials] DDM ${endpoint} returned ${r.status}`); return null; }
      const d = await r.json();
      return d.data || d || null;
    } catch (e) {
      console.warn('[FA:financials] DDM error:', e.message);
      return null;
    }
  }

  // ── Determine current reference period ──────────────────

  function currentQuarter() {
    const now = new Date();
    const q = Math.ceil((now.getMonth() + 1) / 3);
    return `${now.getFullYear()}-Q${q}`;
  }

  function currentYear() { return `${new Date().getFullYear()}-anual`; }

  // ── Public methods ───────────────────────────────────────

  async function getDRE(ticker, period = 'quarterly') {
    const refPeriod = period === 'quarterly' ? currentQuarter() : currentYear();
    return FA.tasks.cache.withCache(ticker, 'dre', refPeriod, 'dadosdemercado', async () => {
      console.log('[FA:financials] fetching DRE for', ticker, period);
      const data = await ddmFetch(ticker, 'incomes');
      if (data) return { source: 'dadosdemercado', period, data };
      // CVM fallback — returns null (full CVM CSV parsing out of scope for browser)
      console.warn('[FA:financials] DDM failed for DRE', ticker, '— CVM fallback not yet implemented in browser');
      return null;
    });
  }

  async function getBalanco(ticker, period = 'quarterly') {
    const refPeriod = period === 'quarterly' ? currentQuarter() : currentYear();
    return FA.tasks.cache.withCache(ticker, 'balanco', refPeriod, 'dadosdemercado', async () => {
      console.log('[FA:financials] fetching Balanço for', ticker, period);
      const data = await ddmFetch(ticker, 'balance-sheets');
      if (data) return { source: 'dadosdemercado', period, data };
      return null;
    });
  }

  async function getDFC(ticker, period = 'quarterly') {
    const refPeriod = period === 'quarterly' ? currentQuarter() : currentYear();
    return FA.tasks.cache.withCache(ticker, 'dfc', refPeriod, 'dadosdemercado', async () => {
      console.log('[FA:financials] fetching DFC for', ticker, period);
      const data = await ddmFetch(ticker, 'cash-flows');
      if (data) return { source: 'dadosdemercado', period, data };
      return null;
    });
  }

  // Convenience: fetch all three at once
  async function getAll(ticker) {
    console.log('[FA:financials] getAll for', ticker);
    const [dre, balanco, dfc] = await Promise.all([
      getDRE(ticker),
      getBalanco(ticker),
      getDFC(ticker),
    ]);
    return { dre, balanco, dfc, availableSources: [dre?.source, balanco?.source, dfc?.source].filter(Boolean) };
  }

  return { getDRE, getBalanco, getDFC, getAll };
})();
