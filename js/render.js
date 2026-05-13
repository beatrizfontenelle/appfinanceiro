// ── KPIs & international account ─────────────────────────
function updateKPIs() {
  const sal = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const inv = investments.reduce((s, i) => s + (i.amount || i.balance || 0), 0);
  document.getElementById('kp-tot').textContent = R(sal + inv + intBrl());
  document.getElementById('kp-sal').textContent = R(sal); document.getElementById('kp-sal-s').textContent = accounts.length + ' conta(s)';
  document.getElementById('kp-inv').textContent = R(inv); document.getElementById('kp-inv-s').textContent = investments.length + ' ativos';
}

function renderInt() {
  const usd = cfg.int_usd, custo = cfg.int_custo; if (!usdRate) return;
  const hoje = usd * usdRate, ganho = custo ? hoje - custo : null, pct = custo ? ((hoje - custo) / custo * 100) : null;
  document.getElementById('i-rate').textContent = 'R$ ' + usdRate.toFixed(4);
  document.getElementById('i-hoje').textContent = R(hoje);
  document.getElementById('kp-int').textContent = 'US$ ' + usd.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  document.getElementById('kp-int-s').textContent = '≈ ' + R(hoje) + ' · R$ ' + usdRate.toFixed(2) + '/USD';
  if (ganho != null) {
    const el = document.getElementById('i-ganho');
    el.textContent = (ganho >= 0 ? '+' : '') + R(Math.abs(ganho)) + ' (' + (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%)';
    el.className = 'int-val ' + (ganho >= 0 ? 'pos' : 'neg');
  } else { document.getElementById('i-ganho').textContent = '— inserir custo'; }
}

// ── Overview ─────────────────────────────────────────────
function renderOverview() {
  updateKPIs(); renderInt();
  document.getElementById('contas-tb').innerHTML = accounts.map(a =>
    `<tr><td>${a.name || '—'}</td><td><span class="tag tb">${a.subtype || a.type}</span></td><td class="mono">${R(a.balance)}</td></tr>`
  ).join('');
  const g = {};
  investments.forEach(i => { const k = i.type || 'OUTROS'; g[k] = (g[k] || 0) + (i.amount || i.balance || 0); });
  const sal = accounts.reduce((s, a) => s + (a.balance || 0), 0); if (sal > 0) g['CONTA'] = sal;
  const ib = intBrl(); if (ib > 0) g["INT'L USD"] = ib;
  const tot = Object.values(g).reduce((s, v) => s + v, 0);
  document.getElementById('aloc-tot').textContent = R(tot);
  renderDonut('donut', 'donut-leg', g, tot);
}

// ── Gastos ───────────────────────────────────────────────
function fTx(days) { if (!days) return txAll; const c = new Date(); c.setDate(c.getDate() - days); return txAll.filter(t => new Date(t.date) >= c); }

function renderTxs() {
  const t = fTx(txDays).filter(x => txType === 'all' || x.type === txType);
  const cr = t.filter(x => x.type === 'CREDIT').reduce((s, x) => s + Math.abs(x.amount || 0), 0);
  const db2 = t.filter(x => x.type === 'DEBIT').reduce((s, x) => s + Math.abs(x.amount || 0), 0);
  const lq = cr - db2;
  document.getElementById('g-cr').textContent = R(cr); document.getElementById('g-db').textContent = R(db2);
  document.getElementById('g-lq').textContent = R(lq); document.getElementById('g-lq').className = 'kpi-v ' + (lq >= 0 ? 'pos' : 'neg');
  document.getElementById('g-n').textContent = t.length;
  const tb = document.getElementById('tx-tb');
  if (!t.length) { tb.innerHTML = '<tr><td colspan="5" class="empty">sem transações</td></tr>'; return; }
  tb.innerHTML = t.slice(0, 200).map(x => {
    const v = Math.abs(x.amount || 0), cl = x.type === 'CREDIT' ? 'pos' : 'neg', s2 = x.type === 'CREDIT' ? '+' : '-';
    const m = x.operationType || x.paymentData?.paymentMethod || '—';
    return `<tr><td class="muted mono">${x.date?.slice(0, 10) || '—'}</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x.description || '—'}</td><td><span class="tag ta" style="font-size:9px">${(x.category || '—').slice(0, 20)}</span></td><td class="muted">${m}</td><td class="mono ${cl}">${s2}${R(v)}</td></tr>`;
  }).join('');
}

