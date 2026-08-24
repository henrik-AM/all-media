const state = {
  users: {},
  chats: [],
  stories: [],
  contacts: [],
  communities: [],
  view: 'chats',
  area: 'messenger',
  filter: 'all',
  query: '',
  contactQuery: '',
  communityQuery: '',
  communityFilter: 'all',
  theme: localStorage.getItem('am-theme') || 'system',
  openChatId: null,
  messages: [],
};

const $ = (sel) => document.querySelector(sel);
const main = $('#main');
const overlay = $('#overlay');

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function user(id) {
  return state.users[id] || { name: '?', initials: '?', color: '#9AA1AC' };
}

function avatarOf(chat, size = 52) {
  if (chat.isGroup) {
    return `<div class="avatar avatar--${size}" style="background:linear-gradient(135deg,#5C6BC0,#26A69A)">${ICONS.people}</div>`
      .replace('<svg', '<svg style="width:45%;height:45%"');
  }
  const u = user(chat.userId);
  return `<div class="avatar avatar--${size}" style="background:${u.color}">${esc(u.initials)}</div>`;
}

function avatarForUser(id, size = 44) {
  const u = user(id);
  return `<div class="avatar avatar--${size}" style="background:${u.color}">${esc(u.initials)}</div>`;
}

/* ------------------------------------------------------------------ theme */
function applyTheme() {
  const root = document.documentElement;
  if (state.theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', state.theme);
}

/* ------------------------------------------------------------------ toast */
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2200);
}

/* ------------------------------------------------------------------ data */
async function bootstrap() {
  const res = await fetch('/api/bootstrap');
  const data = await res.json();
  Object.assign(state, data);
  applyTheme();
  render();
}

/* ------------------------------------------------------------------ views */
function render() {
  const navActive = state.area === 'messenger' || state.area === 'profile';
  document.querySelectorAll('.navbtn').forEach((b) =>
    b.classList.toggle('is-active', navActive && b.dataset.view === state.view)
  );
  document.querySelectorAll('.topbar__btn').forEach((b) =>
    b.classList.toggle('is-active', b.dataset.area === state.area)
  );

  if (state.area === 'video') return renderPlaceholder('Video-Feed', 'play', 'Der Video-Bereich kommt in einer späteren Phase.');
  if (state.area === 'communities') return renderCommunities();
  if (state.area === 'profile') return renderProfile();
  if (state.area === 'camera') return openCamera();

  if (state.view === 'chats') return renderChats();
  if (state.view === 'stories') return renderStories();
  if (state.view === 'contacts') return renderContacts();
  if (state.view === 'settings') return renderSettings();
}

function renderPlaceholder(title, icon, text) {
  main.innerHTML = `
    <div class="pagehead"><h1 class="pagehead__title">${esc(title)}</h1></div>
    <div class="scroll">
      <div class="empty">${ICONS[icon]}
        <div class="empty__title">Bald verfügbar</div>
        <div class="empty__text">${esc(text)}</div>
      </div>
    </div>`;
}

/* ---------------------------------------------------------- chats view */
function filteredChats() {
  const q = state.query.trim().toLowerCase();
  return state.chats.filter((c) => {
    if (state.filter === 'contacts' && c.isGroup) return false;
    if (state.filter === 'groups' && !c.isGroup) return false;
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || (c.preview || '').toLowerCase().includes(q);
  });
}

