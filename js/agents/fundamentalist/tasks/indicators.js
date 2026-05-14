// ── Fundamentalist Agent — Task: indicators ──────────────
// P/L, P/VP, EV/EBITDA, ROE, ROIC, DY, margens, dívida/EBITDA
// Sources: 1. Dados de Mercado  2. Fundamentus (scraping via server)
// TTL: 1 day (set in cache.js)

window.FA = window.FA || {};
window.FA.tasks = window.FA.tasks || {};

FA.tasks.indicators = (function () {

  async function fromDadosDeMercado(ticker) {
    try {
      const url = `https://dadosdemercado.com.br/api/v1/companies/${ticker}/indicators`;
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!r.ok) return null;
      const d = await r.json();
      const raw = d.data || d;
      console.log('[FA:indicators] DDM hit for', ticker);

      // Normalize to our standard shape
      return {
        pl:             raw.priceToEarnings  ?? raw.pe          ?? null,
        pvp:            raw.priceToBook      ?? raw.pb          ?? null,
        ev_ebitda:      raw.evToEbitda       ?? raw.evEbitda    ?? null,
        roe:            raw.roe              ?? null,
        roic:           raw.roic             ?? null,
        margem_liquida: raw.netMargin        ?? raw.margemLiquida ?? null,
        margem_ebitda:  raw.ebitdaMargin     ?? raw.margemEbitda  ?? null,
        dividend_yield: raw.dividendYield    ?? raw.dy          ?? null,
        divida_ebitda:  raw.netDebtToEbitda  ?? raw.dividaEbitda ?? null,
        crescimento_receita: raw.revenueGrowth ?? null,
        crescimento_lucro:   raw.netIncomeGrowth ?? null,
        source: 'dadosdemercado',
        fetched_at: new Date().toISOString(),
      };
    } catch (e) {
      console.warn('[FA:indicators] DDM error:', e.message);
      return null;
    }
  }

  async function fromFundamentus(ticker) {
    // Fundamentus blocks CORS — must go through a server-side proxy.
    // The /api/fundamentus endpoint handles this scraping.
    try {
      const r = await fetch(`/api/fundamentus?ticker=${ticker}`);
      if (!r.ok) return null;
      const d = await r.json();
      console.log('[FA:indicators] Fundamentus hit for', ticker);
      return { ...d, source: 'fundamentus' };
    } catch (e) {
      console.warn('[FA:indicators] fundamentus error:', e.message);
      return null;
    }
  }

  async function get(ticker) {
    return FA.tasks.cache.withCache(ticker, 'indicadores', null, 'dadosdemercado', async () => {
      console.log('[FA:indicators] fetching indicators for', ticker);
      return (await fromDadosDeMercado(ticker)) || (await fromFundamentus(ticker));
    });
  }

  return { get };
})();
