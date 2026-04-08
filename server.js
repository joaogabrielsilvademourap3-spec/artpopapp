const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const PUBLIC_DIR = path.join(ROOT, 'public');
const ADMIN_DIR = path.join(ROOT, 'admin');
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const QR_SECRET = 'elite-club-local-secret';

const files = {
  users: 'users.json',
  tournaments: 'tournaments.json',
  events: 'events.json',
  registrations: 'registrations.json',
  waitlist: 'waitlist.json',
  checkins: 'checkins.json',
  notifications: 'notifications.json',
  sessions: 'sessions.json',
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const ensureData = async () => {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  for (const file of Object.values(files)) {
    const p = path.join(DATA_DIR, file);
    try {
      await fsp.access(p);
    } catch {
      await fsp.writeFile(p, '[]', 'utf8');
    }
  }

  const users = await readJson('users');
  if (users.length === 0) {
    const now = new Date().toISOString();
    const seedUsers = [
      {
        id: uid('usr'),
        name: 'Administrador Elite',
        email: 'admin@eliteclub.local',
        phone: '11990000000',
        nickname: 'Boss',
        role: 'admin',
        passwordHash: hashPassword('admin123'),
        createdAt: now,
      },
      {
        id: uid('usr'),
        name: 'Lucas Almeida',
        email: 'lucas@eliteclub.local',
        phone: '11981112222',
        nickname: 'Lukinha',
        role: 'player',
        passwordHash: hashPassword('player123'),
        createdAt: now,
      },
      {
        id: uid('usr'),
        name: 'Marina Costa',
        email: 'marina@eliteclub.local',
        phone: '11983334444',
        nickname: 'M.Costa',
        role: 'player',
        passwordHash: hashPassword('player123'),
        createdAt: now,
      },
      {
        id: uid('usr'),
        name: 'Rafael Nunes',
        email: 'rafael@eliteclub.local',
        phone: '11985556666',
        nickname: 'RafaN',
        role: 'player',
        passwordHash: hashPassword('player123'),
        createdAt: now,
      },
    ];
    await writeJson('users', seedUsers);

    const t1 = {
      id: uid('trn'),
      name: 'High Roller Friday',
      description: 'Torneio principal com blinds progressivos e estrutura premium.',
      type: 'torneio',
      date: daysFromNow(3),
      time: '20:00',
      location: 'Sala Ouro - Elite Club',
      buyIn: 500,
      estimatedPrize: 35000,
      totalSlots: 8,
      remainingSlots: 1,
      status: 'ativo',
      rules: 'Freezeout. Re-entry permitido até o nível 8.',
      checkinEnabled: true,
      checkinStart: hoursFromNow(60),
      checkinEnd: hoursFromNow(74),
      category: 'tournament',
      createdAt: now,
    };
    const t2 = {
      id: uid('evt'),
      name: 'Satellite Sunday',
      description: 'Classificatório com vaga para Main Event.',
      type: 'satélite',
      date: daysFromNow(7),
      time: '18:00',
      location: 'Salão Black',
      buyIn: 120,
      estimatedPrize: 12000,
      totalSlots: 20,
      remainingSlots: 0,
      status: 'lotado',
      rules: 'Top 3 garantem vaga. Sem add-on.',
      checkinEnabled: true,
      checkinStart: hoursFromNow(150),
      checkinEnd: hoursFromNow(166),
      category: 'event',
      createdAt: now,
    };
    const t3 = {
      id: uid('evt'),
      name: 'Cash Game Night',
      description: 'Mesa de cash game com blind flexível.',
      type: 'cash game',
      date: daysFromNow(1),
      time: '21:00',
      location: 'Lounge Diamond',
      buyIn: 200,
      estimatedPrize: 0,
      totalSlots: 12,
      remainingSlots: 6,
      status: 'ativo',
      rules: 'Stack inicial de 200BB.',
      checkinEnabled: true,
      checkinStart: hoursFromNow(12),
      checkinEnd: hoursFromNow(28),
      category: 'event',
      createdAt: now,
    };
    await writeJson('tournaments', [t1]);
    await writeJson('events', [t2, t3]);

    const usersSeed = seedUsers.filter((u) => u.role === 'player');
    const reg1 = makeRegistration(usersSeed[0], t1, 'confirmed');
    const reg2 = makeRegistration(usersSeed[1], t1, 'confirmed');
    const reg3 = makeRegistration(usersSeed[2], t2, 'waitlist');

    await writeJson('registrations', [reg1, reg2, reg3]);
    await writeJson('waitlist', [
      {
        id: uid('wlt'),
        eventId: t2.id,
        userId: usersSeed[2].id,
        registrationId: reg3.id,
        position: 1,
        status: 'waiting',
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await writeJson('checkins', [
      {
        id: uid('chk'),
        registrationId: reg1.id,
        userId: usersSeed[0].id,
        eventId: t1.id,
        status: 'confirmed',
        checkedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      },
    ]);
    await writeJson('notifications', [
      {
        id: uid('ntf'),
        userId: usersSeed[0].id,
        title: 'Bem-vindo ao Elite Tournament Club',
        message: 'Sua conta está pronta para inscrições e check-ins.',
        read: false,
        createdAt: now,
      },
      {
        id: uid('ntf'),
        userId: usersSeed[2].id,
        title: 'Você está na fila de espera',
        message: `Evento ${t2.name} lotado. Posição atual: 1`,
        read: false,
        createdAt: now,
      },
    ]);
  }
};

function makeRegistration(user, event, status) {
  const createdAt = new Date().toISOString();
  const regId = uid('reg');
  const payload = `${user.id}|${event.id}|${regId}|${createdAt}`;
  const signature = crypto.createHmac('sha256', QR_SECRET).update(payload).digest('hex');
  const token = Buffer.from(JSON.stringify({ userId: user.id, eventId: event.id, registrationId: regId, ts: createdAt, sig: signature })).toString('base64url');
  return {
    id: regId,
    userId: user.id,
    eventId: event.id,
    status,
    checkinStatus: 'pending',
    qrToken: token,
    createdAt,
    updatedAt: createdAt,
  };
}

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function hoursFromNow(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

async function readJson(key) {
  const p = path.join(DATA_DIR, files[key]);
  const content = await fsp.readFile(p, 'utf8');
  try {
    return JSON.parse(content || '[]');
  } catch {
    return [];
  }
}

async function writeJson(key, data) {
  const p = path.join(DATA_DIR, files[key]);
  await fsp.writeFile(p, JSON.stringify(data, null, 2), 'utf8');
}

function uid(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(`elite::${password}`).digest('hex');
}

function safeUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Payload grande demais'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('JSON inválido'));
      }
    });
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME_TYPES[ext] || 'application/octet-stream';
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    sendJson(res, 404, { error: 'Arquivo não encontrado' });
  });
  res.writeHead(200, { 'Content-Type': type });
  stream.pipe(res);
}