function renderChats() {
  const list = filteredChats();
  main.innerHTML = `
    <div class="pagehead">
      <h1 class="pagehead__title">Chats</h1>
      <div class="searchrow">
        <label class="searchbox">
          ${ICONS.search}
          <input id="chatSearch" type="search" placeholder="Suche nach Chats oder Namen" value="${esc(state.query)}" autocomplete="off" />
          ${state.query ? `<button class="searchbox__clear" id="chatSearchClear" aria-label="Suche löschen">${ICONS.close}</button>` : ''}
        </label>
        <button class="iconbtn-primary" id="newChat" aria-label="Neuer Chat">${ICONS.plus}</button>
      </div>
    </div>
    <div class="pills">
      ${['all', 'contacts', 'groups']
        .map(
          (f) =>
            `<button class="pill ${state.filter === f ? 'is-active' : ''}" data-filter="${f}">${
              { all: 'Alle', contacts: 'Kontakte', groups: 'Gruppen' }[f]
            }</button>`
        )
        .join('')}
    </div>
    <div class="scroll">
      ${state.query ? '' : storyRail()}
      ${
        list.length
          ? `<ul class="rows">${list.map(chatRow).join('')}</ul>`
          : `<div class="empty">${ICONS.search}
              <div class="empty__title">Keine Treffer</div>
              <div class="empty__text">Für „${esc(state.query)}" wurde nichts gefunden.</div>
            </div>`
      }
    </div>`;

  const input = $('#chatSearch');
  input.addEventListener('input', (e) => {
    state.query = e.target.value;
    const pos = e.target.selectionStart;
    renderChats();
    const next = $('#chatSearch');
    next.focus();
    next.setSelectionRange(pos, pos);
  });
  $('#chatSearchClear')?.addEventListener('click', () => {
    state.query = '';
    renderChats();
    $('#chatSearch').focus();
  });
  $('#newChat').addEventListener('click', () => {
    state.view = 'contacts';
    render();
  });
  main.querySelectorAll('.pill').forEach((p) =>
    p.addEventListener('click', () => {
      state.filter = p.dataset.filter;
      renderChats();
    })
  );
  main.querySelectorAll('[data-chat]').forEach((r) =>
    r.addEventListener('click', () => openChat(r.dataset.chat))
  );
  bindStoryRail();
}

function chatRow(c) {
  const mediaIcon = c.mediaPreview === 'image' ? ICONS.image : c.mediaPreview === 'audio' ? ICONS.mic : '';
  return `
    <li>
      <button class="row ${c.unread ? 'is-unread' : ''}" data-chat="${c.id}">
        ${avatarOf(c, 52)}
        <div class="row__body">
          <div class="row__top">
            <span class="row__name">${esc(c.name)}</span>
            <span class="row__time">${esc(c.time)}</span>
          </div>
          <div class="row__bottom">
            <span class="row__preview">${mediaIcon}${esc(c.preview)}</span>
            <span class="row__meta">
              ${c.muted ? ICONS.mute : ''}
              ${c.unread ? `<span class="badge">${c.unread}</span>` : ''}
            </span>
          </div>
        </div>
      </button>
    </li>`;
}

function storyRail() {
  return `<div class="storyrail">${state.stories.map(storyItem).join('')}</div>`;
}

function storyItem(s) {
  const u = user(s.userId);
  if (s.own) {
    return `
      <button class="story" data-story="${s.id}">
        <div class="story__ring is-viewed story__add">
          <div class="story__inner" style="background:${u.color}">${esc(u.initials)}</div>
          <span class="story__add-badge">${ICONS.plus}</span>
        </div>
        <div class="story__name">${esc(s.name)}</div>
      </button>`;
  }
  return `
    <button class="story" data-story="${s.id}">
      <div class="story__ring ${s.viewed ? 'is-viewed' : ''}">
        <div class="story__inner" style="background:${u.color}">${esc(u.initials)}</div>
      </div>
      <div class="story__name">${esc(s.name)}</div>
    </button>`;
}

function bindStoryRail() {
  main.querySelectorAll('[data-story]').forEach((el) =>
    el.addEventListener('click', () => {
      const s = state.stories.find((x) => x.id === el.dataset.story);
      if (s.own) return openCamera();
      openStory(s.id);
    })
  );
}

/* ---------------------------------------------------------- stories view */
function renderStories() {
  const unseen = state.stories.filter((s) => !s.own && !s.viewed);
  const seen = state.stories.filter((s) => !s.own && s.viewed);
  const own = state.stories.find((s) => s.own);

  const item = (s) => {
    const u = user(s.userId);
    return `<li><button class="row" data-story="${s.id}">
        <div class="story__ring ${s.viewed ? 'is-viewed' : ''}" style="width:52px;height:52px">
          <div class="story__inner" style="background:${u.color};font-size:15px">${esc(u.initials)}</div>
        </div>
        <div class="row__body">
          <div class="row__name">${esc(u.name)}</div>
          <div class="row__bottom"><span class="row__preview">${s.viewed ? 'Bereits angesehen' : 'Neue Story'}</span></div>
        </div>
      </button></li>`;
  };

  main.innerHTML = `
    <div class="pagehead"><h1 class="pagehead__title">Storys</h1></div>
    <div class="scroll">
      <ul class="rows">
        <li><button class="row" data-story="${own.id}">
          <div class="story__ring is-viewed story__add" style="width:52px;height:52px">
            <div class="story__inner" style="background:${user('me').color};font-size:15px">DU</div>
            <span class="story__add-badge">${ICONS.plus}</span>
          </div>
          <div class="row__body">
            <div class="row__name">Deine Story</div>
            <div class="row__bottom"><span class="row__preview">Tippe, um etwas zu teilen</span></div>
          </div>
        </button></li>
      </ul>
      ${unseen.length ? `<div class="listhead">Neu</div><ul class="rows">${unseen.map(item).join('')}</ul>` : ''}
      ${seen.length ? `<div class="listhead">Angesehen</div><ul class="rows">${seen.map(item).join('')}</ul>` : ''}
    </div>`;
  bindStoryRail();
}

