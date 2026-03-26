const STORAGE_KEYS = {
  user: 'clubElite_user',
  registrations: 'clubElite_registrations',
  waitlist: 'clubElite_waitlist',
  prefs: 'clubElite_preferences',
  notificationsRead: 'clubElite_notifications_read'
};

const mock = {
  user: { name: 'Rafael Costa', email: 'rafael@elite.com', phone: '(11) 98888-7777', nickname: 'Rafa Shark', avatar: 'RC', preferences: ['Texas Hold\'em', 'PLO', 'High Roller'] },
  events: [
    { id: 1, name: 'Cash Game Midnight', date: '2026-03-28', time: '22:00', type: 'Cash Game', buyIn: 'R$ 500', blinds: '5/10', slots: 9, taken: 6, status: 'disponível' },
    { id: 2, name: 'Elite Sunday Major', date: '2026-03-29', time: '17:00', type: 'Torneio', buyIn: 'R$ 1.500', blinds: '20 min', prize: 'R$ 80.000', slots: 70, taken: 69, status: 'últimas vagas', structure: 'Stack inicial 30.000 / níveis de 20 min' },
    { id: 3, name: 'VIP Invitational', date: '2026-04-01', time: '20:30', type: 'Evento especial', buyIn: 'R$ 3.000', blinds: '25 min', prize: 'R$ 140.000', slots: 45, taken: 45, status: 'lotado', structure: 'Freezeout com bounty progressivo' },
    { id: 4, name: 'Satellite High Stakes', date: '2026-04-02', time: '19:00', type: 'Satélite', buyIn: 'R$ 250', blinds: '15 min', prize: 'Pacote High Roller', slots: 36, taken: 11, status: 'disponível', structure: '5 vagas garantidas para High Roller' },
    { id: 5, name: 'Legends Deepstack', date: '2026-04-03', time: '18:00', type: 'Torneio', buyIn: 'R$ 900', blinds: '20 min', prize: 'R$ 60.000', slots: 90, taken: 90, status: 'lotado', structure: 'Deepstack 50.000 fichas' }
  ],
  leaderboard: [
    { name: 'André Blitz', points: 1920, wins: 12, freq: '96%' },
    { name: 'Carla Rivers', points: 1808, wins: 10, freq: '93%' },
    { name: 'Leo Titan', points: 1704, wins: 9, freq: '88%' },
    { name: 'Maya Queen', points: 1540, wins: 8, freq: '84%' },
    { name: 'Davi Stone', points: 1492, wins: 7, freq: '83%' }
  ],
  notifications: [
    { id: 'n1', type: 'nova rodada', text: 'Mesa Cash 10/20 liberada para hoje às 21:00.', time: 'há 12 min' },
    { id: 'n2', type: 'inscrição', text: 'Sua inscrição no Elite Sunday Major foi confirmada.', time: 'há 1h' },
    { id: 'n3', type: 'promoção', text: 'Bônus de entrada 15% no primeiro buy-in do fim de semana.', time: 'há 3h' },
    { id: 'n4', type: 'evento', text: 'Evento especial com jogador convidado em 01/04.', time: 'ontem' }
  ],
  promotions: [
    { title: 'Bônus New Seat', desc: 'Ganhe R$ 100 em fichas no primeiro check-in do mês.' },
    { title: 'VIP Wednesday', desc: 'Open food premium + blind level estendido.' },
    { title: 'Programa Black Card', desc: 'Acumule pontos e troque por entradas e gifts exclusivos.' }
  ]
};

