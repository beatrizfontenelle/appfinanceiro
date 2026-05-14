// ── Fundamentalist Agent — Task: cache ───────────────────
// TTL-aware wrapper for asset_cache Supabase table.
// All fundamentalist tasks call through here instead of fetching directly.
//
// TTLs (days):
//   dre/balanco/dfc trimestral → 90
//   dre/balanco/dfc anual      → 365
//   escritura                  → 180
//   setor                      → 30
//   noticias                   → 3
//   indicadores                → 1

window.FA = window.FA || {};
window.FA.tasks = window.FA.tasks || {};

FA.tasks.cache = (function () {

  const TTL_DAYS = {
    dre_trimestral:      90,
    balanco_trimestral:  90,
    dfc_trimestral:      90,
    dre_anual:           365,
    balanco_anual:       365,
    dfc_anual:           365,
    escritura:           180,
    setor:               30,
    noticias:            3,
    indicadores:         1,
  };

  function ttlDays(dataType, referencePeriod) {
    if (referencePeriod && referencePeriod.includes('Q')) return TTL_DAYS[dataType + '_trimestral'] || 30;
    if (referencePeriod && referencePeriod.includes('anual')) return TTL_DAYS[dataType + '_anual'] || 90;
    return TTL_DAYS[dataType] || 7;
  }

  function expiresAt(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString();
  }

  async function get(identifier, dataType, referencePeriod = null) {
    try {
      let q = sbc.from('asset_cache')
        .select('data, fetched_at, expires_at')
        .eq('identifier', identifier)
        .eq('data_type', dataType);
      if (referencePeriod) q = q.eq('reference_period', referencePeriod);
      else q = q.is('reference_period', null);

      const { data, error } = await q.maybeSingle();
      if (error || !data) return null;

      // Check expiry
      if (new Date(data.expires_at) < new Date()) {
        console.log(`[FA:cache] expired: ${identifier}/${dataType}/${referencePeriod}`);
        return null;
      }
      console.log(`[FA:cache] hit: ${identifier}/${dataType}/${referencePeriod}`);
      return data.data;
    } catch (e) {
      console.warn('[FA:cache] get error:', e.message);
      return null;
    }
  }

  async function set(identifier, dataType, data, source, referencePeriod = null) {
    try {
      const days = ttlDays(dataType, referencePeriod);
      const record = {
        identifier,
        data_type: dataType,
        data,
        source,
        reference_period: referencePeriod,
        fetched_at: new Date().toISOString(),
        expires_at: expiresAt(days),
      };
      const { error } = await sbc.from('asset_cache').upsert(record, {
        onConflict: 'identifier,data_type,reference_period',
      });
      if (error) console.warn('[FA:cache] set error:', error.message);
      else console.log(`[FA:cache] saved: ${identifier}/${dataType}/${referencePeriod} (expires in ${days}d)`);
    } catch (e) {
      console.warn('[FA:cache] set exception:', e.message);
    }
  }

  // Wrapped fetch: checks cache first, calls fetchFn if miss, saves result.
  async function withCache(identifier, dataType, referencePeriod, source, fetchFn) {
    const cached = await get(identifier, dataType, referencePeriod);
    if (cached) return cached;

    console.log(`[FA:cache] miss: ${identifier}/${dataType} — fetching from ${source}`);
    const fresh = await fetchFn();
    if (fresh) await set(identifier, dataType, fresh, source, referencePeriod);
    return fresh;
  }

  return { get, set, withCache };
})();
