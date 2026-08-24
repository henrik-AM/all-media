/*
 * Grundstruktur der App — sie folgt dem Figma-Prototypen und wird nicht
 * abgewandelt:
 *
 *   unten  : vier Bereiche (Messenger, Videos, Communitys, Einstellungen)
 *   oben   : die Unterpunkte des gerade offenen Bereichs
 *
 * Die Unterpunkte je Bereich stammen aus den Prototyp-Frames:
 *   Messenger   -> Friend-Map | Chats | Kamera | Profil
 *   Videos      -> Home | Hochformat | Querformat | Suche | Profil
 *   Communitys  -> Home | Chats | Suchen | Profil
 *   Einstellungen hat im Prototyp keine obere Leiste.
 */
const NAV = {
  messenger: {
    label: 'Messenger',
    icon: 'chat',
    subs: [
      { id: 'friendmap', label: 'Friend-Map', icon: 'mapPin' },
      { id: 'chats', label: 'Chats', icon: 'chat' },
      { id: 'camera', label: 'Kamera', icon: 'camera' },
      { id: 'profile', label: 'Profil', icon: 'person' },
    ],
  },
  videos: {
    label: 'Videos',
    icon: 'play',
    subs: [
      { id: 'home', label: 'Home', icon: 'home' },
      { id: 'portrait', label: 'Hochformat', icon: 'portrait' },
      { id: 'landscape', label: 'Querformat', icon: 'landscape' },
      { id: 'search', label: 'Suche', icon: 'search' },
      { id: 'profile', label: 'Profil', icon: 'person' },
    ],
  },
  communities: {
    label: 'Communitys',
    icon: 'people',
    subs: [
      { id: 'home', label: 'Home', icon: 'grid' },
      { id: 'chats', label: 'Chats', icon: 'chat' },
      { id: 'search', label: 'Suchen', icon: 'search' },
      { id: 'profile', label: 'Profil', icon: 'person' },
    ],
  },
  settings: { label: 'Einstellungen', icon: 'settings', subs: [] },
};

const AREAS = ['messenger', 'videos', 'communities', 'settings'];

const state = {
  users: {},
  chats: [],
  stories: [],
  contacts: [],
  communities: [],
  videos: [],
  posts: [],
  clips: [],
  hashtags: [],
  sounds: [],
  places: [],
  friends: [],
  area: 'messenger',
  // Jeder Bereich merkt sich seinen zuletzt offenen Unterpunkt.
  sub: { messenger: 'chats', videos: 'home', communities: 'home', settings: 'main' },
  filter: 'all',
  query: '',
  contactQuery: '',
  communityQuery: '',
  communityFilter: 'all',
  commSearchQuery: '',
  commSearchFilter: 'all',
  videoSearchQuery: '',
  clipQuery: '',
  theme: localStorage.getItem('am-theme') || 'system',
  ownProfileTab: 'grid',
  openChatId: null,
  messages: [],
};

const sub = () => state.sub[state.area];

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

// Untere Leiste: die vier Bereiche. Sie aendert sich nie.
function renderBottomNav() {
  const nav = $('#bottomnav');
  nav.innerHTML = AREAS.map((id) => `
    <button class="navbtn ${state.area === id ? 'is-active' : ''}" data-area="${id}">
      <span class="navbtn__icon">${ICONS[NAV[id].icon]}</span>
      <span class="navbtn__label">${NAV[id].label}</span>
    </button>`).join('');

  nav.querySelectorAll('[data-area]').forEach((b) =>
    b.addEventListener('click', () => {
      state.area = b.dataset.area;
      render();
    })
  );
}

// Obere Leiste: die Unterpunkte des offenen Bereichs.
function renderTopBar() {
  const bar = $('#topbar');
  const subs = NAV[state.area].subs;

  if (!subs.length) {
    bar.hidden = true;
    bar.innerHTML = '';
    return;
  }

  bar.hidden = false;
  bar.style.gridTemplateColumns = `repeat(${subs.length}, 1fr)`;
  bar.innerHTML = subs.map((s) => `
    <button class="topbar__btn ${sub() === s.id ? 'is-active' : ''}" data-sub="${s.id}" title="${s.label}" aria-label="${s.label}">
      ${ICONS[s.icon]}
    </button>`).join('');

  bar.querySelectorAll('[data-sub]').forEach((b) =>
    b.addEventListener('click', () => {
      state.sub[state.area] = b.dataset.sub;
      render();
    })
  );
}

