const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..');
const DB_PATH = path.join(__dirname, 'data', 'db.json');

function readDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function normalizeStatus(item) {
  const taken = Number(item.taken || 0);
  const slots = Number(item.slots || 0);
  if (item.status === 'cancelado') return 'cancelado';
  if (taken >= slots) return 'lotado';
  if (slots - taken <= 3) return 'últimas vagas';
  return 'disponível';
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    ...headers
  });
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload), { 'Content-Type': 'application/json; charset=utf-8' });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('JSON inválido.'));
      }
    });
    req.on('error', reject);
  });
}

function uid() {
  return crypto.randomUUID();
}

function createInternalCodeDataUrl(token, checkinUrl) {
  const escapedUrl = checkinUrl.replace(/&/g, '&amp;');
  const escapedToken = token.replace(/&/g, '&amp;');
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
  <rect width="320" height="320" fill="#ffffff"/>
  <rect x="20" y="20" width="280" height="280" fill="#ffffff" stroke="#111" stroke-width="2"/>
  <rect x="35" y="35" width="70" height="70" fill="#000"/>
  <rect x="45" y="45" width="50" height="50" fill="#fff"/>
  <rect x="55" y="55" width="30" height="30" fill="#000"/>
  <rect x="215" y="35" width="70" height="70" fill="#000"/>
  <rect x="225" y="45" width="50" height="50" fill="#fff"/>
  <rect x="235" y="55" width="30" height="30" fill="#000"/>
  <rect x="35" y="215" width="70" height="70" fill="#000"/>
  <rect x="45" y="225" width="50" height="50" fill="#fff"/>
  <rect x="55" y="235" width="30" height="30" fill="#000"/>
  <text x="160" y="160" text-anchor="middle" font-family="monospace" font-size="11" fill="#111">CHECKIN</text>
  <text x="160" y="178" text-anchor="middle" font-family="monospace" font-size="8" fill="#222">${escapedToken.slice(0, 18)}</text>
  <text x="160" y="194" text-anchor="middle" font-family="monospace" font-size="7" fill="#555">${escapedUrl}</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function serveStatic(reqPath, res) {
  const safePath = reqPath === '/' ? '/index.html' : reqPath;
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) return send(res, 403, 'Forbidden');
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return false;

  const ext = path.extname(filePath);
  const typeMap = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml'
  };

  send(res, 200, fs.readFileSync(filePath), { 'Content-Type': typeMap[ext] || 'application/octet-stream' });
  return true;
}

