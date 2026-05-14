// ── Fundamentalist Agent — Task: debenture-data ──────────
// Escritura, covenants, taxas indicativas ANBIMA, dados B3
// Sources: ANBIMA → debentures.com.br → fallback informational

window.FA = window.FA || {};
window.FA.tasks = window.FA.tasks || {};

FA.tasks.debenture = (function () {

  async function getANBIMARate(isin) {
    // ANBIMA has a public debenture search — go through server proxy to avoid CORS
    try {
      const r = await fetch(`/api/anbima?isin=${isin}`);
      if (!r.ok) return null;
      const d = await r.json();
      console.log('[FA:debenture] ANBIMA hit for', isin);
      return d;
    } catch (e) {
      console.warn('[FA:debenture] ANBIMA error:', e.message);
      return null;
    }
  }

  async function getEscritura(isin) {
    return FA.tasks.cache.withCache(isin, 'escritura', null, 'debentures.com.br', async () => {
      console.log('[FA:debenture] fetching escritura for', isin);
      // debentures.com.br needs server-side scraping due to CORS
      try {
        const r = await fetch(`/api/escritura?isin=${isin}`);
        if (!r.ok) {
          console.warn('[FA:debenture] escritura not found via API for', isin);
          return null;
        }
        const d = await r.json();
        return d;
      } catch (e) {
        console.warn('[FA:debenture] escritura error:', e.message);
        return null;
      }
    });
  }

  async function getIndicativeTaxes(isin) {
    return FA.tasks.cache.withCache(isin, 'indicadores', null, 'anbima', async () => {
      return await getANBIMARate(isin);
    });
  }

  // Parse covenant text from PDF using Claude API (via /api/claude)
  async function parseCovenants(escrituraPdfText) {
    if (!escrituraPdfText) return null;
    try {
      const prompt = `Extraia os covenants financeiros desta escritura de debênture em JSON estruturado.
Retorne APENAS JSON válido, sem markdown:
{
  "covenants": [
    { "tipo": "financeiro|operacional|outro", "descricao": "texto do covenant", "metrica": "ex: Dívida/EBITDA", "limite": "ex: <= 3.5x", "periodicidade": "trimestral|semestral|anual" }
  ],
  "hierarquia": "sênior|subordinado|quirografário",
  "garantias": ["descrição das garantias"],
  "vencimento": "YYYY-MM-DD",
  "taxa": "descrição da taxa (ex: CDI + 1.5% a.a.)",
  "amortizacao": "descrição"
}

ESCRITURA (trecho):
${escrituraPdfText.slice(0, 8000)}`;

      const result = await FA.callClaude(prompt, { maxTokens: 1000 });
      if (!result) return null;
      try {
        return JSON.parse(result);
      } catch (e) {
        // Try extracting JSON with regex
        const m = result.match(/\{[\s\S]+\}/);
        if (m) return JSON.parse(m[0]);
        return null;
      }
    } catch (e) {
      console.warn('[FA:debenture] covenant parsing error:', e.message);
      return null;
    }
  }

  async function getAll(isin) {
    console.log('[FA:debenture] getAll for', isin);
    const [taxes, escritura] = await Promise.all([
      getIndicativeTaxes(isin),
      getEscritura(isin),
    ]);
    const covenants = escritura?.rawText ? await parseCovenants(escritura.rawText) : null;
    return { taxes, escritura, covenants };
  }

  return { getAll, getIndicativeTaxes, getEscritura, parseCovenants };
})();
