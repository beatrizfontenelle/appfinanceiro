// ── Merchant Recognition Engine ──────────────────────────
// Maps transaction description patterns → { name, category, icon }
// Priority: first match wins. Patterns tested against lowercased description.
// Add new entries at the top of the relevant section to give them higher priority.

const MERCHANT_TABLE = [
  // ── Food delivery ──────────────────────────────────────
  { p: /ifood|i\.food/,                        name: 'iFood',            cat: 'Alimentação',   icon: '🛵' },
  { p: /rappi/,                                name: 'Rappi',            cat: 'Alimentação',   icon: '🛵' },
  { p: /uber.*eat|ubereats/,                   name: 'Uber Eats',        cat: 'Alimentação',   icon: '🛵' },
  { p: /james.*deliv|james food/,              name: 'James Delivery',   cat: 'Alimentação',   icon: '🛵' },
  { p: /zé delivery|ze delivery|zedelivery/,   name: 'Zé Delivery',      cat: 'Bebidas',       icon: '🍺' },

  // ── Transport ──────────────────────────────────────────
  { p: /\buber\b(?!.*eat)/,                    name: 'Uber',             cat: 'Transporte',    icon: '🚗' },
  { p: /\b99\b.*taxi|taxi.*\b99\b|99app|99cab/, name: '99',              cat: 'Transporte',    icon: '🚗' },
  { p: /cabify/,                               name: 'Cabify',           cat: 'Transporte',    icon: '🚗' },
  { p: /buser/,                                name: 'Buser',            cat: 'Transporte',    icon: '🚌' },
  { p: /clickbus|click bus/,                   name: 'ClickBus',         cat: 'Transporte',    icon: '🚌' },
  { p: /latam|gol\b|azul\b|tam\b/,             name: 'Passagem aérea',   cat: 'Viagem',        icon: '✈️' },
  { p: /estacion|parking|rotativo/,            name: 'Estacionamento',   cat: 'Transporte',    icon: '🅿️' },
  { p: /bilhete.*unico|bilhete unico|spturis/,  name: 'Bilhete Único',   cat: 'Transporte',    icon: '🚇' },
  { p: /shell\b|ipiranga|posto\b|combustiv/,   name: 'Combustível',      cat: 'Transporte',    icon: '⛽' },

  // ── Streaming & entertainment ──────────────────────────
  { p: /netflix/,                              name: 'Netflix',          cat: 'Streaming',     icon: '🎬' },
  { p: /spotify/,                              name: 'Spotify',          cat: 'Streaming',     icon: '🎵' },
  { p: /disney.*plus|disney\+/,               name: 'Disney+',           cat: 'Streaming',     icon: '🎬' },
  { p: /hbo.*max|max\.com/,                    name: 'Max (HBO)',         cat: 'Streaming',     icon: '🎬' },
  { p: /amazon.*prime|prime.*video/,           name: 'Amazon Prime',     cat: 'Streaming',     icon: '🎬' },
  { p: /globoplay/,                            name: 'Globoplay',        cat: 'Streaming',     icon: '🎬' },
  { p: /paramount/,                            name: 'Paramount+',       cat: 'Streaming',     icon: '🎬' },
  { p: /apple.*tv|apple tv/,                   name: 'Apple TV+',        cat: 'Streaming',     icon: '🎬' },
  { p: /crunchyroll/,                          name: 'Crunchyroll',      cat: 'Streaming',     icon: '🎬' },
  { p: /twitch/,                               name: 'Twitch',           cat: 'Streaming',     icon: '🎮' },
  { p: /steam|steampowered/,                   name: 'Steam',            cat: 'Jogos',         icon: '🎮' },
  { p: /playstation|ps store|psn/,             name: 'PlayStation Store', cat: 'Jogos',        icon: '🎮' },
  { p: /xbox|microsoft.*game/,                 name: 'Xbox / Game Pass', cat: 'Jogos',         icon: '🎮' },
  { p: /nintendo/,                             name: 'Nintendo',         cat: 'Jogos',         icon: '🎮' },
  { p: /deezer/,                               name: 'Deezer',           cat: 'Streaming',     icon: '🎵' },
  { p: /youtube.*premium/,                     name: 'YouTube Premium',  cat: 'Streaming',     icon: '🎬' },

  // ── Tech subscriptions ─────────────────────────────────
  { p: /openai|chatgpt/,                       name: 'ChatGPT (OpenAI)', cat: 'Assinaturas',   icon: '🤖' },
  { p: /anthropic|claude\.ai/,                 name: 'Claude (Anthropic)', cat: 'Assinaturas', icon: '🤖' },
  { p: /github.*copilot|github\.com/,          name: 'GitHub',           cat: 'Assinaturas',   icon: '💻' },
  { p: /microsoft.*365|office 365|ms 365/,     name: 'Microsoft 365',   cat: 'Assinaturas',   icon: '💼' },
  { p: /google.*one|google one/,               name: 'Google One',       cat: 'Assinaturas',   icon: '☁️' },
  { p: /icloud/,                               name: 'iCloud',           cat: 'Assinaturas',   icon: '☁️' },
  { p: /adobe/,                                name: 'Adobe',            cat: 'Assinaturas',   icon: '🎨' },
  { p: /canva/,                                name: 'Canva',            cat: 'Assinaturas',   icon: '🎨' },
  { p: /notion/,                               name: 'Notion',           cat: 'Assinaturas',   icon: '📝' },
  { p: /slack/,                                name: 'Slack',            cat: 'Assinaturas',   icon: '💬' },
  { p: /dropbox/,                              name: 'Dropbox',          cat: 'Assinaturas',   icon: '☁️' },
  { p: /zoom/,                                 name: 'Zoom',             cat: 'Assinaturas',   icon: '📹' },
  { p: /duolingo/,                             name: 'Duolingo',         cat: 'Educação',      icon: '🦜' },
  { p: /coursera|udemy|alura|hotmart/,         name: 'Curso online',     cat: 'Educação',      icon: '📚' },
  { p: /linkedIn.*premium/,                    name: 'LinkedIn Premium', cat: 'Assinaturas',   icon: '💼' },
  { p: /chatgpt|chat gpt/,                     name: 'ChatGPT',          cat: 'Assinaturas',   icon: '🤖' },

  // ── Shopping online ────────────────────────────────────
  { p: /amzn mktp|amazon\.com|amazon brasil/,  name: 'Amazon',           cat: 'Compras',       icon: '📦' },
  { p: /mercado livre|mercadolivre|meli/,       name: 'Mercado Livre',   cat: 'Compras',       icon: '📦' },
  { p: /shopee/,                               name: 'Shopee',           cat: 'Compras',       icon: '📦' },
  { p: /magazine luiza|magalu|mag luiza/,       name: 'Magazine Luiza',  cat: 'Compras',       icon: '🛒' },
  { p: /americanas/,                           name: 'Americanas',       cat: 'Compras',       icon: '🛒' },
  { p: /via varejo|casas bahia|pontofrio/,      name: 'Casas Bahia',     cat: 'Compras',       icon: '🛒' },
  { p: /aliexpress/,                           name: 'AliExpress',       cat: 'Compras',       icon: '📦' },
  { p: /shein/,                                name: 'Shein',            cat: 'Vestuário',     icon: '👗' },
  { p: /netshoes|centauro/,                    name: 'Esportes online',  cat: 'Esportes',      icon: '👟' },
  { p: /kabum|kabúm/,                          name: 'KaBuM!',           cat: 'Tecnologia',    icon: '💻' },
  { p: /terabyte|pichau|hardware/,             name: 'Hardware',         cat: 'Tecnologia',    icon: '💻' },

  // ── Supermarkets & grocery ─────────────────────────────
  { p: /pao de acucar|pão de açúcar|grupopaodeacucar/,  name: 'Pão de Açúcar',  cat: 'Mercado', icon: '🛒' },
  { p: /carrefour/,                            name: 'Carrefour',        cat: 'Mercado',       icon: '🛒' },
  { p: /extra\b/,                              name: 'Extra',            cat: 'Mercado',       icon: '🛒' },
  { p: /atacadao|atacadão/,                    name: 'Atacadão',         cat: 'Mercado',       icon: '🛒' },
  { p: /assai|assaí/,                          name: 'Assaí',            cat: 'Mercado',       icon: '🛒' },
  { p: /prezunic/,                             name: 'Prezunic',         cat: 'Mercado',       icon: '🛒' },
  { p: /hortifruti/,                           name: 'Hortifruti',       cat: 'Mercado',       icon: '🥦' },
  { p: /world wine|world\s*wine|wine\.com/,    name: 'Wine',             cat: 'Bebidas',       icon: '🍷' },

  // ── Restaurants & cafés ────────────────────────────────
  { p: /mcdonald|mc donald|mcdonalds/,         name: "McDonald's",       cat: 'Alimentação',   icon: '🍔' },
  { p: /burger king|burgerking/,               name: 'Burger King',      cat: 'Alimentação',   icon: '🍔' },
  { p: /subway\b/,                             name: 'Subway',           cat: 'Alimentação',   icon: '🥪' },
  { p: /kfc\b/,                                name: 'KFC',              cat: 'Alimentação',   icon: '🍗' },
  { p: /bob.*s\b|bobs\b/,                      name: "Bob's",            cat: 'Alimentação',   icon: '🍔' },
  { p: /outback/,                              name: 'Outback',          cat: 'Alimentação',   icon: '🥩' },
  { p: /starbucks/,                            name: 'Starbucks',        cat: 'Café',          icon: '☕' },
  { p: /chiquinho/,                            name: 'Chiquinho Sorvetes', cat: 'Alimentação', icon: '🍦' },

  // ── Pharmacies ─────────────────────────────────────────
  { p: /drogasil/,                             name: 'Drogasil',         cat: 'Saúde',         icon: '💊' },
  { p: /droga raia|drogaraia/,                 name: 'Droga Raia',       cat: 'Saúde',         icon: '💊' },
  { p: /farmácia|farmacia|drogaria/,           name: 'Farmácia',         cat: 'Saúde',         icon: '💊' },
  { p: /ultrafarma/,                           name: 'Ultrafarma',       cat: 'Saúde',         icon: '💊' },
  { p: /pacheco/,                              name: 'Farmácias Pacheco', cat: 'Saúde',        icon: '💊' },

  // ── Health & fitness ───────────────────────────────────
  { p: /smart\s*fit/,                          name: 'Smart Fit',        cat: 'Academia',      icon: '💪' },
  { p: /bodytech/,                             name: 'Bodytech',         cat: 'Academia',      icon: '💪' },
  { p: /gympass|wellhub/,                      name: 'Gympass / Wellhub', cat: 'Academia',     icon: '💪' },
  { p: /unimed/,                               name: 'Unimed',           cat: 'Saúde',         icon: '🏥' },
  { p: /amil/,                                 name: 'Amil',             cat: 'Saúde',         icon: '🏥' },
  { p: /sulamerica|sulamérica/,                name: 'SulAmérica Saúde', cat: 'Saúde',         icon: '🏥' },
  { p: /hapvida/,                              name: 'Hapvida',          cat: 'Saúde',         icon: '🏥' },
  { p: /bradesco saude|bradesco saúde/,        name: 'Bradesco Saúde',   cat: 'Saúde',         icon: '🏥' },

  // ── Utilities & bills ──────────────────────────────────
  { p: /enel\b|cemig\b|cpfl\b|coelba\b|celpe\b|energisa\b|light\b|elektro\b/, name: 'Energia elétrica', cat: 'Casa', icon: '⚡' },
  { p: /sabesp|cedae|copasa\b|sanepar\b/,      name: 'Água e esgoto',    cat: 'Casa',          icon: '💧' },
  { p: /vivo\b|claro\b|tim\b|oi\b|nextel\b/,  name: 'Telefone / Internet', cat: 'Casa',       icon: '📱' },
  { p: /net\b.*internet|claro\b.*net|internet|fibra/,  name: 'Internet',  cat: 'Casa',         icon: '🌐' },
  { p: /gás|gas ceg|comgas|gas natural/,       name: 'Gás',              cat: 'Casa',          icon: '🔥' },
  { p: /condomin/,                             name: 'Condomínio',       cat: 'Casa',          icon: '🏠' },
  { p: /aluguel|locação|locacao/,              name: 'Aluguel',          cat: 'Casa',          icon: '🏠' },
  { p: /correios/,                             name: 'Correios',         cat: 'Serviços',      icon: '📮' },

  // ── Financial services ─────────────────────────────────
  { p: /nubank|nu pagamentos/,                 name: 'Nubank',           cat: 'Financeiro',    icon: '💜' },
  { p: /inter\b|banco inter/,                  name: 'Banco Inter',      cat: 'Financeiro',    icon: '🧡' },
  { p: /c6 bank|c6bank/,                       name: 'C6 Bank',          cat: 'Financeiro',    icon: '⚫' },
  { p: /pagseguro|pagbank/,                    name: 'PagBank',          cat: 'Financeiro',    icon: '💳' },
  { p: /picpay/,                               name: 'PicPay',           cat: 'Financeiro',    icon: '💚' },
  { p: /mercado pago/,                         name: 'Mercado Pago',     cat: 'Financeiro',    icon: '💳' },
  { p: /paypal/,                               name: 'PayPal',           cat: 'Financeiro',    icon: '🔵' },

  // ── Beauty & personal care ─────────────────────────────
  { p: /sephora/,                              name: 'Sephora',          cat: 'Beleza',        icon: '💄' },
  { p: /o boticario|o boticário|boticario/,    name: 'O Boticário',     cat: 'Beleza',         icon: '🧴' },
  { p: /natura\b/,                             name: 'Natura',           cat: 'Beleza',        icon: '🌿' },
  { p: /salão|salao|cabeleirei/,               name: 'Salão de beleza',  cat: 'Beleza',        icon: '✂️' },

  // ── Education ──────────────────────────────────────────
  { p: /anki/,                                 name: 'Anki',             cat: 'Educação',      icon: '📖' },
  { p: /kindle|amazon.*books/,                 name: 'Kindle / Livros',  cat: 'Educação',      icon: '📚' },

  // ── Travel & accommodation ─────────────────────────────
  { p: /airbnb/,                               name: 'Airbnb',           cat: 'Viagem',        icon: '🏡' },
  { p: /booking\.com|booking com/,             name: 'Booking.com',      cat: 'Viagem',        icon: '🏨' },
  { p: /hotel|pousada|hostel/,                 name: 'Hospedagem',       cat: 'Viagem',        icon: '🏨' },
  { p: /decolar|despegar/,                     name: 'Decolar',          cat: 'Viagem',        icon: '✈️' },
];

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
// Returns { label, category, icon }
// label: merchant name if recognized, otherwise cleaned description
function enrichTx(tx) {
  const merchant = recognizeMerchant(tx.description);
  if (merchant) return { label: merchant.name, category: merchant.cat, icon: merchant.icon, recognized: true };
  // Fallback: use Pluggy category + clean description
  const label = (tx.description || '—')
    .replace(/\b\d{10,}\b/g, '')   // remove long numeric IDs
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  return { label, category: tx.category || '—', icon: null, recognized: false };
}
