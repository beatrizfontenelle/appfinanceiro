// ── Fundamentalist Agent — Mode: Equity ──────────────────
// Análise fundamentalista completa de ações.
// Coleta: DRE + Balanço + DFC + indicadores + preços + setor + notícias
// Gera análise via Claude API.

window.FA = window.FA || {};
FA.modes = FA.modes || {};

FA.modes.equity = (function () {

  // Collect all data needed for an equity analysis
  async function collectData(asset) {
    console.log('[FA:equity] collecting data for', asset.ticker);

    const [dre, balanco, dfc, indicators, priceHistory, sector, news] = await Promise.all([
      FA.tasks.financials.getDRE(asset.ticker, 'quarterly'),
      FA.tasks.financials.getBalanco(asset.ticker, 'quarterly'),
      FA.tasks.financials.getDFC(asset.ticker, 'quarterly'),
      FA.tasks.indicators.get(asset.ticker),
      FA.tasks.prices.getHistory(asset.ticker, 365 * 5),  // 5 years
      FA.tasks.sector.get(asset.ticker, asset.name, asset.sector),
      FA.tasks.news.get(asset.ticker, asset.name, 'equity'),
    ]);

    // Sync latest prices (delta only)
    await FA.tasks.prices.sync(asset.ticker);

    // Get competitor data (top 2-3 from sector)
    const competitors = [];
    if (sector?.concorrentes_principais) {
      const competitorFetches = sector.concorrentes_principais
        .slice(0, 2)
        .filter(c => c.ticker && c.ticker !== asset.ticker)
        .map(c => FA.tasks.indicators.get(c.ticker).then(ind => ({ ...c, indicators: ind })));
      competitors.push(...await Promise.all(competitorFetches));
    }

    console.log('[FA:equity] data collected:', {
      hasDRE: !!dre, hasBalanco: !!balanco, hasDFC: !!dfc,
      hasIndicators: !!indicators, priceRows: priceHistory.length,
      hasSector: !!sector, hasNews: !!news, competitors: competitors.length,
    });

    return { dre, balanco, dfc, indicators, priceHistory, sector, news, competitors };
  }

  // Format data for Claude prompt
  function formatForPrompt(asset, data, previousMemory) {
    const { dre, balanco, dfc, indicators, priceHistory, sector, news, competitors } = data;

    let sections = [];

    // Financial data
    if (dre || balanco || dfc) {
      sections.push('=== DADOS FINANCEIROS ===');
      if (dre?.data) sections.push('DRE:\n' + JSON.stringify(dre.data, null, 2).slice(0, 3000));
      if (balanco?.data) sections.push('Balanço:\n' + JSON.stringify(balanco.data, null, 2).slice(0, 2000));
      if (dfc?.data) sections.push('DFC:\n' + JSON.stringify(dfc.data, null, 2).slice(0, 1500));
    } else {
      sections.push('=== DADOS FINANCEIROS ===\n[Não disponíveis — dados ausentes das fontes consultadas]');
    }

    // Indicators
    if (indicators) {
      sections.push('=== MÚLTIPLOS E INDICADORES ===\n' + JSON.stringify(indicators, null, 2));
    }

    // Price context
    if (priceHistory.length > 0) {
      const latest = priceHistory[priceHistory.length - 1];
      const yearAgo = priceHistory[0];
      const ret12m = yearAgo ? ((latest.close - yearAgo.close) / yearAgo.close * 100).toFixed(1) : null;
      sections.push(`=== PREÇOS ===\nAtual: R$ ${latest.close} (${latest.date})\nRetorno 12m: ${ret12m ? ret12m + '%' : 'n/d'}`);
    }

    // Competitors
    if (competitors.length > 0) {
      sections.push('=== CONCORRENTES ===');
      competitors.forEach(c => {
        sections.push(`${c.nome} (${c.ticker}): ${c.posicao || ''}\n${c.indicators ? JSON.stringify(c.indicators, null, 2).slice(0, 500) : ''}`);
      });
    }

    // Sector
    if (sector) {
      sections.push('=== CONTEXTO SETORIAL ===\n' + JSON.stringify(sector, null, 2).slice(0, 1500));
    }

    // News
    if (news?.noticias?.length) {
      sections.push('=== NOTÍCIAS RECENTES ===\n' + JSON.stringify(news.noticias, null, 2).slice(0, 1500));
    }

    // Previous memory
    if (previousMemory) {
      sections.push(`=== ANÁLISE ANTERIOR (${FA.memory.store.formatDate(previousMemory.analyzed_at)}, v${previousMemory.analysis_version}) ===
Rating anterior: ${previousMemory.rating}
Tese anterior: ${(previousMemory.thesis || '').slice(0, 500)}`);
    } else {
      sections.push('=== ANÁLISE ANTERIOR ===\n[Primeira análise — sem histórico]');
    }

    return sections.join('\n\n');
  }

  // Build the Claude prompt for equity analysis
  function buildPrompt(asset, data, previousMemory) {
    const dataStr = formatForPrompt(asset, data, previousMemory);
    const currentPrice = data.priceHistory?.slice(-1)[0]?.close || null;

    return `Você é um analista fundamentalista sênior especializado em empresas brasileiras.
Analise os dados abaixo e produza uma avaliação completa no formato JSON especificado.

EMPRESA: ${asset.name} (${asset.ticker || 'sem ticker'})
SETOR: ${asset.sector || 'não identificado'}
DATA DE REFERÊNCIA: ${new Date().toISOString().slice(0, 10)}
PREÇO ATUAL: ${currentPrice ? 'R$ ' + currentPrice : 'não disponível'}

${dataStr}

Responda APENAS com JSON válido, sem markdown, neste formato exato:
{
  "rating": "comprar|manter|reduzir|vender",
  "thesis": "tese de investimento em 3-5 parágrafos em português",
  "price_target_12m": número_ou_null,
  "price_target_method": "descrição do método (DCF, múltiplos, etc.)",
  "key_metrics": {
    "roe": número_ou_null,
    "roic": número_ou_null,
    "margem_liquida": número_ou_null,
    "crescimento_receita_3a": número_ou_null,
    "crescimento_lucro_3a": número_ou_null,
    "divida_ebitda": número_ou_null,
    "dividend_yield": número_ou_null,
    "pl_atual": número_ou_null,
    "pl_historico_medio": número_ou_null,
    "ev_ebitda": número_ou_null,
    "pvp": número_ou_null
  },
  "quality_score": "número de 1-10 com justificativa em texto",
  "risks": ["risco 1", "risco 2", "risco 3"],
  "opportunities": ["oportunidade 1", "oportunidade 2"],
  "vs_competitors": "comparação qualitativa com concorrentes",
  "vs_previous_analysis": "o que mudou desde a última análise",
  "data_period": "período dos dados usados (ex: Q3-2024)"
}`;
  }

  // Execute the full equity analysis
  async function analyze(asset, data, previousMemory) {
    console.log('[FA:equity] generating analysis for', asset.ticker);
    const prompt = buildPrompt(asset, data, previousMemory);
    const raw = await FA.callClaude(prompt, { maxTokens: 2000 });

    if (!raw) {
      console.error('[FA:equity] Claude API returned nothing');
      return null;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      // Try extracting JSON block
      const m = raw.match(/\{[\s\S]+\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); }
        catch { parsed = null; }
      }
    }

    if (!parsed) {
      console.error('[FA:equity] could not parse Claude response');
      return { raw, parseError: true };
    }

    // Add price at analysis time
    const latestPrice = data.priceHistory?.slice(-1)[0];
    if (latestPrice) parsed.price_at_analysis = latestPrice.close;

    console.log('[FA:equity] analysis complete:', {
      ticker: asset.ticker,
      rating: parsed.rating,
      target: parsed.price_target_12m,
    });

    return parsed;
  }

  return { collectData, analyze, buildPrompt };
})();