function render() {
  renderBottomNav();
  renderTopBar();

  const v = sub();
  if (state.area === 'messenger') {
    if (v === 'friendmap') return renderFriendMap();
    if (v === 'chats') return renderChats();
    if (v === 'camera') return renderCameraPage();
    if (v === 'profile') return renderMessengerProfile();
  }
  if (state.area === 'videos') {
    if (v === 'home') return renderHomeFeed();
    if (v === 'portrait') return renderVideoFeed();
    if (v === 'landscape') return renderLandscapeVideos();
    if (v === 'search') return renderVideoSearch();
    if (v === 'profile') return renderVideoProfile();
  }
  if (state.area === 'communities') {
    if (v === 'home') return renderCommunities();
    if (v === 'chats') return renderCommunityChats();
    if (v === 'search') return renderCommunitySearch();
    if (v === 'profile') return renderCommunityProfile();
  }
  return renderSettings();
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
    ${storyRail()}
    <div class="pagehead">
      <div class="searchrow">
        <label class="searchbox">
          ${ICONS.search}
          <input id="chatSearch" type="search" placeholder="Suche hier nach deinen Chats ..." value="${esc(state.query)}" autocomplete="off" />
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
  $('#newChat').addEventListener('click', openNewMenu);
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

/* ---------------------------------------------------------- contacts page */
// Kontakte sind im Prototyp kein eigener Navigationspunkt, sondern werden aus
// der Chatliste heraus geoeffnet. Deshalb eine Overlay-Seite statt eines Tabs.
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

  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="page">
    <div class="pagehead">
      <div class="pagehead__row">
        <button class="iconbtn" id="contactsBack" aria-label="Zurück">${ICONS.back}</button>
        <h1 class="pagehead__title">Kontakte</h1>
      </div>
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
    </div>
    </div>`;

  $('#contactsBack').addEventListener('click', closeOverlay);
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
  $('#addContact').addEventListener('click', openAddContact);
  overlay.querySelectorAll('[data-contact]').forEach((r) =>
    r.addEventListener('click', () => {
      const chat = state.chats.find((c) => c.userId === r.dataset.contact);
      if (chat) openChat(chat.id);
      else toast('Noch kein Chat mit diesem Kontakt');
    })
  );
}

/* ---------------------------------------------------------- new: sheet */
function openSheet(title, bodyHtml, onMount) {
  const sheet = document.createElement('div');
  sheet.className = 'sheet-backdrop';
  sheet.innerHTML = `
    <div class="sheet" role="dialog" aria-label="${esc(title)}">
      <div class="sheet__handle"></div>
      <div class="sheet__title">${esc(title)}</div>
      ${bodyHtml}
    </div>`;
  document.querySelector('.app').appendChild(sheet);

  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) sheet.remove();
  });

  onMount?.(sheet, () => sheet.remove());
  return sheet;
}

function openNewMenu() {
  openSheet(
    'Neu',
    `<button class="item" data-new="group">
      <span class="item__icon">${ICONS.people}</span>
      <span class="item__label">Neue Gruppe</span>
      <span class="row__chevron">${ICONS.chevron}</span>
    </button>
    <button class="item" data-new="contact">
      <span class="item__icon">${ICONS.userPlus}</span>
      <span class="item__label">Kontakt hinzufügen</span>
      <span class="row__chevron">${ICONS.chevron}</span>
    </button>
    <button class="item" data-new="contacts">
      <span class="item__icon">${ICONS.person}</span>
      <span class="item__label">Kontakte</span>
      <span class="row__chevron">${ICONS.chevron}</span>
    </button>`,
    (sheet, close) => {
      sheet.querySelectorAll('[data-new]').forEach((b) =>
        b.addEventListener('click', () => {
          close();
          if (b.dataset.new === 'group') openNewGroup();
          else if (b.dataset.new === 'contacts') renderContacts();
          else openAddContact();
        })
      );
    }
  );
}

function openNewGroup() {
  // Zwei Schritte wie bei WhatsApp: erst die Personen, dann Name und Infos.
  // Vorher musste der Gruppenname vor der Auswahl feststehen - das war
  // verdreht.
  const zustand = { schritt: 1, gewaehlt: new Set(), extern: [], name: '', info: '' };

  const schrittEins = () => `
    <div class="sheet__field">
      <div class="sheet__row">
        <input id="groupPhone" placeholder="Telefonnummer hinzufügen" autocomplete="off" />
        <button class="iconbtn-primary" id="groupPhoneAdd" aria-label="Hinzufügen">${ICONS.plus}</button>
      </div>
    </div>
    <div class="sheet__hint">Auch Personen, die noch nicht in deinen Kontakten stehen.</div>
    <div class="sheet__body">
      ${zustand.extern
        .map(
          (e) => `<div class="row">
            ${avatarForUser(e.id, 44)}
            <div class="row__body">
              <div class="row__name">${esc(e.name)}</div>
              <div class="row__sub">${e.extern ? 'Wird eingeladen' : esc(e.phone || '')}</div>
            </div>
            <button class="iconbtn" data-extern-remove="${e.id}" aria-label="Entfernen">${ICONS.close || '×'}</button>
          </div>`
        )
        .join('')}
      ${state.contacts
        .filter((c) => c.status === 'friend')
        .map(
          (c) => `<button class="row" data-member="${c.id}">
            ${avatarForUser(c.id, 44)}
            <div class="row__body"><div class="row__name">${esc(c.name)}</div></div>
            <span class="checkbox ${zustand.gewaehlt.has(c.id) ? 'is-on' : ''}">${
              zustand.gewaehlt.has(c.id) ? ICONS.check : ''
            }</span>
          </button>`
        )
        .join('')}
    </div>
    <div class="sheet__footer">
      <button class="prof__btn is-primary" id="groupNext">Weiter</button>
    </div>`;

  const schrittZwei = () => `
    <div class="sheet__field">
      <div class="sheet__row">
        <div class="group-pic" id="groupPic">${ICONS.camera}</div>
        <span class="sheet__label">Gruppenbild hinzufügen</span>
      </div>
    </div>
    <div class="sheet__field">
      <label class="sheet__label" for="groupName">Gruppenname</label>
      <input id="groupName" placeholder="z. B. Wochenend-Crew" maxlength="40" value="${esc(zustand.name)}" />
    </div>
    <div class="sheet__field">
      <label class="sheet__label" for="groupInfo">Gruppen-Info (freiwillig)</label>
      <textarea id="groupInfo" rows="3" maxlength="200" placeholder="Worum geht es in der Gruppe?">${esc(
        zustand.info
      )}</textarea>
    </div>
    <div class="sheet__hint">${anzahl()} ${anzahl() === 1 ? 'Person' : 'Personen'} ausgewählt</div>
    <div class="sheet__footer">
      <button class="prof__btn is-primary" id="groupCreate">Gruppe erstellen</button>
    </div>`;

  const anzahl = () => zustand.gewaehlt.size + zustand.extern.length;

  const titel = () =>
    zustand.schritt === 1
      ? `Personen auswählen${anzahl() ? ` · ${anzahl()}` : ''}`
      : 'Gruppe einrichten';

  openSheet('Neue Gruppe', schrittEins(), (sheet, close) => {
    const neuZeichnen = () => {
      sheet.querySelector('.sheet').innerHTML = `
        <div class="sheet__handle"></div>
        <div class="sheet__title">${titel()}</div>
        ${zustand.schritt === 1 ? schrittEins() : schrittZwei()}`;
      binden();
    };

    const binden = () => {
      if (zustand.schritt === 1) {
        sheet.querySelectorAll('[data-member]').forEach((b) =>
          b.addEventListener('click', () => {
            const id = b.dataset.member;
            zustand.gewaehlt.has(id) ? zustand.gewaehlt.delete(id) : zustand.gewaehlt.add(id);
            neuZeichnen();
          })
        );

        sheet.querySelectorAll('[data-extern-remove]').forEach((b) =>
          b.addEventListener('click', () => {
            zustand.extern = zustand.extern.filter((e) => e.id !== b.dataset.externRemove);
            neuZeichnen();
          })
        );

        const nummerFeld = sheet.querySelector('#groupPhone');
        const nummerHinzu = async () => {
          const roh = nummerFeld.value.trim();
          if (!roh) return toast('Bitte eine Telefonnummer eingeben');

          const res = await fetch('/api/personen/suche', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eingabe: roh }),
          });
          const gefunden = await res.json();

          if (gefunden.person) {
            const id = gefunden.person.id;
            if (zustand.gewaehlt.has(id) || zustand.extern.some((e) => e.id === id)) {
              return toast(`${gefunden.person.name} ist schon dabei`);
            }
            zustand.extern.push({ id, name: gefunden.person.name, phone: gefunden.person.phone });
            toast(`${gefunden.person.name} hinzugefügt`);
          } else {
            if (zustand.extern.some((e) => e.phone === roh)) return toast('Diese Nummer ist schon dabei');
            zustand.extern.push({ id: 'ext' + Date.now(), name: roh, phone: roh, extern: true });
            toast(`${roh} wird eingeladen`);
          }
          neuZeichnen();
        };

        nummerFeld.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') nummerHinzu();
        });
        sheet.querySelector('#groupPhoneAdd').addEventListener('click', nummerHinzu);

        sheet.querySelector('#groupNext').addEventListener('click', () => {
          if (!anzahl()) return toast('Bitte mindestens eine Person auswählen');
          zustand.schritt = 2;
          neuZeichnen();
        });
        return;
      }

      // Schritt 2
      const nameFeld = sheet.querySelector('#groupName');
      const infoFeld = sheet.querySelector('#groupInfo');
      nameFeld.focus();
      nameFeld.addEventListener('input', (e) => (zustand.name = e.target.value));
      infoFeld.addEventListener('input', (e) => (zustand.info = e.target.value));
      sheet.querySelector('#groupPic').addEventListener('click', () => toast('Gruppenbild auswählen folgt'));

      sheet.querySelector('#groupCreate').addEventListener('click', async () => {
        const name = zustand.name.trim();
        if (!name) return toast('Bitte einen Gruppennamen eingeben');

        const res = await fetch('/api/groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            memberIds: [...zustand.gewaehlt, ...zustand.extern.map((e) => e.id)],
            info: zustand.info.trim(),
          }),
        });
        const chat = await res.json();
        state.chats.unshift(chat);
        close();
        toast(`Gruppe „${chat.name}“ erstellt`);
        openChat(chat.id);
      });
    };

    sheet.querySelector('.sheet').classList.add('sheet--tall');
    neuZeichnen();
  });
}

function openAddContact() {
  openSheet(
    'Kontakt hinzufügen',
    `<div class="sheet__field">
      <input id="contactHandle" placeholder="Benutzername oder Telefonnummer" autocomplete="off" />
    </div>
    <div class="sheet__hint">Noch keine Kontakte: @greta, @hakan, @ida — oder deren Nummer, z. B. +49 174 8901234</div>
    <div class="sheet__field">
      <label class="sheet__label" for="contactMsg">Nachricht (freiwillig)</label>
      <textarea id="contactMsg" rows="3" placeholder="Kurz schreiben, wer du bist …"></textarea>
    </div>
    <div class="sheet__hint">
      Diese eine Nachricht geht schon mit der Anfrage raus. Weitere erst,
      wenn die Anfrage angenommen wurde.
    </div>
    <div class="sheet__footer">
      <button class="prof__btn is-primary" id="contactAdd">Anfrage senden</button>
    </div>`,
    (sheet, close) => {
      const input = sheet.querySelector('#contactHandle');
      const msg = sheet.querySelector('#contactMsg');
      input.focus();

      const submit = async () => {
        const handle = input.value.trim();
        if (!handle) return toast('Bitte Benutzername oder Telefonnummer eingeben');

        const nachricht = msg.value.trim();
        const res = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handle, nachricht }),
        });
        const result = await res.json();

        if (!result.ok) return toast(result.error);

        state.contacts.push(result.contact);
        if (result.chat) state.chats.unshift(result.chat);
        close();
        toast(
          nachricht
            ? `Anfrage mit Nachricht an ${result.contact.name} gesendet`
            : `Anfrage an ${result.contact.name} gesendet`
        );
        if (overlay.querySelector('#contactSearch')) renderContacts();
        else if (result.chat) openChat(result.chat.id);
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') msg.focus();
      });
      sheet.querySelector('#contactAdd').addEventListener('click', submit);
    }
  );
}

/* ------------------------------------------------------ contact profile */
/** Kontaktinfo aus Sicht des Messengers - an WhatsApp angelehnt. */
async function openContactProfile(userId) {
  const u = user(userId);
  if (!u) return toast('Diese Person gibt es nicht');

  const eintraege = [
    ['images', 'Medien, Links und Dokumente', '128'],
    ['star', 'Markierte Nachrichten', '3'],
    ['mute', 'Stummschalten', ''],
    ['clock', 'Selbstlöschende Nachrichten', 'Aus'],
    ['lock', 'Verschlüsselung', 'Ende-zu-Ende'],
  ];

  overlay.hidden = false;
  overlay.innerHTML = `
    <header class="chathead">
      <button class="chathead__back" id="kpBack" aria-label="Zurück">${ICONS.back}</button>
      <div class="chathead__body"><div class="chathead__name">Kontaktinfo</div></div>
    </header>

    <div class="scroll">
      <div class="kp__kopf">
        ${avatarForUser(userId, 104)}
        <div class="kp__name">${esc(u.name)}</div>
        <div class="kp__handle">${esc(u.handle)}</div>
        ${u.phone ? `<div class="kp__nummer">${esc(u.phone)}</div>` : ''}
      </div>

      <div class="kp__aktionen">
        <button data-kp="message">${ICONS.chat || ICONS.send}<span>Nachricht</span></button>
        <button data-kp="audio">${ICONS.phone}<span>Anrufen</span></button>
        <button data-kp="video">${ICONS.video}<span>Video</span></button>
        <button data-kp="search">${ICONS.search}<span>Suchen</span></button>
      </div>

      <div class="kp__liste">
        ${eintraege
          .map(
            ([, label, wert]) => `<button class="kp__zeile" data-kp-item="${esc(label)}">
              <span class="kp__zeileText">${esc(label)}</span>
              ${wert ? `<span class="kp__zeileWert">${esc(wert)}</span>` : ''}
              <span class="row__chevron">${ICONS.chevron}</span>
            </button>`
          )
          .join('')}
      </div>

      <div class="kp__liste">
        <button class="kp__zeile is-danger" data-kp-item="Kontakt blockieren">
          <span class="kp__zeileText">Kontakt blockieren</span>
        </button>
        <button class="kp__zeile is-danger" data-kp-item="Kontakt melden">
          <span class="kp__zeileText">Kontakt melden</span>
        </button>
      </div>
    </div>`;

  $('#kpBack').addEventListener('click', () => {
    overlay.hidden = true;
    overlay.innerHTML = '';
  });

  overlay.querySelectorAll('[data-kp]').forEach((b) =>
    b.addEventListener('click', () => {
      const was = b.dataset.kp;
      if (was === 'message') {
        const chat = state.chats.find((c) => c.userId === userId);
        if (chat) return openChat(chat.id);
        return toast('Noch kein Chat mit dieser Person');
      }
      toast(`${b.textContent.trim()} folgt`);
    })
  );

  overlay.querySelectorAll('[data-kp-item]').forEach((b) =>
    b.addEventListener('click', () => toast(`${b.dataset.kpItem} folgt`))
  );
}

/* ---------------------------------------------------------- user profile */
/**
 * Profil einer Person.
 *
 * variante 'kontakt'   = Sicht des Messengers, an WhatsApp angelehnt
 * variante 'oeffentlich' = Beitragsprofil wie im Bereich Videos
 *
 * Vorher landete man aus einem Chat heraus immer im Beitragsprofil - aus dem
 * Messenger heraus will man aber Nummer, Medien und Stummschalten sehen.
 */
async function openProfile(userId, variante) {
  if (variante === undefined) variante = state.view === 'chats' || state.view === 'friendmap' ? 'kontakt' : 'oeffentlich';
  if (variante === 'kontakt') return openContactProfile(userId);

  const res = await fetch(`/api/profile/${userId}`);
  if (!res.ok) return toast('Profil nicht verfügbar');
  let profile = await res.json();
  let tab = 'grid';

  overlay.hidden = false;

  const paint = () => {
    overlay.innerHTML = `
      <header class="chathead">
        <button class="chathead__back" id="profBack" aria-label="Zurück">${ICONS.back}</button>
        <div class="chathead__body"><div class="chathead__name">${esc(profile.handle || '@' + profile.name)}</div></div>
        <div class="chathead__actions">
          <button id="profMore" aria-label="Mehr">${ICONS.info}</button>
        </div>
      </header>

      <div class="scroll">
        <div class="prof__top">
          <div class="story__ring" style="width:88px;height:88px;padding:3px">
            <div class="story__inner" style="background:${profile.color};font-size:28px">${esc(profile.initials)}</div>
          </div>
          <div class="prof__stats">
            <div class="prof__stat"><strong>${compactNumber(profile.posts)}</strong><span>Beiträge</span></div>
            <div class="prof__stat"><strong>${compactNumber(profile.followers)}</strong><span>Follower</span></div>
            <div class="prof__stat"><strong>${compactNumber(profile.following)}</strong><span>Gefolgt</span></div>
          </div>
        </div>

        <div class="prof__about">
          <div class="prof__name">${esc(profile.name)}</div>
          <div class="prof__bio">${esc(profile.bio)}</div>
          <a class="prof__link" href="#" id="profLink">${esc(profile.link)}</a>
        </div>

        <div class="prof__buttons">
          <button class="prof__btn ${profile.following_me ? 'is-following' : 'is-primary'}" id="profFollow">
            ${profile.following_me ? 'Gefolgt' : 'Folgen'}
          </button>
          <button class="prof__btn" id="profMessage">Nachricht</button>
        </div>

        ${
          profile.highlights.length
            ? `<div class="storyrail">${profile.highlights
                .map(
                  (h) => `<div class="story">
                    <div class="story__ring is-viewed">
                      <div class="story__inner" style="background:${profile.color};font-size:13px">${esc(
                        h.slice(0, 2).toUpperCase()
                      )}</div>
                    </div>
                    <div class="story__name">${esc(h)}</div>
                  </div>`
                )
                .join('')}</div>`
            : ''
        }

        <div class="prof__tabs">
          <button class="prof__tab ${tab === 'grid' ? 'is-active' : ''}" data-ptab="grid" aria-label="Beiträge">${ICONS.image}</button>
          <button class="prof__tab ${tab === 'repost' ? 'is-active' : ''}" data-ptab="repost" aria-label="Reposts">${ICONS.repeat}</button>
          <button class="prof__tab ${tab === 'tagged' ? 'is-active' : ''}" data-ptab="tagged" aria-label="Markiert">${ICONS.person}</button>
        </div>

        ${
          tab === 'grid'
            ? `<div class="prof__grid">${profile.grid
                .map(
                  (g) => `<div class="griditem">
                    ${ICONS.image}
                    ${g.kind === 'video' ? `<span class="griditem__badge">${ICONS.play}</span>` : ''}
                  </div>`
                )
                .join('')}</div>`
            : `<div class="empty">${tab === 'repost' ? ICONS.repeat : ICONS.person}
                <div class="empty__title">${tab === 'repost' ? 'Keine Reposts' : 'Keine Markierungen'}</div>
                <div class="empty__text">Hier ist noch nichts.</div>
              </div>`
        }
      </div>`;

    $('#profBack').addEventListener('click', closeOverlay);
    $('#profMore').addEventListener('click', () => toast('Weitere Optionen folgen in Phase 3'));
    $('#profLink').addEventListener('click', (e) => {
      e.preventDefault();
      toast(profile.link);
    });

    $('#profFollow').addEventListener('click', async () => {
      const r = await fetch(`/api/profile/${userId}/follow`, { method: 'POST' });
      const updated = await r.json();
      profile = { ...profile, ...updated };
      toast(updated.following_me ? `Du folgst ${profile.name}` : `${profile.name} nicht mehr gefolgt`);
      paint();
    });

    $('#profMessage').addEventListener('click', () => {
      const chat = state.chats.find((c) => c.userId === userId);
      if (chat) openChat(chat.id);
      else toast('Noch kein Chat mit dieser Person');
    });

    overlay.querySelectorAll('[data-ptab]').forEach((b) =>
      b.addEventListener('click', () => {
        tab = b.dataset.ptab;
        paint();
      })
    );
  };

  paint();
}

/* ---------------------------------------------------------- comments */
async function openComments(targetId, onCountChange) {
  const res = await fetch(`/api/comments/${targetId}`);
  let list = await res.json();

  const sheet = document.createElement('div');
  sheet.className = 'sheet-backdrop';
  document.querySelector('.app').appendChild(sheet);

  const paint = () => {
    sheet.innerHTML = `
      <div class="sheet sheet--tall" role="dialog" aria-label="Kommentare">
        <div class="sheet__handle"></div>
        <div class="sheet__title">${list.length} ${list.length === 1 ? 'Kommentar' : 'Kommentare'}</div>
        <div class="sheet__body">
          ${
            list.length
              ? list.map(commentRow).join('')
              : `<div class="empty">${ICONS.chat}
                  <div class="empty__title">Noch keine Kommentare</div>
                  <div class="empty__text">Schreib den ersten.</div>
                </div>`
          }
        </div>
        <form class="composer" id="commentForm">
          <div class="avatar avatar--36" style="background:${user('me').color}">DU</div>
          <div class="composer__field">
            <textarea id="commentInput" rows="1" placeholder="Kommentar hinzufügen"></textarea>
          </div>
          <button type="submit" class="composer__send" id="commentSend" aria-label="Senden" disabled>${ICONS.send}</button>
        </form>
      </div>`;

    sheet.querySelectorAll('[data-clike]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const r = await fetch(`/api/comments/${targetId}/${btn.dataset.clike}/like`, { method: 'POST' });
        const updated = await r.json();
        list = list.map((c) => (c.id === updated.id ? updated : c));
        paint();
      })
    );

    const input = sheet.querySelector('#commentInput');
    const send = sheet.querySelector('#commentSend');

    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 108) + 'px';
      send.disabled = !input.value.trim();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sheet.querySelector('#commentForm').requestSubmit();
      }
    });

    sheet.querySelector('#commentForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;

      const r = await fetch(`/api/comments/${targetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      list = [...list, await r.json()];
      onCountChange?.(list.length);
      paint();
      sheet.querySelector('.sheet__body').scrollTop = sheet.querySelector('.sheet__body').scrollHeight;
    });
  };

  paint();

  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) sheet.remove();
  });
}

