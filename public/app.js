const state = { user: null, route: 'home', tournaments: [], events: [], registrations: [], notifications: [], checkins: [], waitlist: [] };

const $ = (s) => document.querySelector(s);
const view = $('#view');

function toast(msg, bad = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.style.display = 'block';
  t.style.borderColor = bad ? '#ff7070' : '#d6b36b';
  setTimeout(() => (t.style.display = 'none'), 2600);
}

async function api(path, options = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro de comunicação');
  return data;
}

function setAuthMode(mode) {
  $('#loginForm').classList.toggle('hidden', mode !== 'login');
  $('#registerForm').classList.toggle('hidden', mode !== 'register');
  $('#recoverForm').classList.toggle('hidden', mode !== 'recover');
  $('#authTitle').textContent = mode === 'login' ? 'Entrar' : mode === 'register' ? 'Cadastro' : 'Recuperação local';
}

function eventCard(e, reg) {
  const occupied = e.totalSlots - e.remainingSlots;
  return `<article class="card"><h3>${e.name}</h3><p>${e.description}</p><div class="grid two"><small>${e.date} ${e.time}</small><small>${e.location}</small><small>Tipo: ${e.type}</small><small>Buy-in: R$ ${e.buyIn}</small><small>Vagas: ${occupied}/${e.totalSlots}</small><small>Status: ${e.status}</small></div>
  <p class="muted">Check-in: ${e.checkinEnabled ? 'habilitado' : 'desabilitado'}</p>
  ${reg ? `<span class="status ${reg.status}">${reg.status}</span> <button data-cancel="${reg.id}" class="danger">Cancelar</button>` : `<button data-register="${e.id}">${e.remainingSlots > 0 ? 'Inscrever-se' : 'Entrar na fila'}</button>`}</article>`;
}

function registrationCard(r) {
  const qr = InternalQR.svg(r.qrToken, 170);
  return `<article class="card ticket"><div><h3>${r.event?.name || 'Evento removido'}</h3><p>Status inscrição: <span class="status ${r.status}">${r.status}</span></p><p>Status check-in: <span class="status ${r.checkinStatus}">${r.checkinStatus}</span></p><small>${r.createdAt}</small></div><div><div class="qr-box">${qr}</div><small>Token: ${r.qrToken.slice(0, 18)}...</small></div></article>`;
}

async function loadCore() {
  const [tournaments, events, registrations, notifications, checkins, waitlist] = await Promise.all([
    api('/api/tournaments'), api('/api/events'), api('/api/registrations'), api('/api/notifications'), api('/api/checkins'), api('/api/waitlist'),
  ]);
  state.tournaments = tournaments.items;
  state.events = events.items;
  state.registrations = registrations.items;
  state.notifications = notifications.items;
  state.checkins = checkins.items;
  state.waitlist = waitlist.items;
}

function renderHome() {
  const upcoming = [...state.tournaments, ...state.events].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const next = upcoming[0];
  const myPending = state.registrations.filter((r) => ['confirmed', 'waitlist'].includes(r.status)).length;
  view.innerHTML = `<section class="card"><h2>Bem-vindo, ${state.user.name}</h2><p class="muted">${state.user.nickname || 'Jogador'} • ${state.user.email}</p></section>
  ${next ? `<section class="card"><h3>Próximo destaque</h3><p><strong>${next.name}</strong></p><small>${next.date} ${next.time} • ${next.location}</small><p>Vagas restantes: ${next.remainingSlots}</p></section>` : ''}
  <section class="grid two"><article class="card"><h3>Inscrições ativas</h3><p>${myPending}</p></article><article class="card"><h3>Avisos</h3><p>${state.notifications.filter((n) => !n.read).length}</p></article></section>
  <section class="card"><h3>Próximos eventos</h3>${upcoming.slice(0, 3).map((e) => `<p>${e.date} • ${e.name} • vagas ${e.remainingSlots}</p>`).join('') || '<p class="muted">Sem agenda.</p>'}</section>`;
}

function renderEvents(type) {
  const items = type === 'torneios' ? state.tournaments : state.events;
  view.innerHTML = `<h2>${type === 'torneios' ? 'Torneios' : 'Eventos'}</h2>${items.map((e) => eventCard(e, state.registrations.find((r) => r.eventId === e.id && r.status !== 'cancelled'))).join('') || '<div class="card">Sem itens.</div>'}`;
}

function renderRegistrations() {
  const mine = state.registrations;
  view.innerHTML = `<h2>Minhas inscrições</h2>${mine.map(registrationCard).join('') || '<div class="card">Você não possui inscrições.</div>'}`;
}

