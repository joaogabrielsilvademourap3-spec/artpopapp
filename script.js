const API = '/api';
const STORAGE = { user: 'clubElite_user', notificationsRead: 'clubElite_notifications_read' };
const state = { view: 'home', authTab: 'login', tournaments: [], events: [], user: null, notifications: [], selectedTournament: null, scanStream: null };
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const leaderboard = [
  { name: 'André Blitz', points: 1920, wins: 12, freq: '96%' },
  { name: 'Carla Rivers', points: 1808, wins: 10, freq: '93%' },
  { name: 'Leo Titan', points: 1704, wins: 9, freq: '88%' },
  { name: 'Maya Queen', points: 1540, wins: 8, freq: '84%' }
];

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro inesperado.' }));
    throw new Error(err.error || 'Erro na API');
  }
  return res.json();
}

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  $('#toast-stack').appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

function saveUser(user) { localStorage.setItem(STORAGE.user, JSON.stringify(user)); }
function getUser() { return JSON.parse(localStorage.getItem(STORAGE.user) || 'null'); }
function unreadCount() {
  const read = JSON.parse(localStorage.getItem(STORAGE.notificationsRead) || '[]');
  return state.notifications.filter((n) => !read.includes(n.id)).length;
}

function openView(view) {
  state.view = view;
  $$('.view').forEach((v) => v.classList.toggle('active', v.dataset.view === view));
  $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.nav === view));
  $('#screen-title').textContent = ({ home: 'Home', agenda: 'Agenda', tournaments: 'Torneios', ranking: 'Ranking', profile: 'Perfil', notifications: 'Notificações', history: 'Histórico', club: 'Clube', admin: 'Admin', scanner: 'Scanner QR' }[view] || 'Club Elite');
  renderCurrentView();
}

function statusClass(s) {
  if (s === 'lotado') return 'full';
  if (s === 'últimas vagas') return 'last';
  if (s === 'cancelado') return 'cancelled';
  return 'available';
}

async function fetchCoreData() {
  const [tournaments, events] = await Promise.all([api('/tournaments'), api('/events')]);
  state.tournaments = tournaments;
  state.events = events;
  state.notifications = [
    { id: 'n1', text: 'Nova rodada cash 10/20 aberta às 21:00.', type: 'Rodada' },
    { id: 'n2', text: 'Inscrições do Sunday Major quase encerradas.', type: 'Inscrição' },
    { id: 'n3', text: 'Promoção VIP Wednesday ativa hoje.', type: 'Promoção' }
  ];
}

function renderHome() {
  const next = state.tournaments[0];
  const cash = state.events.filter((e) => e.type === 'Cash Game').length;
  const slots = state.tournaments.reduce((a, b) => a + Math.max(b.slots - b.taken, 0), 0);
  $('[data-view="home"]').innerHTML = `
    <div class="banner"><p class="muted">Bem-vindo, ${state.user.name}</p><h3>Ambiente premium para jogos exclusivos</h3><p>Próximo torneio: <b>${next?.name || '-'}</b></p></div>
    <div class="kpis">
      <article class="kpi"><small>Próximo torneio</small><b>${next?.time || '--:--'}</b><small>${next?.date || '-'}</small></article>
      <article class="kpi"><small>Cash games</small><b>${cash}</b><small>ativos</small></article>
      <article class="kpi"><small>Vagas livres</small><b>${slots}</b><small>torneios</small></article>
      <article class="kpi"><small>Notificações</small><b>${unreadCount()}</b><small>não lidas</small></article>
    </div>
    <div class="quick-grid">
      <button class="quick-btn" data-quick="tournaments">Inscrever-se</button>
      <button class="quick-btn" data-quick="history">Meus check-ins</button>
      <button class="quick-btn" data-quick="club">Regras da casa</button>
      ${state.user.role === 'admin' ? '<button class="quick-btn" data-quick="admin">Painel Admin</button>' : '<button class="quick-btn" data-quick="agenda">Agenda</button>'}
    </div>`;
  $$('[data-quick]').forEach((b) => (b.onclick = () => openView(b.dataset.quick)));
}

