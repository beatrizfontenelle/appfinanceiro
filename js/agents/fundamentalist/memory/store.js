// ── Fundamentalist Agent — Memory Store ──────────────────
// Read/write to asset_memory and asset_track_record tables.
// Memory is per-asset (shared across all users/profiles).

window.FA = window.FA || {};
FA.memory = FA.memory || {};

FA.memory.store = (function () {

  // Get the most recent memory for an asset
  async function getLatest(identifier) {
    try {
      const { data, error } = await sbc.from('asset_memory')
        .select('*')
        .eq('identifier', identifier)
        .order('analyzed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) console.log(`[FA:memory] loaded memory for ${identifier} (v${data.analysis_version}, ${data.analyzed_at?.slice(0,10)})`);
      return data || null;
    } catch (e) {
      console.warn('[FA:memory] getLatest error:', e.message);
      return null;
    }
  }

  // Get all history for an asset (track record overview)
  async function getHistory(identifier, limit = 10) {
    try {
      const { data, error } = await sbc.from('asset_memory')
        .select('id, rating, price_at_analysis, analyzed_at, analysis_version, data_period')
        .eq('identifier', identifier)
        .order('analyzed_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.warn('[FA:memory] getHistory error:', e.message);
      return [];
    }
  }

  // Save a new analysis (always inserts — never updates old versions)
  async function save(asset, analysis) {
    try {
      const prev = await getLatest(asset.ticker || asset.isin);
      const version = prev ? (prev.analysis_version || 1) + 1 : 1;

      const record = {
        identifier:         asset.ticker || asset.isin,
        asset_type:         asset.type,
        asset_name:         asset.name,
        thesis:             analysis.thesis || null,
        rating:             analysis.rating || null,
        key_metrics:        analysis.key_metrics || null,
        risks:              analysis.risks ? JSON.stringify(analysis.risks) : null,
        opportunities:      analysis.opportunities ? JSON.stringify(analysis.opportunities) : null,
        price_at_analysis:  analysis.price_at_analysis || null,
        analysis_version:   version,
        analyzed_at:        new Date().toISOString(),
        data_period:        analysis.data_period || null,
      };

      const { data, error } = await sbc.from('asset_memory').insert(record).select().single();
      if (error) throw error;
      console.log(`[FA:memory] saved analysis v${version} for ${record.identifier}`);

      // Save track record entry if there's a price target
      if (analysis.price_target_12m && data?.id) {
        await saveTrackRecord(asset, analysis, data.id);
      }

      return data;
    } catch (e) {
      console.error('[FA:memory] save error:', e.message);
      return null;
    }
  }

  async function saveTrackRecord(asset, analysis, memoryId) {
    try {
      const record = {
        identifier:         asset.ticker || asset.isin,
        asset_type:         asset.type,
        memory_id:          memoryId,
        prediction_rating:  analysis.rating,
        prediction_target:  analysis.price_target_12m || null,
        prediction_date:    new Date().toISOString().slice(0, 10),
        prediction_horizon: '12m',
      };
      const { error } = await sbc.from('asset_track_record').insert(record);
      if (error) throw error;
      console.log(`[FA:memory] track record saved for ${record.identifier} — target: ${record.prediction_target}`);
    } catch (e) {
      console.warn('[FA:memory] saveTrackRecord error:', e.message);
    }
  }

  // Evaluate previous predictions vs actual prices
  async function evaluateTrackRecord(asset, prevMemory) {
    try {
      const identifier = asset.ticker || asset.isin;
      const { data: openPredictions } = await sbc.from('asset_track_record')
        .select('*')
        .eq('identifier', identifier)
        .is('evaluated_at', null);

      if (!openPredictions?.length) return;

      const currentPrice = asset.ticker
        ? await FA.tasks.prices.getLatestPrice(asset.ticker)
        : null;

      if (!currentPrice) return;

      const today = new Date().toISOString().slice(0, 10);
      for (const pred of openPredictions) {
        const predDate = new Date(pred.prediction_date);
        const daysElapsed = Math.floor((Date.now() - predDate) / 86400000);
        const horizonDays = pred.prediction_horizon === '12m' ? 365
          : pred.prediction_horizon === '6m' ? 180
          : pred.prediction_horizon === '3m' ? 90 : 365;

        if (daysElapsed < horizonDays) continue; // not yet due

        const dirCorrect = prevMemory.rating?.toLowerCase().includes('comprar')
          ? currentPrice.close > pred.prediction_target * 0.9
          : currentPrice.close < pred.prediction_target * 1.1;

        const targetHit = pred.prediction_target
          ? Math.abs(currentPrice.close - pred.prediction_target) / pred.prediction_target < 0.05
          : null;

        await sbc.from('asset_track_record').update({
          actual_price:      currentPrice.close,
          actual_date:       today,
          direction_correct: dirCorrect,
          target_hit:        targetHit,
          evaluated_at:      new Date().toISOString(),
        }).eq('id', pred.id);

        console.log(`[FA:memory] evaluated prediction ${pred.id}: direction=${dirCorrect}, target_hit=${targetHit}`);
      }
    } catch (e) {
      console.warn('[FA:memory] evaluateTrackRecord error:', e.message);
    }
  }

  // Check if a memory is still fresh (within maxDays)
  function isExpired(analyzedAt, maxDays = 90) {
    if (!analyzedAt) return true;
    const age = (Date.now() - new Date(analyzedAt)) / 86400000;
    return age > maxDays;
  }

  function formatDate(isoStr) {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleDateString('pt-BR');
  }

  return { getLatest, getHistory, save, evaluateTrackRecord, isExpired, formatDate };
})();