/* ---------------------------------------------------------- contacts view */
function renderContacts() {
  const q = state.contactQuery.trim().toLowerCase();
  const list = state.contacts.filter((c) => !q || c.name.toLowerCase().includes(q));
  const friends = list.filter((c) => c.status === 'friend');
  const pending = list.filter((c) => c.status === 'pending');

  const item = (c) => `
    <li><button class="row" data-contact="${c.id}">
      ${avatarForUser(c.id, 44)}
      <div class="row__body">
        <div class="row__name">${esc(c.name)}</div>
        <div class="row__bottom"><span class="row__preview">${esc(c.about)}</span></div>
      </div>
      <span class="row__chevron">${ICONS.chevron}</span>
    </button></li>`;

  main.innerHTML = `
    <div class="pagehead">
      <h1 class="pagehead__title">Kontakte</h1>
      <div class="searchrow">
        <label class="searchbox">
          ${ICONS.search}
          <input id="contactSearch" type="search" placeholder="Kontakte durchsuchen" value="${esc(state.contactQuery)}" autocomplete="off" />
          ${state.contactQuery ? `<button class="searchbox__clear" id="contactSearchClear" aria-label="Suche löschen">${ICONS.close}</button>` : ''}
        </label>
        <button class="iconbtn-primary" id="addContact" aria-label="Kontakt hinzufügen">${ICONS.plus}</button>
      </div>
    </div>
    <div class="scroll">
      ${
        list.length
          ? `${friends.length ? `<div class="listhead">Kontakte auf All Media</div><ul class="rows">${friends.map(item).join('')}</ul>` : ''}
             ${pending.length ? `<div class="listhead">Ausstehende Anfragen</div><ul class="rows">${pending.map(item).join('')}</ul>` : ''}`
          : `<div class="empty">${ICONS.person}
              <div class="empty__title">Keine Kontakte gefunden</div>
              <div class="empty__text">Für „${esc(state.contactQuery)}" wurde nichts gefunden.</div>
            </div>`
      }
    </div>`;

  const input = $('#contactSearch');
  input.addEventListener('input', (e) => {
    state.contactQuery = e.target.value;
    const pos = e.target.selectionStart;
    renderContacts();
    const next = $('#contactSearch');
    next.focus();
    next.setSelectionRange(pos, pos);
  });
  $('#contactSearchClear')?.addEventListener('click', () => {
    state.contactQuery = '';
    renderContacts();
    $('#contactSearch').focus();
  });
  $('#addContact').addEventListener('click', () => toast('Kontakt hinzufügen folgt in Phase 3'));
  main.querySelectorAll('[data-contact]').forEach((r) =>
    r.addEventListener('click', () => {
      const chat = state.chats.find((c) => c.userId === r.dataset.contact);
      if (chat) openChat(chat.id);
      else toast('Noch kein Chat mit diesem Kontakt');
    })
  );
}

/* ---------------------------------------------------------- communities */
function communityAvatar(c, size = 52) {
  const palette = ['#5C6BC0', '#26A69A', '#EF6C6C', '#8D6E63', '#7E57C2', '#42A5F5'];
  let hash = 0;
  for (let i = 0; i < c.id.length; i++) hash = (hash * 31 + c.id.charCodeAt(i)) >>> 0;
  const initials = c.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return `<div class="avatar avatar--${size}" style="background:${palette[hash % palette.length]};border-radius:16px">${esc(initials)}</div>`;
}

