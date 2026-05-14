# App Financeiro Pessoal — Bia

## Visão geral
Dashboard financeiro pessoal que evolui para um assessor de wealth management completo com IA. Objetivo final: análise fundamentalista automatizada, recomendações personalizadas e relatórios em linguagem natural.

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

### Agentes (sistemas com lógica de orquestração)
Agentes coordenam múltiplas tasks para atingir um objetivo:

| Arquivo | Responsabilidade |
|---------|-----------------|
| `js/agents/data-agent.js` | Orquestra toda a coleta de dados: decide cache vs fresh, chama tasks em sequência, salva resultado |

### Agentes implementados
| Arquivo | Responsabilidade |
|---------|-----------------|
| `js/agents/data-agent.js` | Orquestra toda a coleta de dados |
| `js/agents/fundamentalist/agent.js` | **Agente Fundamentalista** — análise equity + crédito via Claude API |

### Agentes futuros (a implementar progressivamente)
| Agente | Descrição |
|--------|-----------|
| `analysis-agent.js` | Calcula métricas avançadas: volatilidade, correlação, risco, Sharpe ratio |
| `advisor-agent.js` | Chat em linguagem natural com conhecimento completo da carteira (Claude API) |
| `alerts-agent.js` | Monitora variações e dispara notificações via Cowork |
| `reports-agent.js` | Gera resumo diário e envia por email via Cowork |

---

## Estrutura de arquivos
```
appfinanceiro/
├── api/
│   ├── yahoo.js              ← Vercel serverless: proxy Yahoo Finance (resolve CORS)
│   └── claude.js             ← Vercel serverless: proxy Anthropic Claude API
├── supabase/
│   └── migrations/
│       └── 20260514_001_fundamentalist_tables.sql  ← 4 tabelas do Agente Fundamentalista
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
│   │   └── fundamentalist/
│   │       ├── agent.js      ← Orquestrador: FA.analyzeAsset(), FA.analyzePDF(), FA.analyzePortfolio()
│   │       ├── modes/
│   │       │   ├── equity.js ← Análise de ações (DRE + múltiplos + setor + Claude)
│   │       │   └── credit.js ← Análise de crédito privado (escritura + covenants + Claude)
│   │       ├── memory/
│   │       │   └── store.js  ← CRUD asset_memory + avaliação de track record
│   │       ├── parsers/
│   │       │   └── pdf-statement.js  ← Parser de extrato de corretora (XP, BTG, Itaú, genérico)
│   │       └── tasks/
│   │           ├── identify.js       ← Resolve ticker/ISIN → objeto asset canônico
│   │           ├── cache.js          ← TTL wrapper para asset_cache no Supabase
│   │           ├── prices.js         ← Histórico de preços acumulativo (asset_prices)
│   │           ├── financials-cvm.js ← DRE + Balanço + DFC via Dados de Mercado / CVM
│   │           ├── indicators.js     ← P/L, ROE, DY, etc. via Dados de Mercado
│   │           ├── debenture-data.js ← Escritura + covenants + ANBIMA
│   │           ├── sector.js         ← Análise setorial via Claude + web_search
│   │           └── news.js           ← Notícias e fatos relevantes via Claude + web_search
│   ├── charts.js             ← Wrappers Chart.js
│   ├── render.js             ← Renderização de todas as seções
│   └── app.js                ← Navegação + bootstrap + UI do Agente Fundamentalista
├── index.html
├── vercel.json
└── CLAUDE.md
```

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

## Agente Fundamentalista

### Dois modos de análise
| Modo | Arquivo | Ativos |
|------|---------|--------|
| Equity | `modes/equity.js` | Ações brasileiras (PETR4, VALE3, etc.) |
| Credit | `modes/credit.js` | Debêntures, CRI, CRA, FIDC |

### Três formas de entrada
1. **Via ticker/ISIN direto**: `FA.analyzeAsset('PETR4')` — identifica automaticamente
2. **Via PDF**: `FA.analyzePDF(file)` — extrai ativos do extrato de corretora
3. **Via carteira Pluggy**: `FA.analyzePortfolio()` — analisa todos os ativos do Open Finance

