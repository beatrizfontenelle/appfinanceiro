// ── Chart default options ────────────────────────────────
function cOpts(yFmt) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#888880', font: { family: 'DM Mono', size: 11 } } } },
    scales: {
      x: { ticks: { color: '#555550', font: { size: 10 }, maxRotation: 0 }, grid: { color: 'rgba(255,255,255,.03)' } },
      y: { ticks: { color: '#555550', font: { size: 10 }, callback: yFmt || (v => v >= 1000 ? 'R$' + (v / 1000).toFixed(0) + 'k' : 'R$' + v) }, grid: { color: 'rgba(255,255,255,.04)' } }
    }
  };
}

// ── Bar chart (DOM-based) ────────────────────────────────
function bars(id, data, col) {
  const el = document.getElementById(id);
  const s = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (!s.length) { el.innerHTML = '<div class="empty">sem dados</div>'; return; }
  const mx = s[0][1];
  el.innerHTML = s.map(([k, v]) =>
    `<div class="brow"><div class="blabel" title="${k}">${k}</div><div class="btrack"><div class="bfill" style="width:${(v / mx * 100).toFixed(1)}%;background:${col}"></div></div><div class="bval">${R(v)}</div></div>`
  ).join('');
}

// ── Donut (SVG-based) ────────────────────────────────────
function renderDonut(svgId, legId, g, tot) {
  if (!tot) return;
  const svg = document.getElementById(svgId), leg = document.getElementById(legId);
  const cx = 60, cy = 60, r = 46, sw = 16, circ = 2 * Math.PI * r;
  const ent = Object.entries(g).sort((a, b) => b[1] - a[1]);
  svg.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1a1a18" stroke-width="${sw}"/>`;
  let off = 0;
  ent.forEach(([k, v], i) => {
    const len = v / tot * circ, c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r); c.setAttribute('fill', 'none');
    c.setAttribute('stroke', CLRS[i % CLRS.length]); c.setAttribute('stroke-width', sw - 1);
    c.setAttribute('stroke-dasharray', `${len} ${circ - len}`); c.setAttribute('stroke-dashoffset', -off);
    c.setAttribute('transform', `rotate(-90 ${cx} ${cy})`); svg.appendChild(c); off += len;
  });
  leg.innerHTML = ent.map(([k, v], i) =>
    `<div class="drow"><div class="ddot" style="background:${CLRS[i % CLRS.length]}"></div><span style="color:var(--muted);flex:1">${k}</span><span>${(v / tot * 100).toFixed(1)}%</span></div>`
  ).join('');
}

// ── Monthly cash flow bar chart ──────────────────────────
function mkFluxo(cid) {
  kc(cid);
  const mo = {};
  txAll.forEach(x => {
    const m = x.date?.slice(0, 7); if (!m) return;
    if (!mo[m]) mo[m] = { cr: 0, db: 0 };
    if (x.type === 'CREDIT') mo[m].cr += Math.abs(x.amount || 0);
    else mo[m].db += Math.abs(x.amount || 0);
  });
  const lb = Object.keys(mo).sort().slice(-12);
  const ctx = document.getElementById(cid).getContext('2d');
  CH[cid] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: lb.map(l => l.slice(5) + '/' + l.slice(2, 4)),
      datasets: [
        { label: 'Entradas', data: lb.map(l => mo[l].cr), backgroundColor: 'rgba(143,189,143,.5)', borderColor: '#8fbd8f', borderWidth: 1 },
        { label: 'Saídas',   data: lb.map(l => mo[l].db), backgroundColor: 'rgba(189,143,143,.5)', borderColor: '#bd8f8f', borderWidth: 1 },
      ]
    },
    options: cOpts()
  });
}