function renderCommunities() {
  const q = state.communityQuery.trim().toLowerCase();
  const list = state.communities.filter((c) => {
    if (state.communityFilter === 'public' && c.visibility !== 'public') return false;
    if (state.communityFilter === 'private' && c.visibility !== 'private') return false;
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || c.topic.toLowerCase().includes(q);
  });

  main.innerHTML = `
    <div class="pagehead">
      <h1 class="pagehead__title">Communitys</h1>
      <div class="searchrow">
        <label class="searchbox">
          ${ICONS.search}
          <input id="commSearch" type="search" placeholder="Suche nach Communitys" value="${esc(state.communityQuery)}" autocomplete="off" />
          ${state.communityQuery ? `<button class="searchbox__clear" id="commSearchClear" aria-label="Suche löschen">${ICONS.close}</button>` : ''}
        </label>
        <button class="iconbtn-primary" id="newCommunity" aria-label="Community erstellen">${ICONS.plus}</button>
      </div>
    </div>
    <div class="pills">
      ${['all', 'public', 'private']
        .map(
          (f) =>
            `<button class="pill ${state.communityFilter === f ? 'is-active' : ''}" data-cfilter="${f}">${
              { all: 'Alle', public: 'Öffentlich', private: 'Privat' }[f]
            }</button>`
        )
        .join('')}
    </div>
    <div class="scroll">
      ${
        list.length
          ? `<ul class="rows">${list.map(communityRow).join('')}</ul>`
          : `<div class="empty">${ICONS.people}
              <div class="empty__title">Keine Community gefunden</div>
              <div class="empty__text">Für „${esc(state.communityQuery)}" wurde nichts gefunden.</div>
            </div>`
      }
    </div>`;

  const input = $('#commSearch');
  input.addEventListener('input', (e) => {
    state.communityQuery = e.target.value;
    const pos = e.target.selectionStart;
    renderCommunities();
    const next = $('#commSearch');
    next.focus();
    next.setSelectionRange(pos, pos);
  });
  $('#commSearchClear')?.addEventListener('click', () => {
    state.communityQuery = '';
    renderCommunities();
    $('#commSearch').focus();
  });
  $('#newCommunity').addEventListener('click', () => toast('Community erstellen folgt in Phase 3'));

  main.querySelectorAll('[data-cfilter]').forEach((p) =>
    p.addEventListener('click', () => {
      state.communityFilter = p.dataset.cfilter;
      renderCommunities();
    })
  );

  main.querySelectorAll('[data-community]').forEach((row) =>
    row.addEventListener('click', () => {
      const community = state.communities.find((c) => c.id === row.dataset.community);
      if (!community.joined) return toast('Tritt der Community zuerst bei');
      openChat(community.id);
    })
  );

  main.querySelectorAll('[data-join]').forEach((btn) =>
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const res = await fetch(`/api/communities/${btn.dataset.join}/join`, { method: 'POST' });
      const updated = await res.json();
      const idx = state.communities.findIndex((c) => c.id === updated.id);
      state.communities[idx] = updated;
      toast(updated.joined ? `„${updated.name}" beigetreten` : `„${updated.name}" verlassen`);
      renderCommunities();
    })
  );
}

function communityRow(c) {
  const members = c.members.toLocaleString('de-DE');
  return `
    <li>
      <button class="row ${c.unread ? 'is-unread' : ''}" data-community="${c.id}">
        ${communityAvatar(c)}
        <div class="row__body">
          <div class="row__top">
            <span class="row__name">${esc(c.name)}</span>
            ${c.visibility === 'private' ? `<span class="row__meta">${ICONS.lock}</span>` : ''}
          </div>
          <div class="row__bottom">
            <span class="row__preview">${esc(c.topic)}</span>
          </div>
          <div class="row__bottom">
            <span class="row__preview" style="font-size:12px;color:var(--text-3)">${members} Mitglieder</span>
          </div>
        </div>
        <span class="row__meta">
          ${c.unread ? `<span class="badge">${c.unread}</span>` : ''}
          <span class="joinbtn ${c.joined ? 'is-joined' : ''}" data-join="${c.id}">${c.joined ? 'Mitglied' : 'Beitreten'}</span>
        </span>
      </button>
    </li>`;
}

