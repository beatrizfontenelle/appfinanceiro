# App Financeiro Pessoal — Bia

## Visão geral
Dashboard financeiro pessoal que evolui para um assessor financeiro completo, com nível de análise de wealth management, suportado por IA.

## Stack atual
- Frontend: HTML/CSS/JS puro, hospedado no Vercel
- Banco de dados/cache: Supabase (PostgreSQL)
- Dados bancários: Pluggy API (Open Finance Brasil)
- Cotações e histórico: Brapi API
- Câmbio: AwesomeAPI
- Deploy: GitHub → Vercel automático

## Funcionalidades existentes
- Dashboard com patrimônio total (contas + investimentos + conta internacional USD)
- Extrato e categorias de gastos
- Carteira de investimentos completa
- Rentabilidade por período vs benchmarks (Ibovespa, S&P 500, CDI)
- Evolução patrimonial
- Proventos/dividendos
- Alocação por classe e ativo
- Custo médio de ações com cálculo de ganho/perda
- Cache diário no Supabase para carregamento instantâneo

## Próximas funcionalidades planejadas (em ordem de prioridade)
1. Chat com assessor IA dentro do dashboard (Claude API) — conhece toda a carteira da usuária e responde perguntas em linguagem natural
2. Formulário de perfil de investidor (suitability) — prazo, objetivos, tolerância a risco
3. Análise automática de cada ativo — risco, setor, correlação, sugestões
4. Relatório diário automático por email via Cowork
5. Alertas de variação de preço
6. Rentabilidade de títulos do governo americano (conta internacional XP)
7. Planejamento tributário (isenção IR renda variável)
8. Simulador de aposentadoria

## Perfil da usuária
- Investidora pessoa física, Brasil
- Corretora principal: XP Investimentos
- Conta secundária: PicPay
- Conta internacional: XP International (USD)
- Ativos: ações brasileiras, LFTs, CDB, fundo de investimento
- Não tem conhecimento técnico de programação — toda comunicação deve ser em português claro

## Princípios de desenvolvimento
- Sempre manter o código modular e separado por responsabilidade
- Cada arquivo JS tem uma função clara (api.js = dados, charts.js = gráficos, render.js = telas)
- Priorizar robustez e tratamento de erros
- Cache inteligente: buscar dados frescos uma vez por dia, carregar do cache nas demais visitas
- O site deve funcionar bem em desktop e mobile
- Credenciais nunca no código — usar variáveis de ambiente quando possível no futuro