function backendUi(db) {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Club Elite Backend UI</title>
<style>body{font-family:Arial;padding:20px;background:#111;color:#eee}table{width:100%;border-collapse:collapse;margin:10px 0}td,th{border:1px solid #333;padding:8px}input,button{padding:8px;margin:4px 0;background:#222;color:#eee;border:1px solid #444}button{cursor:pointer}</style>
</head><body>
<h1>Backend UI - Club Elite</h1>
<p>Status do backend operacional. Use esta tela para validar dados e criar torneios rapidamente.</p>
<h2>Usuários</h2>
<table><tr><th>ID</th><th>Nome</th><th>E-mail</th><th>Role</th></tr>${db.users.map(u => `<tr><td>${u.id}</td><td>${u.name}</td><td>${u.email}</td><td>${u.role}</td></tr>`).join('')}</table>
<h2>Torneios (${db.tournaments.length})</h2>
<table><tr><th>Nome</th><th>Data</th><th>Tipo</th><th>Vagas</th><th>Ocupadas</th></tr>${db.tournaments.map(t => `<tr><td>${t.name}</td><td>${t.date} ${t.time}</td><td>${t.type}</td><td>${t.slots}</td><td>${t.taken}</td></tr>`).join('')}</table>
<h3>Cadastrar torneio (rápido)</h3>
<form id="f"><input name="name" placeholder="Nome" required/><input type="date" name="date" required/><input type="time" name="time" required/>
<input name="type" placeholder="Torneio" value="Torneio" required/><input name="buyIn" type="number" placeholder="Buy-in" required/>
<input name="slots" type="number" placeholder="Vagas" required/><button>Criar</button></form>
<pre id="out"></pre>
<script>
const f=document.getElementById('f');
f.onsubmit=async(e)=>{e.preventDefault();const body=Object.fromEntries(new FormData(f).entries());const r=await fetch('/api/tournaments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});document.getElementById('out').textContent=await r.text();if(r.ok)location.reload();};
</script>
</body></html>`;
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsed.pathname;

  if (req.method === 'OPTIONS') return send(res, 204, '');

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, service: 'club-elite-api', mode: 'no-external-deps' });
    }

    if (req.method === 'POST' && pathname === '/api/auth/signup') {
      const { name, email, phone, password } = await parseBody(req);
      if (!name || !email || !phone || !password) return sendJson(res, 400, { error: 'Dados obrigatórios.' });
      const db = readDb();
      if (db.users.some((u) => u.email.toLowerCase() === String(email).toLowerCase())) return sendJson(res, 409, { error: 'E-mail já cadastrado.' });

      const user = { id: uid(), name, email, phone, password, nickname: String(name).split(' ')[0], role: 'player' };
      db.users.push(user);
      writeDb(db);
      return sendJson(res, 201, { user: { ...user, password: undefined } });
    }

    if (req.method === 'POST' && pathname === '/api/auth/login') {
      const { email, password } = await parseBody(req);
      const db = readDb();
      const user = db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase() && u.password === password);
      if (!user) return sendJson(res, 401, { error: 'Credenciais inválidas.' });
      return sendJson(res, 200, { user: { ...user, password: undefined } });
    }

    if (req.method === 'GET' && pathname === '/api/tournaments') {
      const db = readDb();
      const type = parsed.searchParams.get('type');
      const search = parsed.searchParams.get('search');
      let list = db.tournaments.map((t) => ({ ...t, status: normalizeStatus(t) }));
      if (type && type !== 'Todos') list = list.filter((t) => t.type === type);
      if (search) {
        const q = search.toLowerCase();
        list = list.filter((t) => `${t.name} ${t.type}`.toLowerCase().includes(q));
      }
      return sendJson(res, 200, list);
    }

    if (req.method === 'POST' && pathname === '/api/tournaments') {
      const p = await parseBody(req);
      const required = ['name', 'date', 'time', 'type', 'buyIn', 'slots'];
      const missing = required.filter((k) => !p[k]);
      if (missing.length) return sendJson(res, 400, { error: `Campos obrigatórios: ${missing.join(', ')}` });
      const db = readDb();
      const t = { id: uid(), name: p.name, date: p.date, time: p.time, type: p.type, buyIn: Number(p.buyIn), blinds: p.blinds || '-', prize: Number(p.prize || 0), slots: Number(p.slots), taken: 0, structure: p.structure || 'Stack padrão Club Elite', status: 'disponível' };
      db.tournaments.push(t);
      writeDb(db);
      return sendJson(res, 201, t);
    }

    if (req.method === 'GET' && pathname === '/api/events') {
      const db = readDb();
      return sendJson(res, 200, db.events.map((e) => ({ ...e, status: normalizeStatus(e) })));
    }

    if (req.method === 'POST' && pathname === '/api/registrations') {
      const { userId, tournamentId } = await parseBody(req);
      const db = readDb();
      const user = db.users.find((u) => u.id === userId);
      const tournament = db.tournaments.find((t) => t.id === tournamentId);
      if (!user || !tournament) return sendJson(res, 404, { error: 'Usuário ou torneio não encontrado.' });
      if (db.registrations.some((r) => r.userId === userId && r.tournamentId === tournamentId)) return sendJson(res, 409, { error: 'Usuário já inscrito neste torneio.' });

      const registration = { id: uid(), userId, tournamentId, createdAt: new Date().toISOString(), status: 'confirmado' };
      db.registrations.push(registration);
      tournament.taken = Number(tournament.taken || 0) + 1;

      const checkinToken = uid();
      const checkinUrl = `http://${req.headers.host}/checkin/${checkinToken}`;
      const qrCodeDataUrl = createInternalCodeDataUrl(checkinToken, checkinUrl);
      db.checkins.push({ id: uid(), registrationId: registration.id, token: checkinToken, checkinUrl, qrCodeDataUrl, checkedInAt: null });

      writeDb(db);
      return sendJson(res, 201, { registration, checkinUrl, qrCodeDataUrl, checkinToken });
    }

    if (req.method === 'GET' && pathname.startsWith('/api/checkins/user/')) {
      const userId = pathname.split('/').pop();
      const db = readDb();
      const registrations = db.registrations.filter((r) => r.userId === userId);
      const history = registrations.map((registration) => ({
        registration,
        checkin: db.checkins.find((c) => c.registrationId === registration.id),
        tournament: db.tournaments.find((t) => t.id === registration.tournamentId)
      }));
      return sendJson(res, 200, history);
    }

    if (req.method === 'POST' && pathname === '/api/checkins/scan') {
      const { token } = await parseBody(req);
      const db = readDb();
      const checkin = db.checkins.find((c) => c.token === token);
      if (!checkin) return sendJson(res, 404, { error: 'QR/token inválido.' });

      const registration = db.registrations.find((r) => r.id === checkin.registrationId);
      const user = db.users.find((u) => u.id === registration.userId);
      const tournament = db.tournaments.find((t) => t.id === registration.tournamentId);
      if (!checkin.checkedInAt) checkin.checkedInAt = new Date().toISOString();
      writeDb(db);

      return sendJson(res, 200, {
        checkin,
        registration,
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, nickname: user.nickname },
        tournament
      });
    }

    if (req.method === 'GET' && pathname === '/backend-ui') {
      return send(res, 200, backendUi(readDb()), { 'Content-Type': 'text/html; charset=utf-8' });
    }

    if (req.method === 'GET' && pathname.startsWith('/checkin/')) {
      return serveStatic('/index.html', res);
    }

    if (req.method === 'GET' && serveStatic(pathname, res)) return;

    return sendJson(res, 404, { error: 'Rota não encontrada.' });
  } catch (err) {
    return sendJson(res, 500, { error: err.message || 'Erro interno.' });
  }
});

server.listen(PORT, () => {
  console.log(`Club Elite no ar em http://localhost:${PORT}`);
  console.log(`Backend UI: http://localhost:${PORT}/backend-ui`);
});
