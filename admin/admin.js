const state = { tab: 'dashboard', metrics: null, tournaments: [], events: [], registrations: [], users: [], checkins: [], scanResult: null, stream: null };
const el = document.querySelector('#content');

const api = async (path, options = {}) => {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro API');
  return data;
};

function card(html) { return `<article class="card">${html}</article>`; }
function esc(v){return String(v ?? '').replace(/[&<>\"]/g, s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));}

async function loadAll() {
  const [dashboard, tournaments, events, registrations, users, checkins] = await Promise.all([
    api('/api/admin/dashboard'), api('/api/tournaments'), api('/api/events'), api('/api/registrations'), api('/api/users'), api('/api/checkins')
  ]);
  state.metrics = dashboard;
  state.tournaments = tournaments.items;
  state.events = events.items;
  state.registrations = registrations.items;
  state.users = users.items;
  state.checkins = checkins.items;
}

function render() {
  if (state.tab === 'dashboard') {
    const m = state.metrics.metrics;
    el.innerHTML = card(`<h2>Dashboard</h2><div class='grid'>
      <div>Total jogadores: <strong>${m.totalPlayers}</strong></div>
      <div>Torneios ativos: <strong>${m.activeTournaments}</strong></div>
      <div>Eventos futuros: <strong>${m.futureEvents}</strong></div>
      <div>Inscrições ativas: <strong>${m.pendingOrConfirmed}</strong></div>
      <div>Check-ins hoje: <strong>${m.checkinsToday}</strong></div></div>`) +
      card(`<h3>Ocupação por evento</h3>${state.metrics.occupancy.map((o)=>`<p>${esc(o.name)} - ${o.occupancy}</p>`).join('')}`);
  }

  if (state.tab === 'create') {
    el.innerHTML = card(`<h2>Criar torneio/evento</h2>
      <form id='createForm'>
        <label>Tipo de rota<select name='kind'><option value='tournaments'>Torneio</option><option value='events'>Evento</option></select></label>
        <label>Nome<input name='name' required></label>
        <label>Descrição<textarea name='description' required></textarea></label>
        <label>Tipo<input name='type' value='torneio' required></label>
        <div class='grid'><label>Data<input type='date' name='date' required></label><label>Hora<input type='time' name='time' required></label></div>
        <label>Local<input name='location' required></label>
        <div class='grid'><label>Buy-in<input type='number' name='buyIn'></label><label>Premiação<input type='number' name='estimatedPrize'></label><label>Vagas<input type='number' name='totalSlots' required></label></div>
        <label>Regras<textarea name='rules'></textarea></label>
        <div class='grid'><label>Check-in início<input type='datetime-local' name='checkinStart'></label><label>Check-in fim<input type='datetime-local' name='checkinEnd'></label></div>
        <label><input type='checkbox' name='checkinEnabled' checked> Check-in habilitado</label>
        <button type='submit'>Salvar</button>
      </form>`);

    document.querySelector('#createForm').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const kind = fd.get('kind');
      const payload = Object.fromEntries(fd.entries());
      payload.checkinEnabled = fd.get('checkinEnabled') === 'on';
      try {
        await api(`/api/${kind}`, { method: 'POST', body: JSON.stringify(payload) });
        alert('Criado com sucesso');
        await loadAll();
      } catch (err) { alert(err.message); }
    };
  }

  if (state.tab === 'manage') {
    const items = [...state.tournaments, ...state.events];
    el.innerHTML = card(`<h2>Gestão de eventos</h2>
      <input id='search' placeholder='Buscar por nome'>
      <div id='list'>${items.map(itemRow).join('')}</div>`) +
      card(`<h3>Inscrições (${state.registrations.length})</h3>
      ${state.registrations.map((r)=>`<p>${esc(r.user?.name)} • ${esc(r.event?.name)} • ${r.status}</p>`).join('')}`) +
      card(`<h3>Exportar</h3><button id='exportReg'>Exportar inscrições para JSON</button><pre id='exportStatus'></pre>`);

    document.querySelector('#search').oninput = (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelector('#list').innerHTML = items.filter((i)=>i.name.toLowerCase().includes(q)).map(itemRow).join('');
      bindManagementButtons();
    };
    bindManagementButtons();
    document.querySelector('#exportReg').onclick = async () => {
      try {
        const r = await api('/api/export/registrations');
        document.querySelector('#exportStatus').textContent = JSON.stringify(r, null, 2);
      } catch (err) { alert(err.message); }
    };
  }

  if (state.tab === 'users') {
    el.innerHTML = card(`<h2>Jogadores cadastrados</h2>${state.users.map((u)=>`<p>${esc(u.name)} • ${esc(u.email)} • ${esc(u.phone)} • ${u.role}</p>`).join('')}`) +
      card(`<h3>Histórico de check-ins</h3><div class='row'><input id='fUser' placeholder='Filtrar jogador'><input id='fDate' type='date'></div><div id='checkRows'>${checkRows(state.checkins)}</div>`);

    const apply = () => {
      const q = document.querySelector('#fUser').value.toLowerCase();
      const d = document.querySelector('#fDate').value;
      const filtered = state.checkins.filter((c) => c.player?.name?.toLowerCase().includes(q) && (!d || c.checkedAt.startsWith(d)));
      document.querySelector('#checkRows').innerHTML = checkRows(filtered);
    };
    document.querySelector('#fUser').oninput = apply;
    document.querySelector('#fDate').oninput = apply;
  }

  if (state.tab === 'checkin') renderCheckin();
}

function checkRows(items){return items.map((c)=>`<p>${esc(c.player?.name)} • ${esc(c.event?.name)} • ${new Date(c.checkedAt).toLocaleString('pt-BR')}</p>`).join('') || '<p>Sem dados</p>'}
function itemRow(i){return `<div class='card'><p><strong>${esc(i.name)}</strong> - ${i.date} ${i.time} - ${i.status}</p><div class='row'><button data-edit='${i.id}'>Encerrar</button><button data-del='${i.id}'>Cancelar</button></div></div>`}

function bindManagementButtons() {
  document.querySelectorAll('[data-edit]').forEach((b) => b.onclick = async () => {
    const id = b.dataset.edit;
    const kind = state.tournaments.some((t) => t.id === id) ? 'tournaments' : 'events';
    await api(`/api/${kind}/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'encerrado' }) });
    await loadAll(); render();
  });
  document.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    const id = b.dataset.del;
    const kind = state.tournaments.some((t) => t.id === id) ? 'tournaments' : 'events';
    await api(`/api/${kind}/${id}`, { method: 'DELETE' });
    await loadAll(); render();
  });
}

function renderCheckin() {
  el.innerHTML = card(`<h2>Check-in de entrada</h2><p id='mode'>Modo: detectando suporte...</p><video id='video' autoplay muted playsinline></video>
    <div class='row'><button id='startScan'>Iniciar câmera</button><button id='stopScan'>Parar</button></div>
    <label>Fallback manual (colar token)<textarea id='manualToken'></textarea></label><button id='validateManual'>Validar manualmente</button>
    <pre id='scanOut'>Aguardando leitura...</pre><button id='confirmBtn' disabled>Confirmar check-in</button>`);

  const mode = document.querySelector('#mode');
  mode.textContent = 'BarcodeDetector' in window ? 'Modo: scanner nativo ativo (BarcodeDetector)' : 'Modo: fallback manual (scanner nativo indisponível)';

  document.querySelector('#validateManual').onclick = async () => {
    const token = document.querySelector('#manualToken').value.trim();
    if (!token) return alert('Informe token.');
    await validateToken(token);
  };

  document.querySelector('#confirmBtn').onclick = async () => {
    if (!state.scanResult?.registration?.id) return;
    try {
      await api('/api/checkin/confirm', { method: 'POST', body: JSON.stringify({ registrationId: state.scanResult.registration.id }) });
      alert('Check-in confirmado!');
      state.scanResult = null;
      await loadAll();
      render();
    } catch (err) { alert(err.message); }
  };

  document.querySelector('#startScan').onclick = startScanner;
  document.querySelector('#stopScan').onclick = stopScanner;
}

async function validateToken(token) {
  try {
    const data = await api('/api/checkin/validate', { method: 'POST', body: JSON.stringify({ manualToken: token }) });
    state.scanResult = data;
    document.querySelector('#scanOut').textContent = JSON.stringify(data, null, 2);
    document.querySelector('#confirmBtn').disabled = data.status !== 'valid';
  } catch (err) {
    state.scanResult = null;
    document.querySelector('#scanOut').textContent = err.message;
    document.querySelector('#confirmBtn').disabled = true;
  }
}

async function startScanner() {
  if (!('BarcodeDetector' in window)) return;
  try {
    state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    const video = document.querySelector('#video');
    video.srcObject = state.stream;
    const detector = new BarcodeDetector({ formats: ['qr_code'] });

    const loop = async () => {
      if (!state.stream) return;
      try {
        const codes = await detector.detect(video);
        if (codes[0]?.rawValue) {
          document.querySelector('#manualToken').value = codes[0].rawValue;
          await validateToken(codes[0].rawValue);
          stopScanner();
          return;
        }
      } catch {}
      requestAnimationFrame(loop);
    };
    loop();
  } catch (err) {
    alert('Falha ao acessar câmera: ' + err.message);
  }
}

function stopScanner() {
  if (state.stream) {
    state.stream.getTracks().forEach((t) => t.stop());
    state.stream = null;
  }
  const v = document.querySelector('#video');
  if (v) v.srcObject = null;
}

document.querySelectorAll('aside button[data-tab]').forEach((b) => b.onclick = () => { state.tab = b.dataset.tab; render(); });
document.querySelector('#logout').onclick = async () => { await api('/api/auth/logout', { method: 'POST' }); location.href = '/'; };

(async function init() {
  try {
    const me = await api('/api/me');
    if (me.user.role !== 'admin') return (location.href = '/');
    await loadAll();
    render();
  } catch {
    location.href = '/';
  }
})();
