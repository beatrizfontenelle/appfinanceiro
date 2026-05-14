// api/claude.js — Vercel serverless function
// Proxy for Anthropic Claude API (keeps API key server-side)
//
// Two modes:
//   POST { prompt, maxTokens, webSearch }          → single-turn (Fundamentalist Agent)
//   POST { messages, system, maxTokens, stream }   → multi-turn chat (Advisor Agent)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

  const { prompt, messages, system, maxTokens = 1500, webSearch = false, stream = false } = req.body || {};

  // Validate: need either prompt (single-turn) or messages (multi-turn)
  if (!prompt && !messages?.length) {
    return res.status(400).json({ error: 'prompt or messages required' });
  }

  try {
    const tools = webSearch ? [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }] : undefined;

    const body = {
      model: 'claude-opus-4-5',
      max_tokens: Math.min(maxTokens, 4096),
      messages: messages || [{ role: 'user', content: prompt }],
      ...(system ? { system } : {}),
      ...(tools ? { tools } : {}),
      ...(stream ? { stream: true } : {}),
    };

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      ...(webSearch ? { 'anthropic-beta': 'web-search-2025-03-05' } : {}),
    };

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('[claude proxy] API error:', r.status, err);
      return res.status(r.status).json({ error: err });
    }

    // ── Streaming mode (for chat) ─────────────────────────
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = r.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
      return res.end();
    }

    // ── Non-streaming mode ────────────────────────────────
    const data = await r.json();
    const textBlock = data.content?.find(b => b.type === 'text');
    const content = textBlock?.text || null;

    return res.status(200).json({ content, usage: data.usage });

  } catch (e) {
    console.error('[claude proxy] error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