function commentRow(c) {
  const u = user(c.userId);
  return `
    <div class="comment">
      <div class="avatar avatar--36" style="background:${u.color}">${esc(u.initials)}</div>
      <div class="comment__body">
        <div class="comment__text"><strong data-profile="${c.userId}">${esc(u.name)}</strong> ${esc(c.text)}</div>
        <div class="comment__meta">${esc(c.time)}${c.likes ? ` · ${c.likes} Gefällt mir` : ''}</div>
      </div>
      <button class="comment__like ${c.liked ? 'is-on' : ''}" data-clike="${c.id}" aria-label="Gefällt mir">${ICONS.heart}</button>
    </div>`;
}

/* ---------------------------------------------------------- home feed */
function renderHomeFeed() {
  main.innerHTML = `
    <div class="scroll" id="homeScroll">
      ${storyRail()}
      <div class="postlist">${state.posts.map(postCard).join('')}</div>
    </div>`;

  bindStoryRail();

  main.querySelectorAll('[data-paction]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const { paction, pid } = btn.dataset;

      if (paction === 'comment') {
        return openComments(pid, (count) => {
          const idx = state.posts.findIndex((x) => x.id === pid);
          state.posts[idx] = { ...state.posts[idx], comments: count };
        });
      }
      if (paction === 'share') return toast('Beitrag geteilt');
      if (paction === 'repost') return toast('Repost folgt in Phase 3');

      const res = await fetch(`/api/posts/${pid}/${paction}`, { method: 'POST' });
      const updated = await res.json();
      const idx = state.posts.findIndex((p) => p.id === updated.id);
      state.posts[idx] = updated;

      if (paction === 'save') toast(updated.saved ? 'Gespeichert' : 'Nicht mehr gespeichert');
      if (paction === 'follow') toast(updated.following ? 'Du folgst jetzt' : 'Nicht mehr gefolgt');
      if (paction === 'notify') toast(updated.notify ? 'Benachrichtigungen an' : 'Benachrichtigungen aus');

      const scrollTop = $('#homeScroll').scrollTop;
      renderHomeFeed();
      $('#homeScroll').scrollTop = scrollTop;
    })
  );
}

function postCard(p) {
  const u = user(p.userId);
  return `
    <article class="post">
      <header class="post__head">
        <div class="story__ring" style="width:40px;height:40px;padding:2px">
          <div class="story__inner" style="background:${u.color};font-size:13px">${esc(u.initials)}</div>
        </div>
        <button class="post__who" data-profile="${p.userId}">
          <div class="post__name">${esc(u.name)}</div>
          <div class="post__sub">${esc(p.location)} · ${esc(p.music)}</div>
        </button>
        <button class="post__follow ${p.following ? 'is-on' : ''}" data-paction="follow" data-pid="${p.id}">
          ${p.following ? 'Gefolgt' : 'Folgen'}
        </button>
        <button class="post__bell ${p.notify ? 'is-on' : ''}" data-paction="notify" data-pid="${p.id}" aria-label="Benachrichtigungen">
          ${ICONS.bell}
        </button>
      </header>

      <div class="post__media">${ICONS.image}</div>

      <div class="post__actions">
        <button class="postbtn ${p.liked ? 'is-liked' : ''}" data-paction="like" data-pid="${p.id}" aria-label="Gefällt mir">${ICONS.heart}</button>
        <button class="postbtn" data-paction="comment" data-pid="${p.id}" aria-label="Kommentieren">${ICONS.chat}</button>
        <button class="postbtn" data-paction="share" data-pid="${p.id}" aria-label="Senden">${ICONS.send}</button>
        <button class="postbtn" data-paction="repost" data-pid="${p.id}" aria-label="Repost">${ICONS.repeat}</button>
        <button class="postbtn postbtn--end ${p.saved ? 'is-saved' : ''}" data-paction="save" data-pid="${p.id}" aria-label="Speichern">${ICONS.bookmark}</button>
      </div>

      <div class="post__likes">
        Gefällt <strong>${esc(p.likedBy)}</strong> und ${compactNumber(Math.max(p.likes - 1, 0))} weiteren Personen
      </div>
      <div class="post__desc"><strong>${esc(u.name)}</strong> ${esc(p.description)}</div>
      <button class="post__comments" data-paction="comment" data-pid="${p.id}">
        Alle ${p.comments} Kommentare ansehen
      </button>
    </article>`;
}

/* ---------------------------------------------------------- video feed */
function compactNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.', ',') + ' Mio.';
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.', ',') + 'k';
  return String(n);
}

function renderVideoFeed() {
  main.innerHTML = `<div class="feed" id="feed">${state.videos.map(videoSlide).join('')}</div>`;

  main.querySelectorAll('[data-vaction]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const { vaction, vid } = btn.dataset;

      if (vaction === 'comment') {
        return openComments(vid, (count) => {
          const idx = state.videos.findIndex((x) => x.id === vid);
          state.videos[idx] = { ...state.videos[idx], comments: count };
        });
      }
      if (vaction === 'repost') return toast('Repost folgt in Phase 3');

      const res = await fetch(`/api/videos/${vid}/${vaction}`, { method: 'POST' });
      const updated = await res.json();
      const idx = state.videos.findIndex((v) => v.id === updated.id);
      state.videos[idx] = updated;

      if (vaction === 'share') toast('Beitrag geteilt');
      if (vaction === 'save') toast(updated.saved ? 'Gespeichert' : 'Nicht mehr gespeichert');

      const scrollTop = $('#feed').scrollTop;
      renderVideoFeed();
      $('#feed').scrollTop = scrollTop;
    })
  );

  main.querySelectorAll('[data-vfollow]').forEach((btn) =>
    btn.addEventListener('click', () => toast('Folgen folgt in Phase 3'))
  );
}

function videoSlide(v) {
  const u = user(v.userId);
  return `
    <section class="slide">
      <div class="slide__stage">${ICONS.play}</div>

      <div class="slide__rail">
        <button class="railbtn ${v.liked ? 'is-on' : ''}" data-vaction="like" data-vid="${v.id}" aria-label="Gefällt mir">
          ${ICONS.heart}
          <span>${compactNumber(v.likes)}</span>
        </button>
        <button class="railbtn" data-vaction="comment" data-vid="${v.id}" aria-label="Kommentare">
          ${ICONS.chat}
          <span>${compactNumber(v.comments)}</span>
        </button>
        <button class="railbtn" data-vaction="share" data-vid="${v.id}" aria-label="Teilen">
          ${ICONS.send}
          <span>${compactNumber(v.shares)}</span>
        </button>
        <button class="railbtn" data-vaction="repost" data-vid="${v.id}" aria-label="Repost">
          ${ICONS.repeat}
          <span>Repost</span>
        </button>
        <button class="railbtn ${v.saved ? 'is-saved' : ''}" data-vaction="save" data-vid="${v.id}" aria-label="Speichern">
          ${ICONS.bookmark}
          <span>${v.saved ? 'Gespeichert' : 'Merken'}</span>
        </button>
      </div>

      <div class="slide__meta">
        <div class="slide__author">
          <button class="slide__who" data-profile="${v.userId}">
            <div class="avatar avatar--36" style="background:${u.color}">${esc(u.initials)}</div>
            <span class="slide__name">${esc(u.name)}</span>
          </button>
          <button class="slide__follow" data-vfollow="${v.id}">Folgen</button>
        </div>
        <div class="slide__desc">${esc(v.description)}</div>
        <div class="slide__sub">${esc(v.location)} · ${esc(v.music)}</div>
      </div>
    </section>`;
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
      <div class="searchrow">
        <label class="searchbox">
          ${ICONS.search}
          <input id="commSearch" type="search" placeholder="Suche nach Communitys" value="${esc(state.communityQuery)}" autocomplete="off" />
          ${state.communityQuery ? `<button class="searchbox__clear" id="commSearchClear" aria-label="Suche löschen">${ICONS.close}</button>` : ''}
        </label>
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

  bindJoinButtons(renderCommunities);
}

