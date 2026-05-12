// ── Pluggy authentication ─────────────────────────────────
async function plAuth() {
  if (plKey) return plKey;
  console.log('[banking] authenticating Pluggy...');
  const r = await fetch(`${PL_BASE}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: PL_ID, clientSecret: PL_SEC })
  });
  const d = await r.json();
  if (!d.apiKey) throw new Error('Pluggy auth failed: ' + JSON.stringify(d));
  plKey = d.apiKey;
  console.log('[banking] Pluggy auth ok');
  return plKey;
}

async function plF(path) {
  const k = await plAuth();
  const r = await fetch(`${PL_BASE}${path}`, { headers: { 'X-API-KEY': k } });
  if (!r.ok) { console.warn('[banking] plF error', r.status, path); }
  return r.json();
}

// ── Fetch bank accounts ───────────────────────────────────
async function fetchAccounts() {
  console.log('[banking] fetching accounts for items:', ITEMS);
  const results = await Promise.all(ITEMS.map(id => plF(`/accounts?itemId=${id}`)));
  accounts = results.flatMap(a => a.results || []);
  console.log('[banking] accounts:', accounts.length, accounts.map(a => a.name + ' ' + a.balance));
}

// ── Fetch transactions ────────────────────────────────────
async function fetchTransactions() {
  console.log('[banking] fetching transactions for', accounts.length, 'accounts...');
  const results = await Promise.all(
    accounts.map(a => plF(`/transactions?accountId=${a.id}&pageSize=500`).then(d => d.results || []))
  );
  txAll = results.flat().sort((a, b) => new Date(b.date) - new Date(a.date));
  console.log('[banking] transactions:', txAll.length);
}

// ── Fetch investment portfolio ────────────────────────────
async function fetchInvestments() {
  console.log('[banking] fetching investments for items:', ITEMS);
  const results = await Promise.all(ITEMS.map(id => plF(`/investments?itemId=${id}`)));
  investments = results.flatMap(a => a.results || []);
  console.log('[banking] investments:', investments.length, investments.map(i => (i.code || i.name) + '(' + i.type + ')'));
}
