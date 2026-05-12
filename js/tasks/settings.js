// ── Load user settings ────────────────────────────────────
async function loadSettings() {
  setSt('st-db', 'warn', 'supabase: conectando...');
  try {
    const [u, c, p] = await Promise.all([
      dbGet('int_usd'), dbGet('int_custo'), dbGet('precos_medios')
    ]);
    if (u != null) cfg.int_usd = u;
    if (c != null) cfg.int_custo = c;
    if (p != null) cfg.precos = p;
    document.getElementById('i-usd').value = cfg.int_usd;
    document.getElementById('i-custo').value = cfg.int_custo || '';
    setSt('st-db', 'ok', 'supabase: ok');
    console.log('[settings] loaded | int_usd:', cfg.int_usd, '| avg costs:', Object.keys(cfg.precos).length);
  } catch (e) {
    console.error('[settings] load error', e);
    setSt('st-db', 'err', 'supabase: erro');
  }
}

// ── Save international account ────────────────────────────
async function saveCfg() {
  cfg.int_usd   = parseFloat(document.getElementById('i-usd').value)   || 0;
  cfg.int_custo = parseFloat(document.getElementById('i-custo').value) || 0;
  try {
    await Promise.all([dbSet('int_usd', cfg.int_usd), dbSet('int_custo', cfg.int_custo)]);
    const b = document.getElementById('sv-badge');
    b.classList.add('show');
    setTimeout(() => b.classList.remove('show'), 2000);
    renderInt(); updateKPIs();
  } catch (e) { console.error('[settings] saveCfg error', e); }
}

let svTimer = null;
function scheduleSave() { clearTimeout(svTimer); svTimer = setTimeout(saveCfg, 900); }

// ── Save average cost per ticker ──────────────────────────
async function savePM() {
  const sel = document.getElementById('ac-sel');
  const v = parseFloat(document.getElementById('ac-pm').value);
  const msg = document.getElementById('ac-msg');
  if (!sel.value || isNaN(v) || v <= 0) { msg.textContent = 'preencha ativo e preço.'; return; }
  cfg.precos[sel.value] = v;
  await dbSet('precos_medios', cfg.precos);
  document.getElementById('ac-pm').value = '';
  msg.textContent = '✓ salvo';
  setTimeout(() => msg.textContent = '', 2500);
  renderAcoes(); renderRentab();
}
