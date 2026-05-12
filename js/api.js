// ── Supabase helpers ─────────────────────────────────────
async function dbGet(k) {
  try { const { data } = await sbc.from('user_settings').select('value').eq('key', k).single(); return data ? JSON.parse(data.value) : null; }
  catch { return null; }
}
async function dbSet(k, v) {
  try { await sbc.from('user_settings').upsert({ key: k, value: JSON.stringify(v), updated_at: new Date().toISOString() }, { onConflict: 'key' }); }
  catch (e) { console.warn('db set err', e); }
}

async function loadCfg() {
  setSt('st-db', 'warn', 'supabase: conectando...');
  try {
    const [u, c, p] = await Promise.all([dbGet('int_usd'), dbGet('int_custo'), dbGet('precos_medios')]);
    if (u != null) cfg.int_usd = u;
    if (c != null) cfg.int_custo = c;
    if (p != null) cfg.precos = p;
    document.getElementById('i-usd').value = cfg.int_usd;
    document.getElementById('i-custo').value = cfg.int_custo || '';
    setSt('st-db', 'ok', 'supabase: ok');
  } catch { setSt('st-db', 'err', 'supabase: erro'); }
}

async function saveCfg() {
  cfg.int_usd   = parseFloat(document.getElementById('i-usd').value)   || 0;
  cfg.int_custo = parseFloat(document.getElementById('i-custo').value) || 0;
  try {
    await Promise.all([dbSet('int_usd', cfg.int_usd), dbSet('int_custo', cfg.int_custo)]);
    const b = document.getElementById('sv-badge'); b.classList.add('show'); setTimeout(() => b.classList.remove('show'), 2000);
    renderInt(); updateKPIs();
  } catch {}
}

let svTimer = null;
function scheduleSave() { clearTimeout(svTimer); svTimer = setTimeout(saveCfg, 900); }

async function savePM() {
  const sel = document.getElementById('ac-sel'), v = parseFloat(document.getElementById('ac-pm').value), msg = document.getElementById('ac-msg');
  if (!sel.value || isNaN(v) || v <= 0) { msg.textContent = 'preencha ativo e preço.'; return; }
  cfg.precos[sel.value] = v;
  await dbSet('precos_medios', cfg.precos);
  document.getElementById('ac-pm').value = '';
  msg.textContent = '✓ salvo'; setTimeout(() => msg.textContent = '', 2500);
  renderAcoes(); renderRentab();
}

// ── Cache ────────────────────────────────────────────────
async function cacheOk() {
  const [d, bd] = await Promise.all([dbGet('cache_date'), dbGet('cache_brapi')]);
  return d === todayKey() && bd && Object.keys(bd).length > 0;
}

async function saveCache() {
  await Promise.all([
    dbSet('cache_accounts', accounts), dbSet('cache_transactions', txAll), dbSet('cache_investments', investments),
    dbSet('cache_brapi', BD), dbSet('cache_benchmarks', BM), dbSet('cache_usd', usdRate),
    dbSet('cache_ts_pluggy', tsP), dbSet('cache_ts_brapi', tsB), dbSet('cache_date', todayKey()),
  ]);
}

async function loadCache() {
  const [ac, tx, iv, br, bm, usd, tp, tb] = await Promise.all([
    dbGet('cache_accounts'), dbGet('cache_transactions'), dbGet('cache_investments'),
    dbGet('cache_brapi'), dbGet('cache_benchmarks'), dbGet('cache_usd'),
    dbGet('cache_ts_pluggy'), dbGet('cache_ts_brapi'),
  ]);
  if (ac) accounts = ac; if (tx) txAll = tx; if (iv) investments = iv;
  if (br) BD = br; if (bm) BM = bm; if (usd) usdRate = usd;
  if (tp) tsP = tp; if (tb) tsB = tb;
}

