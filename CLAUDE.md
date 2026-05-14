# App Financeiro Pessoal — Bia

## Visão geral
Dashboard financeiro pessoal que evolui para um assessor de wealth management completo com IA. Objetivo final: recomendações personalizadas, alertas e relatórios em linguagem natural.

---

## Stack atual
| Camada | Tecnologia | Motivo da escolha |
|--------|-----------|-------------------|
| Frontend | HTML/CSS/JS puro | Zero dependências, deploy imediato no Vercel |
| Banco/cache | Supabase (PostgreSQL) | Cache diário gratuito, settings persistentes |
| Open Finance | Pluggy API | Único provedor BR com cobertura XP + PicPay |
| Cotações/histórico | Yahoo Finance v8 + proxy Vercel | Gratuito, 1 ano de história, sem chave de API |
| Benchmarks | Yahoo Finance (^BVSP, ^GSPC) + BrasilAPI (CDI) | CDI dinâmico real, sem CORS |
| Câmbio | AwesomeAPI (USD-BRL) | Gratuito, CORS liberado |
| IA | Anthropic Claude API via `api/claude.js` | Assessora IA com contexto da carteira |
| Deploy | GitHub (`main`) → Vercel automático | Push = deploy |

### Por que Yahoo Finance e não Brapi?
- Brapi: requer token, plano gratuito limita a 1 ticker/request e 3 meses de histórico sem dividendos
- Yahoo Finance: gratuito, 1 ano de histórico completo, sem limite de tickers
- **CORS**: Yahoo Finance bloqueia requests do browser → solução: `api/yahoo.js` (Vercel serverless function que faz o request server-side)

---

## Arquitetura: Tasks vs Agentes

### Tasks (funções isoladas, sem estado próprio)
Cada task faz uma coisa só e é reutilizável independentemente:

| Arquivo | Responsabilidade |
|---------|-----------------|
| `js/tasks/cache.js` | CRUD Supabase + validação/save/load do cache diário |
| `js/tasks/settings.js` | Carregar e salvar configurações do usuário (USD, custo médio) |
| `js/tasks/banking.js` | Pluggy: autenticação, contas, transações, investimentos |
| `js/tasks/market.js` | Yahoo Finance: cotações + histórico 1y para ações BR |
| `js/tasks/benchmarks.js` | Ibovespa, S&P 500, CDI (BrasilAPI), câmbio USD/BRL |
| `js/tasks/calculations.js` | Matemática financeira: TWR, retornos por período, helpers de preço |
| `js/tasks/merchants.js` | Reconhecimento de estabelecimentos + categorias PT |

### Agentes (sistemas com lógica de orquestração)
| Arquivo | Responsabilidade |
|---------|-----------------|
| `js/agents/data-agent.js` | Orquestra toda a coleta de dados: decide cache vs fresh, chama tasks em sequência, salva resultado |
| `js/agents/advisor/agent.js` | Assessora IA: chat multi-turn com contexto completo da carteira via Claude API |

### Agentes futuros (a implementar progressivamente)
| Agente | Descrição |
|--------|-----------|
| `analysis-agent.js` | Calcula métricas avançadas: volatilidade, correlação, risco, Sharpe ratio |
| `alerts-agent.js` | Monitora variações e dispara notificações via Cowork |
| `reports-agent.js` | Gera resumo diário e envia por email via Cowork |

---

## Estrutura de arquivos
```
appfinanceiro/
├── api/
│   ├── yahoo.js              ← Vercel serverless: proxy Yahoo Finance (resolve CORS)
│   └── claude.js             ← Vercel serverless: proxy Anthropic Claude API (Assessora IA)
├── css/
│   └── style.css
├── js/
│   ├── config.js             ← Constantes, estado global, helpers utilitários
│   ├── tasks/
│   │   ├── cache.js          ← Supabase CRUD + cache diário
│   │   ├── settings.js       ← Configurações do usuário
│   │   ├── banking.js        ← Pluggy (contas, transações, investimentos)
│   │   ├── market.js         ← Yahoo Finance (cotações + histórico)
│   │   ├── benchmarks.js     ← BVSP, GSPC, CDI, USD/BRL
│   │   ├── calculations.js   ← TWR, retornos, helpers de preço
│   │   └── merchants.js      ← Reconhecimento de estabelecimentos + categorias PT
│   ├── agents/
│   │   ├── data-agent.js     ← Orquestra toda coleta e cache
│   │   └── advisor/
│   │       └── agent.js      ← Assessora IA: chat com contexto da carteira
│   ├── charts.js             ← Wrappers Chart.js
│   ├── render.js             ← Renderização de todas as seções
│   └── app.js                ← Navegação + bootstrap + UI da Assessora IA
├── index.html
├── vercel.json
└── CLAUDE.md
```

---