// Beitreten/Verlassen wird an mehreren Stellen angeboten. Der Aufrufer sagt,
// was danach neu gezeichnet wird.
function bindJoinButtons(rerender) {
  main.querySelectorAll('[data-join]').forEach((btn) =>
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const res = await fetch(`/api/communities/${btn.dataset.join}/join`, { method: 'POST' });
      const updated = await res.json();
      const idx = state.communities.findIndex((c) => c.id === updated.id);
      state.communities[idx] = updated;
      toast(updated.joined ? `„${updated.name}" beigetreten` : `„${updated.name}" verlassen`);
      rerender();
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
/*
 * Prototyp-Frame "Einstellungen": vier Abschnitte (Allgemein, Messenger,
 * Videos, Communitys) mit einer Sprungleiste darueber. Die Eintraege sind
 * eins zu eins uebernommen.
 */
const SETTINGS = [
  {
    id: 'allgemein',
    title: 'Allgemein',
    items: [
      { label: 'Erziehungsberechtigte/r', icon: 'shield' },
      { label: 'Spendencode', icon: 'bookmark' },
      { label: 'Sicherheits-/Entsperrcode', icon: 'lock' },
      { label: 'Geräteverknüpfung', icon: 'portrait' },
      { label: 'Dunkles Design', icon: 'moon', toggle: 'theme' },
    ],
  },
  {
    id: 'konto',
    title: 'Konto',
    items: [
      { label: 'Profil bearbeiten', icon: 'person' },
      { label: 'Telefonnummer ändern', icon: 'phone' },
      { label: 'Passwort ändern', icon: 'lock' },
      { label: 'Zwei-Faktor-Anmeldung', icon: 'shield' },
      { label: 'Konto löschen', icon: 'block' },
    ],
  },
  {
    id: 'datenschutz',
    title: 'Datenschutz',
    items: [
      { label: 'Zuletzt online', icon: 'clock' },
      { label: 'Profilbild sichtbar für', icon: 'image' },
      { label: 'Info sichtbar für', icon: 'info' },
      { label: 'Blockierte Kontakte', icon: 'block' },
      { label: 'Gruppen: wer darf hinzufügen', icon: 'people' },
      { label: 'Bildschirmsperre', icon: 'lock', toggle: 'bildschirmsperre' },
    ],
  },
  {
    id: 'mitteilungen',
    title: 'Mitteilungen',
    items: [
      { label: 'Nachrichten-Töne', icon: 'bell', toggle: 'toene' },
      { label: 'Vibration', icon: 'portrait', toggle: 'vibration' },
      { label: 'Vorschau anzeigen', icon: 'eye', toggle: 'vorschau' },
      { label: 'Gruppen-Mitteilungen', icon: 'people' },
      { label: 'Ruhezeiten', icon: 'moon' },
    ],
  },
  {
    id: 'messenger',
    title: 'Chats',
    items: [
      { label: 'Lesebestätigung', icon: 'checkDouble', toggle: 'lesebestaetigung' },
      { label: 'Standort-Sichtbarkeit', icon: 'mapPin' },
      { label: 'Story-Sichtbarkeit', icon: 'eye' },
      { label: 'Mit Enter senden', icon: 'send', toggle: 'entersenden' },
      { label: 'Chat-Hintergrund', icon: 'image' },
      { label: 'Schriftgröße', icon: 'info' },
      { label: 'Chat-Verlauf sichern', icon: 'bookmark' },
      { label: 'Archivierte Chats', icon: 'bookmark' },
    ],
  },
  {
    id: 'speicher',
    title: 'Speicher',
    items: [
      { label: 'Automatischer Download', icon: 'image' },
      { label: 'Speicher verwalten', icon: 'compass' },
      { label: 'Datensparmodus', icon: 'portrait', toggle: 'datensparen' },
      { label: 'Medienqualität', icon: 'image' },
    ],
  },
  {
    id: 'hilfe',
    title: 'Hilfe',
    items: [
      { label: 'Hilfebereich', icon: 'info' },
      { label: 'Problem melden', icon: 'shield' },
      { label: 'Nutzungsbedingungen', icon: 'bookmark' },
      { label: 'Datenschutzerklärung', icon: 'lock' },
      { label: 'Freunde einladen', icon: 'people' },
    ],
  },
  {
    id: 'videos',
    title: 'Videos',
    items: [
      { label: 'Privates Profil', icon: 'lock', toggle: 'videoPrivate' },
      { label: 'Spendencode', icon: 'bookmark' },
      { label: 'Insights', icon: 'compass' },
      { label: 'Mit Glocke markierte Profile', icon: 'bell' },
      { label: 'Repost-Sichtbarkeit', icon: 'repeat' },
      { label: 'Likes-Sichtbarkeit', icon: 'heart' },
      { label: 'Downloadeinstellungen', icon: 'image' },
      { label: 'Story-Sichtbarkeit', icon: 'eye' },
      { label: 'Nutzerstatus', icon: 'person' },
      { label: 'Profilbanner', icon: 'landscape' },
    ],
  },
  {
    id: 'communitys',
    title: 'Communitys',
    items: [
      { label: 'Spendencode', icon: 'bookmark' },
      { label: 'Nutzerstatus', icon: 'person' },
      { label: 'Privates Profil', icon: 'lock', toggle: 'commPrivate' },
      { label: 'Nachrichtenerlaubnis', icon: 'chat' },
      { label: 'Push-to-Talk Nachricht', icon: 'mic' },
      { label: 'Gestummte Communitys', icon: 'mute' },
      { label: 'Gestummte Profile', icon: 'block' },
    ],
  },
];

const toggles = {
  videoPrivate: false,
  commPrivate: false,
  bildschirmsperre: false,
  toene: true,
  vibration: true,
  vorschau: true,
  lesebestaetigung: true,
  entersenden: false,
  datensparen: false,
};

function renderSettings() {
  const itemHtml = (it) => {
    if (it.toggle) {
      const on = it.toggle === 'theme' ? state.theme === 'dark' : toggles[it.toggle];
      return `<div class="item">
        <span class="item__icon">${ICONS[it.icon]}</span>
        <span class="item__label">${esc(it.label)}</span>
        <button class="switch ${on ? 'is-on' : ''}" data-toggle="${it.toggle}" aria-label="${esc(it.label)}"><span class="switch__knob"></span></button>
      </div>`;
    }
    return `<button class="item" data-setting="${esc(it.label)}">
      <span class="item__icon">${ICONS[it.icon]}</span>
      <span class="item__label">${esc(it.label)}</span>
      <span class="row__chevron">${ICONS.chevron}</span>
    </button>`;
  };

  main.innerHTML = `
    <div class="pagehead">
      <div class="pills">
        ${(() => {
        if (!state.konten) {
          const me = user('me');
          state.konten = [{ id: 'me', name: 'Henrik', email: 'henrik@allmedia.de', initials: me.initials, color: me.color }];
          state.kontoAktiv = 'me';
        }
        const aktiv = state.konten.find((k) => k.id === state.kontoAktiv) || state.konten[0];
        return `
        <div class="konto__kopf" id="kontoKopf">
          <span class="avatar avatar--52" style="background:${aktiv.color}">${esc(aktiv.initials)}</span>
          <div class="konto__body">
            <div class="konto__name">${esc(aktiv.name)}</div>
            <div class="konto__mail">${esc(aktiv.email)}${
              state.konten.length > 1 ? `  ·  ${state.konten.length} Konten` : ''
            }</div>
          </div>
          <span class="konto__pfeil">${ICONS.chevron}</span>
        </div>
        <button class="konto__wechsel" id="kontoWechselBtn">
          ${ICONS.people}<span>Konto wechseln oder hinzufügen</span>
        </button>`;
      })()}
      ${SETTINGS.map((sec) => `<button class="pill" data-jump="${sec.id}">${esc(sec.title)}</button>`).join('')}
      </div>
    </div>
    <div class="scroll" id="settingsScroll">
      ${SETTINGS.map(
        (sec) => `<div class="listhead" id="sec-${sec.id}">${esc(sec.title)} →</div>
          <div class="group">${sec.items.map(itemHtml).join('')}</div>`
      ).join('')}
      <div class="group">
        <button class="item" data-setting="Über All Media">
          <span class="item__icon">${ICONS.info}</span>
          <span class="item__label">Über All Media</span>
          <span class="item__value">1.0.0</span>
        </button>
        <button class="item item--danger" data-setting="Abmelden">
          <span class="item__icon">${ICONS.logout}</span>
          <span class="item__label">Abmelden</span>
        </button>
      </div>
    </div>`;

  $('#kontoKopf')?.addEventListener('click', openKontoWechsel);
  $('#kontoWechselBtn')?.addEventListener('click', openKontoWechsel);

  main.querySelectorAll('[data-jump]').forEach((b) =>
    b.addEventListener('click', () => {
      document.getElementById('sec-' + b.dataset.jump)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    })
  );

  main.querySelectorAll('[data-toggle]').forEach((b) =>
    b.addEventListener('click', () => {
      const key = b.dataset.toggle;
      if (key === 'theme') {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('am-theme', state.theme);
        applyTheme();
      } else {
        toggles[key] = !toggles[key];
      }
      b.classList.toggle('is-on');
    })
  );

  main.querySelectorAll('[data-setting]').forEach((b) =>
    b.addEventListener('click', () => toast(`${b.dataset.setting} folgt mit dem Backend`))
  );
}

/* ------------------------------------------------- Messenger: Friend-Map */
// Prototyp-Frame "Messenger - Friend-Map": Karte mit Freunden, darunter eine
// Liste mit letztem Standort.
function renderFriendMap() {
  // Zoom und Verschiebung der Karte. Bleibt zwischen den Neuzeichnungen
  // erhalten, damit ein Klick auf einen Kontakt nicht zurueckspringt.
  const k = (state.karte = state.karte || { zoom: 1, x: 0, y: 0, aktiv: null });
  const freigabeTexte = {
    niemand: 'Dein Standort bleibt privat',
    kontakte: 'Alle deine Kontakte sehen dich',
    ausgewaehlt: 'Nur wen du freigibst',
  };
  if (state.standort === undefined) state.standort = { an: true, wer: 'kontakte' };

  const strassenX = [12, 27, 44, 61, 78, 92];
  const strassenY = [15, 33, 52, 70, 87];
  const bloecke = [
    [4, 6, 16, 18], [32, 4, 20, 14], [66, 8, 22, 16], [6, 40, 14, 20],
    [34, 38, 18, 22], [70, 42, 18, 18], [14, 74, 22, 16], [52, 76, 26, 14],
  ];

  main.innerHTML = `
    <div class="scroll">
      <div class="map" id="map">
        <div class="map__flaeche" id="mapFlaeche">
          <div class="map__park"></div>
          <div class="map__fluss"></div>
          ${bloecke
            .map(([x, y, w, h]) => `<div class="map__block" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%"></div>`)
            .join('')}
          ${strassenX.map((x) => `<div class="map__strasse-v" style="left:${x}%"></div>`).join('')}
          ${strassenY.map((y) => `<div class="map__strasse-h" style="top:${y}%"></div>`).join('')}
          <div class="map__me" title="Dein Standort" style="transform:scale(${(1 / k.zoom).toFixed(3)})"><span></span></div>
          ${state.friends
            .map((f) => {
              const u = user(f.id);
              // Gegen den Zoom skalieren: Nadeln sollen ihre Groesse behalten,
              // sonst fuellt eine Nadel beim Hineinzoomen den halben Schirm.
              return `<button class="map__pin ${k.aktiv === f.id ? 'is-aktiv' : ''}" style="left:${f.x}%;top:${f.y}%;transform:scale(${(1 / k.zoom).toFixed(3)})" data-pin="${f.id}" title="${esc(u.name)}">
                <span class="map__dot" style="background:${u.color}">${esc(u.initials)}</span>
                <span class="map__label">${esc(u.name.split(' ')[0])}</span>
              </button>`;
            })
            .join('')}
        </div>

        <div class="map__zoom">
          <button id="zoomIn" aria-label="Näher">${ICONS.plus}</button>
          <button id="zoomOut" aria-label="Weiter weg">${ICONS.minus || '−'}</button>
        </div>
        ${k.zoom > 1.05 ? '<button class="map__reset" id="mapReset">Ganze Karte</button>' : ''}
      </div>

      <div class="standort">
        <div class="standort__kopf">
          <span class="standort__icon">${ICONS.mapPin}</span>
          <div class="standort__text">
            <div class="standort__titel">Deinen Standort teilen</div>
            <div class="standort__sub">${
              state.standort.an ? freigabeTexte[state.standort.wer] : 'Standort ist aus'
            }</div>
          </div>
          <label class="schalter">
            <input type="checkbox" id="standortAn" ${state.standort.an ? 'checked' : ''} />
            <span></span>
          </label>
        </div>
        ${
          state.standort.an
            ? `<div class="standort__optionen">
                ${['niemand', 'kontakte', 'ausgewaehlt']
                  .map(
                    (w) => `<button class="pill ${state.standort.wer === w ? 'is-active' : ''}" data-wer="${w}">${
                      { niemand: 'Niemand', kontakte: 'Alle Kontakte', ausgewaehlt: 'Ausgewählte' }[w]
                    }</button>`
                  )
                  .join('')}
              </div>`
            : ''
        }
      </div>

      <div class="listhead">In deiner Nähe</div>
      <ul class="rows">
        ${state.friends
          .map((f) => {
            const u = user(f.id);
            return `<li><div class="row ${k.aktiv === f.id ? 'is-aktiv' : ''}" data-zoom="${f.id}">
              ${avatarForUser(f.id, 44)}
              <div class="row__body">
                <div class="row__name">${esc(u.name)}</div>
                <div class="row__bottom"><span class="row__preview">${esc(f.place)} · ${esc(f.when)}</span></div>
              </div>
              <button class="iconbtn" data-friend-profil="${f.id}" aria-label="Profil von ${esc(u.name)}">${ICONS.person || ICONS.chevron}</button>
            </div></li>`;
          })
          .join('')}
      </ul>
    </div>`;

  const flaeche = $('#mapFlaeche');
  const anwenden = () => {
    flaeche.style.transform = `translate(${k.x}px, ${k.y}px) scale(${k.zoom})`;
  };
  anwenden();

  // Mit den echten Maszen rechnen, nicht mit geschaetzten - sonst sitzt die
  // Person beim Hineinzoomen nicht mittig.
  const masze = () => {
    const r = $('#map').getBoundingClientRect();
    return { b: r.width, h: r.height };
  };
  const grenze = () => {
    const m = masze();
    return { x: ((k.zoom - 1) * m.b) / 2, y: ((k.zoom - 1) * m.h) / 2 };
  };
  const begrenzen = () => {
    const g = grenze();
    k.x = Math.max(-g.x, Math.min(g.x, k.x));
    k.y = Math.max(-g.y, Math.min(g.y, k.y));
  };

  const setzeZoom = (z) => {
    k.zoom = Math.max(1, Math.min(4, z));
    begrenzen();
    anwenden();
    renderFriendMap();
  };

  $('#zoomIn').addEventListener('click', () => setzeZoom(k.zoom + 0.6));
  $('#zoomOut').addEventListener('click', () => setzeZoom(k.zoom - 0.6));
  $('#mapReset')?.addEventListener('click', () => {
    k.zoom = 1; k.x = 0; k.y = 0; k.aktiv = null;
    renderFriendMap();
  });

  /**
   * Auf eine Person zoomen: Sie sitzt bei x/y Prozent und soll in die Mitte -
   * dazu die Karte um die Abweichung von der Mitte verschieben.
   */
  const zoomAuf = (id) => {
    const f = state.friends.find((x) => x.id === id);
    if (!f) return;
    const m = masze();

    // Erst grob hinzoomen ...
    const abstand = Math.max(Math.abs(50 - f.x), Math.abs(50 - f.y)) / 100;
    k.zoom = Math.min(4, Math.max(2.4, 1 / Math.max(0.001, 0.52 - abstand)));
    k.aktiv = id;
    k.x = ((50 - f.x) / 100) * m.b * k.zoom;
    k.y = ((50 - f.y) / 100) * m.h * k.zoom;
    begrenzen();
    renderFriendMap();

    // ... danach genau nachzentrieren. Die Nadel sitzt wegen ihrer Spitze
    // und der Gegenskalierung nicht exakt auf dem gerechneten Punkt -
    // messen ist hier verlaesslicher als rechnen.
    requestAnimationFrame(() => {
      const rahmen = $('#map');
      const nadel = document.querySelector('.map__pin.is-aktiv');
      const flaeche = $('#mapFlaeche');
      if (!rahmen || !nadel || !flaeche) return;

      const rm = rahmen.getBoundingClientRect();
      const rn = nadel.getBoundingClientRect();
      k.x += rm.x + rm.width / 2 - (rn.x + rn.width / 2);
      k.y += rm.y + rm.height / 2 - (rn.y + rn.height / 2);
      begrenzen();
      flaeche.style.transform = `translate(${k.x}px, ${k.y}px) scale(${k.zoom})`;
    });
  };

  main.querySelectorAll('[data-pin]').forEach((el) =>
    el.addEventListener('click', () => zoomAuf(el.dataset.pin))
  );
  // Tippen auf den Kontakt zoomt auf der Karte - fuehrt nicht mehr weg.
  main.querySelectorAll('[data-zoom]').forEach((el) =>
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-friend-profil]')) return;
      zoomAuf(el.dataset.zoom);
    })
  );
  main.querySelectorAll('[data-friend-profil]').forEach((el) =>
    el.addEventListener('click', () => openProfile(el.dataset.friendProfil, 'kontakt'))
  );

  $('#standortAn').addEventListener('change', (e) => {
    state.standort.an = e.target.checked;
    toast(state.standort.an ? 'Standort wird geteilt' : 'Standort ist aus');
    renderFriendMap();
  });
  main.querySelectorAll('[data-wer]').forEach((b) =>
    b.addEventListener('click', () => {
      state.standort.wer = b.dataset.wer;
      toast(`Standort sichtbar für: ${b.textContent.trim()}`);
      renderFriendMap();
    })
  );

  // Verschieben mit der Maus oder dem Finger
  let zieht = false, startX = 0, startY = 0;
  const map = $('#map');
  const beginn = (cx, cy) => { zieht = true; startX = cx - k.x; startY = cy - k.y; };
  const zug = (cx, cy) => {
    if (!zieht) return;
    k.x = cx - startX;
    k.y = cy - startY;
    begrenzen();
    anwenden();
  };
  map.addEventListener('mousedown', (e) => beginn(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => zug(e.clientX, e.clientY));
  window.addEventListener('mouseup', () => (zieht = false));
  map.addEventListener('touchstart', (e) => beginn(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  map.addEventListener('touchmove', (e) => zug(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  map.addEventListener('touchend', () => (zieht = false));
}

/* ---------------------------------------------------- Messenger: Kamera */
// Prototyp-Frame "Messenger - Kamera". Als Seite, nicht als Overlay, weil die
// Kamera im Prototyp ein eigener Unterpunkt der oberen Leiste ist.
function renderCameraPage() {
  let mode = 'photo';
  let recording = false;

  main.innerHTML = `
    <div class="camera camera--page">
      <div class="camera__top">
        <span></span>
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

  $('#camFlash').addEventListener('click', () => toast('Blitz umgeschaltet'));
  $('#camGallery').addEventListener('click', () => toast('Galerie folgt mit dem Backend'));
  $('#camSwitch').addEventListener('click', () => toast('Kamera gewechselt'));

  main.querySelectorAll('.camera__mode').forEach((b) =>
    b.addEventListener('click', () => {
      mode = b.dataset.mode;
      main.querySelectorAll('.camera__mode').forEach((x) => x.classList.toggle('is-active', x === b));
    })
  );

  $('#camShutter').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    if (mode === 'photo') return toast('Foto aufgenommen');
    recording = !recording;
    btn.classList.toggle('is-rec', recording);
    toast(recording ? 'Aufnahme gestartet' : 'Aufnahme gespeichert');
  });
}

