// ── Chart default options ────────────────────────────────
function cOpts(yFmt) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#888880', font: { family: 'DM Mono', size: 11 } } },
      tooltip: {
        backgroundColor: 'rgba(17,17,16,.97)',
        borderColor: 'rgba(255,255,255,.1)',
        borderWidth: 1,
        padding: 10,
        titleColor: '#888880',
        titleFont: { family: 'DM Mono', size: 10 },
        bodyColor: '#f0ede6',
        bodyFont: { family: 'DM Mono', size: 12 },
        callbacks: {
          label: ctx => {
            const v = ctx.raw;
            if (v == null) return '';
            const fmt = yFmt ? yFmt(v) : (v >= 100 || v <= -100 ? 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v.toFixed(2));
            return ` ${ctx.dataset.label}: ${fmt}`;
          }
        }
      }
    },
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
    `<div class="drow"><div class="ddot" style="background:${CLRS[i % CLRS.length]}"></div><span style="color:var(--muted);flex:1">${k}</span><div style="text-align:right"><div style="font-size:12px">${(v / tot * 100).toFixed(1)}%</div><div style="font-size:10px;color:var(--muted2)">${R(v)}</div></div></div>`
  ).join('');
}

// ── Monthly cash flow bar chart ──────────────────────────
// onlyReal=true → only real expenses vs income (excludes investment/transfer)
function mkFluxo(cid, onlyReal = false) {
  kc(cid);
  const mo = {};
  txAll.forEach(x => {
    const m = x.date?.slice(0, 7); if (!m) return;
    if (!mo[m]) mo[m] = { cr: 0, db: 0 };
    const cls = classifyTx(x);
    if (onlyReal) {
      if (cls === 'INCOME')  mo[m].cr += Math.abs(x.amount || 0);
      if (cls === 'EXPENSE') mo[m].db += Math.abs(x.amount || 0);
    } else {
      if (x.type === 'CREDIT') mo[m].cr += Math.abs(x.amount || 0);
      else                     mo[m].db += Math.abs(x.amount || 0);
    }
  });
  const lb = Object.keys(mo).sort().slice(-12);
  const ctx = document.getElementById(cid).getContext('2d');
  CH[cid] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: lb.map(l => l.slice(5) + '/' + l.slice(2, 4)),
      datasets: [
        { label: 'Entradas', data: lb.map(l => mo[l]?.cr || 0), backgroundColor: 'rgba(143,189,143,.5)', borderColor: '#8fbd8f', borderWidth: 1 },
        { label: 'Saídas',   data: lb.map(l => mo[l]?.db || 0), backgroundColor: 'rgba(189,143,143,.5)', borderColor: '#bd8f8f', borderWidth: 1 },
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
      const cur = bprice(i.code); if (!cur) return null;
      const pm = cfg.precos[i.id];
      if (!pm) return null;
      return { n: i.code || i.name, r: (cur - pm) / pm * 100 };
    }).filter(Boolean);
    if (!d2.length) { ctx.canvas.parentElement.innerHTML = '<div class="empty">insira o preço médio na seção "Custo Médio" para ver a rentabilidade desde compra</div>'; return; }
    CH['rent-chart'] = new Chart(ctx, {
      type: 'bar',
      data: { labels: d2.map(x => x.n), datasets: [{ label: 'Retorno desde compra (PM)', data: d2.map(x => x.r), backgroundColor: d2.map(x => x.r >= 0 ? 'rgba(143,189,143,.6)' : 'rgba(189,143,143,.6)'), borderColor: d2.map(x => x.r >= 0 ? '#8fbd8f' : '#bd8f8f'), borderWidth: 1 }] },
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
    // Stock lines: thinner and semi-transparent so benchmarks stand out
    const col = CLRS[idx % CLRS.length];
    datasets.push({ label: inv.code, data: pts, borderColor: col, borderWidth: 1, pointRadius: 0, tension: .3, fill: false, spanGaps: true, borderDash: [] });
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
    datasets.push({ label, data: pts, borderColor: col, borderWidth: 2.5, pointRadius: 0, tension: .3, fill: false, borderDash: dash, spanGaps: true });
  };
  // Benchmark lines: thicker and fully opaque — the reference the user compares against
  addBM('BVSP', 'Ibovespa', '#c8b97a', [5, 3]); addBM('GSPC', 'S&P 500', '#8f9fbd', [5, 3]);
  const daily = Math.pow(1 + cdiR / 100, 1 / 252) - 1;
  datasets.push({ label: 'CDI', data: labels.map((_, i) => (Math.pow(1 + daily, i) - 1) * 100), borderColor: '#8fbd8f', borderWidth: 2, pointRadius: 0, fill: false, borderDash: [3, 3], spanGaps: true });
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
