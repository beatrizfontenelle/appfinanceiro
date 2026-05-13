export default async function handler(req, res) {
  const { symbol, range = '1y', interval = '1d', events = '' } = req.query;
  if (!symbol) { res.status(400).json({ error: 'symbol required' }); return; }
  const evParam = events ? `&events=${encodeURIComponent(events)}` : '';
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}${evParam}`;
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    });
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
