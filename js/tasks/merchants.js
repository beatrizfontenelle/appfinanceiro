// ── Merchant Recognition Engine ──────────────────────────
// Maps transaction description patterns → { name, category, icon }
// Priority: first match wins. Patterns tested against lowercased description.
//
// IMPORTANT: PicPay billing prefixes used in Brazil:
//   IFD*  → iFood (e.g. "IFD*NECTAR ORIGINAL LTDA")
//   UB*   → Uber  (e.g. "UB* PENDING", "UBER * TRIP")
//   PP*   → Outros pagamentos PicPay

const MERCHANT_TABLE = [
  // ── Food delivery ──────────────────────────────────────
  // iFood: bills as "IFD*{NOME DO RESTAURANTE}" or "IFOOD*"
  { p: /^ifd\*|ifd\s*\*|\bifood\b|i\.food/,       name: 'iFood',            cat: 'Alimentação',   icon: '🛵' },
  { p: /rappi/,                                    name: 'Rappi',            cat: 'Alimentação',   icon: '🛵' },
  { p: /uber.*eat|ubereats/,                       name: 'Uber Eats',        cat: 'Alimentação',   icon: '🛵' },
  { p: /james.*deliv|james food/,                  name: 'James Delivery',   cat: 'Alimentação',   icon: '🛵' },
  { p: /zé delivery|ze delivery|zedelivery/,       name: 'Zé Delivery',      cat: 'Bebidas',       icon: '🍺' },

  // ── Transport ──────────────────────────────────────────
  // Uber: bills as "UBER * TRIP", "UB* PENDING", "UBER BRASIL"
  { p: /^ub\s*\*|uber\s*\*\s*trip|uber\s*\*\s*pend|\buber\b(?!.*eat)/, name: 'Uber', cat: 'Transporte', icon: '🚗' },
  // 99: bills as "99APP", "99 TAXI", "99PAY", sometimes just "DL" on PicPay card
  { p: /99app|99\s*taxi|99pay|\b99\b.*corrida/,    name: '99',               cat: 'Transporte',    icon: '🚗' },
  { p: /cabify/,                                   name: 'Cabify',           cat: 'Transporte',    icon: '🚗' },
  { p: /buser/,                                    name: 'Buser',            cat: 'Transporte',    icon: '🚌' },
  { p: /clickbus|click\s*bus/,                     name: 'ClickBus',         cat: 'Transporte',    icon: '🚌' },
  { p: /latam|gol\b|azul\b(?!.*pague)|tam\b/,      name: 'Passagem aérea',   cat: 'Viagem',        icon: '✈️' },
  { p: /estacion|parking|rotativo|zona\s*azul/,    name: 'Estacionamento',   cat: 'Transporte',    icon: '🅿️' },
  { p: /bilhete.*unico|bilhete unico|spturis|sptrans/, name: 'Bilhete Único', cat: 'Transporte',   icon: '🚇' },
  { p: /shell\b|ipiranga|posto\b(?!.*saude)|combustiv|gasolina|etanol\b/, name: 'Combustível', cat: 'Transporte', icon: '⛽' },

  // ── Streaming & entertainment ──────────────────────────
  { p: /netflix/,                                  name: 'Netflix',          cat: 'Streaming',     icon: '🎬' },
  { p: /spotify/,                                  name: 'Spotify',          cat: 'Streaming',     icon: '🎵' },
  { p: /disney.*plus|disney\+/,                    name: 'Disney+',          cat: 'Streaming',     icon: '🎬' },
  { p: /hbo.*max|\bmax\.com\b/,                    name: 'Max (HBO)',         cat: 'Streaming',     icon: '🎬' },
  { p: /amazon.*prime|prime.*video/,               name: 'Amazon Prime',     cat: 'Streaming',     icon: '🎬' },
  { p: /globoplay/,                                name: 'Globoplay',        cat: 'Streaming',     icon: '🎬' },
  { p: /paramount/,                                name: 'Paramount+',       cat: 'Streaming',     icon: '🎬' },
  { p: /apple\s*tv/,                               name: 'Apple TV+',        cat: 'Streaming',     icon: '🎬' },
  { p: /crunchyroll/,                              name: 'Crunchyroll',      cat: 'Streaming',     icon: '🎬' },
  { p: /twitch/,                                   name: 'Twitch',           cat: 'Streaming',     icon: '🎮' },
  { p: /deezer/,                                   name: 'Deezer',           cat: 'Streaming',     icon: '🎵' },
  { p: /youtube.*premium/,                         name: 'YouTube Premium',  cat: 'Streaming',     icon: '🎬' },
  { p: /apple.*music/,                             name: 'Apple Music',      cat: 'Streaming',     icon: '🎵' },
  { p: /steam|steampowered/,                       name: 'Steam',            cat: 'Jogos',         icon: '🎮' },
  { p: /playstation|ps\s*store|psn\b/,             name: 'PlayStation Store', cat: 'Jogos',        icon: '🎮' },
  { p: /xbox|microsoft.*game/,                     name: 'Xbox / Game Pass', cat: 'Jogos',         icon: '🎮' },
  { p: /nintendo/,                                 name: 'Nintendo',         cat: 'Jogos',         icon: '🎮' },

  // ── Tech subscriptions ─────────────────────────────────
  { p: /openai|chatgpt|chat\s*gpt/,                name: 'ChatGPT (OpenAI)', cat: 'Assinaturas',   icon: '🤖' },
  { p: /anthropic|claude\.ai/,                     name: 'Claude (Anthropic)', cat: 'Assinaturas', icon: '🤖' },
  { p: /github/,                                   name: 'GitHub',           cat: 'Assinaturas',   icon: '💻' },
  { p: /microsoft.*365|office\s*365|ms\s*365/,     name: 'Microsoft 365',    cat: 'Assinaturas',   icon: '💼' },
  { p: /google\s*one/,                             name: 'Google One',       cat: 'Assinaturas',   icon: '☁️' },
  { p: /icloud/,                                   name: 'iCloud',           cat: 'Assinaturas',   icon: '☁️' },
  { p: /adobe/,                                    name: 'Adobe',            cat: 'Assinaturas',   icon: '🎨' },
  { p: /canva/,                                    name: 'Canva',            cat: 'Assinaturas',   icon: '🎨' },
  { p: /notion/,                                   name: 'Notion',           cat: 'Assinaturas',   icon: '📝' },
  { p: /slack/,                                    name: 'Slack',            cat: 'Assinaturas',   icon: '💬' },
  { p: /dropbox/,                                  name: 'Dropbox',          cat: 'Assinaturas',   icon: '☁️' },
  { p: /zoom/,                                     name: 'Zoom',             cat: 'Assinaturas',   icon: '📹' },
  { p: /duolingo/,                                 name: 'Duolingo',         cat: 'Educação',      icon: '🦜' },
  { p: /coursera|udemy|alura|hotmart/,             name: 'Curso online',     cat: 'Educação',      icon: '📚' },
  { p: /linkedin.*premium/,                        name: 'LinkedIn Premium', cat: 'Assinaturas',   icon: '💼' },
  { p: /figma/,                                    name: 'Figma',            cat: 'Assinaturas',   icon: '🎨' },

  // ── Online shopping ────────────────────────────────────
  { p: /amzn\s*mktp|amazon\.com|amazon\s*brasil/,  name: 'Amazon',           cat: 'Compras',       icon: '📦' },
  { p: /mercado\s*livre|mercadolivre|\bmeli\b/,     name: 'Mercado Livre',    cat: 'Compras',       icon: '📦' },
  { p: /shopee/,                                   name: 'Shopee',           cat: 'Compras',       icon: '📦' },
  { p: /magazine\s*luiza|magalu/,                  name: 'Magazine Luiza',   cat: 'Compras',       icon: '🛒' },
  { p: /americanas/,                               name: 'Americanas',       cat: 'Compras',       icon: '🛒' },
  { p: /casas\s*bahia|via\s*varejo|pontofrio/,     name: 'Casas Bahia',      cat: 'Compras',       icon: '🛒' },
  { p: /aliexpress/,                               name: 'AliExpress',       cat: 'Compras',       icon: '📦' },
  { p: /shein/,                                    name: 'Shein',            cat: 'Vestuário',     icon: '👗' },
  { p: /netshoes|centauro/,                        name: 'Esportes online',  cat: 'Esportes',      icon: '👟' },
  { p: /kabum|kabúm/,                              name: 'KaBuM!',           cat: 'Tecnologia',    icon: '💻' },

  // ── Supermarkets & grocery ─────────────────────────────
  { p: /pao\s*de\s*acucar|pão\s*de\s*açúcar|grupo\s*pao/,  name: 'Pão de Açúcar', cat: 'Mercado', icon: '🛒' },
  { p: /carrefour/,                                name: 'Carrefour',        cat: 'Mercado',       icon: '🛒' },
  { p: /\bextra\b(?!.*bom|.*ofer)/,               name: 'Extra',            cat: 'Mercado',       icon: '🛒' },
  { p: /atacad[aã]o/,                              name: 'Atacadão',         cat: 'Mercado',       icon: '🛒' },
  { p: /assa[ií]/,                                 name: 'Assaí',            cat: 'Mercado',       icon: '🛒' },
  { p: /prezunic/,                                 name: 'Prezunic',         cat: 'Mercado',       icon: '🛒' },
  { p: /hortifruti/,                               name: 'Hortifruti',       cat: 'Mercado',       icon: '🥦' },

  // ── Restaurants & cafés ────────────────────────────────
  { p: /mcdonald|mc\s*donald/,                     name: "McDonald's",       cat: 'Restaurantes',  icon: '🍔' },
  { p: /burger\s*king/,                            name: 'Burger King',      cat: 'Restaurantes',  icon: '🍔' },
  { p: /\bsubway\b/,                               name: 'Subway',           cat: 'Restaurantes',  icon: '🥪' },
  { p: /\bkfc\b/,                                  name: 'KFC',              cat: 'Restaurantes',  icon: '🍗' },
  { p: /\bbobs?\b/,                                name: "Bob's",            cat: 'Restaurantes',  icon: '🍔' },
  { p: /outback/,                                  name: 'Outback',          cat: 'Restaurantes',  icon: '🥩' },
  { p: /starbucks/,                                name: 'Starbucks',        cat: 'Café',          icon: '☕' },
  { p: /chiquinho/,                                name: 'Chiquinho Sorvetes', cat: 'Restaurantes', icon: '🍦' },

  // ── Pharmacies ─────────────────────────────────────────
  { p: /drogasil/,                                 name: 'Drogasil',         cat: 'Saúde',         icon: '💊' },
  { p: /droga\s*raia/,                             name: 'Droga Raia',       cat: 'Saúde',         icon: '💊' },
  { p: /ultrafarma/,                               name: 'Ultrafarma',       cat: 'Saúde',         icon: '💊' },
  { p: /pacheco/,                                  name: 'Farmácias Pacheco', cat: 'Saúde',        icon: '💊' },
  { p: /farm[aá]cia|drogaria/,                     name: 'Farmácia',         cat: 'Saúde',         icon: '💊' },

  // ── Health & fitness ───────────────────────────────────
  { p: /smart\s*fit/,                              name: 'Smart Fit',        cat: 'Academia',      icon: '💪' },
  { p: /bodytech/,                                 name: 'Bodytech',         cat: 'Academia',      icon: '💪' },
  { p: /gympass|wellhub/,                          name: 'Gympass / Wellhub', cat: 'Academia',     icon: '💪' },
  { p: /academia\b|fitness\b|crossfit/,            name: 'Academia',         cat: 'Academia',      icon: '💪' },
  { p: /unimed/,                                   name: 'Unimed',           cat: 'Saúde',         icon: '🏥' },
  { p: /\bamil\b/,                                 name: 'Amil',             cat: 'Saúde',         icon: '🏥' },
  { p: /sulamerica|sulamérica/,                    name: 'SulAmérica Saúde', cat: 'Saúde',         icon: '🏥' },
  { p: /hapvida/,                                  name: 'Hapvida',          cat: 'Saúde',         icon: '🏥' },
  { p: /bradesco\s*sau[dú]e/,                      name: 'Bradesco Saúde',   cat: 'Saúde',         icon: '🏥' },

  // ── Utilities & bills ──────────────────────────────────
  { p: /\benel\b|\bcemig\b|\bcpfl\b|\bcoelba\b|\bcelpe\b|\benergia\b|\blight\b|\belektro\b|\bequatorial\b/, name: 'Energia elétrica', cat: 'Casa', icon: '⚡' },
  { p: /\bsabesp\b|\bcedae\b|\bcopasa\b|\bsanepar\b|\bsaneamento\b/, name: 'Água e esgoto', cat: 'Casa', icon: '💧' },
  { p: /\bvivo\b|\bclaro\b|\btim\b|\boi\b|\bnextel\b/,  name: 'Telefone / Internet', cat: 'Casa', icon: '📱' },
  { p: /\bcomgas\b|\bceg\b|\bgás natural\b/,       name: 'Gás',              cat: 'Casa',          icon: '🔥' },
  { p: /condomin/,                                 name: 'Condomínio',       cat: 'Casa',          icon: '🏠' },
  { p: /aluguel|loca[çc][aã]o/,                    name: 'Aluguel',          cat: 'Casa',          icon: '🏠' },
  { p: /correios/,                                 name: 'Correios',         cat: 'Serviços',      icon: '📮' },

  // ── Financial services ─────────────────────────────────
  { p: /nubank|nu\s*pagamentos/,                   name: 'Nubank',           cat: 'Financeiro',    icon: '💜' },
  { p: /banco\s*inter|\binter\b(?!.*net)/,         name: 'Banco Inter',      cat: 'Financeiro',    icon: '🧡' },
  { p: /c6\s*bank/,                                name: 'C6 Bank',          cat: 'Financeiro',    icon: '⚫' },
  { p: /pagseguro|pagbank/,                        name: 'PagBank',          cat: 'Financeiro',    icon: '💳' },
  { p: /picpay(?!\s*card\s*d[eé]b)/,              name: 'PicPay',           cat: 'Financeiro',    icon: '💚' },
  { p: /mercado\s*pago/,                           name: 'Mercado Pago',     cat: 'Financeiro',    icon: '💳' },
  { p: /paypal/,                                   name: 'PayPal',           cat: 'Financeiro',    icon: '🔵' },

  // ── Beauty & personal care ─────────────────────────────
  { p: /sephora/,                                  name: 'Sephora',          cat: 'Beleza',        icon: '💄' },
  { p: /boticario|boticário/,                      name: 'O Boticário',      cat: 'Beleza',        icon: '🧴' },
  { p: /\bnatural\b|\bnatura\b/,                   name: 'Natura',           cat: 'Beleza',        icon: '🌿' },
  { p: /sal[aã]o|cabeleirei/,                      name: 'Salão de beleza',  cat: 'Beleza',        icon: '✂️' },

  // ── Education ──────────────────────────────────────────
  { p: /\banki\b/,                                 name: 'Anki',             cat: 'Educação',      icon: '📖' },
  { p: /kindle/,                                   name: 'Kindle / Livros',  cat: 'Educação',      icon: '📚' },

  // ── Travel & accommodation ─────────────────────────────
  { p: /airbnb/,                                   name: 'Airbnb',           cat: 'Viagem',        icon: '🏡' },
  { p: /booking\.com/,                             name: 'Booking.com',      cat: 'Viagem',        icon: '🏨' },
  { p: /\bhotel\b|\bpousada\b|\bhostel\b/,         name: 'Hospedagem',       cat: 'Viagem',        icon: '🏨' },
  { p: /decolar|despegar/,                         name: 'Decolar',          cat: 'Viagem',        icon: '✈️' },

  // ── Wine & drinks ──────────────────────────────────────
  { p: /wine\.com\.br|world\s*wine/,               name: 'Wine',             cat: 'Bebidas',       icon: '🍷' },
];