/* ---------------------------------------------------- Messenger: Profil */
/*
 * Prototyp-Frame "Messenger - Profil": Leiste "Profil wechseln" ueber die
 * volle Breite, darunter Bild links neben Name und Biografie, dann die beiden
 * Profilverweise und der Abschnitt Einstellungen.
 */
/* ------------------------------------------------------- Konto wechseln */
/*
 * Mehrere eigene Konten nebeneinander, wie man es von Instagram kennt.
 *
 * Henrik meinte mit "Profil wechseln" ausdruecklich nicht den Wechsel
 * zwischen Messenger-, Video- und Community-Profil desselben Kontos, sondern
 * ein zweites eigenstaendiges Konto, auf das man umschaltet.
 */
function openKontoWechsel() {
  if (!state.konten) {
    const me = user('me');
    state.konten = [{ id: 'me', name: 'Henrik', email: 'henrik@allmedia.de', initials: me.initials, color: me.color }];
    state.kontoAktiv = 'me';
  }

  const zustand = { ansicht: 'liste', name: '', email: '', passwort: '' };

  const liste = () => `
    <div class="sheet__body">
      ${state.konten
        .map(
          (k) => `<div class="row" data-konto="${k.id}">
            <span class="avatar avatar--44" style="background:${k.color}">${esc(k.initials)}</span>
            <div class="row__body">
              <div class="row__name">${esc(k.name)}</div>
              <div class="row__sub">${esc(k.email)}</div>
            </div>
            ${
              k.id === state.kontoAktiv
                ? `<span class="konto__aktiv">${ICONS.check}</span>`
                : `<button class="iconbtn" data-konto-weg="${k.id}" aria-label="Abmelden">${ICONS.close}</button>`
            }
          </div>`
        )
        .join('')}

      <button class="row" data-konto-neu="anmelden">
        <span class="konto__rund">${ICONS.person}</span>
        <div class="row__body"><div class="konto__aktion">Bestehendes Konto hinzufügen</div></div>
      </button>
      <button class="row" data-konto-neu="neu">
        <span class="konto__rund">${ICONS.plus}</span>
        <div class="row__body"><div class="konto__aktion">Neues Konto erstellen</div></div>
      </button>
    </div>`;

  const formular = () => `
    ${
      zustand.ansicht === 'neu'
        ? `<div class="sheet__field">
            <label class="sheet__label" for="kontoName">Name</label>
            <input id="kontoName" placeholder="Wie sollen dich andere sehen?" value="${esc(zustand.name)}" />
          </div>`
        : ''
    }
    <div class="sheet__field">
      <label class="sheet__label" for="kontoMail">E-Mail</label>
      <input id="kontoMail" type="email" placeholder="name@beispiel.de" value="${esc(zustand.email)}" />
    </div>
    <div class="sheet__field">
      <label class="sheet__label" for="kontoPass">Passwort</label>
      <input id="kontoPass" type="password" placeholder="••••••••" />
    </div>
    <div class="sheet__footer">
      <button class="prof__btn is-primary" id="kontoOk">
        ${zustand.ansicht === 'neu' ? 'Konto erstellen' : 'Anmelden'}
      </button>
    </div>`;

  const titel = () =>
    zustand.ansicht === 'liste'
      ? 'Konto wechseln'
      : zustand.ansicht === 'anmelden'
      ? 'Konto anmelden'
      : 'Neues Konto';

  openSheet('Konto wechseln', liste(), (sheet, close) => {
    const neuZeichnen = () => {
      sheet.querySelector('.sheet').innerHTML = `
        <div class="sheet__handle"></div>
        <div class="sheet__title">${titel()}</div>
        ${zustand.ansicht === 'liste' ? liste() : formular()}`;
      binden();
    };

    const anlegen = () => {
      const email = ($('#kontoMail')?.value || '').trim();
      const pass = ($('#kontoPass')?.value || '').trim();
      const name = ($('#kontoName')?.value || '').trim();

      if (zustand.ansicht === 'neu' && !name) return toast('Bitte einen Namen eingeben');
      if (!email) return toast('Bitte E-Mail eingeben');
      if (zustand.ansicht === 'neu' && pass.length < 6) return toast('Passwort: mindestens 6 Zeichen');
      if (!pass) return toast('Bitte Passwort eingeben');

      const vorhanden = state.konten.find((k) => k.email.toLowerCase() === email.toLowerCase());
      if (vorhanden) {
        state.kontoAktiv = vorhanden.id;
        close();
        toast(`Gewechselt zu ${vorhanden.name}`);
        return render();
      }

      const anzeige = name || email.split('@')[0].replace(/[._-]+/g, ' ');
      const farben = ['#F2A65A', '#6C8AE4', '#E4699B', '#4DB6AC', '#9575CD', '#7986CB'];
      const id = 'acc' + Date.now();
      state.konten.push({
        id,
        name: anzeige.charAt(0).toUpperCase() + anzeige.slice(1),
        email,
        initials: anzeige.slice(0, 2).toUpperCase(),
        color: farben[state.konten.length % farben.length],
      });
      state.kontoAktiv = id;
      close();
      toast(zustand.ansicht === 'neu' ? `Konto für ${anzeige} erstellt` : `Angemeldet als ${email}`);
      render();
    };

    const binden = () => {
      if (zustand.ansicht === 'liste') {
        sheet.querySelectorAll('[data-konto]').forEach((el) =>
          el.addEventListener('click', (e) => {
            if (e.target.closest('[data-konto-weg]')) return;
            const id = el.dataset.konto;
            if (id === state.kontoAktiv) return close();
            state.kontoAktiv = id;
            const k = state.konten.find((x) => x.id === id);
            close();
            toast(`Gewechselt zu ${k.name}`);
            render();
          })
        );
        sheet.querySelectorAll('[data-konto-weg]').forEach((b) =>
          b.addEventListener('click', () => {
            const id = b.dataset.kontoWeg;
            const k = state.konten.find((x) => x.id === id);
            state.konten = state.konten.filter((x) => x.id !== id);
            if (state.kontoAktiv === id) state.kontoAktiv = state.konten[0]?.id || null;
            toast(`${k.name} abgemeldet`);
            neuZeichnen();
          })
        );
        sheet.querySelectorAll('[data-konto-neu]').forEach((b) =>
          b.addEventListener('click', () => {
            zustand.ansicht = b.dataset.kontoNeu;
            neuZeichnen();
          })
        );
        return;
      }

      sheet.querySelector('#kontoOk').addEventListener('click', anlegen);
      sheet.querySelector('#kontoPass').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') anlegen();
      });
    };

    sheet.querySelector('.sheet').classList.add('sheet--tall');
    neuZeichnen();
  });
}

