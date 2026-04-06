const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

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

app.get('/api/health', (_, res) => res.json({ ok: true, service: 'club-elite-api' }));

app.post('/api/auth/signup', (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !phone || !password) return res.status(400).json({ error: 'Dados obrigatórios.' });

  const db = readDb();
  if (db.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: 'E-mail já cadastrado.' });
  }

  const user = {
    id: uuidv4(),
    name,
    email,
    phone,
    password,
    nickname: name.split(' ')[0],
    role: 'player'
  };

  db.users.push(user);
  writeDb(db);
  res.status(201).json({ user: { ...user, password: undefined } });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const db = readDb();
  const user = db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase() && u.password === password);
  if (!user) return res.status(401).json({ error: 'Credenciais inválidas.' });
  res.json({ user: { ...user, password: undefined } });
});

app.get('/api/tournaments', (req, res) => {
  const db = readDb();
  const { type, search } = req.query;
  let list = db.tournaments.map((t) => ({ ...t, status: normalizeStatus(t) }));
  if (type && type !== 'Todos') list = list.filter((t) => t.type === type);
  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter((t) => `${t.name} ${t.type}`.toLowerCase().includes(q));
  }
  res.json(list);
});

app.post('/api/tournaments', (req, res) => {
  const payload = req.body;
  const required = ['name', 'date', 'time', 'type', 'buyIn', 'slots'];
  const missing = required.filter((k) => !payload[k]);
  if (missing.length) return res.status(400).json({ error: `Campos obrigatórios: ${missing.join(', ')}` });

  const db = readDb();
  const tournament = {
    id: uuidv4(),
    name: payload.name,
    date: payload.date,
    time: payload.time,
    type: payload.type,
    buyIn: Number(payload.buyIn),
    blinds: payload.blinds || '-',
    prize: Number(payload.prize || 0),
    slots: Number(payload.slots),
    taken: 0,
    structure: payload.structure || 'Stack padrão Club Elite',
    status: 'disponível'
  };
  db.tournaments.push(tournament);
  writeDb(db);
  res.status(201).json(tournament);
});

app.get('/api/events', (_, res) => {
  const db = readDb();
  res.json(db.events.map((e) => ({ ...e, status: normalizeStatus(e) })));
});

app.post('/api/events', (req, res) => {
  const payload = req.body;
  const required = ['name', 'date', 'time', 'type', 'buyIn', 'slots'];
  const missing = required.filter((k) => !payload[k]);
  if (missing.length) return res.status(400).json({ error: `Campos obrigatórios: ${missing.join(', ')}` });

  const db = readDb();
  const event = {
    id: uuidv4(),
    name: payload.name,
    date: payload.date,
    time: payload.time,
    type: payload.type,
    buyIn: Number(payload.buyIn),
    blinds: payload.blinds || '-',
    slots: Number(payload.slots),
    taken: 0,
    status: 'disponível'
  };
  db.events.push(event);
  writeDb(db);
  res.status(201).json(event);
});

app.post('/api/registrations', async (req, res) => {
  const { userId, tournamentId } = req.body;
  const db = readDb();

  const user = db.users.find((u) => u.id === userId);
  const tournament = db.tournaments.find((t) => t.id === tournamentId);
  if (!user || !tournament) return res.status(404).json({ error: 'Usuário ou torneio não encontrado.' });

  const duplicate = db.registrations.find((r) => r.userId === userId && r.tournamentId === tournamentId);
  if (duplicate) return res.status(409).json({ error: 'Usuário já inscrito neste torneio.' });

  const registration = {
    id: uuidv4(),
    userId,
    tournamentId,
    createdAt: new Date().toISOString(),
    status: 'confirmado'
  };

  db.registrations.push(registration);
  tournament.taken = Number(tournament.taken || 0) + 1;

  const checkinToken = uuidv4();
  const checkinUrl = `${req.protocol}://${req.get('host')}/checkin/${checkinToken}`;
  const qrCodeDataUrl = await QRCode.toDataURL(checkinUrl, { margin: 1, width: 300 });
  db.checkins.push({
    id: uuidv4(),
    registrationId: registration.id,
    token: checkinToken,
    checkinUrl,
    qrCodeDataUrl,
    checkedInAt: null
  });

  writeDb(db);
  res.status(201).json({ registration, checkinUrl, qrCodeDataUrl, checkinToken });
});

app.get('/api/registrations/user/:userId', (req, res) => {
  const db = readDb();
  const list = db.registrations
    .filter((r) => r.userId === req.params.userId)
    .map((r) => {
      const tournament = db.tournaments.find((t) => t.id === r.tournamentId);
      const checkin = db.checkins.find((c) => c.registrationId === r.id);
      return { ...r, tournament, checkin };
    });
  res.json(list);
});

app.post('/api/checkins/scan', (req, res) => {
  const { token } = req.body;
  const db = readDb();
  const checkin = db.checkins.find((c) => c.token === token);
  if (!checkin) return res.status(404).json({ error: 'QR inválido.' });

  const registration = db.registrations.find((r) => r.id === checkin.registrationId);
  const user = db.users.find((u) => u.id === registration.userId);
  const tournament = db.tournaments.find((t) => t.id === registration.tournamentId);

  if (!checkin.checkedInAt) checkin.checkedInAt = new Date().toISOString();
  writeDb(db);

  res.json({
    checkin,
    registration,
    user: { id: user.id, name: user.name, email: user.email, phone: user.phone, nickname: user.nickname },
    tournament
  });
});

app.get('/api/checkins/user/:userId', (req, res) => {
  const db = readDb();
  const registrations = db.registrations.filter((r) => r.userId === req.params.userId);
  const history = registrations.map((registration) => {
    const checkin = db.checkins.find((c) => c.registrationId === registration.id);
    const tournament = db.tournaments.find((t) => t.id === registration.tournamentId);
    return { registration, checkin, tournament };
  });
  res.json(history);
});

app.get('/checkin/:token', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Club Elite rodando em http://localhost:${PORT}`);
});