// ── Pluggy category translations (EN → PT-BR) ────────────
// Pluggy returns categories in English; translate everything to Portuguese
const CAT_TRANSLATE = {
  // Food & drink
  'Food delivery':              'Delivery de comida',
  'Eating out':                 'Restaurantes',
  'Groceries':                  'Mercado',
  'Drinks':                     'Bebidas',
  'Coffee shops':               'Café',

  // Transport
  'Taxi and ride-hailing':      'Transporte',
  'Public transport':           'Transporte público',
  'Fuel':                       'Combustível',
  'Parking':                    'Estacionamento',
  'Car rental':                 'Aluguel de carro',
  'Travel':                     'Viagem',
  'Flights':                    'Passagem aérea',
  'Accommodation':              'Hospedagem',

  // Health
  'Health':                     'Saúde',
  'Pharmacy':                   'Farmácia',
  'Fitness':                    'Academia',
  'Sports practice':            'Academia',

  // Shopping & services
  'Shopping':                   'Compras',
  'Electronics':                'Eletrônicos',
  'Clothing':                   'Vestuário',
  'Books':                      'Livros',
  'Home':                       'Casa',
  'Home improvement':           'Casa',
  'Gifts':                      'Presentes',
  'Personal care':              'Beleza',
  'Beauty':                     'Beleza',

  // Bills & utilities
  'Bills and utilities':        'Contas e serviços',
  'Utilities':                  'Utilidades',
  'Rent':                       'Aluguel',
  'Phone':                      'Telefone',
  'Internet':                   'Internet',
  'TV':                         'TV / Streaming',

  // Finance
  'Financial services':         'Serviços financeiros',
  'Transfers':                  'Transferências',
  'Investments and savings':    'Investimentos',
  'Insurance':                  'Seguros',
  'Taxes':                      'Impostos',
  'Tax on financial operations':'IOF / Taxas',
  'Fees and charges':           'Taxas e tarifas',
  'ATM':                        'Saque',
  'Loan':                       'Empréstimo',
  'Credit card':                'Cartão de crédito',

  // Income
  'Income':                     'Receita',
  'Salary':                     'Salário',
  'Freelance':                  'Freelance',
  'Investments income':         'Rendimentos',

  // Other
  'Education':                  'Educação',
  'Entertainment':              'Entretenimento',
  'Charity':                    'Doações',
  'Pets':                       'Animais',
  'Childcare':                  'Filhos',
  'Automotive':                 'Automóvel',
  'Other':                      'Outros',
  'Others':                     'Outros',
  'Uncategorized':              'Outros',
};

