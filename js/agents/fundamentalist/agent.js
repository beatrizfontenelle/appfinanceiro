// ── Fundamentalist Agent — Orchestrator ──────────────────
// Main entry point. Coordinates identify → mode → memory → analyze.
// Usage: FA.analyzeAsset('PETR4') or FA.analyzeAsset('BRVALEACNOR0')

window.FA = window.FA || {};

// ── Claude API helper (calls /api/claude serverless function) ──
FA.callClaude = async function (prompt, opts = {}) {
  const { maxTokens = 1500, webSearch = false } = opts;
  try {
    console.log('[FA:claude] calling API, ~' + prompt.length + ' chars prompt');
    const r = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, maxTokens, webSearch }),
    });
    if (!r.ok) {
      const err = await r.text();
      console.error('[FA:claude] API error:', r.status, err);
      return null;
    }
    const d = await r.json();
    return d.content || null;
  } catch (e) {
    console.error('[FA:claude] fetch error:', e.message);
    return null;
  }
};

// ── analyzeAsset ─────────────────────────────────────────

FA.analyzeAsset = async function (identifier, options = {}) {
  const { forceRefresh = false, onProgress = null } = options;

  const progress = (msg) => {
    console.log('[FA]', msg);
    if (onProgress) onProgress(msg);
  };

  progress(`Identificando ativo: ${identifier}...`);

  // 1. Identify
  const asset = await FA.tasks.identify.resolve(identifier);
  if (!asset) {
    return { error: 'Ativo não identificado: ' + identifier };
  }
  progress(`Ativo identificado: ${asset.name} (${asset.type})`);

  // 2. Choose mode
  const mode = asset.type === 'credit' ? FA.modes.credit : FA.modes.equity;

  // 3. Load previous memory
  const prevMemory = await FA.memory.store.getLatest(asset.ticker || asset.isin);

  // 4. Return cached analysis if still fresh and not forcing refresh
  if (prevMemory && !FA.memory.store.isExpired(prevMemory.analyzed_at, 90) && !forceRefresh) {
    progress(`Análise recente encontrada (${FA.memory.store.formatDate(prevMemory.analyzed_at)}) — usando cache.`);
    return {
      fromCache: true,
      asset,
      memory: prevMemory,
      message: `Análise de ${asset.name} de ${FA.memory.store.formatDate(prevMemory.analyzed_at)} — ainda válida. Use forceRefresh: true para re-analisar.`,
    };
  }

  // 5. Evaluate previous predictions before re-analyzing
  if (prevMemory && asset.ticker) {
    progress('Avaliando previsões anteriores...');
    await FA.memory.store.evaluateTrackRecord(asset, prevMemory);
  }

  // 6. Collect data
  progress('Coletando dados financeiros...');
  let data;
  try {
    data = await mode.collectData(asset);
  } catch (e) {
    console.error('[FA] collectData error:', e.message);
    return { error: 'Erro ao coletar dados: ' + e.message };
  }

  // 7. Generate analysis via Claude
  progress('Gerando análise fundamentalista...');
  let analysis;
  try {
    analysis = await mode.analyze(asset, data, prevMemory);
  } catch (e) {
    console.error('[FA] analyze error:', e.message);
    return { error: 'Erro na análise: ' + e.message };
  }

  if (!analysis) {
    return { error: 'Análise não retornou resultado (API indisponível?)' };
  }

  // 8. Save to memory
  progress('Salvando análise...');
  const savedMemory = await FA.memory.store.save(asset, analysis);

  progress(`Análise completa: ${asset.name} — ${analysis.rating || analysis.recommendation}`);

  return {
    fromCache: false,
    asset,
    analysis,
    memoryId: savedMemory?.id,
  };
};

// ── analyzePortfolio ─────────────────────────────────────
// Analyze all assets in the current portfolio (from Pluggy investments)

FA.analyzePortfolio = async function (opts = {}) {
  const { onProgress = null } = opts;
  const results = [];

  // Get unique tickers from current investments
  const tickers = [...new Set(
    investments
      .filter(i => i.code && (isRV(i) || i.type === 'FIXED_INCOME'))
      .map(i => i.code || i.isin)
      .filter(Boolean)
  )];

  console.log('[FA] analyzePortfolio: found', tickers.length, 'assets');
  if (onProgress) onProgress(`Analisando ${tickers.length} ativos...`);

  for (const ticker of tickers) {
    try {
      const result = await FA.analyzeAsset(ticker, { onProgress });
      results.push({ ticker, result });
    } catch (e) {
      results.push({ ticker, error: e.message });
    }
  }

  return results;
};

// ── analyzePDF ───────────────────────────────────────────
// Parse PDF and analyze all assets found

FA.analyzePDF = async function (file, opts = {}) {
  const { onProgress = null } = opts;

  if (onProgress) onProgress('Processando PDF...');
  const parsed = await FA.parsers.pdfStatement.parse(file);

  if (parsed.error) return { error: parsed.error };

  const results = [];
  if (onProgress) onProgress(`Encontrados ${parsed.assets.length} ativos no extrato (${parsed.broker}).`);

  for (const pdfAsset of parsed.assets) {
    const identifier = pdfAsset.ticker || pdfAsset.isin;
    if (!identifier) continue;

    if (onProgress) onProgress(`Analisando ${identifier}...`);
    try {
      const result = await FA.analyzeAsset(identifier, { onProgress });
      results.push({ ...pdfAsset, result });
    } catch (e) {
      results.push({ ...pdfAsset, error: e.message });
    }
  }

  return { broker: parsed.broker, assets: parsed.assets, analyses: results };
};
