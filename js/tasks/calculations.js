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

// ── Price on or before a specific date ───────────────────
// Walks backwards to find the last close on or before dateStr.
// Used for patrimony history reconstruction.
function hpriceOn(code, dateStr) {
  const h = BD[code]?.history;
  if (!h?.length) return null;
  for (let i = h.length - 1; i >= 0; i--) { if (h[i].date <= dateStr) return h[i].close; }
  return null;
}

// ── Back-calculate fixed income value N days ago ─────────
// Given current value and annual rate (% a.a.), estimates value at a past date.
// Uses compound interest with 252 trading days/year (standard BR convention).
function backCalcFixedIncome(currentValue, rateAnnual, daysBack) {
  if (!rateAnnual || rateAnnual <= 0 || !daysBack) return currentValue;
  const dailyFactor = Math.pow(1 + rateAnnual / 100, 1 / 252);
  const tradingDays = Math.round(daysBack * 252 / 365);
  return currentValue / Math.pow(dailyFactor, tradingDays);
}

// ── Build monthly patrimony history (last 12 months) ─────
// Returns array of { label, dateStr, bank, rv, rf, intl, total }
// - bank: reconstructed from transaction history (backwards)
// - rv:   quantity × historical Yahoo Finance close price
// - rf:   back-calculated from current value + CDI/contract rate
// - intl: current USD × current rate (no historical FX available)
function buildPatrimonyHistory() {
  // ── Month endpoints ────────────────────────────────────
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i + 1, 0); // last day of month
    months.push({ label: String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getFullYear()).slice(2), dateStr: d.toISOString().slice(0, 10) });
  }

  // ── Bank account: backward reconstruction ─────────────
  const mo = {};
  txAll.forEach(x => {
    const m = x.date?.slice(0, 7); if (!m) return;
    if (!mo[m]) mo[m] = { cr: 0, db: 0 };
    if (x.type === 'CREDIT') mo[m].cr += Math.abs(x.amount || 0);
    else mo[m].db += Math.abs(x.amount || 0);
  });
  const sortedMonths = Object.keys(mo).sort();
  const curBank = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  const bankByMonth = {};
  let runBank = curBank;
  for (let i = sortedMonths.length - 1; i >= 0; i--) {
    bankByMonth[sortedMonths[i]] = +runBank.toFixed(2);
    runBank -= (mo[sortedMonths[i]].cr - mo[sortedMonths[i]].db);
  }

  // ── Asset groups ───────────────────────────────────────
  const rv = investments.filter(isRV);
  const rf = investments.filter(i => !isRV(i));
  const cdiRate = BM.CDI?.rate || 14.75;
  const intUsd = cfg.int_usd || 0;
  const curRate = usdRate || 5.75;

  return months.map(({ label, dateStr }) => {
    const mk = dateStr.slice(0, 7);
    const today = now.toISOString().slice(0, 10);
    const daysBack = Math.round((now - new Date(dateStr)) / 86400000);

    // Bank
    const bank = bankByMonth[mk] ?? curBank;

    // Renda variável: quantity × historical price (or current if no history)
    let rvVal = 0;
    rv.forEach(i => {
      if (!i.code) { rvVal += i.amount || 0; return; }
      const p = hpriceOn(i.code, dateStr);
      rvVal += (p ?? bprice(i.code) ?? 0) * (i.quantity || 0);
    });

    // Renda fixa: back-calculate each asset using its rate or CDI
    let rfVal = 0;
    rf.forEach(i => {
      const cur = i.amount || i.balance || 0;
      // Use asset's own rate if available, otherwise CDI
      const rate = i.annualRate || i.fixedAnnualRate || (i.type === 'TREASURY' ? cdiRate : cdiRate);
      rfVal += backCalcFixedIncome(cur, rate, daysBack);
    });

    // Internacional: fixed at current rate (no historical FX data)
    const intl = intUsd * curRate;

    const total = bank + rvVal + rfVal + intl;
    return { label, dateStr, bank: +bank.toFixed(2), rv: +rvVal.toFixed(2), rf: +rfVal.toFixed(2), intl: +intl.toFixed(2), total: +total.toFixed(2) };
  });
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