// ── Categorias ───────────────────────────────────────────
function renderCats() {
  const t = fTx(catDays).filter(x => x.type === 'DEBIT');
  const cats = {}, mths = {};
  t.forEach(x => {
    const c = x.category || 'Outros'; cats[c] = (cats[c] || 0) + Math.abs(x.amount || 0);
    const m2 = x.operationType || x.paymentData?.paymentMethod || 'Outros'; mths[m2] = (mths[m2] || 0) + Math.abs(x.amount || 0);
  });
  bars('cat-bars', cats, CLRS[0]); bars('mth-bars', mths, CLRS[3]);
  mkFluxo('fluxo-chart');
}

// ── Carteira ─────────────────────────────────────────────
function renderCarteira() {
  const inv = investments, tot = inv.reduce((s, i) => s + (i.amount || i.balance || 0), 0);
  document.getElementById('iv-tot').textContent = R(tot);
  document.getElementById('iv-rv').textContent = R(inv.filter(i => ['EQUITY', 'ETF'].includes(i.type)).reduce((s, i) => s + (i.amount || 0), 0));
  document.getElementById('iv-rf').textContent = R(inv.filter(i => i.type === 'FIXED_INCOME' || i.type === 'TREASURY').reduce((s, i) => s + (i.amount || 0), 0));
  document.getElementById('iv-fd').textContent = R(inv.filter(i => i.type === 'MUTUAL_FUND' || i.type === 'INVESTMENT_FUND').reduce((s, i) => s + (i.amount || 0), 0));
  document.getElementById('inv-lbl').textContent = `${inv.length} ativos`;
  const TT = { EQUITY: 'tr', ETF: 'tb', FIXED_INCOME: 'tg', TREASURY: 'tg', MUTUAL_FUND: 'ta', INVESTMENT_FUND: 'ta', SECURITY: 'ta', COE: 'tb', CDB: 'tg' };
  document.getElementById('inv-tb').innerHTML = inv.map(i => {
    const v = i.amount || i.balance || 0, pp = tot > 0 ? (v / tot * 100).toFixed(1) + '%' : '—';
    const bpv = bprice(i.code);
    const pSrc = bpv != null ? `${R(bpv)} <span style="font-size:9px;color:var(--g)">mkt</span>` : (i.value != null ? `${R(i.value)} <span style="font-size:9px;color:var(--muted)">pluggy</span>` : '—');
    let rent = '—';
    if (i.lastMonthRate != null) rent = `<span class="${i.lastMonthRate >= 0 ? 'pos' : 'neg'}">${Pct(i.lastMonthRate)} 1m</span>`;
    else if (i.annualRate != null) rent = `<span>${Pct(i.annualRate)} a.a.</span>`;
    else if (i.fixedAnnualRate != null) rent = `<span class="pos">${i.fixedAnnualRate}% a.a.</span>`;
    return `<tr><td style="font-weight:500">${i.name || i.code || '—'}</td><td><span class="tag ${TT[i.type] || 'tb'}">${i.subtype || i.type}</span></td><td class="muted mono">${i.quantity != null ? i.quantity.toLocaleString('pt-BR') : '—'}</td><td class="mono">${pSrc}</td><td class="mono">${R(v)}</td><td>${rent}</td><td class="muted">${pp}</td></tr>`;
  }).join('');
}

// ── Rentabilidade ─────────────────────────────────────────
function setRP(p, btn) { rentPer = p; document.querySelectorAll('#pt-rent .ptab').forEach(b => b.classList.remove('on')); btn.classList.add('on'); renderRentab(); }

