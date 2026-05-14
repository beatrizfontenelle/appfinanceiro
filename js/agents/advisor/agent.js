// ── Agente Assessor ───────────────────────────────────────
// Chat em linguagem natural com conhecimento completo da carteira.
// Usa Claude API via /api/claude. Mantém histórico da conversa.
// Delega análise fundamentalista ao FA quando identificar intenção.

window.Advisor = (function () {

  // Histórico de mensagens da conversa (formato Anthropic)
  let history = [];

  // ── Intenções que disparam o Agente Fundamentalista ──────
  const FA_INTENTS = [
    /analisa[r]?\s+([A-Z]{4}\d{1,2})/i,
    /avalia[r]?\s+([A-Z]{4}\d{1,2})/i,
    /o que (?:você|vc) acha d[eo]\s+([A-Z]{4}\d{1,2})/i,
    /valuation\s+([A-Z]{4}\d{1,2})/i,
    /tese d[eo]\s+([A-Z]{4}\d{1,2})/i,
    /preço alvo\s+([A-Z]{4}\d{1,2})/i,
    /fundamentalista\s+([A-Z]{4}\d{1,2})/i,
  ];

  function detectFAIntent(msg) {
    for (const re of FA_INTENTS) {
      const m = msg.match(re);
      if (m) return m[1].toUpperCase();
    }
    return null;
  }

  // ── Monta o contexto da carteira para o system prompt ────

  function buildPortfolioContext() {
    const lines = [];

    // Total patrimônio
    const totalRV = investments.filter(isRV).reduce((s, i) => {
      const p = bprice(i.code) || i.value || 0;
      const qty = i.quantity || 1;
      return s + (i.code ? p * qty : i.value || 0);
    }, 0);
    const totalRF = investments.filter(i => !isRV(i)).reduce((s, i) => s + (i.value || 0), 0);
    const totalContas = accounts.reduce((s, a) => s + (a.balance || 0), 0);
    const totalIntl = intBrl();
    const total = totalRV + totalRF + totalContas + totalIntl;

    lines.push(`PATRIMÔNIO TOTAL: R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits:2})}`);
    lines.push(`  Renda variável: R$ ${totalRV.toLocaleString('pt-BR', {minimumFractionDigits:2})}`);
    lines.push(`  Renda fixa:     R$ ${totalRF.toLocaleString('pt-BR', {minimumFractionDigits:2})}`);
    lines.push(`  Contas:         R$ ${totalContas.toLocaleString('pt-BR', {minimumFractionDigits:2})}`);
    lines.push(`  Internacional:  R$ ${totalIntl.toLocaleString('pt-BR', {minimumFractionDigits:2})} (USD ${(cfg.int_usd||0).toFixed(2)} × ${(usdRate||0).toFixed(2)})`);

    // Carteira RV
    const rv = investments.filter(isRV).filter(i => i.code);
    if (rv.length) {
      lines.push('\nCARTEIRA — RENDA VARIÁVEL:');
      rv.forEach(i => {
        const cur = bprice(i.code);
        const val = cur && i.quantity ? cur * i.quantity : (i.value || 0);
        const pm = cfg.precos?.[i.id];
        const ret = pm && cur ? ((cur - pm) / pm * 100).toFixed(1) + '%' : '—';
        lines.push(`  ${i.code}: ${i.quantity || '?'} cotas × R$ ${cur ? cur.toFixed(2) : '?'} = R$ ${val.toLocaleString('pt-BR', {minimumFractionDigits:2})} | PM: ${pm ? 'R$ '+pm.toFixed(2) : '?'} | retorno PM: ${ret}`);
      });
    }

    // Renda Fixa
    const rf = investments.filter(i => !isRV(i));
    if (rf.length) {
      lines.push('\nCARTEIRA — RENDA FIXA:');
      rf.forEach(i => {
        lines.push(`  ${i.name || i.code || 'sem nome'} (${i.subtype || i.type}): R$ ${(i.value||0).toLocaleString('pt-BR', {minimumFractionDigits:2})}${i.annualRate ? ' @ '+i.annualRate.toFixed(1)+'% a.a.' : ''}`);
      });
    }

    // Contas
    if (accounts.length) {
      lines.push('\nCONTAS BANCÁRIAS:');
      accounts.forEach(a => {
        lines.push(`  ${a.name || a.institution?.name || 'conta'}: R$ ${(a.balance||0).toLocaleString('pt-BR', {minimumFractionDigits:2})}`);
      });
    }

    // Benchmarks recentes
    const cdiR = BM.CDI?.rate || 14.75;
    const ibovRet = (() => {
      const h = BM.BVSP?.history;
      if (!h?.length) return null;
      const cur = h[h.length-1]?.close, mo = h[h.length-22]?.close;
      return mo ? ((cur-mo)/mo*100).toFixed(1)+'%' : null;
    })();
    lines.push(`\nBENCHMARKS: CDI ${cdiR.toFixed(2)}% a.a.${ibovRet ? ' | Ibovespa 1m: '+ibovRet : ''} | USD/BRL: ${(usdRate||0).toFixed(2)}`);

    // Gastos recentes (resumo)
    const now = Date.now();
    const recentTx = txAll.filter(t => {
      const d = new Date(t.date); return (now - d) / 86400000 <= 30;
    });
    if (recentTx.length) {
      const gastos = recentTx.filter(t => classifyTx(t) === 'EXPENSE');
      const totalGastos = gastos.reduce((s, t) => s + Math.abs(t.amount||0), 0);
      lines.push(`\nGASTOS ÚLTIMOS 30 DIAS: R$ ${totalGastos.toLocaleString('pt-BR', {minimumFractionDigits:2})} (${gastos.length} transações)`);
    }

    return lines.join('\n');
  }

  function buildSystemPrompt() {
    const today = new Date().toLocaleDateString('pt-BR', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    const portfolio = buildPortfolioContext();

    return `Você é a assessora financeira pessoal da Beatriz (Bia), uma investidora brasileira. Seu nome é "Bia Assessora".

DATA DE HOJE: ${today}

DADOS DA CARTEIRA (atualizados agora):
${portfolio}

SUAS RESPONSABILIDADES:
- Responder perguntas sobre a carteira da Bia em português claro e direto
- Explicar rentabilidades, comparar com benchmarks, analisar concentração
- Sugerir rebalanceamentos quando fizer sentido
- Calcular projeções simples (ex: "quanto terei em X anos com Y% a.a.")
- Alertar sobre riscos de concentração ou alocação
- Para análise fundamentalista profunda de um ativo específico (DRE, múltiplos, preço alvo), avisar que vai acionar o Agente Fundamentalista

ESTILO:
- Português brasileiro direto e objetivo
- Sem jargão desnecessário — Bia não tem conhecimento técnico profundo
- Use R$ formatado, porcentagens com 1 casa decimal
- Seja honesta quando não tiver certeza
- Respostas curtas e claras para perguntas simples; mais detalhadas quando a pergunta pedir`;
  }

  // ── Envia mensagem e recebe resposta ─────────────────────

  async function chat(userMessage, onChunk = null) {
    // Checa intenção fundamentalista
    const faTicker = detectFAIntent(userMessage);

    // Adiciona ao histórico
    history.push({ role: 'user', content: userMessage });

    // Se intenção FA detectada, avisa e delega
    if (faTicker) {
      const notice = `Vou acionar o Agente Fundamentalista para analisar ${faTicker} em profundidade...`;
      if (onChunk) onChunk(notice, false);

      // Busca análise
      let faResult;
      try {
        faResult = await FA.analyzeAsset(faTicker, {
          onProgress: msg => { if (onChunk) onChunk('_progress:' + msg, false); }
        });
      } catch (e) {
        faResult = { error: e.message };
      }

      // Monta resposta contextualizando o resultado
      let summaryPrompt;
      if (faResult?.error) {
        summaryPrompt = `O Agente Fundamentalista tentou analisar ${faTicker} mas encontrou um erro: ${faResult.error}. Responda a Bia de forma natural explicando isso.`;
      } else {
        const a = faResult.analysis || faResult.memory;
        summaryPrompt = `O Agente Fundamentalista acabou de analisar ${faTicker} e retornou: ${JSON.stringify(a, null, 2).slice(0, 3000)}.
Resuma isso para a Bia em português claro: rating, tese principal, principais riscos e oportunidades, e preço alvo se houver. Seja direta e objetiva.`;
      }

      history[history.length - 1].content = summaryPrompt;
    }

    // Chama Claude API
    try {
      const body = {
        system: buildSystemPrompt(),
        messages: history,
        maxTokens: 1000,
        stream: !!onChunk,
      };

      const r = await fetch('/api/claude', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const err = await r.text();
        throw new Error('API error ' + r.status + ': ' + err);
      }

      let assistantMessage = '';

      if (onChunk && r.headers.get('content-type')?.includes('text/event-stream')) {
        // Streaming response
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'content_block_delta') {
                  const text = data.delta?.text || '';
                  assistantMessage += text;
                  onChunk(text, false);
                } else if (data.type === 'message_stop') {
                  onChunk('', true);
                }
              } catch {}
            }
          }
        }
      } else {
        // Non-streaming
        const d = await r.json();
        assistantMessage = d.content || '';
        if (onChunk) onChunk(assistantMessage, true);
      }

      // Salva resposta no histórico
      if (assistantMessage) {
        history.push({ role: 'assistant', content: assistantMessage });
      }

      return assistantMessage;
    } catch (e) {
      console.error('[Advisor] chat error:', e.message);
      const errMsg = 'Desculpa, tive um problema para me conectar. Tenta de novo? (' + e.message + ')';
      history.push({ role: 'assistant', content: errMsg });
      if (onChunk) onChunk(errMsg, true);
      return errMsg;
    }
  }

  function clearHistory() {
    history = [];
    console.log('[Advisor] history cleared');
  }

  function getHistory() { return [...history]; }

  return { chat, clearHistory, getHistory, buildPortfolioContext };
})();
