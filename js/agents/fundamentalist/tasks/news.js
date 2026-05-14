// ── Fundamentalist Agent — Task: news ────────────────────
// Fatos relevantes e notícias recentes — via Claude API + web_search.
// TTL: 3 days.

window.FA = window.FA || {};
window.FA.tasks = window.FA.tasks || {};

FA.tasks.news = (function () {

  async function get(ticker, assetName, assetType = 'equity') {
    return FA.tasks.cache.withCache(ticker, 'noticias', null, 'claude+web', async () => {
      console.log('[FA:news] fetching news for', ticker);

      const year = new Date().getFullYear();
      const creditNote = assetType === 'credit'
        ? 'Foque em eventos de crédito: rebaixamentos de rating, inadimplência, reestruturações, emissões novas.'
        : 'Foque em fatos relevantes CVM, resultados trimestrais, guidance, e mudanças estratégicas.';

      const prompt = `Pesquise as notícias e fatos relevantes mais recentes sobre ${assetName} (${ticker}) no Brasil.
${creditNote}

Retorne APENAS JSON válido, sem markdown:
{
  "noticias": [
    {
      "data": "YYYY-MM-DD ou 'recente'",
      "titulo": "título da notícia",
      "resumo": "resumo em 1-2 frases",
      "impacto": "positivo|negativo|neutro",
      "categoria": "resultado|fato_relevante|macro|credito|governança|outro"
    }
  ],
  "sentimento_geral": "positivo|negativo|neutro|misto",
  "eventos_proximos": ["evento ou data relevante esperada"],
  "referencia_data": "${new Date().toISOString().slice(0,10)}"
}

Limite a 8 notícias mais relevantes dos últimos 6 meses.`;

      const result = await FA.callClaude(prompt, { webSearch: true, maxTokens: 1500 });
      if (!result) return { noticias: [], sentimento_geral: 'neutro' };

      try {
        return JSON.parse(result);
      } catch (e) {
        const m = result.match(/\{[\s\S]+\}/);
        if (m) { try { return JSON.parse(m[0]); } catch {} }
        return { raw: result, noticias: [] };
      }
    });
  }

  return { get };
})();