/* ---------------------------------------------------------- settings */
function renderSettings() {
  const me = user('me');
  main.innerHTML = `
    <div class="scroll">
      <div class="profilehead">
        <div class="avatar avatar--88" style="background:${me.color}">DU</div>
        <div class="profilehead__name">Henrik</div>
        <div class="profilehead__sub">@henrik · Hey, ich nutze All Media!</div>
      </div>
      <div class="group">
        <button class="item" data-act="edit">
          <span class="item__icon">${ICONS.edit}</span>
          <span class="item__label">Profil bearbeiten</span>
          <span class="row__chevron">${ICONS.chevron}</span>
        </button>
        <button class="item" data-act="notifications">
          <span class="item__icon">${ICONS.bell}</span>
          <span class="item__label">Benachrichtigungen</span>
          <span class="row__chevron">${ICONS.chevron}</span>
        </button>
        <button class="item" data-act="privacy">
          <span class="item__icon">${ICONS.lock}</span>
          <span class="item__label">Privatsphäre</span>
          <span class="row__chevron">${ICONS.chevron}</span>
        </button>
        <div class="item">
          <span class="item__icon">${ICONS.moon}</span>
          <span class="item__label">Dunkles Design</span>
          <button class="switch ${state.theme === 'dark' ? 'is-on' : ''}" id="themeSwitch" aria-label="Dunkles Design">
            <span class="switch__knob"></span>
          </button>
        </div>
      </div>
      <div class="group">
        <button class="item" data-act="storage">
          <span class="item__icon">${ICONS.image}</span>
          <span class="item__label">Speicher &amp; Daten</span>
          <span class="item__value">1,2 GB</span>
        </button>
        <button class="item" data-act="about">
          <span class="item__icon">${ICONS.info}</span>
          <span class="item__label">Über All Media</span>
          <span class="item__value">1.0.0</span>
        </button>
        <button class="item item--danger" data-act="logout">
          <span class="item__icon">${ICONS.logout}</span>
          <span class="item__label">Abmelden</span>
        </button>
      </div>
    </div>`;

  $('#themeSwitch').addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('am-theme', state.theme);
    applyTheme();
    renderSettings();
  });
  main.querySelectorAll('[data-act]').forEach((b) =>
    b.addEventListener('click', () => {
      const labels = {
        edit: 'Profil bearbeiten',
        notifications: 'Benachrichtigungen',
        privacy: 'Privatsphäre',
        storage: 'Speicher & Daten',
        about: 'All Media 1.0.0',
        logout: 'Abmelden',
      };
      toast(labels[b.dataset.act] + ' folgt in Phase 3');
    })
  );
}

function renderProfile() {
  state.view = 'settings';
  renderSettings();
}

/* ---------------------------------------------------------- chat detail */
async function openChat(chatId) {
  let chat = state.chats.find((c) => c.id === chatId);

  if (!chat) {
    const community = state.communities.find((c) => c.id === chatId);
    if (!community) return;
    chat = {
      id: community.id,
      name: community.name,
      isGroup: true,
      members: new Array(Math.max(community.members - 1, 0)),
      unread: community.unread,
    };
    community.unread = 0;
  }

  state.openChatId = chatId;

  const res = await fetch(`/api/messages/${chatId}`);
  state.messages = await res.json();

  if (chat.unread) {
    chat.unread = 0;
    fetch(`/api/chats/${chatId}/read`, { method: 'POST' });
  }

  overlay.hidden = false;
  overlay.innerHTML = `
    <header class="chathead">
      <button class="chathead__back" id="chatBack" aria-label="Zurück">${ICONS.back}</button>
      ${avatarOf(chat, 36)}
      <div class="chathead__body">
        <div class="chathead__name">${esc(chat.name)}</div>
        <div class="chathead__status ${chat.isGroup ? 'is-off' : ''}">${
          chat.isGroup ? `${((chat.members || []).length + 1).toLocaleString('de-DE')} Mitglieder` : 'Online'
        }</div>
      </div>
      <div class="chathead__actions">
        <button data-call="video" aria-label="Videoanruf">${ICONS.video}</button>
        <button data-call="audio" aria-label="Anruf">${ICONS.phone}</button>
      </div>
    </header>
    <div class="messages" id="messages"></div>
    <form class="composer" id="composer">
      <button type="button" class="composer__icon" id="attach" aria-label="Anhang">${ICONS.plus}</button>
      <div class="composer__field">
        <textarea id="msgInput" rows="1" placeholder="Nachricht" autocomplete="off"></textarea>
        <button type="button" class="composer__icon" id="camBtn" aria-label="Kamera">${ICONS.camera}</button>
      </div>
      <button type="submit" class="composer__send" id="sendBtn" aria-label="Senden" disabled>${ICONS.send}</button>
    </form>`;

  paintMessages(chat);

  $('#chatBack').addEventListener('click', closeChat);
  overlay.querySelectorAll('[data-call]').forEach((b) =>
    b.addEventListener('click', () =>
      toast(b.dataset.call === 'video' ? 'Videoanruf folgt in Phase 3' : 'Anruf folgt in Phase 3')
    )
  );
  $('#attach').addEventListener('click', () => toast('Anhänge folgen in Phase 3'));
  $('#camBtn').addEventListener('click', openCamera);

  const input = $('#msgInput');
  const sendBtn = $('#sendBtn');
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 108) + 'px';
    sendBtn.disabled = !input.value.trim();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $('#composer').requestSubmit();
    }
  });
  $('#composer').addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage(chat);
  });
  input.focus();
}