function renderAgenda() {
  const cards = [...state.events, ...state.tournaments]
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .map((e) => `<article class="card"><div class="row"><h3>${e.name}</h3><span class="status ${statusClass(e.status)}">${e.status}</span></div><p class="muted">${e.date} • ${e.time} • ${e.type}</p><small>Buy-in: R$ ${e.buyIn} • Blinds: ${e.blinds || '-'}</small></article>`)
    .join('');
  $('[data-view="agenda"]').innerHTML = cards || '<p class="muted">Sem eventos.</p>';
}

function renderTournaments() {
  $('[data-view="tournaments"]').innerHTML = `
    <label>Buscar torneio<input id="search-tour" placeholder="Nome/tipo" /></label>
    <div class="filters">${['Todos', 'Torneio', 'Evento especial', 'Satélite'].map((f) => `<button class="pill" data-type="${f}">${f}</button>`).join('')}</div>
    <div id="tour-list"></div>`;

  const renderList = (term = '', type = 'Todos') => {
    const filtered = state.tournaments.filter((t) => (type === 'Todos' || t.type === type) && `${t.name} ${t.type}`.toLowerCase().includes(term.toLowerCase()));
    $('#tour-list').innerHTML = filtered.map((t) => `
      <article class="card"><div class="row"><h3>${t.name}</h3><span class="status ${statusClass(t.status)}">${t.status}</span></div>
      <p class="muted">${t.date} • ${t.time}</p>
      <small>Buy-in: R$ ${t.buyIn} • Premiação: R$ ${t.prize || 0} • Vagas: ${Math.max(t.slots - t.taken, 0)}</small>
      <p>${t.structure || '-'}</p>
      <div class="row"><button class="btn btn-secondary" data-detail="${t.id}">Detalhes</button><button class="btn btn-primary" data-register="${t.id}">Inscrever</button></div></article>`).join('') || '<p class="muted">Nenhum torneio.</p>';

    $$('[data-register]').forEach((b) => (b.onclick = () => openRegisterModal(b.dataset.register)));
    $$('[data-detail]').forEach((b) => (b.onclick = () => {
      const t = state.tournaments.find((x) => x.id === b.dataset.detail);
      showToast(`${t.name} • ${t.date} ${t.time}`);
    }));
  };

  renderList();
  $('#search-tour').oninput = (e) => renderList(e.target.value, $('.pill.active')?.dataset.type || 'Todos');
  $$('.pill').forEach((p) => (p.onclick = () => {
    $$('.pill').forEach((x) => x.classList.remove('active'));
    p.classList.add('active');
    renderList($('#search-tour').value, p.dataset.type);
  }));
  $('.pill')?.classList.add('active');
}

function openRegisterModal(tournamentId) {
  const tournament = state.tournaments.find((t) => t.id === tournamentId);
  $('#modal-text').textContent = `Confirmar inscrição em ${tournament.name} (${tournament.date} ${tournament.time})?`;
  $('#confirm-modal').classList.remove('hidden');
  $('#modal-confirm-btn').onclick = async () => {
    try {
      const result = await api('/registrations', {
        method: 'POST',
        body: JSON.stringify({ userId: state.user.id, tournamentId })
      });
      $('#confirm-modal').classList.add('hidden');
      showToast('Inscrição confirmada! QR de check-in gerado.');
      await fetchCoreData();
      renderCurrentView();
      openView('history');
    } catch (err) {
      showToast(err.message);
    }
  };
}

function renderRanking() {
  $('[data-view="ranking"]').innerHTML = leaderboard.map((p, i) => `<article class="card"><div class="row"><b>#${i + 1} ${p.name}</b>${i < 3 ? '👑' : ''}</div><small>Pontos ${p.points} • Vitórias ${p.wins} • Frequência ${p.freq}</small></article>`).join('');
}

