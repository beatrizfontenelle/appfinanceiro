// ── Fundamentalist Agent — Mode: Credit ──────────────────
// Análise de crédito privado: debêntures, CRI, CRA, FIDCs.
// Coleta: escritura + covenants + financials do emissor + ANBIMA

window.FA = window.FA || {};
FA.modes = FA.modes || {};

FA.modes.credit = (function () {

  async function collectData(asset) {
    console.log('[FA:credit] collecting data for', asset.isin || asset.ticker);
    const identifier = asset.isin || asset.ticker;

    // Issuer ticker — if ISIN we need to resolve the underlying company
    const issuerTicker = asset.ticker || null;

    const [debentureData, financials, news] = await Promise.all([
      FA.tasks.debenture.getAll(identifier),
      issuerTicker
        ? FA.tasks.financials.getAll(issuerTicker)
        : Promise.resolve(null),
      FA.tasks.news.get(identifier, asset.name, 'credit'),
    ]);

    console.log('[FA:credit] data collected:', {
      hasEscritura: !!debentureData?.escritura,
      hasCovenants: !!debentureData?.covenants,
      hasTaxes: !!debentureData?.taxes,
      hasFinancials: !!financials,
      hasNews: !!news,
    });

    return { debentureData, financials, news };
  }

  function buildPrompt(asset, data, previousMemory) {
    const { debentureData, financials, news } = data;
    const isin = asset.isin || 'não identificado';
    const sections = [];

    if (debentureData?.escritura || debentureData?.taxes) {
      sections.push('=== CARACTERÍSTICAS DA EMISSÃO ===');
      if (debentureData.escritura) {
        sections.push(JSON.stringify(debentureData.escritura, null, 2).slice(0, 2000));
      }
      if (debentureData.covenants) {
        sections.push('Covenants:\n' + JSON.stringify(debentureData.covenants, null, 2).slice(0, 1500));
      }
      if (debentureData.taxes) {
        sections.push('Taxas indicativas ANBIMA:\n' + JSON.stringify(debentureData.taxes, null, 2).slice(0, 800));
      }
    } else {
      sections.push('=== CARACTERÍSTICAS DA EMISSÃO ===\n[Escritura não localizada automaticamente — análise baseada em dados disponíveis]');
    }

    if (financials) {
      if (financials.dre?.data) sections.push('=== DRE DO EMISSOR ===\n' + JSON.stringify(financials.dre.data, null, 2).slice(0, 3000));
      if (financials.balanco?.data) sections.push('=== BALANÇO DO EMISSOR ===\n' + JSON.stringify(financials.balanco.data, null, 2).slice(0, 2000));
      if (financials.dfc?.data) sections.push('=== DFC DO EMISSOR ===\n' + JSON.stringify(financials.dfc.data, null, 2).slice(0, 1500));
    } else {
      sections.push('=== DADOS DO EMISSOR ===\n[Ticker do emissor não identificado — dados financeiros indisponíveis]');
    }

    if (news?.noticias?.length) {
      sections.push('=== EVENTOS DE CRÉDITO / NOTÍCIAS ===\n' + JSON.stringify(news.noticias, null, 2).slice(0, 1500));
    }

    if (previousMemory) {
      sections.push(`=== ANÁLISE ANTERIOR (${FA.memory.store.formatDate(previousMemory.analyzed_at)}) ===
Rating: ${previousMemory.rating}
Tese: ${(previousMemory.thesis || '').slice(0, 400)}`);
    } else {
      sections.push('=== ANÁLISE ANTERIOR ===\n[Primeira análise]');
    }

    return `Você é um analista de crédito sênior especializado em crédito privado brasileiro.
Analise os dados abaixo e produza uma avaliação de crédito completa.

EMISSOR: ${asset.name} (${asset.ticker || 'sem ticker BR'})
INSTRUMENTO: ${asset.asset_type || 'debênture'} — ${asset.name}
ISIN: ${isin}
DATA DE REFERÊNCIA: ${new Date().toISOString().slice(0, 10)}

${sections.join('\n\n')}

Responda APENAS com JSON válido, sem markdown:
{
  "rating": "AAA|AA+|AA|AA-|A+|A|A-|BBB+|BBB|BBB-|BB+|BB|BB-|B|CCC|D",
  "rating_rationale": "justificativa em 2-3 parágrafos em português",
  "credit_quality": "investment_grade|high_yield|distressed",
  "thesis": "análise de crédito completa em 3-5 parágrafos em português",
  "key_metrics": {
    "divida_liquida_ebitda": número_ou_null,
    "cobertura_juros": número_ou_null,
    "fcl_sobre_divida": número_ou_null,
    "liquidez_corrente": número_ou_null,
    "margem_ebitda": número_ou_null,
    "spread_atual_bps": número_ou_null,
    "spread_justo_bps": número_ou_null,
    "duration_anos": número_ou_null
  },
  "covenant_analysis": {
    "covenants_listados": ["covenant 1"],
    "margem_para_breach": "avaliação qualitativa",
    "risco_breach": "baixo|médio|alto"
  },
  "collateral_analysis": "análise das garantias",
  "spread_assessment": "justo|caro|barato — com justificativa",
  "recommendation": "manter|reduzir|evitar|acumular",
  "risks": ["risco 1", "risco 2"],
  "vs_previous_analysis": "mudanças desde última análise",
  "data_period": "período dos dados usados"
}`;
  }

  async function analyze(asset, data, previousMemory) {
    console.log('[FA:credit] generating analysis for', asset.isin || asset.ticker);
    const prompt = buildPrompt(asset, data, previousMemory);
    const raw = await FA.callClaude(prompt, { maxTokens: 2000 });

    if (!raw) {
      console.error('[FA:credit] Claude API returned nothing');
      return null;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      const m = raw.match(/\{[\s\S]+\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { parsed = null; } }
    }

    if (!parsed) {
      console.error('[FA:credit] could not parse Claude response');
      return { raw, parseError: true };
    }

    console.log('[FA:credit] analysis complete:', {
      isin: asset.isin,
      rating: parsed.rating,
      quality: parsed.credit_quality,
    });

    return parsed;
  }

  return { collectData, analyze, buildPrompt };
})();