// ── Translate a Pluggy category string ───────────────────
function translateCat(cat) {
  if (!cat) return 'Outros';
  // Try exact match first
  if (CAT_TRANSLATE[cat]) return CAT_TRANSLATE[cat];
  // Try partial match (Pluggy sometimes uses "Tax on financial ope..." truncated)
  const lower = cat.toLowerCase();
  for (const [en, pt] of Object.entries(CAT_TRANSLATE)) {
    if (lower.startsWith(en.toLowerCase().slice(0, 12))) return pt;
  }
  return cat; // return as-is if no translation found
}

// ── Look up a transaction description ────────────────────
// Returns { name, cat, icon } or null if not recognized
function recognizeMerchant(description) {
  if (!description) return null;
  const d = description.toLowerCase();
  for (const entry of MERCHANT_TABLE) {
    if (entry.p.test(d)) return { name: entry.name, cat: entry.cat, icon: entry.icon };
  }
  return null;
}

// ── Get enriched display info for a transaction ───────────
// Returns { label, category, icon, recognized }
// label  : merchant name if recognized, otherwise cleaned description
// category: merchant category or translated Pluggy category
function enrichTx(tx) {
  const merchant = recognizeMerchant(tx.description);
  if (merchant) return { label: merchant.name, category: merchant.cat, icon: merchant.icon, recognized: true };
  // Fallback: translate Pluggy category, clean up description
  const label = (tx.description || '—')
    .replace(/\b\d{10,}\b/g, '')  // remove long numeric IDs (transaction codes)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return { label, category: translateCat(tx.category), icon: null, recognized: false };
}