function renderNotifications() {
  const read = JSON.parse(localStorage.getItem(STORAGE.notificationsRead) || '[]');
  $('[data-view="notifications"]').innerHTML = state.notifications.map((n) => `<article class="card"><div class="row"><b>${n.type}</b>${read.includes(n.id) ? '<small class="muted">Lida</small>' : '<span class="status available">Nova</span>'}</div><p>${n.text}</p></article>`).join('');
  localStorage.setItem(STORAGE.notificationsRead, JSON.stringify(state.notifications.map((n) => n.id)));
  $('#notification-badge').textContent = 0;
}

async function renderHistory() {
  const data = await api(`/checkins/user/${state.user.id}`);
  $('[data-view="history"]').innerHTML = `
    <article class="card"><h3>Meus check-ins e inscrições</h3><p class="muted">Acompanhe QR, status de entrada e histórico.</p></article>
    ${data.map((item) => `
      <article class="card">
        <h4>${item.tournament?.name || 'Evento'}</h4>
        <p class="muted">${item.tournament?.date || '-'} • ${item.tournament?.time || '-'}</p>
        <div class="row"><span class="status ${item.checkin?.checkedInAt ? 'available' : 'last'}">${item.checkin?.checkedInAt ? 'check-in realizado' : 'pendente'}</span><small>${item.checkin?.checkedInAt ? new Date(item.checkin.checkedInAt).toLocaleString('pt-BR') : '-'}</small></div>
        ${item.checkin?.qrCodeDataUrl ? `<img class="qr-img" src="${item.checkin.qrCodeDataUrl}" alt="QR checkin" />` : ''}
        <small>Token: ${item.checkin?.token || '-'}</small>
      </article>
    `).join('') || '<p class="muted">Sem histórico ainda.</p>'}
    ${state.user.role === 'admin' ? '<button class="btn btn-primary" id="open-scanner">Abrir scanner QR</button>' : ''}
  `;
  $('#open-scanner') && ($('#open-scanner').onclick = () => openView('scanner'));
}

function renderProfile() {
  $('[data-view="profile"]').innerHTML = `
    <article class="card"><div class="row"><div class="avatar">${state.user.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</div><button class="btn btn-secondary" id="logout-btn">Sair</button></div>
      <h3>${state.user.name}</h3><p class="muted">${state.user.nickname || 'Membro'}</p><small>${state.user.email} • ${state.user.phone}</small>
      <p>Status: <b>${state.user.role === 'admin' ? 'Administrador' : 'Jogador ativo'}</b></p>
      <div class="quick-grid"><button class="quick-btn" data-go="history">Meus check-ins</button><button class="quick-btn" data-go="club">Info Clube</button>${state.user.role === 'admin' ? '<button class="quick-btn" data-go="admin">Painel Admin</button>' : ''}</div></article>`;
  $('#logout-btn').onclick = () => { localStorage.removeItem(STORAGE.user); location.href = '/'; };
  $$('[data-go]').forEach((b) => (b.onclick = () => openView(b.dataset.go)));
}

function renderClub() {
  $('[data-view="club"]').innerHTML = `
    <article class="card"><h3>Sobre o Clube</h3><p>Clube premium com eventos exclusivos de poker, cash games e experiência VIP.</p></article>
    <article class="card"><h3>Localização</h3><p>Av. Paulista, 1000 • São Paulo/SP</p><small>Mapa pronto para integração com API.</small></article>
    <article class="card"><h3>Regras da Casa</h3><p>Respeito entre jogadores, fichas oficiais e check-in obrigatório via QR na chegada.</p></article>`;
}