### Memória por ativo (não por investidor)
- Tabela `asset_memory`: guarda tese, rating, métricas-chave, riscos, oportunidades
- Versioned: cada re-análise adiciona uma nova linha (nunca sobrescreve)
- Compartilhada: mesma empresa analisada por perfis diferentes usa a mesma memória
- TTL da memória: 90 dias — análise mais antiga que 90 dias aciona re-análise automática

### 4 tabelas Supabase
| Tabela | Propósito |
|--------|-----------|
| `asset_prices` | Série histórica de preços — nunca deletar, só acumular |
| `asset_cache` | Dados fundamentais com TTL (DRE, balanço, indicadores, escritura, notícias) |
| `asset_memory` | Análises geradas pelo agente (tese, rating, métricas) — versionada |
| `asset_track_record` | Previsões vs resultados reais (preço alvo × preço realizado) |

### TTLs do asset_cache
| Tipo de dado | TTL |
|-------------|-----|
| DRE/Balanço/DFC trimestral | 90 dias |
| DRE/Balanço/DFC anual | 365 dias |
| Escritura de debênture | 180 dias |
| Análise setorial | 30 dias |
| Notícias | 3 dias |
| Indicadores (P/L, ROE, etc.) | 1 dia |

### Fontes de dados — ordem de fallback
- **Preços**: Yahoo Finance → Brapi
- **Financials**: Dados de Mercado API (`dadosdemercado.com.br/api/v1`) → CVM Dados Abertos
- **Indicadores**: Dados de Mercado → Fundamentus (via proxy server)
- **Debêntures**: ANBIMA → debentures.com.br → escritura em PDF
- **Setor e notícias**: Claude API com `web_search` tool

### Claude API
- Proxy server-side: `api/claude.js` (Vercel serverless)
- Variável de ambiente necessária: `ANTHROPIC_API_KEY` no Vercel
- Modelo: `claude-opus-4-5`
- Respostas sempre em JSON; fallback regex se `JSON.parse` falhar

### Como testar (browser console)
```javascript
// Analisar uma ação
FA.analyzeAsset('BBDC3', { forceRefresh: true }).then(r => console.log(r))

// Analisar debênture (ISIN)
FA.analyzeAsset('BRVALEACNOR0').then(r => console.log(r))

// Analisar carteira completa
FA.analyzePortfolio().then(r => console.log(r))

// Ver memória histórica de um ativo
FA.memory.store.getHistory('VALE3').then(r => console.log(r))
```

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
- [x] **Agente Fundamentalista**: análise de ações e crédito privado via Claude API

---

## Roadmap — próximas funcionalidades (em ordem de prioridade)
1. **Chat com assessor IA** (Claude API — `advisor-agent.js`): conhece toda a carteira, responde em português, explica rentabilidade, sugere rebalanceamentos
2. **Perfil de investidor** (suitability): prazo, objetivos, tolerância a risco — alimenta recomendações do assessor
3. **Agente fundamentalista** (`fundamentals-agent.js`): para cada ação, busca DRE + balanço + concorrentes via Claude API, gera qualidade do negócio e preço alvo
4. **Relatório diário por email** (`reports-agent.js` via Cowork/scheduled tasks): resumo da carteira, variações do dia, alertas
5. **Alertas de variação** (`alerts-agent.js`): notifica quando ativo sobe/cai X%
6. **Rentabilidade de títulos americanos**: conta XP International
7. **Planejamento tributário**: isenção IR renda variável (vendas < R$20k/mês)
8. **Simulador de aposentadoria**: projeção com aportes + taxa de retorno esperada

---

## Princípios de desenvolvimento
- Cada task é testável de forma independente (console.log no início e fim de cada função)
- Agentes orquestram tasks, nunca fazem fetch direto
- Cache inteligente: dados frescos uma vez por dia, Supabase nas demais visitas
- Fontes de dados com fallback gracioso (ex: CDI cai para 14.75% se BrasilAPI falhar)
- Zero dependências além de Supabase e Chart.js (já no CDN)
- Deploy: push para `main` → Vercel deploya automaticamente