function switchBar(onClickId) {
  return `<button class="switchbar" id="${onClickId}">Profil wechseln</button>`;
}

function renderMessengerProfile() {
  const me = user('me');
  main.innerHTML = `
    ${switchBar('switchProfile')}
    <div class="scroll">
      <div class="mprof">
        <div class="avatar avatar--88" style="background:${me.color}">${esc(me.initials)}</div>
        <div class="mprof__text">
          <div class="mprof__name">Henrik</div>
          <div class="mprof__bio">Baue gerade All Media.</div>
        </div>
      </div>
      <div class="mprof__links">
        <button data-switch="videos">@videoprofil</button>
        <button data-switch="communities">@communityprofil</button>
      </div>

      <button class="sectionlink" data-mact="settings">Einstellungen <span>${ICONS.chevron}</span></button>
      <div class="group">
        <button class="item" data-mact="location">
          <span class="item__label">Standort-Sichtbarkeit</span>
          <span class="row__chevron">${ICONS.chevron}</span>
        </button>
        <button class="item" data-mact="story">
          <span class="item__label">Story-Sichtbarkeit</span>
          <span class="row__chevron">${ICONS.chevron}</span>
        </button>
        <button class="item" data-mact="read">
          <span class="item__label">Lesebestätigung</span>
          <span class="row__chevron">${ICONS.chevron}</span>
        </button>
      </div>
    </div>`;

  // Fuehrt zur Kontoliste - hier hat Henrik den Kontowechsel gesucht.
  $('#switchProfile').addEventListener('click', openKontoWechsel);
  main.querySelectorAll('[data-switch]').forEach((b) =>
    b.addEventListener('click', () => {
      state.area = b.dataset.switch;
      state.sub[state.area] = 'profile';
      render();
    })
  );
  main.querySelectorAll('[data-mact]').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.dataset.mact === 'settings') {
        state.area = 'settings';
        return render();
      }
      state.area = 'settings';
      render();
      toast('Zu finden im Abschnitt Messenger');
    })
  );
}

/* --------------------------------------------------- Videos: Querformat */
// Prototyp-Frame "Videos - Querformat": Suchleiste und Liste von
// Querformat-Videos mit Vorschaubild, Titel, Kanal und Laufzeit.
function renderLandscapeVideos() {
  const q = state.clipQuery.trim().toLowerCase();
  const list = state.clips.filter(
    (c) => !q || c.title.toLowerCase().includes(q) || user(c.userId).name.toLowerCase().includes(q)
  );

  main.innerHTML = `
    <div class="pagehead">
      <div class="searchrow">
        <label class="searchbox">
          ${ICONS.search}
          <input id="clipSearch" type="search" placeholder="Querformat durchsuchen" value="${esc(state.clipQuery)}" autocomplete="off" />
          ${state.clipQuery ? `<button class="searchbox__clear" id="clipSearchClear" aria-label="Suche löschen">${ICONS.close}</button>` : ''}
        </label>
      </div>
    </div>
    <div class="scroll">
      ${
        list.length
          ? list
              .map((c) => {
                const u = user(c.userId);
                return `<article class="clip" data-clip="${c.id}">
                  <div class="clip__thumb">${ICONS.landscape}<span class="clip__time">${esc(c.duration)}</span></div>
                  <div class="clip__meta">
                    <div class="avatar avatar--36" style="background:${u.color}" data-profile="${u.id}">${esc(u.initials)}</div>
                    <div>
                      <div class="clip__title">${esc(c.title)}</div>
                      <div class="clip__sub">${esc(u.name)} · ${compactNumber(c.views)} Aufrufe · ${esc(c.age)}</div>
                    </div>
                  </div>
                </article>`;
              })
              .join('')
          : `<div class="empty">${ICONS.landscape}
              <div class="empty__title">Kein Video gefunden</div>
              <div class="empty__text">Für „${esc(state.clipQuery)}" gibt es keinen Treffer.</div>
            </div>`
      }
    </div>`;

  const input = $('#clipSearch');
  input.addEventListener('input', (e) => {
    state.clipQuery = e.target.value;
    const pos = e.target.selectionStart;
    renderLandscapeVideos();
    const next = $('#clipSearch');
    next.focus();
    next.setSelectionRange(pos, pos);
  });
  $('#clipSearchClear')?.addEventListener('click', () => {
    state.clipQuery = '';
    renderLandscapeVideos();
    $('#clipSearch').focus();
  });
  main.querySelectorAll('[data-clip]').forEach((el) =>
    el.addEventListener('click', () => {
      const c = state.clips.find((x) => x.id === el.dataset.clip);
      toast(`„${c.title}" — Wiedergabe folgt mit dem Backend`);
    })
  );
}

/* -------------------------------------------------------- Videos: Suche */
// Prototyp-Frame "Video - Suche": Explorer mit den Abschnitten Reels,
// Querformat, Beiträge, Profile, Hashtags, Standorte und Sounds.
function renderVideoSearch() {
  const q = state.videoSearchQuery.trim().toLowerCase();
  const hit = (t) => !q || String(t).toLowerCase().includes(q);

  const reels = state.videos.filter((v) => hit(v.description) || hit(user(v.userId).name));
  const clips = state.clips.filter((c) => hit(c.title) || hit(user(c.userId).name));
  const posts = state.posts.filter((p) => hit(p.description) || hit(user(p.userId).name));
  const people = Object.values(state.users).filter((u) => u.id !== 'me' && (hit(u.name) || hit(u.handle)));
  const tags = state.hashtags.filter((h) => hit(h.tag));
  const places = state.places.filter((pl) => hit(pl.name));
  const sounds = state.sounds.filter((so) => hit(so.title) || hit(so.artist));

  const section = (title, body) => (body ? `<div class="exp"><div class="exp__head">${title} →</div>${body}</div>` : '');
  const total = reels.length + clips.length + posts.length + people.length + tags.length + places.length + sounds.length;

  main.innerHTML = `
    <div class="pagehead">
      <div class="searchrow">
        <label class="searchbox">
          ${ICONS.search}
          <input id="videoSearch" type="search" placeholder="Suche nach Videos, Profilen, #Hashtags" value="${esc(state.videoSearchQuery)}" autocomplete="off" />
          ${state.videoSearchQuery ? `<button class="searchbox__clear" id="videoSearchClear" aria-label="Suche löschen">${ICONS.close}</button>` : ''}
        </label>
      </div>
    </div>
    <div class="scroll">
      ${
        total
          ? section(
              'Reels',
              reels.length
                ? `<div class="exp__reels">${reels
                    .map((v) => `<button class="exp__reel" data-openvideo="${v.id}">${ICONS.portrait}<span>${esc(user(v.userId).name)}</span></button>`)
                    .join('')}</div>`
                : ''
            ) +
            section(
              'Querformat',
              clips.length
                ? `<div class="exp__list">${clips
                    .map(
                      (c) => `<button class="exp__row" data-openclip="${c.id}">
                        <span class="exp__thumb">${ICONS.landscape}</span>
                        <span class="exp__text"><strong>${esc(c.title)}</strong><small>${esc(user(c.userId).name)} · ${esc(c.duration)}</small></span>
                      </button>`
                    )
                    .join('')}</div>`
                : ''
            ) +
            section(
              'Beiträge',
              posts.length ? `<div class="exp__grid">${posts.map((p) => `<button class="griditem" data-openpost="${p.id}">${ICONS.image}</button>`).join('')}</div>` : ''
            ) +
            section(
              'Profile',
              people.length
                ? `<div class="exp__list">${people
                    .map(
                      (u) => `<button class="exp__row" data-profile="${u.id}">
                        <span class="avatar avatar--44" style="background:${u.color}">${esc(u.initials)}</span>
                        <span class="exp__text"><strong>${esc(u.name)}</strong><small>${esc(u.handle)}</small></span>
                      </button>`
                    )
                    .join('')}</div>`
                : ''
            ) +
            section(
              '# Hashtags',
              tags.length
                ? `<div class="exp__tags">${tags
                    .map((h) => `<button class="chip" data-tag="${esc(h.tag)}">${esc(h.tag)} · ${compactNumber(h.posts)}</button>`)
                    .join('')}</div>`
                : ''
            ) +
            section(
              'Standorte',
              places.length
                ? `<div class="exp__list">${places
                    .map(
                      (pl) => `<button class="exp__row" data-place="${pl.id}">
                        <span class="exp__thumb">${ICONS.mapPin}</span>
                        <span class="exp__text"><strong>${esc(pl.name)}</strong><small>${compactNumber(pl.posts)} Beiträge</small></span>
                      </button>`
                    )
                    .join('')}</div>`
                : ''
            ) +
            section(
              'Sounds',
              sounds.length
                ? `<div class="exp__list">${sounds
                    .map(
                      (so) => `<button class="exp__row" data-sound="${so.id}">
                        <span class="exp__thumb">${ICONS.music}</span>
                        <span class="exp__text"><strong>${esc(so.title)}</strong><small>${esc(so.artist)} · ${compactNumber(so.uses)} Videos</small></span>
                      </button>`
                    )
                    .join('')}</div>`
                : ''
            )
          : `<div class="empty">${ICONS.search}
              <div class="empty__title">Nichts gefunden</div>
              <div class="empty__text">Für „${esc(state.videoSearchQuery)}" gibt es keinen Treffer.</div>
            </div>`
      }
    </div>`;

  const input = $('#videoSearch');
  input.addEventListener('input', (e) => {
    state.videoSearchQuery = e.target.value;
    const pos = e.target.selectionStart;
    renderVideoSearch();
    const next = $('#videoSearch');
    next.focus();
    next.setSelectionRange(pos, pos);
  });
  $('#videoSearchClear')?.addEventListener('click', () => {
    state.videoSearchQuery = '';
    renderVideoSearch();
    $('#videoSearch').focus();
  });

  main.querySelectorAll('[data-openvideo]').forEach((b) =>
    b.addEventListener('click', () => {
      state.sub.videos = 'portrait';
      render();
    })
  );
  main.querySelectorAll('[data-openclip]').forEach((b) =>
    b.addEventListener('click', () => {
      state.sub.videos = 'landscape';
      render();
    })
  );
  main.querySelectorAll('[data-openpost]').forEach((b) =>
    b.addEventListener('click', () => {
      state.sub.videos = 'home';
      render();
    })
  );
  main.querySelectorAll('[data-tag]').forEach((b) =>
    b.addEventListener('click', () => toast(`${b.dataset.tag} — Hashtag-Seite folgt`))
  );
  main.querySelectorAll('[data-place]').forEach((b) => b.addEventListener('click', () => toast('Standort-Seite folgt')));
  main.querySelectorAll('[data-sound]').forEach((b) => b.addEventListener('click', () => toast('Sound-Seite folgt')));
}