function renderAdmin() {
  if (state.user.role !== 'admin') {
    $('[data-view="admin"]').innerHTML = '<article class="card"><p class="muted">Acesso restrito.</p></article>';
    return;
  }

  $('[data-view="admin"]').innerHTML = `
    <article class="card"><h3>Cadastrar torneio</h3>
      <form id="admin-t-form" class="grid-2">
        <label>Nome<input name="name" required /></label><label>Data<input type="date" name="date" required /></label>
        <label>Hora<input type="time" name="time" required /></label><label>Tipo<select name="type"><option>Torneio</option><option>Evento especial</option><option>Satélite</option></select></label>
        <label>Buy-in<input type="number" name="buyIn" required /></label><label>Premiação<input type="number" name="prize" /></label>
        <label>Vagas<input type="number" name="slots" required /></label><label>Blinds<input name="blinds" /></label>
        <label style="grid-column:1/-1;">Estrutura<textarea name="structure"></textarea></label>
        <button class="btn btn-primary" style="grid-column:1/-1;" type="submit">Salvar torneio</button>
      </form>
    </article>
    <article class="card"><h3>Operação de check-in</h3><button class="btn btn-secondary" id="go-scanner">Abrir scanner QR</button></article>`;

  $('#go-scanner').onclick = () => openView('scanner');
  $('#admin-t-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = Object.fromEntries(fd.entries());
    try {
      await api('/tournaments', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Torneio cadastrado com sucesso.');
      e.target.reset();
      await fetchCoreData();
    } catch (err) {
      showToast(err.message);
    }
  };
}

function extractTokenFromContent(content) {
  try {
    const url = new URL(content);
    if (url.pathname.startsWith('/checkin/')) return url.pathname.split('/').pop();
  } catch (_) {}
  return content.trim();
}

async function handleScanToken(token) {
  if (!token) return;
  try {
    const data = await api('/checkins/scan', { method: 'POST', body: JSON.stringify({ token }) });
    $('#scan-result').innerHTML = `<article class="card"><h3>Check-in confirmado ✅</h3><p><b>${data.user.name}</b> (${data.user.nickname})</p><p>${data.user.email} • ${data.user.phone}</p><p>Torneio: <b>${data.tournament.name}</b></p><small>Entrada registrada: ${new Date(data.checkin.checkedInAt).toLocaleString('pt-BR')}</small></article>`;
    showToast('Jogador identificado e check-in efetuado.');
  } catch (err) {
    showToast(err.message);
  }
}

async function startScanner() {
  const container = $('[data-view="scanner"]');
  container.innerHTML = `
    <article class="card"><h3>Scanner de QR (Portaria)</h3><p class="muted">Escaneie o QR do jogador para visualizar dados e confirmar presença.</p>
      <video id="scan-video" autoplay playsinline></video>
      <label>Fallback manual (token/URL)<input id="manual-token" placeholder="Cole token ou URL /checkin/..." /></label>
      <div class="row"><button class="btn btn-secondary" id="scan-manual">Validar token</button><button class="btn btn-primary" id="stop-scanner">Parar câmera</button></div>
    </article>
    <div id="scan-result"></div>`;

  $('#scan-manual').onclick = () => handleScanToken(extractTokenFromContent($('#manual-token').value));
  $('#stop-scanner').onclick = stopScanner;

  if (!('BarcodeDetector' in window) || !(await BarcodeDetector.getSupportedFormats()).includes('qr_code')) {
    showToast('Scanner nativo indisponível neste dispositivo. Use fallback manual.');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    state.scanStream = stream;
    const video = $('#scan-video');
    video.srcObject = stream;
    const detector = new BarcodeDetector({ formats: ['qr_code'] });

    const tick = async () => {
      if (!state.scanStream || state.view !== 'scanner') return;
      try {
        const codes = await detector.detect(video);
        if (codes[0]?.rawValue) {
          await handleScanToken(extractTokenFromContent(codes[0].rawValue));
          stopScanner();
          return;
        }
      } catch (_) {}
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  } catch (_) {
    showToast('Sem permissão de câmera. Use fallback manual.');
  }
}

function stopScanner() {
  if (state.scanStream) state.scanStream.getTracks().forEach((t) => t.stop());
  state.scanStream = null;
}

async function renderCurrentView() {
  if (state.view === 'home') renderHome();
  else if (state.view === 'agenda') renderAgenda();
  else if (state.view === 'tournaments') renderTournaments();
  else if (state.view === 'ranking') renderRanking();
  else if (state.view === 'profile') renderProfile();
  else if (state.view === 'notifications') renderNotifications();
  else if (state.view === 'club') renderClub();
  else if (state.view === 'admin') renderAdmin();
  else if (state.view === 'history') await renderHistory();
  else if (state.view === 'scanner') startScanner();
  $('#notification-badge').textContent = unreadCount();
}

function enterApp() {
  $('#splash-screen').classList.add('hidden');
  $('#auth-screen').classList.add('hidden');
  $('#top-bar').classList.remove('hidden');
  $('#main-app').classList.remove('hidden');
  $('#bottom-nav').classList.remove('hidden');
  openView('home');
}

function bindEvents() {
  document.body.addEventListener('click', (e) => {
    if (e.target.matches('[data-action="go-auth"]')) {
      $('#splash-screen').classList.add('hidden');
      $('#auth-screen').classList.remove('hidden');
    }
    if (e.target.matches('.tab-btn')) {
      state.authTab = e.target.dataset.authTab;
      $$('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.authTab === state.authTab));
      $('#login-form').classList.toggle('hidden', state.authTab !== 'login');
      $('#signup-form').classList.toggle('hidden', state.authTab !== 'signup');
    }
    if (e.target.matches('.nav-btn') || e.target.closest('.nav-btn')) {
      stopScanner();
      openView(e.target.closest('.nav-btn').dataset.nav);
    }
    if (e.target.matches('[data-action="open-notifications"]') || e.target.closest('[data-action="open-notifications"]')) openView('notifications');
    if (e.target.matches('[data-action="close-modal"]')) $('#confirm-modal').classList.add('hidden');
  });

  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const body = JSON.stringify({ email: e.target.email.value, password: e.target.password.value });
      const data = await api('/auth/login', { method: 'POST', body });
      state.user = data.user;
      saveUser(data.user);
      await fetchCoreData();
      enterApp();
    } catch (err) {
      showToast(err.message);
    }
  });

  $('#signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const body = JSON.stringify({ name: e.target.name.value, email: e.target.email.value, phone: e.target.phone.value, password: e.target.password.value });
      const data = await api('/auth/signup', { method: 'POST', body });
      state.user = data.user;
      saveUser(data.user);
      await fetchCoreData();
      showToast('Cadastro realizado com sucesso.');
      enterApp();
    } catch (err) {
      showToast(err.message);
    }
  });
}

