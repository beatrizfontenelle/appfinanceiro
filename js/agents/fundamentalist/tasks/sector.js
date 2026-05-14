// ── Fundamentalist Agent — Task: sector ──────────────────
// Análise setorial: posição competitiva, perspectivas macro, concorrentes.
// Uses Claude API with web_search tool via /api/claude.

window.FA = window.FA || {};
window.FA.tasks = window.FA.tasks || {};

FA.tasks.sector = (function () {

  async function get(ticker, assetName, sector) {
    const cacheKey = sector ? sector.replace(/\s+/g, '_').toLowerCase() : ticker;
    return FA.tasks.cache.withCache(cacheKey, 'setor', null, 'claude+web', async () => {
      console.log('[FA:sector] fetching sector analysis for', ticker, '/', sector);

      const prompt = `Você é um analista setorial especializado no mercado brasileiro.
Pesquise e analise o setor de "${sector || assetName}" no Brasil.

Empresa de referência: ${assetName} (${ticker})

Retorne APENAS JSON válido, sem markdown:
{
  "setor": "${sector || 'não identificado'}",
  "descricao": "descrição do setor em 2-3 frases",
  "perspectivas": "perspectivas para os próximos 12-24 meses",
  "drivers": ["driver 1", "driver 2", "driver 3"],
  "riscos_macro": ["risco macro 1", "risco macro 2"],
  "concorrentes_principais": [
    { "nome": "empresa", "ticker": "TICK3", "posicao": "breve descrição" }
  ],
  "posicao_competitiva": "como ${assetName} se posiciona no setor",
  "tendencias": ["tendência 1", "tendência 2"],
  "referencia_data": "${new Date().toISOString().slice(0,10)}"
}`;

      const result = await FA.callClaude(prompt, { webSearch: true, maxTokens: 1200 });
      if (!result) return null;

      try {
        return JSON.parse(result);
      } catch (e) {
        const m = result.match(/\{[\s\S]+\}/);
        if (m) { try { return JSON.parse(m[0]); } catch {} }
        console.warn('[FA:sector] JSON parse failed, returning raw text');
        return { raw: result };
      }
    });
  }

  return { get };
})();