function paintMessages(chat) {
  const box = $('#messages');
  box.innerHTML =
    `<div class="daydivider">Heute</div>` +
    state.messages.map((m) => messageBubble(m, chat)).join('');
  box.scrollTop = box.scrollHeight;
}

function messageBubble(m, chat) {
  const out = m.from === 'me';
  const media =
    m.media === 'image'
      ? `<div class="msg__media">${ICONS.image} Foto</div>`
      : m.media === 'audio'
      ? `<div class="msg__media">${ICONS.mic} Sprachnachricht · 0:14</div>`
      : '';
  return `
    <div class="msg msg--${out ? 'out' : 'in'}">
      ${!out && chat.isGroup ? `<div class="msg__sender">${esc(user(m.from).name)}</div>` : ''}
      ${media || esc(m.text)}
      <div class="msg__foot">${esc(m.time)}${out ? ICONS.checkDouble : ''}</div>
    </div>`;
}

async function sendMessage(chat) {
  const input = $('#msgInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  input.style.height = 'auto';
  $('#sendBtn').disabled = true;

  const res = await fetch(`/api/messages/${chat.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const msg = await res.json();
  state.messages.push(msg);
  paintMessages(chat);

  if (!chat.isGroup) simulateReply(chat);
}

function simulateReply(chat) {
  const box = $('#messages');
  if (!box) return;
  const typing = document.createElement('div');
  typing.className = 'typing';
  typing.innerHTML = '<span></span><span></span><span></span>';
  box.appendChild(typing);
  box.scrollTop = box.scrollHeight;

  setTimeout(() => {
    if (state.openChatId !== chat.id) return;
    typing.remove();
    const replies = ['Alles klar!', 'Sehe ich genauso.', 'Melde mich gleich.', 'Danke dir!', 'Passt für mich.'];
    state.messages.push({
      id: 'r' + Date.now(),
      from: chat.userId,
      text: replies[Math.floor(Math.random() * replies.length)],
      time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    });
    paintMessages(chat);
  }, 1400);
}

function closeChat() {
  state.openChatId = null;
  overlay.hidden = true;
  overlay.innerHTML = '';
  render();
}

/* ---------------------------------------------------------- story viewer */
let storyTimer;
function openStory(storyId) {
  const idx = state.stories.findIndex((s) => s.id === storyId);
  const s = state.stories[idx];
  const u = user(s.userId);

  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="viewer">
      <div class="viewer__bars"><div class="viewer__bar"><div class="viewer__fill" id="storyFill"></div></div></div>
      <div class="viewer__head">
        <div class="avatar avatar--36" style="background:${u.color}">${esc(u.initials)}</div>
        <div class="viewer__name">${esc(u.name)}</div>
        <button class="viewer__close" id="storyClose" aria-label="Schließen">${ICONS.close}</button>
      </div>
      <div class="viewer__stage">${ICONS.image}</div>
      <div class="viewer__foot">
        <input class="viewer__reply" placeholder="Auf Story antworten" />
        <button class="viewer__act" id="storyLike" aria-label="Gefällt mir">${ICONS.heart}</button>
        <button class="viewer__act" id="storySend" aria-label="Senden">${ICONS.send}</button>
      </div>
    </div>`;

  let p = 0;
  clearInterval(storyTimer);
  storyTimer = setInterval(() => {
    p += 2;
    const fill = $('#storyFill');
    if (!fill) return clearInterval(storyTimer);
    fill.style.width = p + '%';
    if (p >= 100) {
      clearInterval(storyTimer);
      s.viewed = true;
      closeOverlay();
    }
  }, 60);

  $('#storyClose').addEventListener('click', () => {
    clearInterval(storyTimer);
    s.viewed = true;
    closeOverlay();
  });
  $('#storyLike').addEventListener('click', () => toast('Story gefällt dir'));
  $('#storySend').addEventListener('click', () => toast('Antwort gesendet'));
}

/* ---------------------------------------------------------- camera */
function openCamera() {
  let mode = 'photo';
  let recording = false;

  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="camera">
      <div class="camera__top">
        <button id="camClose" aria-label="Schließen">${ICONS.close}</button>
        <button id="camFlash" aria-label="Blitz">${ICONS.flash}</button>
      </div>
      <div class="camera__stage">${ICONS.camera}</div>
      <div class="camera__modes">
        <button class="camera__mode is-active" data-mode="photo">FOTO</button>
        <button class="camera__mode" data-mode="video">VIDEO</button>
      </div>
      <div class="camera__bottom">
        <button class="camera__side" id="camGallery" aria-label="Galerie">${ICONS.image}</button>
        <button class="camera__shutter" id="camShutter" aria-label="Aufnehmen"><span class="camera__shutter-inner"></span></button>
        <button class="camera__side" id="camSwitch" aria-label="Kamera wechseln">${ICONS.switchCam}</button>
      </div>
    </div>`;

  const close = () => {
    if (state.area === 'camera') state.area = 'messenger';
    closeOverlay();
  };

  $('#camClose').addEventListener('click', close);
  $('#camFlash').addEventListener('click', () => toast('Blitz umgeschaltet'));
  $('#camGallery').addEventListener('click', () => toast('Galerie folgt in Phase 3'));
  $('#camSwitch').addEventListener('click', () => toast('Kamera gewechselt'));

  overlay.querySelectorAll('.camera__mode').forEach((b) =>
    b.addEventListener('click', () => {
      mode = b.dataset.mode;
      overlay.querySelectorAll('.camera__mode').forEach((x) => x.classList.toggle('is-active', x === b));
    })
  );

  $('#camShutter').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    if (mode === 'photo') {
      toast('Foto aufgenommen');
      return;
    }
    recording = !recording;
    btn.classList.toggle('is-rec', recording);
    toast(recording ? 'Aufnahme gestartet' : 'Aufnahme gespeichert');
  });
}

function closeOverlay() {
  overlay.hidden = true;
  overlay.innerHTML = '';
  render();
}

/* ---------------------------------------------------------- navigation */
document.querySelectorAll('.navbtn').forEach((b) =>
  b.addEventListener('click', () => {
    state.area = 'messenger';
    state.view = b.dataset.view;
    render();
  })
);

document.querySelectorAll('.topbar__btn').forEach((b) =>
  b.addEventListener('click', () => {
    const area = b.dataset.area;
    if (area === 'camera') {
      state.area = 'camera';
      render();
      return;
    }
    state.area = area;
    if (area === 'profile') state.view = 'settings';
    if (area === 'messenger') state.view = 'chats';
    render();
  })
);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.hidden) {
    clearInterval(storyTimer);
    if (state.openChatId) closeChat();
    else closeOverlay();
  }
});

/* ---------------------------------------------------------- icons in chrome */
function paintChrome() {
  const top = [ICONS.play, ICONS.chat, ICONS.people, ICONS.camera, ICONS.person];
  document.querySelectorAll('.topbar__btn').forEach((b, i) => (b.innerHTML = top[i]));
  const nav = [ICONS.chat, ICONS.image, ICONS.people, ICONS.settings];
  document.querySelectorAll('.navbtn__icon').forEach((el, i) => (el.innerHTML = nav[i]));
}

paintChrome();
bootstrap();