async function handleCheckinRoute() {
  const token = location.pathname.startsWith('/checkin/') ? location.pathname.split('/').pop() : null;
  if (!token) return false;

  $('#splash-screen').classList.add('hidden');
  $('#auth-screen').classList.add('hidden');
  $('#top-bar').classList.add('hidden');
  $('#main-app').classList.remove('hidden');
  $('#bottom-nav').classList.add('hidden');

  const container = $('[data-view="home"]')
  container.classList.add('active');
  try {
    const data = await api('/checkins/scan', { method: 'POST', body: JSON.stringify({ token }) });
    container.innerHTML = `<article class="card"><h3>Check-in confirmado ✅</h3><p><b>${data.user.name}</b> (${data.user.nickname})</p><p>${data.user.email}</p><p>Torneio: ${data.tournament.name}</p><small>${new Date(data.checkin.checkedInAt).toLocaleString('pt-BR')}</small></article>`;
  } catch (err) {
    container.innerHTML = `<article class="card"><h3>QR inválido</h3><p>${err.message}</p></article>`;
  }
  return true;
}

async function boot() {
  bindEvents();
  $('#loading-screen').classList.remove('hidden');
  try {
    await api('/health');
  } catch (err) {
    showToast('Backend indisponível. Inicie o servidor: npm start');
  }

  const checkinPage = await handleCheckinRoute();
  if (!checkinPage) {
    state.user = getUser();
    if (state.user) {
      await fetchCoreData();
      enterApp();
    }
  }

  $('#loading-screen').classList.add('hidden');
}

boot();
