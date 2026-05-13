// ── Current market price ──────────────────────────────────
function bprice(code) { return BD[code]?.price ?? null; }

// ── Historical price N calendar days ago ─────────────────
// Walks back through history to find the last close on or before target date
function hprice(code, daysAgo) {
  const h = BD[code]?.history;
  if (!h?.length) return null;
  const t = new Date(); t.setDate(t.getDate() - daysAgo);
  const ts = t.toISOString().slice(0, 10);
  for (let i = h.length - 1; i >= 0; i--) { if (h[i].date <= ts) return h[i].close; }
  return null;
}

// ── Historical benchmark price N calendar days ago ────────
function bmhprice(key, daysAgo) {
  const h = BM[key]?.history;
  if (!h?.length) return null;
  const t = new Date(); t.setDate(t.getDate() - daysAgo);
  const ts = t.toISOString().slice(0, 10);
  for (let i = h.length - 1; i >= 0; i--) { if (h[i].date <= ts) return h[i].close; }
  return null;
}

// ── Price at specific date for TWR ───────────────────────
// Returns the first available trading day price on or after the given date.
// Used to calculate Time-Weighted Return since purchase date.
function hpriceAt(code, dateStr) {
  const h = BD[code]?.history;
  if (!h?.length) return null;
  for (let i = 0; i < h.length; i++) { if (h[i].date >= dateStr) return h[i].close; }
  return null;
}

// ── Transaction classification ────────────────────────────
// Returns one of: 'EXPENSE' | 'INVESTMENT' | 'TRANSFER' | 'INCOME' | 'OTHER'
// Priority: Pluggy category → operationType + description regex → fallback
const INVEST_DESC_RE = /aplicac|investimento|aporte|xp invest|rico|avenue|clear|btg|inter invest|cdb|lft|tesouro|fundo|resgate|boleta|corretora/i;
const INVEST_BROKERS = /\bxp\b|rico\b|avenue|clear|btg|inter|nuinvest|easynvest|modalmais|warren|orama/i;
const TRANSFER_RE = /transfer[eê]ncia|ted\b|doc\b|pix para (si|conta)|entre contas/i;
const INCOME_CATS = ['Receitas e Rendimentos', 'Salário', 'Renda', 'Freelance', 'Dividendos', 'Proventos'];
const INVEST_CATS = ['Investimentos e Poupança', 'Investimentos', 'Aplicação Financeira', 'Poupança', 'Aplicacao'];

function classifyTx(tx) {
  const cat  = tx.category || '';
  const desc = (tx.description || '').toLowerCase();
  const op   = tx.operationType || tx.paymentData?.paymentMethod || '';
  const amt  = Math.abs(tx.amount || 0);

  // Pluggy category takes priority
  if (INVEST_CATS.some(c => cat.toLowerCase().includes(c.toLowerCase()))) return 'INVESTMENT';
  if (INCOME_CATS.some(c => cat.toLowerCase().includes(c.toLowerCase()))) return 'INCOME';
  if (cat.toLowerCase().includes('transfer')) return 'TRANSFER';

  // Description + operationType signals
  if (INVEST_DESC_RE.test(desc)) return 'INVESTMENT';
  if (INVEST_BROKERS.test(desc) && (op === 'TED' || op === 'PIX')) return 'INVESTMENT';
  if (TRANSFER_RE.test(desc)) return 'TRANSFER';

  // TED outgoing: if large round amount, likely investment transfer
  if (tx.type === 'DEBIT' && op === 'TED' && amt >= 500 && amt % 50 === 0) return 'INVESTMENT';

  if (tx.type === 'CREDIT') return 'INCOME';
  return 'EXPENSE';
}

// ── Dividend cross-check with bank transactions ───────────
// For each dividend event (Yahoo Finance), tries to find a matching CREDIT
// in txAll within ±7 days with amount ≥ 80% of expected total.
// Returns a Map: `${code}_${date}` → { matched: bool, txDate, txAmount }
function crossCheckDividends(rv) {
  const result = new Map();
  const credits = txAll.filter(x => x.type === 'CREDIT');
  rv.forEach(i => {
    const divs = BD[i.code]?.dividends || [];
    divs.forEach(d => {
      const key = `${i.code}_${d.date}`;
      const expected = (d.amount || 0) * (i.quantity || 0);
      if (expected < 0.01) return;
      // Search for a credit within ±7 days of ex-date
      const exDate = new Date(d.date);
      const match = credits.find(tx => {
        const txDate = new Date(tx.date);
        const daysDiff = Math.abs((txDate - exDate) / 86400000);
        const txAmt = Math.abs(tx.amount || 0);
        // Amount within 20% tolerance (multiple holdings can combine)
        return daysDiff <= 7 && txAmt >= expected * 0.8 && txAmt <= expected * 2.5;
      });
      result.set(key, match
        ? { matched: true, txDate: match.date?.slice(0, 10), txAmount: Math.abs(match.amount || 0) }
        : { matched: false });
    });
  });
  return result;
}

// ── Period return % ───────────────────────────────────────
function calcRet(code, days) {
  const c = bprice(code), o = hprice(code, days);
  if (c == null || o == null) return null;
  return (c - o) / o * 100;
}

function calcBmRet(key, days) {
  const c = BM[key]?.price ?? BM[key]?.history?.slice(-1)[0]?.close;
  const o = bmhprice(key, days);
  if (c == null || o == null) return null;
  return (c - o) / o * 100;
}
