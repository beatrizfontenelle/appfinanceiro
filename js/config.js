// ── Endpoints & credentials ──────────────────────────────
const SB_URL = 'https://qtugxpapmrcnltcrofat.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0dWd4cGFwbXJjbmx0Y3JvZmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MTk4MTcsImV4cCI6MjA5NDA5NTgxN30.95lfAT1CNIQci7R0-n3ZTUprkDJN9uEH2EQzU1xlvKY';
const PL_ID  = 'd0207884-47ef-40fd-b7d2-7cfa87221cbb';
const PL_SEC = '87c7e4dc-d5f6-4e0e-844b-5be251ca1a57';
const PL_BASE = 'https://api.pluggy.ai';
const ITEMS = ['e7ce6148-2c2c-4fc8-99b1-019dc5f17720', '7649ddf1-8ad3-4582-946e-b190cc5ede23'];
const YF_PROXY = '/api/yahoo';
const CLRS = ['#c8b97a','#8fbd8f','#8f9fbd','#bd8fad','#bd9f8f','#7ab8c8','#b8bd8f','#c88f8f','#d4a0a0','#a0c8d4'];

// ── Supabase client ──────────────────────────────────────
const sbc = supabase.createClient(SB_URL, SB_KEY);

// ── App state ────────────────────────────────────────────
let plKey = null, accounts = [], txAll = [], investments = [];
let BD = {}, BM = {}, usdRate = null;
let cfg = { int_usd: 526.15, int_custo: 2691.30, precos: {} };
let txDays = 30, txType = 'all', catDays = 30, rentPer = '1m';
let CH = {};
let tsP = null, tsB = null;
let prevSnapshot = null; // yesterday's patrimônio snapshot for delta KPIs

// ── Utility helpers ──────────────────────────────────────
const R     = v => v == null ? '—' : 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const Pct   = v => v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
const toBRL = t => t ? new Date(t).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const ts2d    = ts => new Date(ts * 1000).toISOString().slice(0, 10);

function setSt(id, dot, txt) { document.getElementById(id).innerHTML = `<span class="sdot ${dot}"></span>${txt}`; }
function showOv(m) { document.getElementById('overlay').classList.remove('hidden'); document.getElementById('omsg').textContent = m; }
function hideOv() { document.getElementById('overlay').classList.add('hidden'); }
function kc(id) { if (CH[id]) { CH[id].destroy(); delete CH[id]; } }
function isRV(i) { return ['EQUITY', 'ETF'].includes(i.type) || ['STOCK', 'BDR', 'REAL_ESTATE_FUND', 'ETF', 'OPTION'].includes(i.subtype); }
function intBrl() { return (usdRate || 0) * cfg.int_usd; }

const PDAYS = { '1m': 30, '3m': 90, '6m': 180, '1y': 365 };
function getDays() { return rentPer === 'origem' ? null : PDAYS[rentPer] || 30; }