// ── Pluggy ───────────────────────────────────────────────
async function plAuth() {
  if (plKey) return plKey;
  const r = await fetch(`${PL_BASE}/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: PL_ID, clientSecret: PL_SEC }) });
  const d = await r.json(); if (!d.apiKey) throw new Error('Pluggy auth falhou');
  plKey = d.apiKey; return plKey;
}
async function plF(path) { const k = await plAuth(); const r = await fetch(`${PL_BASE}${path}`, { headers: { 'X-API-KEY': k } }); return r.json(); }

// ── Brapi ────────────────────────────────────────────────
// Plan limit: max 3 tickers per request for range=1y; max 1 ticker for index symbols
async function fetchBrapi(tickers) {
  if (!tickers.length) return;
  for (let i = 0; i < tickers.length; i += 3) {
    const batch = tickers.slice(i, i + 3).join(',');
    try {
      const [rH, rD] = await Promise.all([
        fetch(`${BA}/quote/${batch}?range=1y&interval=1d&token=${BT}`).then(r => r.json()),
        fetch(`${BA}/quote/${batch}?dividends=true&token=${BT}`).then(r => r.json()),
      ]);
      const dm = {};
      if (rD.results) rD.results.forEach(s => { dm[s.symbol] = s.dividendsData?.cashDividends || []; });
      if (rH.results) rH.results.forEach(s => {
        const history = (s.historicalDataPrice || [])
          .map(h => ({ date: ts2d(h.date), close: +(h.adjustedClose ?? h.close) }))
          .filter(h => h.close > 0 && !isNaN(h.close))
          .sort((a, b) => a.date.localeCompare(b.date));
        BD[s.symbol] = { price: s.regularMarketPrice, updatedAt: s.regularMarketTime || null, history, dividends: dm[s.symbol] || [] };
      });
    } catch (e) { console.warn('Brapi batch error', batch, e); }
  }
  const times = Object.values(BD).filter(v => v.updatedAt).map(v => new Date(v.updatedAt).getTime());
  if (times.length) tsB = new Date(Math.max(...times)).toISOString();
}

async function fetchBM() {
  // Index symbols require individual requests and support range up to 3mo only
  const parseBmResult = (d, key) => {
    if (!d.results?.[0]) return;
    const s = d.results[0];
    BM[key] = {
      price: s.regularMarketPrice,
      history: (s.historicalDataPrice || [])
        .map(h => ({ date: ts2d(h.date), close: +(h.adjustedClose ?? h.close) }))
        .filter(h => h.close > 0).sort((a, b) => a.date.localeCompare(b.date))
    };
  };
  try {
    const [rBvsp, rGspc] = await Promise.all([
      fetch(`${BA}/quote/%5EBVSP?range=3mo&interval=1d&token=${BT}`).then(r => r.json()),
      fetch(`${BA}/quote/%5EGSPC?range=3mo&interval=1d&token=${BT}`).then(r => r.json()),
    ]);
    parseBmResult(rBvsp, 'BVSP');
    parseBmResult(rGspc, 'GSPC');
  } catch (e) { console.warn('BM fetch error', e); }
  try {
    const rc = await fetch(`${BA}/taxas/cdi`);
    const dc = await rc.json();
    BM.CDI = { rate: +(dc.cdi ?? dc.taxa ?? 14.75) };
  } catch {
    try { const rs = await fetch(`${BA}/taxas/selic`); const ds = await rs.json(); BM.CDI = { rate: +(ds.selic ?? 14.75) }; }
    catch { BM.CDI = { rate: 14.75 }; }
  }
}

async function fetchUsd() {
  try { const r = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL'); const d = await r.json(); usdRate = parseFloat(d.USDBRL.bid); }
  catch { usdRate = 4.89; }
}

// ── Price helpers ────────────────────────────────────────
function bprice(code) { return BD[code]?.price ?? null; }

function hprice(code, daysAgo) {
  const h = BD[code]?.history; if (!h || !h.length) return null;
  const t = new Date(); t.setDate(t.getDate() - daysAgo);
  const ts = t.toISOString().slice(0, 10);
  for (let i = h.length - 1; i >= 0; i--) { if (h[i].date <= ts) return h[i].close; }
  return null;
}

function bmhprice(key, daysAgo) {
  const h = BM[key]?.history; if (!h || !h.length) return null;
  const t = new Date(); t.setDate(t.getDate() - daysAgo);
  const ts = t.toISOString().slice(0, 10);
  for (let i = h.length - 1; i >= 0; i--) { if (h[i].date <= ts) return h[i].close; }
  return null;
}

function calcRet(code, days) { const c = bprice(code), o = hprice(code, days); if (!c || !o) return null; return (c - o) / o * 100; }
function calcBmRet(key, days) { const c = BM[key]?.price ?? BM[key]?.history?.slice(-1)[0]?.close; const o = bmhprice(key, days); if (!c || !o) return null; return (c - o) / o * 100; }

// ── Load ─────────────────────────────────────────────────
async function loadAll(force = false) {
  showOv('verificando cache...');
  await loadCfg();
  const ok = !force && await cacheOk();
  if (ok) {
    showOv('carregando do cache...');
    await loadCache();
    setSt('st-pl', 'ok', `pluggy: ${toBRL(tsP)} (cache)`);
    setSt('st-br', 'ok', `brapi: ${toBRL(tsB)} (cache)`);
  } else {
    showOv('autenticando Pluggy...'); await plAuth();
    showOv('buscando contas...');
    const acR = await Promise.all(ITEMS.map(id => plF(`/accounts?itemId=${id}`)));
    accounts = acR.flatMap(a => a.results || []);
    showOv('buscando transações...');
    const txR = await Promise.all(accounts.map(a => plF(`/transactions?accountId=${a.id}&pageSize=500`).then(d => d.results || [])));
    txAll = txR.flat().sort((a, b) => new Date(b.date) - new Date(a.date));
    showOv('buscando investimentos...');
    const ivR = await Promise.all(ITEMS.map(id => plF(`/investments?itemId=${id}`)));
    investments = ivR.flatMap(a => a.results || []);
    const allTs = [...accounts, ...investments].map(x => x.updatedAt).filter(Boolean);
    if (allTs.length) tsP = allTs.reduce((a, b) => a > b ? a : b);
    const tickers = [...new Set(investments.filter(isRV).map(i => i.code).filter(Boolean))];
    showOv(`cotações Brapi (${tickers.length} ativos)...`); await fetchBrapi(tickers);
    showOv('benchmarks...'); await fetchBM();
    showOv('câmbio USD...'); await fetchUsd();
    showOv('salvando cache...'); await saveCache();
    setSt('st-pl', 'ok', `pluggy: ${toBRL(tsP)}`);
    setSt('st-br', 'ok', `brapi: ${toBRL(tsB)}`);
  }
  renderAll();
  document.getElementById('pmeta').textContent = 'dados de: ' + toBRL(tsP);
  document.getElementById('freshbar').innerHTML = [
    `<div class="fresh-item">📊 <b>Pluggy</b> ${toBRL(tsP)}</div>`,
    `<div class="fresh-item">📈 <b>Brapi</b> ${toBRL(tsB)}</div>`,
    `<div class="fresh-item">💵 <b>USD/BRL</b> ${usdRate ? 'R$ ' + usdRate.toFixed(4) : '—'}</div>`,
    `<div class="fresh-item">💾 <b>Cache</b> ${ok ? 'hoje · instantâneo' : 'atualizado agora'}</div>`,
  ].join('');
  hideOv();
}

function forceReload() { plKey = null; accounts = []; txAll = []; investments = []; BD = {}; BM = {}; loadAll(true); }
