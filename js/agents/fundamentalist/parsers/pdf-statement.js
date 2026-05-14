// ── Fundamentalist Agent — PDF Statement Parser ──────────
// Extracts assets from broker statements (XP, BTG, Itaú, Rico, generic).
// Requires PDF.js loaded in the page (added to index.html).
//
// Output per asset:
// { ticker, isin, asset_type, asset_name, quantity, avg_price,
//   purchase_date, current_value, broker, confidence, raw_text }

window.FA = window.FA || {};

FA.parsers = FA.parsers || {};

FA.parsers.pdfStatement = (function () {

  // ── Broker detection ─────────────────────────────────────

  function detectBroker(text) {
    const t = text.toLowerCase();
    if (t.includes('btg pactual') || t.includes('banco btg')) return 'BTG';
    if (t.includes('xp investimentos') || t.includes('xp inc')) return 'XP';
    if (t.includes('rico corretora') || t.includes('rico.com')) return 'Rico';
    if (t.includes('itaú') || t.includes('itau corretora')) return 'Itaú';
    if (t.includes('clear corretora') || t.includes('clear.com')) return 'Clear';
    if (t.includes('avenue')) return 'Avenue';
    return 'Genérico';
  }

  // ── Ticker/ISIN patterns ─────────────────────────────────

  const TICKER_RE = /\b([A-Z]{4}\d{1,2})\b/g;
  const ISIN_RE   = /\b(BR[A-Z0-9]{10})\b/g;
  const MONEY_RE  = /R\$\s*([\d.,]+)/g;
  const QTY_RE    = /(\d+(?:\.\d+)?)\s*(?:cotas?|ações?|units?|cri|cra)/i;

  // ── XP statement parser ──────────────────────────────────

  function parseXP(text) {
    const assets = [];
    const lines = text.split('\n');

    // XP extrato: table rows typically look like:
    // PETR4  PETROBRAS PN  100  38.50  3,850.00  01/03/2024
    const rowRe = /([A-Z]{4}\d{1,2})\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+([\d.,]+)\s+([\d.,]+)/;

    for (const line of lines) {
      const m = line.match(rowRe);
      if (!m) continue;
      const [, ticker, name, qtyStr, priceStr, totalStr] = m;
      assets.push({
        ticker,
        isin: extractISIN(text, ticker),
        asset_type: 'equity',
        asset_name: name.trim(),
        quantity: parseNumber(qtyStr),
        avg_price: parseNumber(priceStr),
        current_value: parseNumber(totalStr),
        purchase_date: null,
        broker: 'XP',
        confidence: 'high',
        raw_text: line.trim(),
      });
    }

    // Also look for fixed income / debentures
    const fiRe = /([A-Z]{2}[A-Z0-9]{10})\s+(.+?)\s+([\d.,]+)/g;
    let fm;
    while ((fm = fiRe.exec(text)) !== null) {
      const [, isin, name, totalStr] = fm;
      if (assets.find(a => a.isin === isin)) continue;
      assets.push({
        ticker: null,
        isin,
        asset_type: isin.startsWith('BR') ? 'credit' : 'treasury',
        asset_name: name.trim(),
        quantity: null,
        avg_price: null,
        current_value: parseNumber(totalStr),
        purchase_date: null,
        broker: 'XP',
        confidence: 'medium',
        raw_text: fm[0].trim(),
      });
    }

    return assets;
  }

  // ── BTG statement parser ─────────────────────────────────

  function parseBTG(text) {
    const assets = [];
    const lines = text.split('\n');

    // BTG Pactual extrato: similar table structure but different column order
    const rowRe = /([A-Z]{4}\d{1,2})\s+(.+?)\s+([\d.]+)\s+([\d.,]+)\s+([\d.,]+)/;

    for (const line of lines) {
      const m = line.match(rowRe);
      if (!m) continue;
      assets.push({
        ticker: m[1],
        isin: extractISIN(text, m[1]),
        asset_type: 'equity',
        asset_name: m[2].trim(),
        quantity: parseNumber(m[3]),
        avg_price: parseNumber(m[4]),
        current_value: parseNumber(m[5]),
        purchase_date: null,
        broker: 'BTG',
        confidence: 'high',
        raw_text: line.trim(),
      });
    }
    return assets;
  }

  // ── Generic parser (fallback) ────────────────────────────

  function parseGeneric(text, broker) {
    const assets = [];
    const seen = new Set();

    // Extract all tickers
    let m;
    TICKER_RE.lastIndex = 0;
    while ((m = TICKER_RE.exec(text)) !== null) {
      const ticker = m[1];
      if (seen.has(ticker)) continue;
      // Skip common false positives
      if (['CNPJ', 'ISIN', 'DATA', 'TIPO', 'NOME'].includes(ticker)) continue;
      seen.add(ticker);

      // Try to extract context around the ticker (±100 chars)
      const ctx = text.slice(Math.max(0, m.index - 30), m.index + 100);
      const nums = ctx.match(/[\d.,]+/g) || [];
      const qty = nums.find(n => parseNumber(n) >= 1 && parseNumber(n) <= 1000000);
      const price = nums.find(n => { const v = parseNumber(n); return v >= 1 && v <= 100000 && v !== parseNumber(qty); });

      assets.push({
        ticker,
        isin: extractISIN(text, ticker),
        asset_type: 'equity',
        asset_name: ticker,
        quantity: qty ? parseNumber(qty) : null,
        avg_price: price ? parseNumber(price) : null,
        current_value: null,
        purchase_date: null,
        broker,
        confidence: qty && price ? 'medium' : 'low',
        raw_text: ctx.trim(),
      });
    }

    // Extract ISINs not yet captured
    ISIN_RE.lastIndex = 0;
    while ((m = ISIN_RE.exec(text)) !== null) {
      const isin = m[1];
      if (assets.find(a => a.isin === isin)) continue;
      const ctx = text.slice(Math.max(0, m.index - 30), m.index + 100);
      assets.push({
        ticker: null,
        isin,
        asset_type: 'credit',
        asset_name: isin,
        quantity: null,
        avg_price: null,
        current_value: null,
        purchase_date: null,
        broker,
        confidence: 'low',
        raw_text: ctx.trim(),
      });
    }

    return assets;
  }

  // ── Helpers ──────────────────────────────────────────────

  function parseNumber(s) {
    if (!s) return null;
    // Handle Brazilian number format (1.234,56 → 1234.56)
    const clean = String(s).replace(/\./g, '').replace(',', '.');
    const n = parseFloat(clean);
    return isNaN(n) ? null : n;
  }

  function extractISIN(text, ticker) {
    const idx = text.indexOf(ticker);
    if (idx === -1) return null;
    const ctx = text.slice(Math.max(0, idx - 50), idx + 200);
    const m = ctx.match(/\b(BR[A-Z0-9]{10})\b/);
    return m ? m[1] : null;
  }

  // ── XP International (USD) statement parser ──────────────

  function parseXPInternacional(text) {
    const assets = [];
    const lines = text.split('\n');

    // XP International (Avenue-style): US equities with USD amounts
    // Format: AAPL  Apple Inc  10  150.25  1,502.50  USD
    const rowRe = /([A-Z]{1,5})\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s+([\d.,]+)\s+([\d.,]+)\s+USD/i;

    for (const line of lines) {
      const m = line.match(rowRe);
      if (!m) continue;
      assets.push({
        ticker: m[1],
        isin: null,
        asset_type: 'equity',
        asset_name: m[2].trim(),
        quantity: parseNumber(m[3]),
        avg_price: parseNumber(m[4]),
        current_value: parseNumber(m[5]),
        currency: 'USD',
        purchase_date: null,
        broker: 'XP Internacional',
        confidence: 'high',
        raw_text: line.trim(),
      });
    }
    return assets;
  }

  // ── Main parse function ──────────────────────────────────

  async function extractTextFromPDF(file) {
    console.log('[FA:pdf] extracting text from', file.name);
    // Uses PDF.js (must be loaded in page)
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js não está carregado. Adicione o script ao index.html.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      text += pageText + '\n';
    }
    console.log('[FA:pdf] extracted', text.length, 'chars from', pdf.numPages, 'pages');
    return text;
  }

  async function parse(file) {
    console.log('[FA:pdf] parsing statement:', file.name);
    let text;
    try {
      text = await extractTextFromPDF(file);
    } catch (e) {
      console.error('[FA:pdf] text extraction failed:', e.message);
      return { error: e.message, assets: [] };
    }

    const broker = detectBroker(text);
    console.log('[FA:pdf] detected broker:', broker);

    let assets;
    switch (broker) {
      case 'XP':
      case 'Rico':
        assets = parseXP(text);
        break;
      case 'BTG':
        assets = parseBTG(text);
        break;
      case 'XP Internacional':
      case 'Avenue':
        assets = parseXPInternacional(text);
        break;
      default:
        assets = parseGeneric(text, broker);
    }

    // Deduplicate by ticker+isin
    const seen = new Set();
    const unique = assets.filter(a => {
      const key = (a.ticker || '') + (a.isin || '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[FA:pdf] found ${unique.length} assets (${assets.length} raw) from ${broker}`);
    return { broker, assets: unique, rawText: text };
  }

  return { parse, detectBroker, extractTextFromPDF };
})();
