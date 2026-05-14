// ── Navigation ────────────────────────────────────────────
const PAGE_TITLES = {
  overview: 'Patrimônio', gastos: 'Transações', cats: 'Categorias',
  carteira: 'Carteira', rentab: 'Rentabilidade', evolucao: 'Evolução Patrimonial',
  proventos: 'Proventos', alocacao: 'Alocação', acoes: 'Custo Médio',
  assessora: 'Assessora IA',
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

// ── Assessora IA — Chat UI ───────────────────────────────

let _chatBusy = false;

function chatAppendMsg(role, text, typing = false) {
  const wrap = document.getElementById('chat-messages');
  // Remove welcome screen on first real message
  const welcome = wrap.querySelector('.chat-welcome');
  if (welcome) welcome.remove();

  const div = document.createElement('div');
  div.className = 'msg ' + role + (typing ? ' msg-typing' : '');
  if (typing) div.id = 'chat-typing';

  const avatar = role === 'user' ? 'B' : '✦';
  div.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-bubble">${typing
      ? '<div class="typing-dots"><span></span><span></span><span></span></div>'
      : escHtml(text)
    }</div>`;
  wrap.appendChild(div);
  wrap.scrollTop = wrap.scrollHeight;
  return div;
}

function chatUpdateTyping(text) {
  const el = document.getElementById('chat-typing');
  if (!el) return;
  el.classList.remove('msg-typing');
  el.id = '';
  el.querySelector('.msg-bubble').textContent = text;
  document.getElementById('chat-messages').scrollTop = 99999;
}

function chatAppendProgress(msg) {
  const el = document.getElementById('chat-typing');
  if (!el) return;
  let p = el.querySelector('.msg-progress');
  if (!p) { p = document.createElement('div'); p.className = 'msg-progress'; el.querySelector('.msg-bubble').after(p); }
  p.textContent = msg;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

async function chatSend() {
  if (_chatBusy) return;
  const input = document.getElementById('chat-input');
  const msg = (input.value || '').trim();
  if (!msg) return;

  input.value = '';
  input.style.height = 'auto';
  _chatBusy = true;
  document.getElementById('chat-send-btn').disabled = true;

  chatAppendMsg('user', msg);
  chatAppendMsg('assistant', '', true); // typing indicator

  let fullText = '';
  let firstChunk = true;

  await Advisor.chat(msg, (chunk, done) => {
    if (chunk.startsWith('_progress:')) {
      chatAppendProgress(chunk.slice(10));
      return;
    }
    if (firstChunk && !done) {
      // Replace typing indicator with first real content
      chatUpdateTyping(chunk);
      fullText = chunk;
      firstChunk = false;
    } else if (!done) {
      fullText += chunk;
      const el = document.getElementById('chat-messages').lastElementChild;
      if (el) el.querySelector('.msg-bubble').innerHTML = escHtml(fullText);
      document.getElementById('chat-messages').scrollTop = 99999;
    } else if (done && fullText) {
      const el = document.getElementById('chat-messages').lastElementChild;
      if (el) el.querySelector('.msg-bubble').innerHTML = escHtml(fullText);
    } else if (done && !fullText) {
      // Non-streaming: chunk is the full message
      if (chunk) {
        fullText = chunk;
        chatUpdateTyping(chunk);
      }
    }
  });

  // If typing indicator still there (error or no stream), remove it
  const typing = document.getElementById('chat-typing');
  if (typing && !fullText) typing.remove();

  _chatBusy = false;
  document.getElementById('chat-send-btn').disabled = false;
  input.focus();
}

function chatSuggest(btn) {
  document.getElementById('chat-input').value = btn.textContent;
  chatSend();
}

function chatClear() {
  Advisor.clearHistory();
  const wrap = document.getElementById('chat-messages');
  wrap.innerHTML = `
    <div class="chat-welcome">
      <div class="chat-welcome-icon">✦</div>
      <div class="chat-welcome-title">Bia Assessora</div>
      <div class="chat-welcome-sub">Sua assessora financeira com IA. Conheço toda a sua carteira em tempo real.<br>Pergunte sobre rentabilidade, alocação, benchmarks ou peça análise de um ativo.</div>
      <div class="chat-suggestions">
        <button class="chat-sug" onclick="chatSuggest(this)">Como está minha carteira hoje?</button>
        <button class="chat-sug" onclick="chatSuggest(this)">Quais são meus maiores riscos?</button>
        <button class="chat-sug" onclick="chatSuggest(this)">Comparo com o Ibovespa no ano?</button>
        <button class="chat-sug" onclick="chatSuggest(this)">Analisa VALE3 pra mim</button>
      </div>
    </div>`;
}

// ── Bootstrap ─────────────────────────────────────────────
loadAll();