function renderRentab() {
  const days = getDays();
  const rv = investments.filter(isRV);
  const bvsp = days ? calcBmRet('BVSP', days) : null;
  const gspc = days ? calcBmRet('GSPC', days) : null;
  const cdiR = BM.CDI?.rate ?? 14.75;
  const cdi  = days ? (cdiR / 365 * days) : null;

  document.getElementById('rent-bm-leg').innerHTML = [
    { n: 'Ibovespa', col: '#c8b97a', r: bvsp }, { n: 'S&P 500', col: '#8f9fbd', r: gspc }, { n: 'CDI', col: '#8fbd8f', r: cdi }
  ].map(b => `<div class="bm-item"><div class="bm-line" style="background:${b.col}"></div>${b.n}: <b style="color:var(--text)">${b.r != null ? Pct(b.r) : '—'}</b></div>`).join('');

  document.getElementById('rent-tb').innerHTML = rv.map(i => {
    const cur = bprice(i.code);
    let r2 = null;
    if (rentPer === 'origem' && cur) {
      const pm = cfg.precos[i.id];
      if (pm) r2 = (cur - pm) / pm * 100;
    } else if (days && i.code) { r2 = calcRet(i.code, days); }
    const vb = r2 != null && bvsp != null ? r2 - bvsp : null;
    const vc = r2 != null && cdi  != null ? r2 - cdi  : null;
    const vg = r2 != null && gspc != null ? r2 - gspc : null;
    const rc = v => v == null ? 'muted' : v >= 0 ? 'pos' : 'neg';
    const pp2 = v => v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2) + 'pp';
    const semDado = rentPer === 'origem' ? 'sem PM' : 'sem hist.';
    return `<tr><td><b>${i.code || i.name || '—'}</b></td><td class="${r2 != null ? (r2 >= 0 ? 'pos' : 'neg') : 'muted'}">${r2 != null ? Pct(r2) : semDado}</td><td class="${rc(vb)}">${pp2(vb)}</td><td class="${rc(vc)}">${pp2(vc)}</td><td class="${rc(vg)}">${pp2(vg)}</td><td class="mono">${cur != null ? R(cur * (i.quantity || 0)) : '—'}</td></tr>`;
  }).join('');

  document.getElementById('bm-tb').innerHTML = [
    { n: 'Ibovespa (^BVSP)', col: '#c8b97a', r: bvsp }, { n: 'S&P 500 (^GSPC)', col: '#8f9fbd', r: gspc },
    { n: `CDI (${cdiR.toFixed(2)}% a.a.)`, col: '#8fbd8f', r: cdi }
  ].map(b => `<tr><td><span style="display:inline-block;width:10px;height:10px;background:${b.col};border-radius:2px;margin-right:6px;vertical-align:middle"></span>${b.n}</td><td class="${b.r != null ? (b.r >= 0 ? 'pos' : 'neg') : 'muted'}">${b.r != null ? Pct(b.r) : '—'}</td></tr>`).join('');

  document.getElementById('rent-chart-lbl').textContent = rentPer === 'origem' ? 'retorno desde compra' : 'normalizado a 0% no início do período';
  mkRentChart(rv, days, cdiR);
}

// ── Evolução ─────────────────────────────────────────────
function renderEvolucao() {
  kc('evol-chart'); kc('fluxo2-chart');
  const mo = {};
  txAll.forEach(x => {
    const m = x.date?.slice(0, 7); if (!m) return;
    if (!mo[m]) mo[m] = { cr: 0, db: 0 };
    if (x.type === 'CREDIT') mo[m].cr += Math.abs(x.amount || 0);
    else mo[m].db += Math.abs(x.amount || 0);
  });
  const months = Object.keys(mo).sort();
  const curSaldo = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const net = months.map(m => mo[m].cr - mo[m].db);
  const bal = []; let run = curSaldo;
  for (let i = months.length - 1; i >= 0; i--) { bal[i] = +run.toFixed(2); run -= net[i]; }
  const ctx = document.getElementById('evol-chart').getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 320);
  grad.addColorStop(0, 'rgba(200,185,122,.18)'); grad.addColorStop(1, 'rgba(200,185,122,0)');
  CH['evol-chart'] = new Chart(ctx, {
    type: 'line',
    data: { labels: months.map(l => l.slice(5) + '/' + l.slice(2, 4)), datasets: [{ label: 'Saldo em conta', data: bal, borderColor: '#c8b97a', backgroundColor: grad, borderWidth: 2, pointRadius: 3, tension: .4, fill: true }] },
    options: cOpts()
  });
  mkFluxo('fluxo2-chart');
}

