// ── Navigation ────────────────────────────────────────────
const PAGE_TITLES = {
  overview: 'Patrimônio', gastos: 'Transações', cats: 'Categorias',
  carteira: 'Carteira', rentab: 'Rentabilidade', evolucao: 'Evolução Patrimonial',
  proventos: 'Proventos', alocacao: 'Alocação', acoes: 'Custo Médio',
  fundamentalista: 'Análise Fundamentalista',
};

function go(id, btn) {
  document.querySelectorAll('.sec').forEach(s => s.classList.remove('on'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('on'));
  document.getElementById('s-' + id).classList.add('on'); btn.classList.add('on');
  document.getElementById('ptitle').textContent = PAGE_TITLES[id] || id;
  if (id === 'rentab')   renderRentab();
  if (id === 'evolucao') renderEvolucao();
  if (id === 'proventos') renderProventos();
  if (id === 'alocacao') renderAlocacao();
  if (id === 'cats')     renderCats();
}

function setP(d, b) { txDays = d; document.querySelectorAll('#fp .fbtn').forEach(x => x.classList.remove('on')); b.classList.add('on'); renderTxs(); }
function setT(t, b) { txType = t; document.querySelectorAll('#ft .fbtn').forEach(x => x.classList.remove('on')); b.classList.add('on'); if (document.getElementById('excl-inv')) document.getElementById('excl-inv').checked = false; renderTxs(); }
function setC(d, b) { catDays = d; document.querySelectorAll('#fc .fbtn').forEach(x => x.classList.remove('on')); b.classList.add('on'); renderCats(); }

// ── Fundamentalist Agent UI ──────────────────────────────

function faSetProgress(msg) {
  const el = document.getElementById('fa-progress');
  if (!msg) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  document.getElementById('fa-progress-msg').textContent = msg;
}

async function faAnalyzeTicker() {
  const input = document.getElementById('fa-ticker-input');
  const ticker = (input.value || '').trim().toUpperCase();
  if (!ticker) return;
  document.getElementById('fa-results').innerHTML = '';
  faSetProgress('Iniciando análise de ' + ticker + '...');
  try {
    const result = await FA.analyzeAsset(ticker, {
      onProgress: msg => faSetProgress(msg),
    });
    faSetProgress(null);
    faRenderResult(result);
  } catch (e) {
    faSetProgress(null);
    faRenderError(ticker, e.message);
  }
}

async function faAnalyzePortfolio() {
  document.getElementById('fa-results').innerHTML = '';
  faSetProgress('Iniciando análise da carteira...');
  try {
    const results = await FA.analyzePortfolio({
      onProgress: msg => faSetProgress(msg),
    });
    faSetProgress(null);
    results.forEach(r => {
      if (r.error) faRenderError(r.ticker, r.error);
      else faRenderResult(r.result);
    });
  } catch (e) {
    faSetProgress(null);
    faRenderError('carteira', e.message);
  }
}

let _faParsedAssets = null;

function faHandlePDF(input) {
  const file = input.files?.[0];
  if (!file) return;
  document.getElementById('fa-file-name').textContent = file.name;
  document.getElementById('fa-results').innerHTML = '';
  faSetProgress('Processando PDF...');

  FA.parsers.pdfStatement.parse(file).then(parsed => {
    faSetProgress(null);
    if (parsed.error) { faRenderError('PDF', parsed.error); return; }
    _faParsedAssets = parsed;
    // Show preview
    document.getElementById('fa-pdf-broker').textContent = parsed.broker;
    const tb = document.getElementById('fa-pdf-tb');
    tb.innerHTML = parsed.assets.map((a, i) => `
      <tr>
        <td>${a.ticker || '—'}</td>
        <td>${a.asset_name || '—'}</td>
        <td><span class="tag ${a.asset_type === 'equity' ? 'tg' : 'tb'}">${a.asset_type}</span></td>
        <td>${a.quantity ?? '—'}</td>
        <td>${a.avg_price != null ? 'R$ ' + a.avg_price.toFixed(2) : '—'}</td>
        <td>${a.current_value != null ? 'R$ ' + a.current_value.toLocaleString('pt-BR', {minimumFractionDigits:2}) : '—'}</td>
        <td><span class="tag ${a.confidence === 'high' ? 'tg' : a.confidence === 'medium' ? 'ta' : 'tr'}">${a.confidence}</span></td>
        <td><input type="checkbox" checked id="fa-pdf-check-${i}"></td>
      </tr>`).join('');
    document.getElementById('fa-pdf-preview').classList.remove('hidden');
  }).catch(e => { faSetProgress(null); faRenderError('PDF', e.message); });
}

async function faConfirmPDF() {
  if (!_faParsedAssets) return;
  document.getElementById('fa-pdf-preview').classList.add('hidden');
  document.getElementById('fa-results').innerHTML = '';

  const selected = _faParsedAssets.assets.filter((_, i) => {
    const cb = document.getElementById(`fa-pdf-check-${i}`);
    return cb ? cb.checked : true;
  });

  faSetProgress(`Analisando ${selected.length} ativos do extrato...`);
  for (const a of selected) {
    const id = a.ticker || a.isin;
    if (!id) continue;
    faSetProgress(`Analisando ${id}...`);
    try {
      const result = await FA.analyzeAsset(id, { onProgress: msg => faSetProgress(msg) });
      faRenderResult(result);
    } catch (e) { faRenderError(id, e.message); }
  }
  faSetProgress(null);
}

function faRenderResult(result) {
  const container = document.getElementById('fa-results');
  if (!result) return;

  if (result.error) { faRenderError('análise', result.error); return; }

  const analysis = result.analysis || result.memory;
  if (!analysis) return;

  const asset = result.asset || {};
  const cached = result.fromCache;
  const ratingClass = {
    comprar: 'fa-rating-comprar', manter: 'fa-rating-manter',
    reduzir: 'fa-rating-reduzir', vender: 'fa-rating-vender',
  }[analysis.rating?.toLowerCase()] || (analysis.recommendation ? 'fa-rating-credit' : 'fa-rating-manter');

  const ratingText = analysis.rating || analysis.recommendation || '—';
  const target = analysis.price_target_12m;

  const metricsHTML = analysis.key_metrics ? Object.entries(analysis.key_metrics)
    .filter(([, v]) => v != null)
    .map(([k, v]) => {
      const label = k.replace(/_/g, ' ');
      const isPercent = ['roe','roic','margem_liquida','margem_ebitda','dividend_yield','crescimento_receita_3a','crescimento_lucro_3a'].includes(k);
      const isMultiple = ['pl_atual','pl_historico_medio','ev_ebitda','pvp','divida_ebitda','divida_liquida_ebitda','cobertura_juros'].includes(k);
      let fmtVal = typeof v === 'number'
        ? (isPercent ? v.toFixed(1) + '%' : isMultiple ? v.toFixed(1) + 'x' : v.toFixed(2))
        : v;
      return `<div class="fa-metric"><div class="fa-metric-l">${label}</div><div class="fa-metric-v">${fmtVal}</div></div>`;
    }).join('') : '';

  const risksList = (analysis.risks || []).map(r => `<li>${r}</li>`).join('');
  const oppsList = (analysis.opportunities || []).map(o => `<li>${o}</li>`).join('');

  const el = document.createElement('div');
  el.className = 'fa-result';
  el.innerHTML = `
    <div class="fa-result-header">
      <div>
        <div class="fa-result-name">${asset.name || analysis.data_period || '—'}
          ${cached ? '<span class="fa-cached-badge">cache</span>' : ''}
        </div>
        <div class="fa-result-sub">${asset.ticker || asset.isin || ''} · ${asset.sector || asset.type || ''}</div>
      </div>
      <div>
        <span class="fa-rating ${ratingClass}">${ratingText}</span>
        ${target ? `<div class="fa-target">Alvo 12m: <b>R$ ${target.toLocaleString('pt-BR', {minimumFractionDigits:2})}</b></div>` : ''}
      </div>
    </div>
    ${analysis.thesis ? `<div class="fa-thesis">${analysis.thesis.replace(/\n/g, '<br>')}</div>` : ''}
    ${metricsHTML ? `<div class="fa-metrics-grid">${metricsHTML}</div>` : ''}
    ${(risksList || oppsList) ? `
    <div class="fa-lists">
      <div><div class="fa-list-title">Riscos</div><ul class="fa-list">${risksList}</ul></div>
      <div><div class="fa-list-title">Oportunidades</div><ul class="fa-list">${oppsList}</ul></div>
    </div>` : ''}
    ${analysis.vs_competitors ? `<div style="font-size:11px;color:var(--muted);margin-top:.5rem"><b style="color:var(--muted)">vs concorrentes:</b> ${analysis.vs_competitors}</div>` : ''}
  `;
  container.appendChild(el);
}

function faRenderError(identifier, msg) {
  const container = document.getElementById('fa-results');
  const el = document.createElement('div');
  el.className = 'fa-result';
  el.innerHTML = `<div class="fa-result-header"><div class="fa-result-name">${identifier}</div><span class="fa-rating fa-rating-vender">erro</span></div><div class="fa-thesis">${msg}</div>`;
  container.appendChild(el);
}

// ── Bootstrap ─────────────────────────────────────────────
loadAll();
