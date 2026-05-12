// ── Navigation ────────────────────────────────────────────
const PAGE_TITLES = {
  overview: 'Patrimônio', gastos: 'Transações', cats: 'Categorias',
  carteira: 'Carteira', rentab: 'Rentabilidade', evolucao: 'Evolução Patrimonial',
  proventos: 'Proventos', alocacao: 'Alocação', acoes: 'Custo Médio'
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
function setT(t, b) { txType = t; document.querySelectorAll('#ft .fbtn').forEach(x => x.classList.remove('on')); b.classList.add('on'); renderTxs(); }
function setC(d, b) { catDays = d; document.querySelectorAll('#fc .fbtn').forEach(x => x.classList.remove('on')); b.classList.add('on'); renderCats(); }

// ── Bootstrap ─────────────────────────────────────────────
loadAll();