// ── Proventos ─────────────────────────────────────────────
function renderProventos() {
  kc('pv-chart');
  const rv = investments.filter(isRV);
  const rows = [], monthly = {}; let total = 0;
  const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 1);
  rv.forEach(i => {
    const divs = BD[i.code]?.dividends || [];
    const recent = divs.filter(d => new Date(d.paymentDate || d.approvedOn || 0) >= cutoff);
    const perUnit = recent.reduce((s, d) => s + (d.rate || 0), 0);
    const tot2 = perUnit * (i.quantity || 0);
    if (tot2 > 0) {
      total += tot2;
      const yld = i.amount ? tot2 / i.amount * 100 : null;
      rows.push({ name: i.code || i.name, total: tot2, yld });
      recent.forEach(d => { const m = (d.paymentDate || d.approvedOn || '').slice(0, 7); if (m) monthly[m] = (monthly[m] || 0) + (d.rate || 0) * (i.quantity || 0); });
    }
  });
  rows.sort((a, b) => b.total - a.total);
  document.getElementById('pv-tot').textContent = R(total);
  const avdy = rows.filter(r => r.yld).length ? rows.filter(r => r.yld).reduce((s, r) => s + (r.yld || 0), 0) / rows.filter(r => r.yld).length : null;
  document.getElementById('pv-dy').textContent = avdy != null ? avdy.toFixed(2) + '%' : '—';
  document.getElementById('pv-n').textContent = rows.length;
  document.getElementById('pv-top').textContent = rows[0]?.name || '—';
  document.getElementById('pv-tb').innerHTML = rows.length
    ? rows.map(r => `<tr><td style="font-weight:500">${r.name}</td><td class="mono pos">${R(r.total)}</td><td class="${r.yld >= 6 ? 'pos' : ''}">${r.yld != null ? r.yld.toFixed(2) + '%' : '—'}</td></tr>`).join('')
    : '<tr><td colspan="3" class="empty">sem proventos neste período</td></tr>';
  const ml = Object.keys(monthly).sort().slice(-12);
  const ctx = document.getElementById('pv-chart').getContext('2d');
  CH['pv-chart'] = new Chart(ctx, {
    type: 'bar',
    data: { labels: ml.map(l => l.slice(5) + '/' + l.slice(2, 4)), datasets: [{ label: 'Proventos', data: ml.map(l => monthly[l] || 0), backgroundColor: 'rgba(143,189,143,.55)', borderColor: '#8fbd8f', borderWidth: 1 }] },
    options: cOpts()
  });
}

// ── Alocação ─────────────────────────────────────────────
function renderAlocacao() {
  kc('aloc1-chart'); kc('aloc2-chart');
  const inv = investments; if (!inv.length) return;
  const byC = {};
  inv.forEach(i => { const k = i.type || 'OUTROS'; byC[k] = (byC[k] || 0) + (i.amount || i.balance || 0); });
  const sal = accounts.reduce((s, a) => s + (a.balance || 0), 0); if (sal > 0) byC['CONTA'] = sal;
  const ib = intBrl(); if (ib > 0) byC["INT'L USD"] = ib;
  mkPie('aloc1-chart', byC);
  const byA = {};
  inv.forEach(i => { const k = (i.code || i.name || '—').slice(0, 14); byA[k] = (byA[k] || 0) + (i.amount || i.balance || 0); });
  mkPie('aloc2-chart', byA);
  const em = {};
  inv.forEach(i => { const e = i.code || i.name?.split(' ')[0] || '—'; em[e] = (em[e] || 0) + (i.amount || i.balance || 0); });
  bars('emis-bars', em, CLRS[1]);
}

// ── Custo médio ───────────────────────────────────────────
function renderAcoes() {
  const rv = investments.filter(isRV);
  document.getElementById('ac-sel').innerHTML = rv.map(i => `<option value="${i.id}">${i.code || i.name}</option>`).join('');
  const tb = document.getElementById('ac-tb');
  if (!rv.length) { tb.innerHTML = '<tr><td colspan="8" class="empty">nenhum ativo de renda variável</td></tr>'; return; }
  tb.innerHTML = rv.map(i => {
    const pm = cfg.precos[i.id], qty = i.quantity || 0;
    const pa = bprice(i.code) ?? (i.value || (qty > 0 ? (i.amount || 0) / qty : 0));
    const ct = pm ? pm * qty : null, va = pa * qty, gn = ct != null ? va - ct : null, rpct = ct ? ((va - ct) / ct * 100) : null;
    return `<tr><td><div style="font-weight:500">${i.code || i.name || '—'}</div><div style="font-size:10px;color:var(--muted)">${i.name || ''}</div></td><td class="muted mono">${qty.toLocaleString('pt-BR')}</td><td class="mono">${pm ? R(pm) : '<span class="muted">— inserir</span>'}</td><td class="mono">${R(pa)}</td><td class="mono">${ct != null ? R(ct) : '—'}</td><td class="mono">${R(va)}</td><td class="mono ${gn != null ? (gn >= 0 ? 'pos' : 'neg') : ''}">${gn != null ? (gn >= 0 ? '+' : '') + R(Math.abs(gn)) : '—'}</td><td class="${rpct != null ? (rpct >= 0 ? 'pos' : 'neg') : 'muted'}">${rpct != null ? Pct(rpct) : '—'}</td></tr>`;
  }).join('');
}

// ── Render all sections ───────────────────────────────────
function renderAll() {
  renderOverview(); renderTxs(); renderCats(); renderCarteira();
  renderRentab(); renderEvolucao(); renderProventos(); renderAlocacao(); renderAcoes();
}