## Assessora IA (`js/agents/advisor/agent.js`)
- Chat multi-turn em linguagem natural via Claude API (`claude-opus-4-5`)
- System prompt construído em tempo real com patrimônio, posições, benchmarks e gastos
- Mantém histórico da conversa na sessão
- Variável de ambiente necessária: `ANTHROPIC_API_KEY` no Vercel
- UI: seção "Assessora IA" no dashboard com interface de chat

---

## Matemática financeira

### Rentabilidade por período (1m, 3m, 6m, 12m)
```
retorno = (preço_atual - preço_há_N_dias) / preço_há_N_dias × 100
```
- Fonte do preço histórico: Yahoo Finance `adjclose` (ajustado por splits/dividendos)
- `hprice(code, daysAgo)`: busca último fechamento disponível antes de N dias atrás

### TWR — Time-Weighted Return ("desde compra")
```
retorno = (preço_atual - preço_na_data_de_compra) / preço_na_data_de_compra × 100
```
- `hpriceAt(code, dateStr)`: busca primeiro fechamento disponível na ou após a data de compra
- Data de compra: campo `i.date` do Pluggy (data da posição de renda variável)
- Limitação: só funciona para compras feitas nos últimos 12 meses (1 ano de histórico disponível)

### CDI acumulado por período
```
CDI_período = CDI_anual / 365 × dias  (linear, aproximação conservadora)
```
- Taxa CDI: BrasilAPI em tempo real (não mais valor fixo hardcoded)
- No gráfico comparativo: CDI calculado com capitalização composta diária (252 dias úteis)

### Benchmarks normalizados
- No gráfico comparativo, todos os benchmarks são normalizados a 0% no início do período para comparação justa

---

## Cache inteligente
- Chave: `cache_market` (Supabase) — salva `BD` (cotações + histórico de todos os tickers)
- Válido por: 1 dia calendario (fuso America/Sao_Paulo)
- No primeiro acesso do dia: busca dados frescos → salva no Supabase → próximas visitas carregam do cache
- `forceReload()`: limpa tudo e rebusca independente do cache

---

## Perfil da usuária
- Investidora pessoa física, Brasil
- Corretora principal: XP Investimentos
- Conta secundária: PicPay
- Conta internacional: XP International (USD)
- Ativos: ações brasileiras (BBDC3, AURE3, CSAN3, ITSA4, BBAS3, TIMS3, PETR4, AERI3), LFTs, CDB, fundo de investimento
- Não tem conhecimento técnico — toda comunicação em português claro

---

## Funcionalidades existentes
- [x] Patrimônio total: contas + investimentos + conta internacional USD convertida
- [x] Carteira completa com preços de mercado (Yahoo Finance)
- [x] Rentabilidade por período (1m, 3m, 6m, 12m) vs Ibovespa, S&P 500, CDI
- [x] TWR "desde compra" usando preço histórico na data de compra
- [x] CDI dinâmico real via BrasilAPI
- [x] Extrato e categorias de gastos (Open Finance)
- [x] Evolução patrimonial reconstruída via transações
- [x] Alocação por classe e por ativo
- [x] Custo médio manual com cálculo de ganho/perda real
- [x] Cache diário no Supabase
- [x] Console.log detalhado com prefixos [cache], [banking], [market], etc.
- [x] Reconhecimento de estabelecimentos (iFood, Uber, Netflix, etc.) e categorias em português
- [x] Classificação de transações: EXPENSE / INCOME / INVESTMENT / TRANSFER
- [x] Evolução patrimonial real (RV × preço histórico + RF back-calc CDI + conta + USD)
- [x] Cross-check de proventos Yahoo Finance × conta bancária Pluggy
- [x] Assessora IA: chat em linguagem natural com contexto completo da carteira

---

## Roadmap — próximas funcionalidades (em ordem de prioridade)
1. **Perfil de investidor** (suitability): prazo, objetivos, tolerância a risco — alimenta recomendações da assessora
2. **Relatório diário por email** (`reports-agent.js` via Cowork/scheduled tasks): resumo da carteira, variações do dia, alertas
3. **Alertas de variação** (`alerts-agent.js`): notifica quando ativo sobe/cai X%
4. **Rentabilidade de títulos americanos**: conta XP International
5. **Planejamento tributário**: isenção IR renda variável (vendas < R$20k/mês)
6. **Simulador de aposentadoria**: projeção com aportes + taxa de retorno esperada

---

## Princípios de desenvolvimento
- Cada task é testável de forma independente (console.log no início e fim de cada função)
- Agentes orquestram tasks, nunca fazem fetch direto
- Cache inteligente: dados frescos uma vez por dia, Supabase nas demais visitas
- Fontes de dados com fallback gracioso (ex: CDI cai para 14.75% se BrasilAPI falhar)
- Zero dependências além de Supabase e Chart.js (já no CDN)
- Deploy: push para `main` → Vercel deploya automaticamente