function renderCheckins() {
  const future = state.registrations.filter((r) => r.status === 'confirmed' && r.checkinStatus !== 'confirmed');
  view.innerHTML = `<h2>Meus check-ins</h2><section class="card"><h3>Histórico</h3>${state.checkins.map((c) => `<p>${c.event?.name || '-'} • ${new Date(c.checkedAt).toLocaleString('pt-BR')}</p>`).join('') || '<p class="muted">Sem check-ins.</p>'}</section>
  <section class="card"><h3>Ingressos futuros</h3>${future.map((r) => `<p>${r.event?.name || '-'} • ${r.event?.date}</p>`).join('') || '<p class="muted">Nenhum ingresso pendente.</p>'}</section>`;
}

function renderProfile() {
  view.innerHTML = `<h2>Perfil</h2><section class="card"><p><strong>Nome:</strong> ${state.user.name}</p><p><strong>E-mail:</strong> ${state.user.email}</p><p><strong>Telefone:</strong> ${state.user.phone}</p><p><strong>Apelido:</strong> ${state.user.nickname || '-'}</p><p><strong>Perfil:</strong> ${state.user.role}</p></section>
  <section class="card"><h3>Notificações</h3>${state.notifications.map((n) => `<p>${n.read ? '✓' : '•'} ${n.title}<br><small>${n.message}</small></p>`).join('') || '<p class="muted">Sem notificações.</p>'}</section>
  <section class="card"><h3>Histórico de fila de espera</h3>${state.waitlist.map((w) => `<p>${w.event?.name || '-'} • posição ${w.position} • ${w.status}</p>`).join('') || '<p class="muted">Sem histórico.</p>'}</section>`;
}

function render() {
  document.querySelectorAll('#bottomNav button').forEach((b) => b.classList.toggle('active', b.dataset.route === state.route));
  if (state.route === 'home') renderHome();
  if (state.route === 'events') renderEvents('eventos');
  if (state.route === 'tournaments') renderEvents('torneios');
  if (state.route === 'registrations') renderRegistrations();
  if (state.route === 'checkins') renderCheckins();
  if (state.route === 'profile' || state.route === 'notifications' || state.route === 'history') renderProfile();
}

async function boot() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  setTimeout(() => { $('#splash').classList.add('hidden'); }, 700);

  $('#switchLogin').onclick = () => setAuthMode('login');
  $('#switchRegister').onclick = () => setAuthMode('register');
  $('#switchRecover').onclick = () => setAuthMode('recover');

  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(fd.entries())) });
      state.user = r.user;
      await afterLogin();
      if (state.user.role === 'admin') location.href = '/admin';
    } catch (err) { toast(err.message, true); }
  };

  $('#registerForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/api/auth/register', { method: 'POST', body: JSON.stringify(Object.fromEntries(fd.entries())) });
      toast('Cadastro realizado. Faça login.');
      setAuthMode('login');
    } catch (err) { toast(err.message, true); }
  };

  $('#recoverForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/api/auth/recover', { method: 'POST', body: JSON.stringify(Object.fromEntries(fd.entries())) });
      toast('Senha atualizada.');
      setAuthMode('login');
    } catch (err) { toast(err.message, true); }
  };

  $('#logoutBtn').onclick = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    state.user = null;
    $('#app').classList.add('hidden');
    $('#auth').classList.remove('hidden');
  };

  $('#bottomNav').onclick = (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    state.route = e.target.dataset.route;
    render();
  };

  view.addEventListener('click', async (e) => {
    const regBtn = e.target.closest('[data-register]');
    const cancelBtn = e.target.closest('[data-cancel]');
    try {
      if (regBtn) {
        await api('/api/registrations', { method: 'POST', body: JSON.stringify({ eventId: regBtn.dataset.register }) });
        toast('Solicitação realizada.');
        await loadCore();
        render();
      }
      if (cancelBtn) {
        await api(`/api/registrations/${cancelBtn.dataset.cancel}`, { method: 'DELETE' });
        toast('Inscrição cancelada.');
        await loadCore();
        render();
      }
    } catch (err) { toast(err.message, true); }
  });

  try {
    const me = await api('/api/me');
    state.user = me.user;
    if (state.user.role === 'admin') location.href = '/admin';
    await afterLogin();
  } catch {
    $('#auth').classList.remove('hidden');
    setAuthMode('login');
  }
}

async function afterLogin() {
  $('#auth').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#bottomNav').classList.remove('hidden');
  await loadCore();
  render();
}

boot();