// ── Rentability comparison line/bar chart ────────────────
function mkRentChart(rv, days, cdiR) {
  kc('rent-chart');
  const ctx = document.getElementById('rent-chart').getContext('2d');
  if (!days) {
    const d2 = rv.map(i => {
      const cur = bprice(i.code); if (!cur || !i.code) return null;
      const buyDate = i.date?.slice(0, 10);
      const buyPrice = buyDate ? hpriceAt(i.code, buyDate) : null;
      if (!buyPrice) return null;
      return { n: i.code || i.name, r: (cur - buyPrice) / buyPrice * 100 };
    }).filter(Boolean);
    if (!d2.length) { ctx.canvas.parentElement.innerHTML = '<div class="empty">sem histórico de preços para calcular TWR</div>'; return; }
    CH['rent-chart'] = new Chart(ctx, {
      type: 'bar',
      data: { labels: d2.map(x => x.n), datasets: [{ label: 'Retorno desde compra', data: d2.map(x => x.r), backgroundColor: d2.map(x => x.r >= 0 ? 'rgba(143,189,143,.6)' : 'rgba(189,143,143,.6)'), borderColor: d2.map(x => x.r >= 0 ? '#8fbd8f' : '#bd8f8f'), borderWidth: 1 }] },
      options: cOpts(v => v.toFixed(1) + '%')
    });
    return;
  }
  const now = new Date(), labels = [];
  for (let i = days; i >= 0; i--) { const d3 = new Date(now); d3.setDate(d3.getDate() - i); labels.push(d3.toISOString().slice(0, 10)); }
  const datasets = [];
  rv.forEach((inv, idx) => {
    if (!inv.code || !BD[inv.code]?.history?.length) return;
    const h = BD[inv.code].history;
    let base = null;
    const pts = labels.map(d3 => {
      let p = null; for (let j = h.length - 1; j >= 0; j--) { if (h[j].date <= d3) { p = h[j].close; break; } }
      if (p != null && base == null) base = p;
      if (base == null || p == null) return null;
      return (p - base) / base * 100;
    });
    if (pts.filter(p => p != null).length < 5) return;
    datasets.push({ label: inv.code, data: pts, borderColor: CLRS[idx % CLRS.length], borderWidth: 1.5, pointRadius: 0, tension: .3, fill: false, spanGaps: true });
  });
  const addBM = (key, label, col, dash) => {
    const h = BM[key]?.history; if (!h || !h.length) return;
    let base = null;
    const pts = labels.map(d3 => {
      let p = null; for (let j = h.length - 1; j >= 0; j--) { if (h[j].date <= d3) { p = h[j].close; break; } }
      if (p != null && base == null) base = p;
      if (base == null || p == null) return null;
      return (p - base) / base * 100;
    });
    datasets.push({ label, data: pts, borderColor: col, borderWidth: 1.5, pointRadius: 0, tension: .3, fill: false, borderDash: dash, spanGaps: true });
  };
  addBM('BVSP', 'Ibovespa', '#c8b97a', [4, 2]); addBM('GSPC', 'S&P 500', '#8f9fbd', [4, 2]);
  const daily = Math.pow(1 + cdiR / 100, 1 / 252) - 1;
  datasets.push({ label: 'CDI', data: labels.map((_, i) => (Math.pow(1 + daily, i) - 1) * 100), borderColor: '#8fbd8f', borderWidth: 1.5, pointRadius: 0, fill: false, borderDash: [2, 2], spanGaps: true });
  if (!datasets.length) { ctx.canvas.parentElement.innerHTML = '<div class="empty">sem dados históricos para este período</div>'; return; }
  const step = Math.ceil(days / 20);
  CH['rent-chart'] = new Chart(ctx, {
    type: 'line', data: { labels: labels.map((l, i) => i % step === 0 ? l.slice(5) : ''), datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#888880', font: { family: 'DM Mono', size: 10 }, boxWidth: 20 } } },
      scales: {
        x: { ticks: { color: '#555550', font: { size: 9 }, maxRotation: 0 }, grid: { color: 'rgba(255,255,255,.03)' } },
        y: { ticks: { color: '#555550', font: { size: 10 }, callback: v => v.toFixed(1) + '%' }, grid: { color: 'rgba(255,255,255,.04)' } }
      }
    }
  });
}

// ── Doughnut chart (Chart.js) ────────────────────────────
function mkPie(id, data) {
  const ent = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const ctx = document.getElementById(id).getContext('2d');
  CH[id] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: ent.map(e => e[0]), datasets: [{ data: ent.map(e => e[1]), backgroundColor: CLRS.slice(0, ent.length), borderColor: '#111110', borderWidth: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#888880', font: { family: 'DM Mono', size: 10 }, boxWidth: 12, padding: 8 } },
        tooltip: { callbacks: { label: c2 => { const t = c2.dataset.data.reduce((a, b) => a + b, 0); return ` ${c2.label}: ${(c2.raw / t * 100).toFixed(1)}% (${R(c2.raw)})`; } } }
      }
    }
  });
}
