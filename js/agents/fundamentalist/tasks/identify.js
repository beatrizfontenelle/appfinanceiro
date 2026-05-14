// ── Fundamentalist Agent — Task: identify ────────────────
// Resolves a ticker, name, or ISIN to a canonical asset object.
// Returns: { ticker, isin, cnpj, name, type, exchange, sector }

window.FA = window.FA || {};
window.FA.tasks = window.FA.tasks || {};

FA.tasks.identify = (function () {

  // Known ISIN → ticker map (expandable)
  const ISIN_MAP = {
    'BRVALEACNOR0': 'VALE3', 'BRPETRACNPR6': 'PETR4', 'BRBBASACNOR3': 'BBAS3',
    'BRIBBRACNPR2': 'BBDC3', 'BRAURECNOR8':  'AURE3', 'BRCSANCNOR9':  'CSAN3',
    'BRITSAACNPR7': 'ITSA4', 'BRTIMSBCNOR5': 'TIMS3', 'BRAERICNOR7':  'AERI3',
  };

  // Debenture ISIN prefix → credit type
  const DEBENTURE_PREFIXES = /^BR[A-Z]{4}(14|12|11|22)[A-Z]\d$/;

  // Well-known sector map for major BR tickers
  const SECTOR_MAP = {
    PETR4: 'Petróleo & Gás', PETR3: 'Petróleo & Gás',
    VALE3: 'Mineração',
    BBAS3: 'Bancos', BBDC3: 'Bancos', BBDC4: 'Bancos', ITSA4: 'Bancos',
    CSAN3: 'Energia & Combustíveis',
    AURE3: 'Energia Elétrica',
    TIMS3: 'Telecomunicações',
    AERI3: 'Transporte Aéreo',
  };

  function detectType(identifier) {
    // ISIN: 12 chars, starts with 2 letters
    if (/^[A-Z]{2}[A-Z0-9]{10}$/.test(identifier)) {
      // Debênture ISINs typically start with country code + 4-char issuer + type digits
      if (DEBENTURE_PREFIXES.test(identifier)) return 'credit';
      if (ISIN_MAP[identifier]) return 'equity';
      return 'credit'; // Unknown ISIN → assume credit
    }
    // BR ticker: 4 letters + 1-2 digits
    if (/^[A-Z]{4}\d{1,2}$/.test(identifier)) return 'equity';
    return 'equity'; // default
  }

  async function fromDadosDeMercado(ticker) {
    try {
      const url = `https://dadosdemercado.com.br/api/v1/companies/${ticker}`;
      const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!r.ok) return null;
      const d = await r.json();
      console.log('[FA:identify] dadosdemercado company hit for', ticker);
      return {
        ticker,
        isin: d.isin || null,
        cnpj: d.cnpj || null,
        name: d.name || d.longName || ticker,
        type: 'equity',
        exchange: 'B3',
        sector: d.sector || SECTOR_MAP[ticker] || null,
      };
    } catch (e) {
      console.warn('[FA:identify] dadosdemercado error:', e.message);
      return null;
    }
  }

  async function fromYahoo(ticker) {
    // Use existing proxy
    try {
      const sym = ticker.includes('.') ? ticker : ticker + '.SA';
      const url = `/api/yahoo?symbol=${sym}&range=1d&interval=1d`;
      const r = await fetch(url);
      if (!r.ok) return null;
      const d = await r.json();
      const meta = d.chart?.result?.[0]?.meta;
      if (!meta) return null;
      console.log('[FA:identify] yahoo hit for', ticker);
      return {
        ticker,
        isin: null,
        cnpj: null,
        name: meta.longName || meta.shortName || ticker,
        type: 'equity',
        exchange: meta.exchangeName || 'B3',
        sector: SECTOR_MAP[ticker] || null,
      };
    } catch (e) {
      console.warn('[FA:identify] yahoo error:', e.message);
      return null;
    }
  }

  async function resolve(identifier) {
    console.log('[FA:identify] resolving:', identifier);
    identifier = identifier.trim().toUpperCase();

    // Direct ISIN lookup
    if (/^[A-Z]{2}[A-Z0-9]{10}$/.test(identifier)) {
      const ticker = ISIN_MAP[identifier];
      if (ticker) identifier = ticker;
      else {
        // Return minimal credit asset for unknown ISIN
        return {
          ticker: null, isin: identifier, cnpj: null,
          name: identifier, type: 'credit', exchange: null, sector: null,
        };
      }
    }

    const type = detectType(identifier);
    if (type === 'credit') {
      return { ticker: null, isin: identifier, cnpj: null, name: identifier, type: 'credit', exchange: null, sector: null };
    }

    // Try Dados de Mercado first, then Yahoo
    const asset = (await fromDadosDeMercado(identifier)) || (await fromYahoo(identifier));
    if (asset) return asset;

    // Fallback minimal object
    console.warn('[FA:identify] fallback minimal object for', identifier);
    return {
      ticker: identifier, isin: null, cnpj: null,
      name: identifier, type: 'equity', exchange: 'B3',
      sector: SECTOR_MAP[identifier] || null,
    };
  }

  return { resolve };
})();