/* ------------------------------------------------------- Videos: Profil */
/*
 * Prototyp-Frame "Videos - Profil": Leiste "Profil wechseln", darunter
 * @Nutzername mit Glocke/Plus/Menue, Bild links neben den Zahlen, dann Name,
 * Biografie und Link linksbuendig, Playlists und Highlights, Tab-Leiste und
 * das Beitragsraster.
 */
function ownProfileTop(handle) {
  return `
    <div class="oprof__bar">
      <span class="oprof__handle">${esc(handle)}</span>
      <span class="oprof__acts">
        <button data-oact="bell" aria-label="Mitteilungen">${ICONS.bell}<i class="oprof__dot"></i></button>
        <button data-oact="create" aria-label="Erstellen">${ICONS.plus}</button>
        <button data-oact="menu" aria-label="Menü">${ICONS.settings}</button>
      </span>
    </div>`;
}

const PROFILE_TABS = [
  { id: 'grid', icon: 'grid' },
  { id: 'repost', icon: 'repeat' },
  { id: 'tagged', icon: 'person' },
  { id: 'saved', icon: 'bookmark' },
];

async function renderVideoProfile() {
  const res = await fetch('/api/profile/me');
  const me = await res.json();
  const tab = state.ownProfileTab;

  main.innerHTML = `
    ${switchBar('switchProfile')}
    <div class="scroll">
      ${ownProfileTop(me.handle)}
      <div class="oprof__top">
        <div class="avatar avatar--88 has-status" style="background:${me.color}">${esc(me.initials)}</div>
        <div class="prof__stats">
          <div class="prof__stat"><span>Beiträge</span><strong>${compactNumber(me.posts)}</strong></div>
          <div class="prof__stat"><span>Follower</span><strong>${compactNumber(me.followers)}</strong></div>
          <div class="prof__stat"><span>Gefolgt</span><strong>${compactNumber(me.following)}</strong></div>
        </div>
      </div>
      <div class="prof__about">
        <div class="prof__name">Henrik</div>
        <div class="prof__bio">${esc(me.bio)}</div>
        <a class="prof__link" href="#" id="profLink">${esc(me.link)}</a>
      </div>
      <div class="highlights">
        <button class="highlight"><span class="highlight__ring is-playlist">${ICONS.play}</span><span class="highlight__label">Playlistname</span></button>
        <button class="highlight"><span class="highlight__ring is-playlist">${ICONS.play}</span><span class="highlight__label">Playlistname</span></button>
        ${me.highlights
          .map((h) => `<button class="highlight"><span class="highlight__ring is-highlight">${ICONS.image}</span><span class="highlight__label">${esc(h)}</span></button>`)
          .join('')}
      </div>
      <div class="prof__tabs">
        ${PROFILE_TABS.map(
          (t) => `<button class="prof__tab ${tab === t.id ? 'is-active' : ''}" data-otab="${t.id}">${ICONS[t.icon]}</button>`
        ).join('')}
      </div>
      ${
        tab === 'grid'
          ? `<div class="prof__grid">${me.grid
              .map((g) => `<div class="griditem">${g.kind === 'video' ? ICONS.play : ICONS.image}</div>`)
              .join('')}</div>`
          : `<div class="empty">${ICONS[PROFILE_TABS.find((t) => t.id === tab).icon]}
              <div class="empty__title">Noch nichts hier</div>
              <div class="empty__text">Dieser Bereich füllt sich, sobald du ihn benutzt.</div>
            </div>`
      }
    </div>`;

  $('#switchProfile').addEventListener('click', openKontoWechsel);
  $('#profLink').addEventListener('click', (e) => {
    e.preventDefault();
    toast(me.link);
  });
  main.querySelectorAll('[data-otab]').forEach((b) =>
    b.addEventListener('click', () => {
      state.ownProfileTab = b.dataset.otab;
      renderVideoProfile();
    })
  );
  main.querySelectorAll('[data-oact]').forEach((b) =>
    b.addEventListener('click', () =>
      toast({ bell: 'Mitteilungen', create: 'Erstellen', menu: 'Menü' }[b.dataset.oact] + ' folgt')
    )
  );
}

/* ---------------------------------------------------- Communitys: Chats */
// Prototyp-Frame "Community - Chats": Suchleiste plus Liste der Chats, die
// innerhalb der Communitys entstanden sind.
function renderCommunityChats() {
  const q = state.commSearchQuery.trim().toLowerCase();
  const list = state.communities
    .filter((c) => c.joined)
    .filter((c) => !q || c.name.toLowerCase().includes(q) || c.topic.toLowerCase().includes(q));

  main.innerHTML = `
    <div class="pagehead">
      <div class="searchrow">
        <label class="searchbox">
          ${ICONS.search}
          <input id="commChatSearch" type="search" placeholder="Suche hier nach Kontakten/Gruppen..." value="${esc(state.commSearchQuery)}" autocomplete="off" />
          ${state.commSearchQuery ? `<button class="searchbox__clear" id="commChatSearchClear" aria-label="Suche löschen">${ICONS.close}</button>` : ''}
        </label>
      </div>
    </div>
    <div class="scroll">
      ${
        list.length
          ? `<ul class="rows">${list
              .map(
                (c) => `<li><button class="row" data-commchat="${c.id}">
                  ${communityAvatar(c, 52)}
                  <div class="row__body">
                    <div class="row__top"><span class="row__name">${esc(c.name)}</span></div>
                    <div class="row__bottom"><span class="row__preview">${esc(c.topic)}</span>
                    ${c.unread ? `<span class="badge">${c.unread}</span>` : ''}</div>
                  </div>
                </button></li>`
              )
              .join('')}</ul>`
          : `<div class="empty">${ICONS.chat}
              <div class="empty__title">Kein Chat gefunden</div>
              <div class="empty__text">Für „${esc(state.commSearchQuery)}" gibt es keinen Treffer.</div>
            </div>`
      }
    </div>`;

  const input = $('#commChatSearch');
  input.addEventListener('input', (e) => {
    state.commSearchQuery = e.target.value;
    const pos = e.target.selectionStart;
    renderCommunityChats();
    const next = $('#commChatSearch');
    next.focus();
    next.setSelectionRange(pos, pos);
  });
  $('#commChatSearchClear')?.addEventListener('click', () => {
    state.commSearchQuery = '';
    renderCommunityChats();
    $('#commChatSearch').focus();
  });
  main.querySelectorAll('[data-commchat]').forEach((r) =>
    r.addEventListener('click', () => openChat(r.dataset.commchat))
  );
}

/* --------------------------------------------------- Communitys: Suchen */
// Prototyp-Frame "Community - Suchen": Filter Alle/Communitys/Kontakte, dann
// die Abschnitte Kanäle und Profile mit Befreunden-Schaltfläche.
function renderCommunitySearch() {
  const q = state.communityQuery.trim().toLowerCase();
  const f = state.commSearchFilter;
  const chans = f === 'people' ? [] : state.communities.filter((c) => !q || c.name.toLowerCase().includes(q) || c.topic.toLowerCase().includes(q));
  const people =
    f === 'channels'
      ? []
      : Object.values(state.users).filter((u) => u.id !== 'me' && (!q || u.name.toLowerCase().includes(q) || u.handle.toLowerCase().includes(q)));

  const statusOf = (id) => {
    const c = state.contacts.find((x) => x.id === id);
    if (!c) return 'none';
    return c.status === 'pending' ? 'pending' : 'friend';
  };

  main.innerHTML = `
    <div class="pagehead">
      <div class="searchrow">
        <label class="searchbox">
          ${ICONS.search}
          <input id="commSearch" type="search" placeholder="Suche hier nach Communitys/Kontakten..." value="${esc(state.communityQuery)}" autocomplete="off" />
          ${state.communityQuery ? `<button class="searchbox__clear" id="commSearchClear" aria-label="Suche löschen">${ICONS.close}</button>` : ''}
        </label>
      </div>
      <div class="pills">
        <button class="pill ${f === 'all' ? 'is-active' : ''}" data-csfilter="all">Alle</button>
        <button class="pill ${f === 'channels' ? 'is-active' : ''}" data-csfilter="channels">Communitys</button>
        <button class="pill ${f === 'people' ? 'is-active' : ''}" data-csfilter="people">Kontakte</button>
      </div>
    </div>
    <div class="scroll">
      ${
        chans.length || people.length
          ? `${chans.length ? `<div class="exp__head">Kanäle →</div><ul class="rows">${chans.map(communityRow).join('')}</ul>` : ''}
             ${
               people.length
                 ? `<div class="exp__head">Profile →</div><ul class="rows">${people
                     .map((u) => {
                       const st = statusOf(u.id);
                       const label = st === 'friend' ? 'Befreundet' : st === 'pending' ? 'Angefragt' : '+ Befreunden';
                       return `<li><div class="row">
                          <span data-profile="${u.id}">${avatarForUser(u.id, 44)}</span>
                          <div class="row__body" data-profile="${u.id}">
                            <div class="row__name">${esc(u.name)}</div>
                            <div class="row__bottom"><span class="row__preview">${esc(u.handle)}</span></div>
                          </div>
                          <button class="joinbtn ${st === 'none' ? '' : 'is-joined'}" data-befriend="${u.id}" ${st === 'none' ? '' : 'disabled'}>${label}</button>
                        </div></li>`;
                     })
                     .join('')}</ul>`
                 : ''
             }`
          : `<div class="empty">${ICONS.search}
              <div class="empty__title">Nichts gefunden</div>
              <div class="empty__text">Für „${esc(state.communityQuery)}" gibt es keinen Treffer.</div>
            </div>`
      }
    </div>`;

  const input = $('#commSearch');
  input.addEventListener('input', (e) => {
    state.communityQuery = e.target.value;
    const pos = e.target.selectionStart;
    renderCommunitySearch();
    const next = $('#commSearch');
    next.focus();
    next.setSelectionRange(pos, pos);
  });
  $('#commSearchClear')?.addEventListener('click', () => {
    state.communityQuery = '';
    renderCommunitySearch();
    $('#commSearch').focus();
  });
  main.querySelectorAll('[data-csfilter]').forEach((b) =>
    b.addEventListener('click', () => {
      state.commSearchFilter = b.dataset.csfilter;
      renderCommunitySearch();
    })
  );
  main.querySelectorAll('[data-community]').forEach((r) =>
    r.addEventListener('click', () => openChat(r.dataset.community))
  );
  bindJoinButtons(renderCommunitySearch);
  main.querySelectorAll('[data-befriend]').forEach((b) =>
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const u = state.users[b.dataset.befriend];
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: u.handle }),
      });
      const result = await res.json();
      if (!result.ok) return toast(result.error);
      state.contacts.push(result.contact);
      toast(`Anfrage an ${u.name} gesendet`);
      renderCommunitySearch();
    })
  );
}