const state = { view: 'home', authTab: 'login', scheduleFilter: 'Todos', leaderboardFilter: 'Geral', selectedTournamentId: null };
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function storageGet(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function storageSet(key, data) { localStorage.setItem(key, JSON.stringify(data)); }

function initData() {
  if (!storageGet(STORAGE_KEYS.registrations)) storageSet(STORAGE_KEYS.registrations, []);
  if (!storageGet(STORAGE_KEYS.waitlist)) storageSet(STORAGE_KEYS.waitlist, []);
  if (!storageGet(STORAGE_KEYS.notificationsRead)) storageSet(STORAGE_KEYS.notificationsRead, []);
}

function isLogged() { return !!storageGet(STORAGE_KEYS.user); }
function getUser() { return storageGet(STORAGE_KEYS.user, mock.user); }

function statusClass(status) {
  if (status === 'lotado') return 'full';
  if (status === 'últimas vagas') return 'last';
  if (status === 'cancelado') return 'cancelled';
  return 'available';
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  $('#toast-stack').appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

function openView(view, title = null) {
  state.view = view;
  $$('.view').forEach(v => v.classList.toggle('active', v.dataset.view === view));
  $$('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.nav === view));
  $('#screen-title').textContent = title || ({ home: 'Home', agenda: 'Agenda', tournaments: 'Torneios', ranking: 'Ranking', profile: 'Perfil', waitlist: 'Lista de Espera', notifications: 'Notificações', club: 'Clube', promotions: 'Benefícios', history: 'Histórico', 'tournament-detail': 'Detalhes' }[view] || 'Club Elite');
  renderCurrentView();
}

function unreadCount() {
  const read = storageGet(STORAGE_KEYS.notificationsRead, []);
  return mock.notifications.filter(n => !read.includes(n.id)).length;
}

function renderCurrentView() {
  const view = state.view;
  if (view === 'home') renderHome();
  else if (view === 'agenda') renderAgenda();
  else if (view === 'tournaments') renderTournaments();
  else if (view === 'ranking') renderRanking();
  else if (view === 'profile') renderProfile();
  else if (view === 'waitlist') renderWaitlist();
  else if (view === 'notifications') renderNotifications();
  else if (view === 'club') renderClub();
  else if (view === 'promotions') renderPromotions();
  else if (view === 'history') renderHistory();
  else if (view === 'tournament-detail') renderTournamentDetail();
  $('#notification-badge').textContent = unreadCount();
}

function renderHome() {
  const next = mock.events.find(e => e.type === 'Torneio');
  const cash = mock.events.filter(e => e.type === 'Cash Game').length;
  const openSlots = mock.events.reduce((acc, e) => acc + Math.max(e.slots - e.taken, 0), 0);
  $('[data-view="home"]').innerHTML = `
    <div class="banner">
      <p class="muted">Bem-vindo ao Club Elite</p>
      <h3>Experiência premium de poker com agenda inteligente</h3>
      <p>Próximo destaque: <b>${next.name}</b> • ${next.date} às ${next.time}</p>
    </div>
    <div class="kpis">
      <article class="kpi"><small>Próximo torneio</small><b>${next.time}</b><small>${next.date}</small></article>
      <article class="kpi"><small>Cash games</small><b>${cash}</b><small>essa semana</small></article>
      <article class="kpi"><small>Vagas livres</small><b>${openSlots}</b><small>geral</small></article>
      <article class="kpi"><small>Avisos</small><b>${unreadCount()}</b><small>não lidos</small></article>
    </div>
    <div class="quick-grid">
      <button class="quick-btn" data-quick="agenda">Ver Agenda</button>
      <button class="quick-btn" data-quick="tournaments">Inscrever-se</button>
      <button class="quick-btn" data-quick="waitlist">Minha Waitlist</button>
      <button class="quick-btn" data-quick="club">Regras da Casa</button>
    </div>
  `;
  $$('[data-quick]').forEach(btn => btn.onclick = () => openView(btn.dataset.quick));
}

function renderAgenda() {
  const filtered = state.scheduleFilter === 'Todos' ? mock.events : mock.events.filter(e => e.type === state.scheduleFilter);
  const cards = filtered.map(e => `
    <article class="card">
      <div class="row"><h3>${e.name}</h3><span class="status ${statusClass(e.status)}">${e.status}</span></div>
      <p class="muted">${e.date} • ${e.time} • ${e.type}</p>
      <div class="row"><small>Buy-in: ${e.buyIn}</small><small>Blinds: ${e.blinds}</small></div>
      <div class="row"><small>Vagas: ${e.slots - e.taken}/${e.slots}</small><button class="btn btn-secondary" data-open-tid="${e.id}">detalhes</button></div>
    </article>`).join('');
  $('[data-view="agenda"]').innerHTML = `
    <div class="filters">${['Todos', 'Cash Game', 'Torneio', 'Evento especial', 'Satélite'].map(t => `<button class="pill ${state.scheduleFilter === t ? 'active' : ''}" data-filter="${t}">${t}</button>`).join('')}</div>
    ${cards || '<p class="muted">Nenhum evento encontrado.</p>'}
  `;
  $$('[data-filter]').forEach(b => b.onclick = () => { state.scheduleFilter = b.dataset.filter; renderAgenda(); });
  $$('[data-open-tid]').forEach(b => b.onclick = () => { state.selectedTournamentId = Number(b.dataset.openTid); openView('tournament-detail'); });
}

function renderTournaments() {
  const tournaments = mock.events.filter(e => ['Torneio', 'Satélite', 'Evento especial'].includes(e.type));
  $('[data-view="tournaments"]').innerHTML = `
    <label>Buscar torneio<input class="input" id="search-tour" placeholder="Digite nome ou tipo" /></label>
    <div id="tour-list">${skeletons(3)}</div>
  `;
  setTimeout(() => updateTournamentList(tournaments, ''), 500);
  $('#search-tour').oninput = (ev) => updateTournamentList(tournaments, ev.target.value.toLowerCase());
}

function updateTournamentList(list, term) {
  const filtered = list.filter(t => (t.name + t.type).toLowerCase().includes(term));
  $('#tour-list').innerHTML = filtered.map(t => `
    <article class="card">
      <div class="row"><h3>${t.name}</h3><span class="status ${statusClass(t.status)}">${t.status}</span></div>
      <p class="muted">${t.date} • ${t.time}</p>
      <small>Buy-in: ${t.buyIn} • Premiação: ${t.prize || 'A definir'}</small>
      <small>Vagas: ${Math.max(t.slots - t.taken, 0)} • Estrutura: ${t.structure || 'Padrão Club Elite'}</small>
      <div class="row" style="margin-top:8px;">
        <button class="btn btn-secondary" data-open-tid="${t.id}">Detalhes</button>
        <button class="btn btn-primary" data-register="${t.id}">Inscrever</button>
      </div>
    </article>
  `).join('') || '<p class="muted">Sem resultados.</p>';

  $$('[data-register]').forEach(btn => btn.onclick = () => openRegisterModal(Number(btn.dataset.register)));
  $$('[data-open-tid]').forEach(btn => btn.onclick = () => { state.selectedTournamentId = Number(btn.dataset.openTid); openView('tournament-detail'); });
}

function renderTournamentDetail() {
  const t = mock.events.find(e => e.id === state.selectedTournamentId) || mock.events[1];
  $('[data-view="tournament-detail"]').innerHTML = `
    <article class="card">
      <h3>${t.name}</h3>
      <p class="muted">${t.date} às ${t.time} • ${t.type}</p>
      <p>Buy-in: <b>${t.buyIn}</b> | Premiação estimada: <b>${t.prize || 'A definir'}</b></p>
      <p>Estrutura: ${t.structure || 'Stack padrão e blinds progressivos.'}</p>
      <p>Vagas disponíveis: ${Math.max(t.slots - t.taken, 0)} de ${t.slots}</p>
      <div class="row">
        <button class="btn btn-primary" data-register="${t.id}">Confirmar inscrição</button>
        <button class="btn btn-secondary" data-waitlist="${t.id}">Entrar na waitlist</button>
      </div>
    </article>
  `;
  $('[data-register]')?.addEventListener('click', () => openRegisterModal(t.id));
  $('[data-waitlist]')?.addEventListener('click', () => addWaitlist(t.id));
}

function openRegisterModal(eventId) {
  const e = mock.events.find(x => x.id === eventId);
  $('#modal-text').textContent = `Confirmar inscrição em ${e.name} (${e.date} ${e.time})?`;
  $('#confirm-modal').classList.remove('hidden');
  $('#modal-confirm-btn').onclick = () => {
    const regs = storageGet(STORAGE_KEYS.registrations, []);
    if (!regs.some(r => r.eventId === eventId)) regs.push({ eventId, date: new Date().toISOString() });
    storageSet(STORAGE_KEYS.registrations, regs);
    $('#confirm-modal').classList.add('hidden');
    showToast('Inscrição confirmada com sucesso.');
    renderCurrentView();
  };
}

function addWaitlist(eventId) {
  const waitlist = storageGet(STORAGE_KEYS.waitlist, []);
  const exists = waitlist.find(w => w.eventId === eventId && w.active);
  if (exists) return showToast('Você já está na lista de espera deste evento.');
  const position = waitlist.filter(w => w.eventId === eventId && w.active).length + 1;
  waitlist.push({ eventId, position, eta: `${position * 15} min`, active: true, enteredAt: new Date().toISOString() });
  storageSet(STORAGE_KEYS.waitlist, waitlist);
  showToast(`Entrada na lista de espera confirmada. Posição #${position}.`);
  openView('waitlist');
}

function renderWaitlist() {
  const waitlist = storageGet(STORAGE_KEYS.waitlist, []);
  const active = waitlist.filter(w => w.active);
  const history = waitlist.filter(w => !w.active);
  $('[data-view="waitlist"]').innerHTML = `
    <h3>Fila Atual</h3>
    <div class="list">${active.map(w => {
      const event = mock.events.find(e => e.id === w.eventId);
      return `<article class="card"><div class="row"><b>${event.name}</b><span class="status last">#${w.position}</span></div><small>Tempo estimado: ${w.eta}</small></article>`;
    }).join('') || '<p class="muted">Você não está em nenhuma fila.</p>'}</div>
    <h3>Histórico</h3>
    <div class="list">${history.map(w => `<article class="card"><small>Evento #${w.eventId} • encerrada</small></article>`).join('') || '<p class="muted">Sem histórico anterior.</p>'}</div>
  `;
}

function renderProfile() {
  const user = getUser();
  const regs = storageGet(STORAGE_KEYS.registrations, []);
  $('[data-view="profile"]').innerHTML = `
    <article class="card">
      <div class="row"><div class="avatar">${user.avatar}</div><button class="btn btn-secondary" id="edit-profile">Editar perfil</button></div>
      <h3>${user.name}</h3>
      <p class="muted">${user.nickname}</p>
      <small>${user.email} • ${user.phone}</small>
      <p>Status de participação: <b>Ativo Premium</b></p>
      <p>Preferências: ${user.preferences.join(', ')}</p>
      <button class="btn btn-secondary" id="logout-btn">Sair da conta</button>
    </article>
    <article class="card"><h3>Histórico de inscrições</h3><p>${regs.length} inscrição(ões) realizadas.</p></article>
    <div class="quick-grid">
      <button class="quick-btn" data-quick="history">Histórico completo</button>
      <button class="quick-btn" data-quick="promotions">Benefícios VIP</button>
      <button class="quick-btn" data-quick="club">Informações Clube</button>
      <button class="quick-btn" data-quick="waitlist">Minha Waitlist</button>
    </div>
  `;
  $('#logout-btn').onclick = () => { localStorage.removeItem(STORAGE_KEYS.user); location.reload(); };
  $('#edit-profile').onclick = () => showToast('Editor de perfil preparado para integração com backend.');
  $$('[data-quick]').forEach(btn => btn.onclick = () => openView(btn.dataset.quick));
}

function renderRanking() {
  $('[data-view="ranking"]').innerHTML = `
    <div class="segmented">${['Semanal','Mensal','Geral'].map(f => `<button class="pill ${state.leaderboardFilter === f ? 'active' : ''}" data-rank-filter="${f}">${f}</button>`).join('')}</div>
    ${mock.leaderboard.map((p, i) => `<article class="card"><div class="row"><b>#${i+1} ${p.name}</b>${i < 3 ? '<span>👑</span>' : ''}</div><small>Pontos: ${p.points} • Vitórias: ${p.wins} • Frequência: ${p.freq}</small></article>`).join('')}
  `;
  $$('[data-rank-filter]').forEach(btn => btn.onclick = () => { state.leaderboardFilter = btn.dataset.rankFilter; renderRanking(); showToast(`Filtro ${state.leaderboardFilter.toLowerCase()} aplicado.`); });
}

function renderNotifications() {
  const read = storageGet(STORAGE_KEYS.notificationsRead, []);
  $('[data-view="notifications"]').innerHTML = mock.notifications.map(n => `
    <article class="card">
      <div class="row"><b>${n.type.toUpperCase()}</b>${read.includes(n.id) ? '<small class="muted">Lida</small>' : '<span class="status available">Nova</span>'}</div>
      <p>${n.text}</p>
      <small class="muted">${n.time}</small>
    </article>
  `).join('');
  storageSet(STORAGE_KEYS.notificationsRead, mock.notifications.map(n => n.id));
  $('#notification-badge').textContent = '0';
}

function renderClub() {
  $('[data-view="club"]').innerHTML = `
    <article class="card"><h3>Sobre o Club Elite</h3><p>Clube de poker premium com ambiente sofisticado, estrutura profissional e eventos exclusivos.</p></article>
    <article class="card"><h3>Localização</h3><p>Av. Paulista, 1000 - São Paulo/SP</p><div class="card" style="margin:0;background:#0d0d0d">Mapa (placeholder pronto para API)</div></article>
    <article class="card"><h3>Horários</h3><p>Seg-Qua 18h-02h | Qui-Sáb 18h-04h | Dom 16h-01h</p><p>Dress code: esporte fino recomendado.</p></article>
    <article class="card faq"><h3>FAQ</h3>
      <details><summary>Como funciona o buy-in?</summary><p>O buy-in varia por evento e é informado na agenda.</p></details>
      <details><summary>Posso levar acompanhante?</summary><p>Sim, sujeito a disponibilidade e cadastro na portaria.</p></details>
      <details><summary>Quais formas de pagamento?</summary><p>PIX, cartão de débito e crédito.</p></details>
    </article>
  `;
}

function renderPromotions() {
  $('[data-view="promotions"]').innerHTML = mock.promotions.map(p => `<article class="card"><h3>${p.title}</h3><p>${p.desc}</p></article>`).join('');
}

function renderHistory() {
  const regs = storageGet(STORAGE_KEYS.registrations, []);
  const waitlist = storageGet(STORAGE_KEYS.waitlist, []);
  $('[data-view="history"]').innerHTML = `
    <label>Filtro por tipo<select id="history-filter"><option value="all">Todos</option><option value="registration">Inscrições</option><option value="waitlist">Lista de espera</option></select></label>
    <div id="history-list"></div>
  `;
  const render = (type) => {
    const regHtml = regs.map(r => `<article class="card"><b>Inscrição:</b> ${mock.events.find(e => e.id === r.eventId)?.name || 'Evento'}<br><small>${new Date(r.date).toLocaleString('pt-BR')}</small></article>`);
    const waitHtml = waitlist.map(w => `<article class="card"><b>Waitlist:</b> Evento #${w.eventId} • Posição ${w.position}<br><small>${new Date(w.enteredAt).toLocaleString('pt-BR')}</small></article>`);
    $('#history-list').innerHTML = (type === 'registration' ? regHtml : type === 'waitlist' ? waitHtml : [...regHtml, ...waitHtml]).join('') || '<p class="muted">Sem registros.</p>';
  };
  render('all');
  $('#history-filter').onchange = (e) => render(e.target.value);
}