function getCookie(req, name) {
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  const items = cookie.split(';').map((v) => v.trim());
  const item = items.find((v) => v.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.split('=')[1]) : null;
}

function setCookie(res, name, value, maxAge = SESSION_TTL_MS / 1000) {
  res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(value)}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax`);
}

async function getSession(req) {
  const token = getCookie(req, 'session_token');
  if (!token) return null;
  const sessions = await readJson('sessions');
  const session = sessions.find((s) => s.token === token && s.expiresAt > Date.now());
  if (!session) return null;
  const users = await readJson('users');
  const user = users.find((u) => u.id === session.userId);
  return user ? { session, user } : null;
}

function notFound(res) {
  sendJson(res, 404, { error: 'Rota não encontrada' });
}

function validateEventPayload(payload) {
  const required = ['name', 'description', 'type', 'date', 'time', 'location', 'totalSlots'];
  const missing = required.find((k) => !payload[k] && payload[k] !== 0);
  if (missing) return `Campo obrigatório: ${missing}`;
  const total = Number(payload.totalSlots);
  if (!Number.isInteger(total) || total < 1) return 'totalSlots precisa ser inteiro maior que 0';
  return null;
}

async function promoteWaitlistIfPossible(eventId) {
  const registrations = await readJson('registrations');
  const waitlist = await readJson('waitlist');
  const events = [...(await readJson('tournaments')), ...(await readJson('events'))];
  const event = events.find((e) => e.id === eventId);
  if (!event || event.remainingSlots <= 0) return;

  const candidate = waitlist
    .filter((w) => w.eventId === eventId && w.status === 'waiting')
    .sort((a, b) => a.position - b.position)[0];
  if (!candidate) return;

  const reg = registrations.find((r) => r.id === candidate.registrationId);
  if (!reg) return;

  reg.status = 'confirmed';
  reg.updatedAt = new Date().toISOString();
  candidate.status = 'promoted';
  candidate.updatedAt = new Date().toISOString();
  event.remainingSlots = Math.max(0, event.remainingSlots - 1);
  event.status = event.remainingSlots === 0 ? 'lotado' : 'ativo';

  const notifications = await readJson('notifications');
  notifications.push({
    id: uid('ntf'),
    userId: reg.userId,
    title: 'Você subiu da fila de espera',
    message: `Sua inscrição no evento ${event.name} foi confirmada automaticamente.`,
    read: false,
    createdAt: new Date().toISOString(),
  });

  await writeJson('registrations', registrations);
  await writeJson('waitlist', waitlist.map((w, i) => ({ ...w, position: i + 1 })));
  if ((await readJson('tournaments')).find((x) => x.id === eventId)) {
    const tourns = await readJson('tournaments');
    const idx = tourns.findIndex((x) => x.id === eventId);
    if (idx >= 0) tourns[idx] = event;
    await writeJson('tournaments', tourns);
  } else {
    const evs = await readJson('events');
    const idx = evs.findIndex((x) => x.id === eventId);
    if (idx >= 0) evs[idx] = event;
    await writeJson('events', evs);
  }
  await writeJson('notifications', notifications);
}

async function handleApi(req, res, pathname) {
  if (req.method === 'POST' && pathname === '/api/auth/register') {
    const body = await parseBody(req);
    const { name, email, phone, password, nickname } = body;
    if (!name || !email || !phone || !password) return sendJson(res, 400, { error: 'Preencha todos os campos obrigatórios.' });

    const users = await readJson('users');
    if (users.some((u) => u.email.toLowerCase() === String(email).toLowerCase())) {
      return sendJson(res, 400, { error: 'E-mail já cadastrado.' });
    }

    const user = {
      id: uid('usr'),
      name,
      email: String(email).toLowerCase(),
      phone,
      nickname: nickname || '',
      role: 'player',
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    await writeJson('users', users);
    sendJson(res, 201, { user: safeUser(user) });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/recover') {
    const body = await parseBody(req);
    if (!body.email || !body.newPassword) return sendJson(res, 400, { error: 'Informe e-mail e nova senha.' });
    const users = await readJson('users');
    const user = users.find((u) => u.email.toLowerCase() === String(body.email).toLowerCase());
    if (!user) return sendJson(res, 404, { error: 'Usuário não encontrado.' });
    user.passwordHash = hashPassword(body.newPassword);
    await writeJson('users', users);
    sendJson(res, 200, { message: 'Senha atualizada localmente.' });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const body = await parseBody(req);
    const users = await readJson('users');
    const user = users.find((u) => u.email.toLowerCase() === String(body.email || '').toLowerCase());
    if (!user || user.passwordHash !== hashPassword(body.password || '')) {
      return sendJson(res, 401, { error: 'Credenciais inválidas.' });
    }

    const sessions = await readJson('sessions');
    const token = crypto.randomBytes(24).toString('base64url');
    sessions.push({ token, userId: user.id, createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_MS });
    await writeJson('sessions', sessions);
    setCookie(res, 'session_token', token);
    sendJson(res, 200, { user: safeUser(user) });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    const token = getCookie(req, 'session_token');
    if (token) {
      const sessions = await readJson('sessions');
      await writeJson('sessions', sessions.filter((s) => s.token !== token));
    }
    setCookie(res, 'session_token', '', 0);
    sendJson(res, 200, { message: 'Logout realizado.' });
    return;
  }

  const auth = await getSession(req);

  if (req.method === 'GET' && pathname === '/api/me') {
    if (!auth) return sendJson(res, 401, { error: 'Não autenticado.' });
    return sendJson(res, 200, { user: safeUser(auth.user) });
  }

  if (!auth) return sendJson(res, 401, { error: 'Sessão expirada.' });

  if (req.method === 'GET' && pathname === '/api/tournaments') {
    return sendJson(res, 200, { items: await readJson('tournaments') });
  }

  if (req.method === 'GET' && pathname === '/api/events') {
    return sendJson(res, 200, { items: await readJson('events') });
  }

  if (req.method === 'GET' && pathname === '/api/notifications') {
    const notifications = await readJson('notifications');
    const visible = auth.user.role === 'admin' ? notifications : notifications.filter((n) => n.userId === auth.user.id);
    return sendJson(res, 200, { items: visible.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  }

  if (req.method === 'POST' && pathname === '/api/notifications/read') {
    const body = await parseBody(req);
    const notifications = await readJson('notifications');
    const item = notifications.find((n) => n.id === body.id && (n.userId === auth.user.id || auth.user.role === 'admin'));
    if (!item) return sendJson(res, 404, { error: 'Notificação não encontrada.' });
    item.read = true;
    await writeJson('notifications', notifications);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/registrations') {
    const regs = await readJson('registrations');
    const users = await readJson('users');
    const events = [...(await readJson('tournaments')), ...(await readJson('events'))];
    const result = regs
      .filter((r) => auth.user.role === 'admin' || r.userId === auth.user.id)
      .map((r) => ({ ...r, user: safeUser(users.find((u) => u.id === r.userId) || {}), event: events.find((e) => e.id === r.eventId) || null }));
    return sendJson(res, 200, { items: result });
  }

  if (req.method === 'POST' && pathname === '/api/registrations') {
    const body = await parseBody(req);
    if (!body.eventId) return sendJson(res, 400, { error: 'eventId obrigatório.' });
    const tournaments = await readJson('tournaments');
    const events = await readJson('events');
    const all = [...tournaments, ...events];
    const event = all.find((e) => e.id === body.eventId);
    if (!event) return sendJson(res, 404, { error: 'Evento não encontrado.' });
    if (!['ativo', 'lotado'].includes(event.status)) return sendJson(res, 400, { error: 'Evento indisponível.' });

    const regs = await readJson('registrations');
    const existing = regs.find((r) => r.eventId === event.id && r.userId === auth.user.id && r.status !== 'cancelled');
    if (existing) return sendJson(res, 400, { error: 'Você já possui inscrição para este evento.' });

    let status = 'confirmed';
    if (event.remainingSlots <= 0) status = 'waitlist';

    const reg = makeRegistration(auth.user, event, status);
    regs.push(reg);

    if (status === 'confirmed') {
      event.remainingSlots = Math.max(0, event.remainingSlots - 1);
      event.status = event.remainingSlots === 0 ? 'lotado' : 'ativo';
    }

    const notifications = await readJson('notifications');
    notifications.push({
      id: uid('ntf'),
      userId: auth.user.id,
      title: status === 'confirmed' ? 'Inscrição confirmada' : 'Entrou na lista de espera',
      message: status === 'confirmed' ? `Você está confirmado em ${event.name}.` : `Evento lotado. Você entrou na fila de espera de ${event.name}.`,
      read: false,
      createdAt: new Date().toISOString(),
    });

    if (status === 'waitlist') {
      const waitlist = await readJson('waitlist');
      const position = waitlist.filter((w) => w.eventId === event.id && w.status === 'waiting').length + 1;
      waitlist.push({
        id: uid('wlt'),
        eventId: event.id,
        userId: auth.user.id,
        registrationId: reg.id,
        position,
        status: 'waiting',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await writeJson('waitlist', waitlist);
    }

    await writeJson('registrations', regs);
    await writeJson('notifications', notifications);
    if (tournaments.find((e) => e.id === event.id)) {
      await writeJson('tournaments', tournaments.map((t) => (t.id === event.id ? event : t)));
    } else {
      await writeJson('events', events.map((t) => (t.id === event.id ? event : t)));
    }

    return sendJson(res, 201, { item: reg, event });
  }

  if (req.method === 'DELETE' && pathname.startsWith('/api/registrations/')) {
    const regId = pathname.split('/').pop();
    const regs = await readJson('registrations');
    const reg = regs.find((r) => r.id === regId && (auth.user.role === 'admin' || r.userId === auth.user.id));
    if (!reg) return sendJson(res, 404, { error: 'Inscrição não encontrada.' });
    if (reg.status === 'cancelled') return sendJson(res, 400, { error: 'Inscrição já cancelada.' });

    reg.status = 'cancelled';
    reg.updatedAt = new Date().toISOString();

    const tournaments = await readJson('tournaments');
    const events = await readJson('events');
    const event = [...tournaments, ...events].find((e) => e.id === reg.eventId);
    if (event && reg.status !== 'waitlist') {
      event.remainingSlots = Math.min(event.totalSlots, event.remainingSlots + 1);
      event.status = event.remainingSlots >= event.totalSlots ? 'ativo' : event.status;
    }

    await writeJson('registrations', regs);
    if (event) {
      if (tournaments.some((t) => t.id === event.id)) await writeJson('tournaments', tournaments.map((t) => (t.id === event.id ? event : t)));
      if (events.some((e) => e.id === event.id)) await writeJson('events', events.map((e) => (e.id === event.id ? event : e)));
      await promoteWaitlistIfPossible(event.id);
    }

    sendJson(res, 200, { message: 'Inscrição cancelada.' });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/checkin/validate') {
    if (auth.user.role !== 'admin') return sendJson(res, 403, { error: 'Somente admin.' });
    const body = await parseBody(req);
    const token = body.qrToken || body.manualToken;
    if (!token) return sendJson(res, 400, { error: 'Token ausente.' });

    let decoded;
    try {
      decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    } catch {
      return sendJson(res, 400, { status: 'invalid', error: 'Token inválido.' });
    }

    const payload = `${decoded.userId}|${decoded.eventId}|${decoded.registrationId}|${decoded.ts}`;
    const expectedSig = crypto.createHmac('sha256', QR_SECRET).update(payload).digest('hex');
    if (expectedSig !== decoded.sig) return sendJson(res, 400, { status: 'invalid', error: 'Assinatura inválida.' });

    const regs = await readJson('registrations');
    const reg = regs.find((r) => r.id === decoded.registrationId && r.userId === decoded.userId && r.eventId === decoded.eventId);
    if (!reg) return sendJson(res, 404, { status: 'invalid', error: 'Inscrição não encontrada.' });

    const users = await readJson('users');
    const events = [...(await readJson('tournaments')), ...(await readJson('events'))];
    const user = users.find((u) => u.id === reg.userId);
    const event = events.find((e) => e.id === reg.eventId);
    if (!user || !event) return sendJson(res, 404, { status: 'invalid', error: 'Dados inconsistentes.' });

    let status = 'valid';
    if (reg.status === 'cancelled') status = 'cancelled';
    else if (reg.checkinStatus === 'confirmed') status = 'already_used';
    else if (!event.checkinEnabled) status = 'checkin_disabled';
    else if (new Date() < new Date(event.checkinStart) || new Date() > new Date(event.checkinEnd)) status = 'outside_window';

    sendJson(res, 200, {
      status,
      registration: reg,
      player: safeUser(user),
      event,
      now: new Date().toISOString(),
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/checkin/confirm') {
    if (auth.user.role !== 'admin') return sendJson(res, 403, { error: 'Somente admin.' });
    const body = await parseBody(req);
    const regs = await readJson('registrations');
    const reg = regs.find((r) => r.id === body.registrationId);
    if (!reg) return sendJson(res, 404, { error: 'Inscrição não encontrada.' });
    if (reg.checkinStatus === 'confirmed') return sendJson(res, 400, { error: 'Check-in já realizado.' });
    if (reg.status === 'cancelled') return sendJson(res, 400, { error: 'Inscrição cancelada.' });

    reg.checkinStatus = 'confirmed';
    reg.updatedAt = new Date().toISOString();

    const checkins = await readJson('checkins');
    checkins.push({
      id: uid('chk'),
      registrationId: reg.id,
      userId: reg.userId,
      eventId: reg.eventId,
      status: 'confirmed',
      checkedAt: new Date().toISOString(),
      staffId: auth.user.id,
    });
    await writeJson('registrations', regs);
    await writeJson('checkins', checkins);
    sendJson(res, 200, { message: 'Check-in confirmado.' });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/checkins') {
    const checkins = await readJson('checkins');
    const users = await readJson('users');
    const events = [...(await readJson('tournaments')), ...(await readJson('events'))];
    const rows = checkins
      .filter((c) => auth.user.role === 'admin' || c.userId === auth.user.id)
      .map((c) => ({ ...c, player: safeUser(users.find((u) => u.id === c.userId) || {}), event: events.find((e) => e.id === c.eventId) || null }));
    return sendJson(res, 200, { items: rows });
  }

  if (req.method === 'GET' && pathname === '/api/waitlist') {
    const waitlist = await readJson('waitlist');
    const users = await readJson('users');
    const events = [...(await readJson('tournaments')), ...(await readJson('events'))];
    return sendJson(res, 200, {
      items: waitlist
        .filter((w) => auth.user.role === 'admin' || w.userId === auth.user.id)
        .map((w) => ({ ...w, player: safeUser(users.find((u) => u.id === w.userId) || {}), event: events.find((e) => e.id === w.eventId) || null })),
    });
  }

  if (req.method === 'GET' && pathname === '/api/users') {
    if (auth.user.role !== 'admin') return sendJson(res, 403, { error: 'Somente admin.' });
    return sendJson(res, 200, { items: (await readJson('users')).map(safeUser) });
  }

  if (req.method === 'GET' && pathname === '/api/admin/dashboard') {
    if (auth.user.role !== 'admin') return sendJson(res, 403, { error: 'Somente admin.' });
    const users = (await readJson('users')).filter((u) => u.role === 'player').length;
    const tournaments = await readJson('tournaments');
    const events = await readJson('events');
    const regs = await readJson('registrations');
    const checkins = await readJson('checkins');
    const today = new Date().toISOString().split('T')[0];

    const occupancy = [...tournaments, ...events].map((e) => ({
      id: e.id,
      name: e.name,
      occupancy: `${e.totalSlots - e.remainingSlots}/${e.totalSlots}`,
    }));

    return sendJson(res, 200, {
      metrics: {
        totalPlayers: users,
        activeTournaments: tournaments.filter((t) => t.status === 'ativo').length,
        futureEvents: [...tournaments, ...events].filter((e) => e.date >= today).length,
        pendingOrConfirmed: regs.filter((r) => ['confirmed', 'waitlist'].includes(r.status)).length,
        checkinsToday: checkins.filter((c) => c.checkedAt.startsWith(today)).length,
      },
      occupancy,
    });
  }

  if (req.method === 'POST' && (pathname === '/api/tournaments' || pathname === '/api/events')) {
    if (auth.user.role !== 'admin') return sendJson(res, 403, { error: 'Somente admin.' });
    const body = await parseBody(req);
    const validation = validateEventPayload(body);
    if (validation) return sendJson(res, 400, { error: validation });

    const now = new Date().toISOString();
    const item = {
      id: uid(pathname.includes('tournaments') ? 'trn' : 'evt'),
      name: body.name,
      description: body.description,
      type: body.type,
      date: body.date,
      time: body.time,
      location: body.location,
      buyIn: Number(body.buyIn || 0),
      estimatedPrize: Number(body.estimatedPrize || 0),
      totalSlots: Number(body.totalSlots),
      remainingSlots: Number(body.totalSlots),
      status: 'ativo',
      rules: body.rules || '',
      checkinEnabled: Boolean(body.checkinEnabled),
      checkinStart: body.checkinStart || new Date().toISOString(),
      checkinEnd: body.checkinEnd || new Date(Date.now() + 86400000).toISOString(),
      createdAt: now,
    };

    if (pathname.includes('tournaments')) {
      const list = await readJson('tournaments');
      list.push(item);
      await writeJson('tournaments', list);
    } else {
      const list = await readJson('events');
      list.push(item);
      await writeJson('events', list);
    }
    return sendJson(res, 201, { item });
  }

  if ((req.method === 'PUT' || req.method === 'DELETE') && (pathname.startsWith('/api/tournaments/') || pathname.startsWith('/api/events/'))) {
    if (auth.user.role !== 'admin') return sendJson(res, 403, { error: 'Somente admin.' });
    const [_, __, kind, id] = pathname.split('/');
    const key = kind === 'tournaments' ? 'tournaments' : 'events';
    const list = await readJson(key);
    const idx = list.findIndex((x) => x.id === id);
    if (idx < 0) return sendJson(res, 404, { error: 'Item não encontrado.' });

    if (req.method === 'DELETE') {
      list[idx].status = 'cancelado';
      list[idx].updatedAt = new Date().toISOString();
      await writeJson(key, list);
      return sendJson(res, 200, { message: 'Cancelado com sucesso.' });
    }

    const body = await parseBody(req);
    list[idx] = { ...list[idx], ...body, updatedAt: new Date().toISOString() };
    await writeJson(key, list);
    return sendJson(res, 200, { item: list[idx] });
  }

  if (req.method === 'GET' && pathname === '/api/export/registrations') {
    if (auth.user.role !== 'admin') return sendJson(res, 403, { error: 'Somente admin.' });
    const regs = await readJson('registrations');
    const outPath = path.join(DATA_DIR, `export_registrations_${Date.now()}.json`);
    await fsp.writeFile(outPath, JSON.stringify(regs, null, 2), 'utf8');
    return sendJson(res, 200, { message: 'Export criado', file: path.basename(outPath) });
  }

  notFound(res);
}

function serveStatic(req, res, pathname) {
  const normalized = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(normalized).replace(/^\.+/, '');

  if (safePath.startsWith('/admin')) {
    const rel = safePath.replace('/admin', '') || '/admin.html';
    const file = path.join(ADMIN_DIR, rel === '/' ? 'admin.html' : rel);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return sendFile(res, file);
    return sendFile(res, path.join(ADMIN_DIR, 'admin.html'));
  }

  const filePath = path.join(PUBLIC_DIR, safePath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return sendFile(res, filePath);
  }
  return sendFile(res, path.join(PUBLIC_DIR, 'index.html'));
}

async function main() {
  await ensureData();
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname.startsWith('/api/')) {
        await handleApi(req, res, url.pathname);
      } else {
        serveStatic(req, res, url.pathname);
      }
    } catch (err) {
      console.error(err);
      sendJson(res, 500, { error: 'Erro interno do servidor.' });
    }
  });

  server.listen(PORT, () => {
    console.log(`Elite Tournament Club em http://localhost:${PORT}`);
  });
}

main();