/* --------------------------------------------------- Communitys: Profil */
// Prototyp-Frame "Community - Profil": erstellte und beigetretene Communitys.
function renderCommunityProfile() {
  const me = user('me');
  const created = state.communities.filter((c) => c.visibility === 'private' && c.joined);
  const joined = state.communities.filter((c) => c.joined && !created.includes(c));

  main.innerHTML = `
    ${switchBar('switchProfile')}
    <div class="scroll">
      ${ownProfileTop(me.handle)}
      <div class="oprof__top">
        <div class="avatar avatar--88 has-status" style="background:${me.color}">${esc(me.initials)}</div>
        <div class="prof__stats">
          <div class="prof__stat"><span>Erstellte Communitys</span><strong>${created.length}</strong></div>
          <div class="prof__stat"><span>Beigetretene Communitys</span><strong>${joined.length}</strong></div>
        </div>
      </div>
      <div class="prof__about">
        <div class="prof__name">Henrik</div>
        <div class="prof__bio">Baue gerade All Media.</div>
        <a class="prof__link" href="#" id="profLink">all-media.app</a>
      </div>
      ${created.length ? `<div class="exp__head">Erstellt →</div><ul class="rows">${created.map(communityRow).join('')}</ul>` : ''}
      ${joined.length ? `<div class="exp__head">Beigetreten →</div><ul class="rows">${joined.map(communityRow).join('')}</ul>` : ''}
    </div>`;

  $('#switchProfile').addEventListener('click', openKontoWechsel);
  $('#profLink').addEventListener('click', (e) => {
    e.preventDefault();
    toast('all-media.app');
  });
  main.querySelectorAll('[data-oact]').forEach((b) =>
    b.addEventListener('click', () =>
      toast({ bell: 'Mitteilungen', create: 'Erstellen', menu: 'Menü' }[b.dataset.oact] + ' folgt')
    )
  );
  main.querySelectorAll('[data-community]').forEach((r) =>
    r.addEventListener('click', () => openChat(r.dataset.community))
  );
  bindJoinButtons(renderCommunityProfile);
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
      <div class="chathead__body" ${chat.userId ? `data-profile="${chat.userId}"` : ''} style="${chat.userId ? 'cursor:pointer' : ''}">
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
    ${
      chat.requestState === 'pending'
        ? `<div class="anfrage">
            <div class="anfrage__text">
              Deine Anfrage läuft noch. Weitere Nachrichten sind möglich,
              sobald ${esc(chat.name)} sie angenommen hat.
            </div>
            <button class="anfrage__btn" id="anfrageOk">Annahme simulieren</button>
          </div>`
        : ''
    }
    <form class="composer" id="composer">
      <button type="button" class="composer__icon" id="attach" aria-label="Anhang">${ICONS.plus}</button>
      <div class="composer__field">
        <textarea id="msgInput" rows="1" placeholder="${
          chat.requestState === 'pending' ? 'Warten auf Annahme …' : 'Nachricht'
        }" autocomplete="off" ${chat.requestState === 'pending' ? 'disabled' : ''}></textarea>
        <button type="button" class="composer__icon" id="camBtn" aria-label="Kamera">${ICONS.camera}</button>
      </div>
      <button type="submit" class="composer__send" id="sendBtn" aria-label="Senden" disabled>${ICONS.send}</button>
    </form>`;

  paintMessages(chat);

  $('#chatBack').addEventListener('click', closeChat);
  $('#anfrageOk')?.addEventListener('click', async () => {
    const res = await fetch(`/api/chats/${chat.id}/accept`, { method: 'POST' });
    const result = await res.json();
    if (!result.ok) return toast(result.error);

    chat.requestState = 'accepted';
    const inState = state.chats.find((c) => c.id === chat.id);
    if (inState) inState.requestState = 'accepted';
    const kontakt = state.contacts.find((c) => c.id === chat.userId);
    if (kontakt) { kontakt.status = 'friend'; kontakt.about = 'Kontakt'; }

    toast('Anfrage angenommen');
    openChat(chat.id);
  });
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
      ${m.replyToStory ? `<div class="msg__reply">Antwort auf die Story von ${esc(m.replyToStory)}</div>` : ''}
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

  if (!chat.isGroup) simulateReply(chat, text);
}

function simulateReply(chat, eingabe) {
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
    state.messages.push({
      id: 'r' + Date.now(),
      from: chat.userId,
      // Antwort richtet sich nach dem, was geschrieben wurde (antworten.js).
      text: antwortAuf(eingabe || '', chat.name),
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
/*
 * Der Viewer haelt sich an vier Regeln aus Henriks Rueckmeldung:
 *  1. Das Herz bleibt rot, solange die Story geliked ist (Zustand im Server).
 *  2. Sobald das Antwortfeld benutzt wird, laeuft die Zeit nicht weiter.
 *  3. Eine Antwort landet wirklich im Chat mit dieser Person.
 *  4. Tippen links/rechts blaettert zur vorigen/naechsten Story.
 */
let storyTimer;
const STORY_DURATION = 6000;
const STORY_STEP = 60;

function openStory(storyId) {
  const list = state.stories.filter((s) => !s.own);
  const idx = list.findIndex((s) => s.id === storyId);
  if (idx < 0) return;

  const s = list[idx];
  const u = user(s.userId);
  let paused = false;
  let elapsed = 0;

  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="viewer">
      <div class="viewer__bars">
        <div class="viewer__bar"><div class="viewer__fill" id="storyFill" style="width:0"></div></div>
      </div>
      <div class="viewer__head">
        <button class="viewer__close" id="storyClose" aria-label="Zurück">${ICONS.back}</button>
        <div class="avatar avatar--36" style="background:${u.color}" data-profile="${u.id}">${esc(u.initials)}</div>
        <div class="viewer__who" data-profile="${u.id}">
          <div class="viewer__name">${esc(u.name)}</div>
          <div class="viewer__time">${esc(s.time || 'vor 2 Std.')}</div>
        </div>
        <button class="viewer__more" id="storyMore" aria-label="Mehr">${ICONS.settings}</button>
      </div>
      <div class="viewer__stage">
        <button class="viewer__zone viewer__zone--prev" id="storyPrev" aria-label="Vorherige Story"></button>
        <button class="viewer__zone viewer__zone--next" id="storyNext" aria-label="Nächste Story"></button>
        <div class="viewer__media">${ICONS.image}</div>
        ${s.caption ? `<div class="viewer__caption">${esc(s.caption)}</div>` : ''}
      </div>
      <form class="viewer__foot" id="storyForm">
        <input class="viewer__reply" id="storyReply" placeholder="Antworten" autocomplete="off" />
        <button type="button" class="viewer__act ${s.liked ? 'is-liked' : ''}" id="storyLike" aria-label="Gefällt mir">${ICONS.heart}</button>
        <button type="submit" class="viewer__hidden" tabindex="-1" aria-hidden="true"></button>
      </form>
    </div>`;

  const fill = $('#storyFill');
  const setFill = () => {
    if (fill) fill.style.width = Math.min(100, (elapsed / STORY_DURATION) * 100) + '%';
  };

  const stop = () => clearInterval(storyTimer);
  const pause = () => {
    paused = true;
    overlay.querySelector('.viewer').classList.add('is-paused');
  };
  const resume = () => {
    paused = false;
    overlay.querySelector('.viewer')?.classList.remove('is-paused');
  };

  const markSeen = () => {
    s.viewed = true;
    fetch(`/api/stories/${s.id}/seen`, { method: 'POST' });
  };

  const go = (step) => {
    stop();
    markSeen();
    const next = list[idx + step];
    if (next) openStory(next.id);
    else closeOverlay();
  };

  stop();
  storyTimer = setInterval(() => {
    if (paused) return;
    elapsed += STORY_STEP;
    if (!$('#storyFill')) return stop();
    setFill();
    if (elapsed >= STORY_DURATION) go(1);
  }, STORY_STEP);

  $('#storyClose').addEventListener('click', () => {
    stop();
    markSeen();
    closeOverlay();
  });

  $('#storyPrev').addEventListener('click', () => go(-1));
  $('#storyNext').addEventListener('click', () => go(1));

  $('#storyMore').addEventListener('click', () => toast('Weitere Optionen folgen'));

  $('#storyLike').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const res = await fetch(`/api/stories/${s.id}/like`, { method: 'POST' });
    const updated = await res.json();
    s.liked = updated.liked;
    btn.classList.toggle('is-liked', s.liked);
    toast(s.liked ? `Dir gefällt die Story von ${u.name}` : 'Gefällt-mir entfernt');
  });

  // Solange im Antwortfeld etwas steht oder es den Fokus hat, steht die Zeit.
  const reply = $('#storyReply');
  reply.addEventListener('focus', pause);
  reply.addEventListener('blur', () => {
    if (!reply.value.trim()) resume();
  });
  reply.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      reply.value = '';
      reply.blur();
      resume();
    }
  });

  $('#storyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = reply.value.trim();
    if (!text) return toast('Bitte etwas schreiben');

    const res = await fetch(`/api/stories/${s.id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const result = await res.json();
    if (!result.ok) return toast(result.error);

    reply.value = '';
    reply.blur();

    // Chatliste aktuell halten, damit die Antwort dort sofort sichtbar ist.
    const chat = state.chats.find((c) => c.id === result.chatId);
    if (chat) {
      chat.preview = text;
      chat.time = result.message.time;
    } else {
      const res2 = await fetch('/api/bootstrap');
      const data = await res2.json();
      state.chats = data.chats;
    }

    stop();
    markSeen();
    toast(`Antwort an ${u.name} gesendet`);
    openChat(result.chatId);
  });
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
// Profile öffnen: überall dort, wo ein Element data-profile trägt.
document.querySelector('.app').addEventListener('click', (e) => {
  const target = e.target.closest('[data-profile]');
  if (!target) return;
  e.stopPropagation();
  clearInterval(storyTimer);
  document.querySelector('.sheet-backdrop')?.remove();
  openProfile(target.dataset.profile);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.hidden) {
    clearInterval(storyTimer);
    if (state.openChatId) closeChat();
    else closeOverlay();
  }
});

bootstrap();