function skeletons(n) { return Array.from({ length: n }, () => '<div class="skeleton"></div>').join(''); }

function attachEvents() {
  document.body.addEventListener('click', (e) => {
    if (e.target.matches('[data-action="go-auth"]')) {
      $('#splash-screen').classList.add('hidden');
      $('#auth-screen').classList.remove('hidden');
    }
    if (e.target.matches('[data-action="open-notifications"]') || e.target.closest('[data-action="open-notifications"]')) openView('notifications');
    if (e.target.matches('[data-action="close-modal"]')) $('#confirm-modal').classList.add('hidden');
    if (e.target.matches('.nav-btn') || e.target.closest('.nav-btn')) {
      const btn = e.target.closest('.nav-btn');
      openView(btn.dataset.nav);
    }
    if (e.target.matches('.tab-btn')) {
      state.authTab = e.target.dataset.authTab;
      $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.authTab === state.authTab));
      $('#login-form').classList.toggle('hidden', state.authTab !== 'login');
      $('#signup-form').classList.toggle('hidden', state.authTab !== 'signup');
    }
  });

  $('#login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = e.target.email.value.trim();
    const password = e.target.password.value.trim();
    if (!email || password.length < 6) return showToast('Preencha os campos corretamente.');
    storageSet(STORAGE_KEYS.user, getUser());
    enterApp();
  });

  $('#signup-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const user = { name: form.get('name'), email: form.get('email'), phone: form.get('phone'), nickname: 'Novo Membro', avatar: String(form.get('name')).split(' ').map(v => v[0]).slice(0,2).join('').toUpperCase(), preferences: ['Texas Hold\'em'] };
    storageSet(STORAGE_KEYS.user, user);
    showToast('Conta criada com sucesso!');
    enterApp();
  });
}

function enterApp() {
  $('#auth-screen').classList.add('hidden');
  $('#splash-screen').classList.add('hidden');
  $('#top-bar').classList.remove('hidden');
  $('#main-app').classList.remove('hidden');
  $('#bottom-nav').classList.remove('hidden');
  openView('home');
}

function boot() {
  initData();
  attachEvents();
  $('#loading-screen').classList.remove('hidden');
  setTimeout(() => {
    $('#loading-screen').classList.add('hidden');
    if (isLogged()) enterApp();
  }, 700);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

boot();
