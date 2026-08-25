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
  openChatSettingsId: null,
  openCommunityId: null,
  openChannelId: null,
  communitiesFilter: 'joined',
  messages: [],
  currentUserId: localStorage.getItem('am-user-id') || 'me',
  profiles: JSON.parse(localStorage.getItem('am-profiles') || '["me"]'),
  blockedUsers: JSON.parse(localStorage.getItem('am-blocked') || '[]'),
  starredMessages: {},
  mutedChats: {},
  notifications: { sound: true, vibration: true, led: true },
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

  // Die eigene Story liegt nur im Browser - nach dem Laden wieder einsetzen.
  const eigene = eigeneStoryLaden();
  if (eigene) {
    const s = state.stories.find((x) => x.own);
    if (s) {
      s.mediaUri = eigene.mediaUri;
      s.aufgenommen = eigene.aufgenommen;
    }
  }

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

/*
 * Zaehler gegen ueberholende Bildaufbauten: renderVideoProfile holt seine
 * Daten erst vom Server. Wechselt man in der Zwischenzeit den Bildschirm,
 * kam das Profil danach trotzdem noch an und hat den neuen Inhalt wieder
 * ueberschrieben. Jeder Aufbau merkt sich deshalb seine Nummer und schreibt
 * nur noch, wenn er der zuletzt gestartete ist.
 */
let renderLauf = 0;

function render() {
  renderLauf++;
  renderBottomNav();
  renderTopBar();

  // Explorer-Übersichtsseiten (Kategorien aus Video-Suche)
  if (state.explorerView) {
    if (state.explorerView === 'reels') return renderReelsExplorer();
    if (state.explorerView === 'clips') return renderClipsExplorer();
    if (state.explorerView === 'posts') return renderPostsExplorer();
    if (state.explorerView === 'hashtag') return renderHashtagExplorer(state.explorerParam);
    if (state.explorerView === 'place') return renderPlaceExplorer(state.explorerParam);
    state.explorerView = null;
  }

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

/* ------------------------------------------------------- eigene Story */
/*
 * Aufnehmen laeuft ueber ein verstecktes Dateifeld mit "capture" - auf dem
 * Handy oeffnet das direkt die Kamera, am Rechner die Dateiauswahl. Damit
 * braucht es keinen Kamerazugriff ueber getUserMedia und keine Berechtigung
 * im Voraus.
 *
 * Die Aufnahme bleibt im Browser (localStorage), nicht auf dem Server: sie
 * gehoert nur diesem einen Nutzer, und der Server teilt seinen Speicher mit
 * allen. Vorher auf 1200 Pixel verkleinert, sonst sprengt sie den Platz.
 */
const STORY_SPEICHER = 'allmedia.eigeneStory';

function eigeneStoryLaden() {
  try {
    const roh = localStorage.getItem(STORY_SPEICHER);
    return roh ? JSON.parse(roh) : null;
  } catch {
    return null;
  }
}

function eigeneStorySichern(daten) {
  try {
    if (daten) localStorage.setItem(STORY_SPEICHER, JSON.stringify(daten));
    else localStorage.removeItem(STORY_SPEICHER);
  } catch {
    /* Speicher voll oder gesperrt - die Story gilt dann nur fuer diese Sitzung */
  }
}

/** Bild auf hoechstens 1200 Pixel bringen und als Datenadresse zurueckgeben. */
function bildVerkleinern(datei) {
  return new Promise((fertig, fehler) => {
    const leser = new FileReader();
    leser.onerror = () => fehler(new Error('Datei nicht lesbar'));
    leser.onload = () => {
      const bild = new Image();
      bild.onerror = () => fehler(new Error('Kein gueltiges Bild'));
      bild.onload = () => {
        const faktor = Math.min(1, 1200 / Math.max(bild.width, bild.height));
        const flaeche = document.createElement('canvas');
        flaeche.width = Math.round(bild.width * faktor);
        flaeche.height = Math.round(bild.height * faktor);
        flaeche.getContext('2d').drawImage(bild, 0, 0, flaeche.width, flaeche.height);
        fertig(flaeche.toDataURL('image/jpeg', 0.82));
      };
      bild.src = leser.result;
    };
    leser.readAsDataURL(datei);
  });
}

/**
 * Kamera bzw. Dateiauswahl oeffnen. Liefert die gewaehlte Datei oder null,
 * wenn abgebrochen wurde. `capture` sorgt am Handy dafuer, dass direkt die
 * Kamera aufgeht - ohne vorher nach der Kameraberechtigung zu fragen.
 */
function dateiWaehlen(art = 'photo', ausGalerie = false) {
  return new Promise((fertig) => {
    const feld = document.createElement('input');
    feld.type = 'file';
    feld.accept = art === 'photo' ? 'image/*' : 'video/*';
    if (!ausGalerie) feld.capture = 'environment';
    feld.style.display = 'none';
    document.body.appendChild(feld);

    // "cancel" gibt es nicht in jedem Browser - darum zusaetzlich beim
    // naechsten Fokus aufraeumen, sonst haengt das Versprechen fuer immer.
    let erledigt = false;
    const schliessen = (datei) => {
      if (erledigt) return;
      erledigt = true;
      feld.remove();
      fertig(datei || null);
    };

    feld.addEventListener('change', () => schliessen(feld.files && feld.files[0]));
    feld.addEventListener('cancel', () => schliessen(null));
    feld.click();
  });
}

/** Erstes Standbild eines Videos - damit im Raster nicht nur ein Symbol steht. */
function videoStandbild(datei) {
  return new Promise((fertig) => {
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.muted = true;
    el.playsInline = true;
    const adresse = URL.createObjectURL(datei);

    const aufgeben = () => {
      URL.revokeObjectURL(adresse);
      fertig(null);
    };
    el.onerror = aufgeben;
    el.onloadeddata = () => {
      try {
        const faktor = Math.min(1, 800 / Math.max(el.videoWidth || 1, el.videoHeight || 1));
        const flaeche = document.createElement('canvas');
        flaeche.width = Math.max(1, Math.round((el.videoWidth || 320) * faktor));
        flaeche.height = Math.max(1, Math.round((el.videoHeight || 240) * faktor));
        flaeche.getContext('2d').drawImage(el, 0, 0, flaeche.width, flaeche.height);
        URL.revokeObjectURL(adresse);
        fertig(flaeche.toDataURL('image/jpeg', 0.8));
      } catch {
        aufgeben();
      }
    };
    el.src = adresse;
    // Ein Stueck vorspulen: das allererste Bild ist oft noch schwarz.
    el.currentTime = 0.1;
  });
}

/** Dateiauswahl oeffnen und das Ergebnis als eigene Story uebernehmen. */
function storyAufnehmen(art = 'photo') {
  const feld = document.createElement('input');
  feld.type = 'file';
  feld.accept = art === 'photo' ? 'image/*' : 'video/*';
  feld.capture = 'environment';
  feld.style.display = 'none';
  document.body.appendChild(feld);

  feld.addEventListener('change', async () => {
    const datei = feld.files && feld.files[0];
    feld.remove();
    if (!datei) return;

    try {
      // Vom Video wird das erste Standbild genommen - so hat die Story auch
      // dann ein Bild, wenn das Video selbst nicht abgespielt werden kann.
      const bild = art === 'video' ? await videoStandbild(datei) : await bildVerkleinern(datei);
      if (!bild) {
        toast('Aus dieser Aufnahme ließ sich kein Bild gewinnen');
        return;
      }
      const eigene = { mediaUri: bild, aufgenommen: Date.now() };
      eigeneStorySichern(eigene);

      const s = state.stories.find((x) => x.own);
      if (s) {
        s.mediaUri = eigene.mediaUri;
        s.aufgenommen = eigene.aufgenommen;
        s.viewed = false;
      }
      toast('Deine Story ist online');
      render();
    } catch (e) {
      toast('Aufnahme konnte nicht gelesen werden');
    }
  });

  feld.click();
}

function storyRail() {
  return `<div class="storyrail">${state.stories.map(storyItem).join('')}</div>`;
}

function storyItem(s) {
  const u = user(s.userId);
  if (s.own) {
    // Solange nichts aufgenommen ist, laedt das Plus dazu ein. Danach
    // verhaelt sich die eigene Story wie jede andere.
    const gefuellt = !!s.mediaUri;
    return `
      <button class="story" data-story="${s.id}">
        <div class="story__ring ${gefuellt ? '' : 'is-viewed story__add'}">
          <div class="story__inner" style="${
            gefuellt
              ? `background-image:url(${s.mediaUri});background-size:cover;background-position:center`
              : `background:${u.color}`
          }">${gefuellt ? '' : esc(u.initials)}</div>
          ${gefuellt ? '' : `<span class="story__add-badge">${ICONS.plus}</span>`}
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
      if (s.own && !s.mediaUri) return openCamera();
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

/** Follower/Gefolgte Listen */
function openFollowerList(profile, art) {
  const liste = art === 'follower'
    ? (state.users.followers || []).map(id => user(id))
    : (state.users.following || []).map(id => user(id));

  const titel = art === 'follower' ? 'Follower' : 'Gefolgt';
  openSheet(
    titel,
    `<div class="sheet__body">${liste.length ? liste.map(u => `
      <button class="item" data-uid="${u.id}">
        <span class="avatar avatar--40" style="background:${u.color}">${esc(u.initials)}</span>
        <span class="item__body">
          <div class="item__label">${esc(u.name)}</div>
          <div class="item__sub">${esc(u.handle)}</div>
        </span>
        <span class="row__chevron">${ICONS.chevron}</span>
      </button>
    `).join('') : '<div style="text-align:center;padding:30px;color:var(--text-2)">Noch niemand</div>'}</div>`,
    (sheet, close) => {
      sheet.querySelectorAll('[data-uid]').forEach(b =>
        b.addEventListener('click', () => {
          close();
          state.area = 'videos';
          state.sub.videos = 'profile';
          render();
        })
      );
    },
    { schliessen: true, hoch: true }
  );
}

/* ---------------------------------------------------------- new: sheet */
/*
 * opts.schliessen  -> X links neben dem mittigen Titel (Prototyp-Frames
 *                     "VP + Mitteilung" und "VP + erstellen")
 * opts.hoch        -> Blatt auf 74% Hoehe, Inhalt scrollt
 */
function openSheet(title, bodyHtml, onMount, opts = {}) {
  const sheet = document.createElement('div');
  sheet.className = 'sheet-backdrop';
  sheet.innerHTML = `
    <div class="sheet ${opts.hoch ? 'sheet--tall' : ''}" role="dialog" aria-label="${esc(title)}">
      ${
        opts.schliessen
          ? `<div class="sheet__kopf">
               <button class="sheet__x" data-sheet-close aria-label="Schließen">${ICONS.close}</button>
               <div class="sheet__titel-mitte">${esc(title)}</div>
             </div>`
          : `<div class="sheet__handle"></div>
             <div class="sheet__title">${esc(title)}</div>`
      }
      ${bodyHtml}
    </div>`;
  document.querySelector('.app').appendChild(sheet);

  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) sheet.remove();
  });
  sheet.querySelector('[data-sheet-close]')?.addEventListener('click', () => sheet.remove());

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
  const zustand = { schritt: 1, gewaehlt: new Set(), extern: [], name: '', info: '', bild: null };

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
        <div class="group-pic" id="groupPic" ${
          zustand.bild
            ? `style="background-image:url(${zustand.bild});background-size:cover;background-position:center"`
            : ''
        }>${zustand.bild ? '' : ICONS.camera}</div>
        <span class="sheet__label">${zustand.bild ? 'Gruppenbild ändern' : 'Gruppenbild hinzufügen'}</span>
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
      sheet.querySelector('#groupPic').addEventListener('click', () => {
        const feld = document.createElement('input');
        feld.type = 'file';
        feld.accept = 'image/*';
        feld.style.display = 'none';
        document.body.appendChild(feld);
        feld.addEventListener('change', async () => {
          const datei = feld.files && feld.files[0];
          feld.remove();
          if (!datei) return;
          try {
            zustand.bild = await bildVerkleinern(datei);
            toast('Gruppenbild ausgewählt');
            neuZeichnen();
          } catch {
            toast('Bild konnte nicht gelesen werden');
          }
        });
        feld.click();
      });

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

/* ------------------------------------------------------------- Anruf */
/*
 * Die Oberflaeche eines Anrufs.
 *
 * Die Uebertragung selbst fehlt bewusst: dafuer braucht es WebRTC, einen
 * Signalweg und einen TURN-Server. Die Oberflaeche steht damit schon
 * vollstaendig, der Verlauf ist simuliert:
 * klingelt -> verbunden (Dauer laeuft) -> beendet.
 */
let anrufTimer;

function zweistellig(n) {
  return String(n).padStart(2, '0');
}

/** Sekunden als mm:ss, ab einer Stunde als h:mm:ss. */
function dauerText(sekunden) {
  const st = Math.floor(sekunden / 3600);
  const min = Math.floor((sekunden % 3600) / 60);
  const sek = sekunden % 60;
  return st > 0
    ? `${st}:${zweistellig(min)}:${zweistellig(sek)}`
    : `${zweistellig(min)}:${zweistellig(sek)}`;
}

/*
 * Anruf - fuer eine Person oder fuer eine Gruppe. Bei einer Gruppe stehen
 * alle Mitglieder oben, sonst die eine Person. Prototyp-Frames
 * "MC + Sprachanruf" und "CC+ Sprachanruf".
 */
function openCall(ziel, art) {
  // Bei einer Gruppe wird der Chat uebergeben, sonst die Kennung der Person.
  const gruppe = typeof ziel === 'object' ? ziel : null;
  const userId = gruppe ? null : ziel;
  const teilnehmer = gruppe ? (gruppe.members || []).filter((id) => state.users[id]) : [];

  const u = gruppe
    ? { name: gruppe.name, initials: '', color: '#5C6BC0' }
    : user(userId);
  if (!u) return toast('Diese Person gibt es nicht');

  let zustand = 'klingelt';
  let dauer = 0;
  const an = { stumm: false, laut: art === 'video', kamera: art === 'video' };

  overlay.hidden = false;

  const zeichnen = () => {
    const status =
      zustand === 'klingelt'
        ? art === 'video' ? 'Videoanruf …' : 'Klingelt …'
        : zustand === 'verbunden' ? dauerText(dauer) : 'Beendet';

    overlay.innerHTML = `
      <div class="anruf">
        ${
          art === 'video' && zustand === 'verbunden'
            ? `<div class="anruf__video">${ICONS.video}
                <span>Bildübertragung folgt mit dem Backend</span>
              </div>`
            : ''
        }
        <div class="anruf__kopf">
          ${
            gruppe && teilnehmer.length
              ? `<div class="anruf__runde">${teilnehmer
                  .map((id) => `<span class="avatar avatar--52" style="background:${user(id).color}">${esc(user(id).initials)}</span>`)
                  .join('')}</div>`
              : `<div class="anruf__avatar ${zustand === 'klingelt' ? 'is-klingelt' : ''}"
                   style="background:${u.color}">${u.initials ? esc(u.initials) : gruppe ? ICONS.people : ''}</div>`
          }
          <div class="anruf__name">${esc(u.name)}</div>
          ${
            gruppe && teilnehmer.length
              ? `<div class="anruf__teilnehmer">${teilnehmer.map((id) => esc(user(id).name.split(' ')[0])).join(', ')}</div>`
              : ''
          }
          <div class="anruf__status" id="anrufStatus">${esc(status)}</div>
          ${
            zustand === 'verbunden'
              ? `<div class="anruf__krypto">${ICONS.lock}<span>Ende-zu-Ende-verschlüsselt</span></div>`
              : ''
          }
        </div>

        ${
          art === 'video' && an.kamera && zustand === 'verbunden'
            ? `<div class="anruf__eigen">${ICONS.person}</div>`
            : ''
        }

        <div class="anruf__leiste">
          <button class="anruf__knopf ${an.stumm ? 'is-an' : ''}" data-anruf="stumm">
            ${an.stumm ? ICONS.micOff || ICONS.mic : ICONS.mic}<span>Stumm</span>
          </button>
          <button class="anruf__knopf ${an.laut ? 'is-an' : ''}" data-anruf="laut">
            ${ICONS.volume || ICONS.mic}<span>Laut</span>
          </button>
          <button class="anruf__knopf ${an.kamera ? 'is-an' : ''}" data-anruf="kamera">
            ${ICONS.video}<span>Video</span>
          </button>
        </div>

        <div class="anruf__unten">
          ${
            zustand === 'klingelt'
              ? `<button class="anruf__rund is-annehmen" data-anruf="annehmen" aria-label="Annehmen">${ICONS.phone}</button>`
              : ''
          }
          <button class="anruf__rund is-auflegen" data-anruf="auflegen" aria-label="Auflegen">${ICONS.phone}</button>
        </div>
      </div>`;

    binden();
  };

  const beenden = () => {
    clearInterval(anrufTimer);
    zustand = 'beendet';
    toast(dauer > 0 ? `Anruf beendet · ${dauerText(dauer)}` : 'Anruf beendet');
    zeichnen();
    setTimeout(() => {
      overlay.hidden = true;
      overlay.innerHTML = '';
    }, 700);
  };

  const verbinden = () => {
    if (zustand !== 'klingelt') return;
    zustand = 'verbunden';
    zeichnen();
    clearInterval(anrufTimer);
    anrufTimer = setInterval(() => {
      dauer += 1;
      const feld = $('#anrufStatus');
      if (feld) feld.textContent = dauerText(dauer);
    }, 1000);
  };

  const binden = () => {
    overlay.querySelectorAll('[data-anruf]').forEach((b) =>
      b.addEventListener('click', () => {
        const was = b.dataset.anruf;
        if (was === 'auflegen') return beenden();
        if (was === 'annehmen') return verbinden();

        an[was] = !an[was];
        const texte = {
          stumm: an.stumm ? 'Mikrofon stumm' : 'Mikrofon an',
          laut: an.laut ? 'Lautsprecher an' : 'Lautsprecher aus',
          kamera: an.kamera ? 'Kamera an' : 'Kamera aus',
        };
        toast(texte[was]);
        zeichnen();
      })
    );
  };

  zeichnen();
  // In der Demo nimmt die Gegenseite von selbst ab.
  setTimeout(verbinden, 2600);
}

/* ------------------------------------------------------ contact profile */
/** Kontaktinfo aus Sicht des Messengers - an WhatsApp angelehnt. */
/*
 * Kontaktinfo im Messenger - aufgebaut nach dem Prototyp-Frame
 * "MC + Kontakteinstellungen": Bearbeiten oben rechts, Name mit Nummer und
 * Biografie, die beiden anderen Profile der Person, drei Knoepfe
 * (Audioanruf, Videoanruf, Suchen) und darunter die Gruppen aus dem Frame.
 *
 * Vorher gaben fast alle Zeilen hier nur "... folgt" aus.
 */
async function openContactProfile(userId) {
  const u = user(userId);
  if (!u) return toast('Diese Person gibt es nicht');

  const chat = state.chats.find((c) => !c.isGroup && c.userId === userId);
  const profil = await (await fetch(`/api/profile/${userId}`)).json().catch(() => ({}));
  let daten = { medien: [], markiert: [], gesamt: 0 };
  if (chat) daten = await (await fetch(`/api/chats/${chat.id}/medien`)).json();

  const kontakt = state.contacts.find((c) => c.id === userId);
  const gemeinsameGruppen = state.chats.filter((c) => c.isGroup && (c.members || []).includes(userId));

  const zeile = (label, wert, art = '') =>
    `<button class="kp__zeile ${art}" data-kp-item="${esc(label)}">
       <span class="kp__zeileText">${esc(label)}</span>
       ${wert ? `<span class="kp__zeileWert">${esc(wert)}</span>` : ''}
       ${art.includes('is-danger') || art.includes('is-gruen') ? '' : `<span class="row__chevron">${ICONS.chevron}</span>`}
     </button>`;

  overlay.hidden = false;
  overlay.innerHTML = `
    <header class="chathead">
      <button class="chathead__back" id="kpBack" aria-label="Zurück">${ICONS.back}</button>
      <div class="chathead__body"><div class="chathead__name">Kontaktinfo</div></div>
      <div class="chathead__actions"><button class="kp__bearbeiten" id="kpEdit">Bearbeiten</button></div>
    </header>

    <div class="scroll">
      <div class="kp__kopf">
        ${avatarForUser(userId, 104)}
        <div class="kp__name">${esc(u.name)}</div>
        ${u.phone ? `<div class="kp__nummer">${esc(u.phone)}</div>` : ''}
      </div>

      ${profil.bio ? `<div class="kp__bio">${esc(profil.bio)}</div>` : ''}

      <div class="kp__profile">
        <button data-kp="videoprofil">${esc(u.handle)} · Videos</button>
        <button data-kp="communityprofil">${esc(u.handle)} · Communitys</button>
      </div>

      <div class="kp__aktionen">
        <button data-kp="audio">${ICONS.phone}<span>Audioanruf</span></button>
        <button data-kp="video">${ICONS.video}<span>Videoanruf</span></button>
        <button data-kp="search">${ICONS.search}<span>Suchen</span></button>
      </div>

      <div class="kp__liste">
        ${zeile('Medien, Links, Doks', String(daten.medien.length))}
        ${zeile('Speicher verwalten', `${daten.gesamt} Nachrichten`)}
        ${zeile('Mit Stern markiert', String(daten.markiert.length))}
      </div>

      <div class="kp__liste">
        ${zeile('Benachrichtigungen', chat?.muted ? 'Aus' : 'An')}
        ${zeile('Chatdesign', einstellung({ label: 'Chat-Hintergrund', wahl: ['Hell', 'Dunkel', 'Farbverlauf'], standard: 'Hell' }))}
        ${zeile('In Fotos speichern', einstellung({ label: 'In Fotos speichern', wahl: ['An', 'Aus'], standard: 'Aus' }))}
      </div>

      <div class="kp__liste">
        ${zeile('Selbstlöschende Nachrichten', einstellung({ label: 'Selbstlöschende Nachrichten', wahl: ['Aus', 'Nach 24 Stunden', 'Nach 7 Tagen'], standard: 'Aus' }))}
        <div class="kp__zeile">
          <span class="kp__zeileText">Chat sperren</span>
          <button class="switch ${state.chatGesperrt?.[userId] ? 'is-on' : ''}" id="kpSperre" aria-label="Chat sperren"><span class="switch__knob"></span></button>
        </div>
        ${zeile('Erweiterter Chat-Datenschutz', einstellung({ label: 'Erweiterter Chat-Datenschutz', wahl: ['Aus', 'An'], standard: 'Aus' }))}
        ${zeile('Verschlüsselung', 'Ende-zu-Ende')}
      </div>

      <div class="kp__liste">
        ${zeile('Kontaktdetails', u.handle)}
      </div>

      <div class="kp__gruppenkopf">${gemeinsameGruppen.length} gemeinsame ${gemeinsameGruppen.length === 1 ? 'Gruppe' : 'Gruppen'}</div>
      ${
        gemeinsameGruppen.length
          ? `<ul class="rows">${gemeinsameGruppen
              .map(
                (g) => `<li><button class="row" data-kp-gruppe="${g.id}">
                  ${avatarOf(g, 44)}
                  <div class="row__body">
                    <div class="row__name">${esc(g.name)}</div>
                    <div class="row__bottom"><span class="row__preview">${(g.members || []).length + 1} Mitglieder</span></div>
                  </div>
                  <span class="row__chevron">${ICONS.chevron}</span>
                </button></li>`
              )
              .join('')}</ul>`
          : `<div class="sheet__hint">Ihr seid in keiner gemeinsamen Gruppe.</div>`
      }

      <div class="kp__liste">
        ${zeile('Kontakt teilen', '', 'is-gruen')}
        ${zeile(kontakt?.favorit ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen', '', 'is-gruen')}
        ${zeile('Chat exportieren', '', 'is-gruen')}
        ${zeile('Chat leeren', '', 'is-danger')}
      </div>

      <div class="kp__liste">
        ${zeile(`„${u.name}" blockieren`, '', 'is-danger')}
        ${zeile(`„${u.name}" melden`, '', 'is-danger')}
      </div>
    </div>`;

  const schliessen = () => {
    overlay.hidden = true;
    overlay.innerHTML = '';
  };

  $('#kpBack').addEventListener('click', schliessen);

  $('#kpEdit').addEventListener('click', () =>
    openFormular(
      'Kontakt bearbeiten',
      [
        { key: 'name', label: 'Angezeigter Name', wert: u.name, pflicht: true },
        { key: 'notiz', label: 'Notiz (nur für dich)' },
      ],
      ({ name }) => {
        // Der angezeigte Name gilt nur hier - er aendert nichts am Profil
        // der anderen Person.
        state.users[userId] = { ...u, name };
        state.chats = state.chats.map((c) => (c.userId === userId ? { ...c, name } : c));
        toast('Kontakt gespeichert');
        openContactProfile(userId);
        return null;
      },
      'Speichern'
    )
  );

  $('#kpSperre')?.addEventListener('click', (e) => {
    state.chatGesperrt = { ...(state.chatGesperrt || {}) };
    state.chatGesperrt[userId] = !state.chatGesperrt[userId];
    e.currentTarget.classList.toggle('is-on');
    toast(state.chatGesperrt[userId] ? 'Chat gesperrt' : 'Chatsperre aufgehoben');
  });

  overlay.querySelectorAll('[data-kp]').forEach((b) =>
    b.addEventListener('click', () => {
      const was = b.dataset.kp;
      if (was === 'audio' || was === 'video') return openCall(userId, was);
      if (was === 'search') return openChatSuche(chat);
      schliessen();
      openProfile(userId, 'oeffentlich');
    })
  );

  overlay.querySelectorAll('[data-kp-gruppe]').forEach((b) =>
    b.addEventListener('click', () => openChat(b.dataset.kpGruppe))
  );

  overlay.querySelectorAll('[data-kp-item]').forEach((b) =>
    b.addEventListener('click', () => kontaktZeile(b.dataset.kpItem, userId, chat, daten))
  );
}

/** Was hinter den Zeilen der Kontaktinfo steckt. */
async function kontaktZeile(label, userId, chat, daten) {
  const u = user(userId);

  if (label === 'Medien, Links, Doks') return openChatMedien(chat, daten.medien, 'Medien, Links, Doks');
  if (label === 'Mit Stern markiert') return openChatMedien(chat, daten.markiert, 'Mit Stern markiert');

  if (label === 'Speicher verwalten') {
    return openEinstellung({
      label: 'Speicher in diesem Chat',
      liste: 'chatspeicher',
      _zeilen: [
        { text: 'Nachrichten', neben: String(daten.gesamt) },
        { text: 'Medien', neben: String(daten.medien.length) },
        { text: 'Markiert', neben: String(daten.markiert.length) },
      ],
    });
  }

  if (label === 'Benachrichtigungen') {
    if (!chat) return toast('Noch kein Chat mit dieser Person');
    chat.muted = !chat.muted;
    toast(chat.muted ? 'Benachrichtigungen aus' : 'Benachrichtigungen an');
    return openContactProfile(userId);
  }

  if (label === 'Chatdesign') {
    return openEinstellung({ label: 'Chat-Hintergrund', wahl: ['Hell', 'Dunkel', 'Farbverlauf'], standard: 'Hell' }, () => openContactProfile(userId));
  }
  if (label === 'In Fotos speichern') {
    return openEinstellung({ label: 'In Fotos speichern', wahl: ['An', 'Aus'], standard: 'Aus' }, () => openContactProfile(userId));
  }
  if (label === 'Selbstlöschende Nachrichten') {
    return openEinstellung(
      {
        label: 'Selbstlöschende Nachrichten',
        wahl: ['Aus', 'Nach 24 Stunden', 'Nach 7 Tagen'],
        standard: 'Aus',
      },
      () => openContactProfile(userId)
    );
  }
  if (label === 'Erweiterter Chat-Datenschutz') {
    return openEinstellung({ label: 'Erweiterter Chat-Datenschutz', wahl: ['Aus', 'An'], standard: 'Aus' }, () => openContactProfile(userId));
  }
  if (label === 'Verschlüsselung') {
    return openEinstellung({
      label: 'Verschlüsselung',
      info: 'Nachrichten in diesem Chat sind Ende-zu-Ende verschlüsselt. Niemand außer euch beiden kann sie lesen — auch All Media nicht.',
    });
  }
  if (label === 'Kontaktdetails') {
    return openEinstellung({
      label: 'Kontaktdetails',
      liste: 'kontaktdetails',
      _zeilen: [
        { text: 'Benutzername', neben: u.handle },
        { text: 'Telefonnummer', neben: u.phone || 'nicht hinterlegt' },
        { text: 'In deinen Kontakten', neben: state.contacts.some((c) => c.id === userId) ? 'ja' : 'nein' },
      ],
    });
  }

  if (label === 'Kontakt teilen') return openProfilSenden({ ...u, id: userId });

  if (label.includes('Favoriten')) {
    const res = await fetch(`/api/kontakte/${userId}/favorit`, { method: 'POST' });
    const antwort = await res.json();
    if (!antwort.ok) return toast(antwort.error);
    state.contacts = antwort.contacts;
    toast(antwort.favorit ? `${u.name} ist jetzt ein Favorit` : 'Aus den Favoriten entfernt');
    return openContactProfile(userId);
  }

  if (label === 'Chat exportieren') {
    if (!chat) return toast('Noch kein Chat mit dieser Person');
    const verlauf = await (await fetch(`/api/messages/${chat.id}`)).json();
    const text = verlauf
      .map((m) => `[${m.time}] ${m.from === 'me' ? 'Du' : user(m.from).name}: ${m.text || ''}`)
      .join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
    a.download = `chat-${u.name.toLowerCase().replace(/\s+/g, '-')}.txt`;
    a.click();
    return toast(`${verlauf.length} Nachrichten gesichert`);
  }

  if (label === 'Chat leeren') {
    if (!chat) return toast('Noch kein Chat mit dieser Person');
    await fetch(`/api/chats/${chat.id}/leeren`, { method: 'POST' });
    const frisch = await (await fetch('/api/bootstrap')).json();
    state.chats = frisch.chats;
    toast('Chat geleert');
    return openContactProfile(userId);
  }

  if (label.includes('blockieren')) {
    const res = await fetch(`/api/profile/${userId}/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const antwort = await res.json();
    if (!antwort.ok) return toast(antwort.error);
    state.contacts = antwort.contacts;
    state.chats = antwort.chats;
    toast(antwort.blocked ? `${u.name} blockiert` : 'Blockierung aufgehoben');
    render();
    return openContactProfile(userId);
  }

  // Melden
  openSheet(
    'Kontakt melden',
    `<div class="sheet__body">${MELDE_GRUENDE.map(
      (g) => `<button class="item" data-grund="${esc(g)}">
        <span class="item__label">${esc(g)}</span>
        <span class="row__chevron">${ICONS.chevron}</span>
      </button>`
    ).join('')}</div>`,
    (blatt, zu) => {
      blatt.querySelectorAll('[data-grund]').forEach((g) =>
        g.addEventListener('click', async () => {
          zu();
          await fetch(`/api/profile/${userId}/melden`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grund: g.dataset.grund }),
          });
          toast('Danke, wir sehen uns das an');
        })
      );
    },
    { schliessen: true }
  );
}

/** Medien oder markierte Nachrichten eines Chats. */
function openChatMedien(chat, liste, titel) {
  if (!chat) return toast('Noch kein Chat mit dieser Person');

  const beschreibung = (m) =>
    m.geteilt
      ? `${m.geteilt.autor}: ${m.geteilt.titel}`
      : m.standort
      ? m.standort.name
      : m.kontakt
      ? m.kontakt.name
      : m.text || 'Foto';

  openSheet(
    titel,
    `<div class="sheet__body">
       ${
         liste.length
           ? liste
               .map(
                 (m) => `<div class="item">
                   <span class="item__icon">${
                     m.media === 'audio' ? ICONS.mic : m.standort ? ICONS.mapPin : m.kontakt ? ICONS.person : ICONS.image
                   }</span>
                   <span class="item__label">${esc(beschreibung(m))}</span>
                   <span class="item__value">${esc(m.time)}</span>
                 </div>`
               )
               .join('')
           : `<div class="sheet__hint">${
               titel === 'Mit Stern markiert'
                 ? 'Noch nichts markiert. Halte eine Nachricht im Chat gedrückt, um sie zu markieren.'
                 : 'In diesem Chat liegen noch keine Medien.'
             }</div>`
       }
     </div>`,
    null,
    { schliessen: true, hoch: liste.length > 4 }
  );
}

/** Nachrichten dieses Chats durchsuchen. */
async function openChatSuche(chat) {
  if (!chat) return toast('Noch kein Chat mit dieser Person');
  const verlauf = await (await fetch(`/api/messages/${chat.id}`)).json();

  openSheet(
    'Im Chat suchen',
    `<div class="sheet__field">
       <input id="chatSucheFeld" type="search" placeholder="Wonach suchst du?" autocomplete="off">
     </div>
     <div class="sheet__body" id="chatSucheListe">
       <div class="sheet__hint">${verlauf.length} Nachrichten in diesem Chat.</div>
     </div>`,
    (sheet, close) => {
      const feld = sheet.querySelector('#chatSucheFeld');
      const liste = sheet.querySelector('#chatSucheListe');
      setTimeout(() => feld.focus(), 80);

      feld.addEventListener('input', () => {
        const q = feld.value.trim().toLowerCase();
        if (!q) {
          liste.innerHTML = `<div class="sheet__hint">${verlauf.length} Nachrichten in diesem Chat.</div>`;
          return;
        }
        const treffer = verlauf.filter((m) => (m.text || '').toLowerCase().includes(q));
        liste.innerHTML = treffer.length
          ? treffer
              .map(
                (m) => `<div class="item">
                  <span class="item__label">${esc(m.text)}</span>
                  <span class="item__value">${esc(m.time)}</span>
                </div>`
              )
              .join('')
          : `<div class="sheet__hint">Nichts gefunden.</div>`;
      });

      void close;
    },
    { schliessen: true, hoch: true }
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
  // Aus dem Messenger heraus gehoert die Kontaktinfo dazu, sonst das
  // oeffentliche Profil. Frueher stand hier state.view - die Variable gibt
  // es seit dem Umbau auf Bereiche nicht mehr, damit war die Weiche tot und
  // es kam immer das Beitragsprofil.
  if (variante === undefined) variante = state.area === 'messenger' ? 'kontakt' : 'oeffentlich';
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

        ${
          profile.blocked
            ? `<div class="prof__hinweis">${ICONS.block} ${esc(profile.name)} ist blockiert. Ihr könnt euch keine Nachrichten schreiben.</div>`
            : profile.muted
            ? `<div class="prof__hinweis">${ICONS.mute} ${esc(profile.name)} ist stummgeschaltet.</div>`
            : ''
        }

        <div class="prof__buttons">
          <button class="prof__btn ${profile.following_me ? 'is-following' : 'is-primary'}" id="profFollow">
            ${profile.following_me ? 'Gefolgt' : 'Folgen'}
          </button>
          <button class="prof__btn" id="profMessage" ${profile.blocked ? 'disabled' : ''}>Nachricht</button>
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
    $('#profMore').addEventListener('click', () => openProfilOptionen(profile, (neu) => { profile = neu; paint(); }));
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

  // Story-Ringe anklickbar
  main.querySelectorAll('[data-openStory]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const userId = btn.dataset.openStory;
      const story = state.stories.find((s) => s.userId === userId);
      if (story) openStory(userId, 0);
      else toast('Keine Story vorhanden');
    })
  );

  main.querySelectorAll('[data-paction]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const { paction, pid } = btn.dataset;

      if (paction === 'comment') {
        return openComments(pid, (count) => {
          const idx = state.posts.findIndex((x) => x.id === pid);
          state.posts[idx] = { ...state.posts[idx], comments: count };
        });
      }
      if (paction === 'share') return openTeilen('post', pid);

      const res = await fetch(`/api/posts/${pid}/${paction}`, { method: 'POST' });
      const updated = await res.json();
      const idx = state.posts.findIndex((p) => p.id === updated.id);
      state.posts[idx] = updated;

      if (paction === 'repost') toast(updated.reposted ? 'Repostet' : 'Repost zurückgenommen');
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
    <article class="post" id="post-${p.id}">
      <header class="post__head">
        <button class="story__ring story-ring-btn" style="width:40px;height:40px;padding:2px" data-openStory="${p.userId}">
          <div class="story__inner" style="background:${u.color};font-size:13px">${esc(u.initials)}</div>
        </button>
        <button class="post__who" data-profile="${p.userId}">
          <div class="post__name">${esc(u.name)}</div>
          <div class="post__sub">${esc(p.location)} · ${esc(p.music)}</div>
        </button>
        <button class="post__follow ${p.following ? 'is-on' : ''}" data-paction="follow" data-pid="${p.id}">
          ${p.following ? 'Gefolgt' : 'Folgen'}
        </button>
        <button class="post__bell ${p.notify ? 'is-on' : ''}" data-paction="notify" data-pid="${p.id}" aria-label="Benachrichtigungen" style="color: ${p.notify ? '#0A66FF' : '#9AA1AC'}; opacity: ${p.notify ? 1 : 0.5}; text-decoration: ${p.notify ? 'none' : 'line-through'}">
          ${ICONS.bell}
        </button>
      </header>

      <div class="post__media">${medienFlaeche(p.id, ICONS.image)}</div>

      <div class="post__actions">
        <button class="postbtn ${p.liked ? 'is-liked' : ''}" data-paction="like" data-pid="${p.id}" aria-label="Gefällt mir">${ICONS.heart}</button>
        <button class="postbtn" data-paction="comment" data-pid="${p.id}" aria-label="Kommentieren">${ICONS.chat}</button>
        <button class="postbtn" data-paction="share" data-pid="${p.id}" aria-label="Senden">${ICONS.send}</button>
        <button class="postbtn ${p.reposted ? 'is-reposted' : ''}" data-paction="repost" data-pid="${p.id}" aria-label="Repost">
          ${ICONS.repeat}${p.reposts ? `<span class="postbtn__zahl">${p.reposts}</span>` : ''}
        </button>
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

      if (vaction === 'share') return openTeilen('video', vid);


      const res = await fetch(`/api/videos/${vid}/${vaction}`, { method: 'POST' });
      const updated = await res.json();
      const idx = state.videos.findIndex((v) => v.id === updated.id);
      state.videos[idx] = updated;

      if (vaction === 'repost') toast(updated.reposted ? 'Repostet' : 'Repost zurückgenommen');
      if (vaction === 'save') toast(updated.saved ? 'Gespeichert' : 'Nicht mehr gespeichert');

      const scrollTop = $('#feed').scrollTop;
      renderVideoFeed();
      $('#feed').scrollTop = scrollTop;
    })
  );

  main.querySelectorAll('[data-vfollow]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const id = btn.dataset.vfollow;
      const res = await fetch(`/api/autoren/${id}/follow`, { method: 'POST' });
      const r = await res.json();
      if (!r.ok) return toast(r.error);

      // Merken, damit der Zustand beim Blaettern erhalten bleibt.
      state.gefolgt = state.gefolgt || {};
      state.gefolgt[id] = r.following;

      btn.textContent = r.following ? 'Gefolgt' : 'Folgen';
      btn.classList.toggle('is-gefolgt', r.following);
      toast(r.following ? `Du folgst ${user(id).name}` : `${user(id).name} nicht mehr gefolgt`);
    })
  );
}

function videoSlide(v) {
  const u = user(v.userId);
  return `
    <section class="slide" id="slide-${v.id}">
      <div class="slide__stage">${medienFlaeche(v.id, ICONS.play)}</div>

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
        <button class="railbtn ${v.reposted ? 'is-reposted' : ''}" data-vaction="repost" data-vid="${v.id}" aria-label="Repost">
          ${ICONS.repeat}
          <span>${v.reposted ? 'Repostet' : 'Repost'}</span>
        </button>
        <button class="railbtn ${v.saved ? 'is-saved' : ''}" data-vaction="save" data-vid="${v.id}" aria-label="Speichern">
          ${ICONS.bookmark}
          <span>${v.saved ? 'Gespeichert' : 'Speichern'}</span>
        </button>
      </div>

      <div class="slide__meta">
        <div class="slide__author">
          <button class="slide__who" data-profile="${v.userId}">
            <div class="avatar avatar--36" style="background:${u.color}">${esc(u.initials)}</div>
            <span class="slide__name">${esc(u.name)}</span>
          </button>
          <button class="slide__follow ${
            state.gefolgt && state.gefolgt[u.id] ? 'is-gefolgt' : ''
          }" data-vfollow="${u.id}">${state.gefolgt && state.gefolgt[u.id] ? 'Gefolgt' : 'Folgen'}</button>
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

function renderCommunityChannels(communityId) {
  const community = state.communities.find((c) => c.id === communityId);
  if (!community) return renderCommunities();

  const channels = [
    { id: 'ch+', name: 'CH+ Kanal', unread: 3 },
    { id: 'allgemein', name: 'Allgemein', unread: 0 },
    { id: 'ankuendigung', name: 'Ankündigungen', unread: 1 },
  ];

  main.innerHTML = `
    <div class="pagehead">
      <button class="back-btn" id="backBtn">${ICONS.back}</button>
      <h2>${esc(community.name)}</h2>
    </div>
    <div class="scroll">
      ${channels.map((ch) => `
        <button class="row" data-channel="${ch.id}">
          <span class="avatar avatar--44" style="background:#0A66FF">${ICONS.hash}</span>
          <div class="row__body">
            <div class="row__name">${esc(ch.name)}</div>
            <div class="row__bottom"><span class="row__preview">${ch.id === 'ch+' ? 'Themenkanal' : 'Diskussionen'}</span></div>
          </div>
          ${ch.unread ? `<span class="badge">${ch.unread}</span>` : ''}
        </button>`).join('')}
    </div>`;

  $('#backBtn')?.addEventListener('click', renderCommunities);
  main.querySelectorAll('[data-channel]').forEach((b) =>
    b.addEventListener('click', () => renderCommunityChat(communityId, b.dataset.channel))
  );
}

function renderCommunityChat(communityId, channelId) {
  const community = state.communities.find((c) => c.id === communityId);
  main.innerHTML = `
    <div class="pagehead">
      <button class="back-btn" id="backBtn">${ICONS.back}</button>
      <div class="chathead__body">
        <div class="chathead__name">${esc(community?.name || 'Community')}</div>
        <div class="chathead__status">#${esc(channelId)}</div>
      </div>
    </div>
    <div class="scroll">
      <div class="messages">
        <div class="message is-other">
          <div class="message__avatar" style="background:#0A66FF">👥</div>
          <div class="message__bubble">Willkommen im #${esc(channelId)} Kanal!</div>
        </div>
      </div>
    </div>
    <div class="messageinput">
      <input type="text" placeholder="Nachricht schreiben..." id="communityMsgInput">
      <button>${ICONS.send}</button>
    </div>`;

  $('#backBtn')?.addEventListener('click', () => renderCommunityChannels(communityId));
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
      state.openCommunityId = community.id;
      state.openChannelId = null;
      renderCommunities();
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
/*
 * Die Einstellungen. Jeder Punkt hat eine Art, damit keiner davon nur ein
 * Hinweis bleibt:
 *
 *   toggle   Schalter
 *   wahl     eine aus mehreren Möglichkeiten, die gewählte steht rechts
 *   eingabe  Formular mit Feldern
 *   liste    was gerade eingetragen ist (Geräte, blockierte Profile, ...)
 *   info     Erklärtext
 *   aktion   tut etwas Einmaliges
 *
 * Die vier Abschnitte aus dem Prototyp-Frame "Einstellungen" stehen zuerst,
 * "Videos" und "Communitys" stammen aus "VP + Einstellung" und
 * "CP + Einstellung".
 */
const SETTINGS = [
  {
    id: 'allgemein',
    title: 'Allgemein',
    items: [
      {
        label: 'Erziehungsberechtigte/r',
        icon: 'shield',
        eingabe: [
          { key: 'name', label: 'Name', platzhalter: 'Vor- und Nachname', pflicht: true },
          { key: 'mail', label: 'E-Mail-Adresse', platzhalter: 'name@beispiel.de', pflicht: true },
        ],
        fertig: 'Einladung verschickt — die Verknüpfung gilt, sobald sie bestätigt wurde',
      },
      {
        label: 'Spendencode',
        icon: 'bookmark',
        eingabe: [{ key: 'code', label: 'Dein Spendencode', platzhalter: 'z. B. HENRIK2026', pflicht: true }],
        fertig: 'Spendencode gespeichert',
      },
      {
        label: 'Sicherheits-/Entsperrcode',
        icon: 'lock',
        eingabe: [
          { key: 'code', label: 'Neuer Code (4 bis 8 Ziffern)', typ: 'zahl', pflicht: true },
          { key: 'wdh', label: 'Code wiederholen', typ: 'zahl', pflicht: true },
        ],
        pruefen: (w) =>
          !/^\d{4,8}$/.test(w.code)
            ? 'Der Code muss aus 4 bis 8 Ziffern bestehen'
            : w.code !== w.wdh
            ? 'Die beiden Eingaben stimmen nicht überein'
            : null,
        fertig: 'Code gesetzt',
      },
      { label: 'Geräteverknüpfung', icon: 'portrait', liste: 'geraete' },
      { label: 'Dunkles Design', icon: 'moon', toggle: 'theme' },
    ],
  },
  {
    id: 'konto',
    title: 'Konto',
    items: [
      {
        label: 'Profil bearbeiten',
        icon: 'person',
        eingabe: [
          { key: 'name', label: 'Name', pflicht: true },
          { key: 'bio', label: 'Biografie', typ: 'mehrzeilig' },
          { key: 'link', label: 'Link' },
        ],
        fertig: 'Profil gespeichert',
      },
      {
        label: 'Telefonnummer ändern',
        icon: 'phone',
        eingabe: [{ key: 'nummer', label: 'Neue Telefonnummer', platzhalter: '+49 …', pflicht: true }],
        fertig: 'Wir haben dir einen Bestätigungscode geschickt',
      },
      {
        label: 'Passwort ändern',
        icon: 'lock',
        eingabe: [
          { key: 'alt', label: 'Bisheriges Passwort', pflicht: true },
          { key: 'neu', label: 'Neues Passwort', pflicht: true },
          { key: 'wdh', label: 'Neues Passwort wiederholen', pflicht: true },
        ],
        pruefen: (w) =>
          w.neu.length < 8
            ? 'Das neue Passwort braucht mindestens acht Zeichen'
            : w.neu !== w.wdh
            ? 'Die beiden Eingaben stimmen nicht überein'
            : null,
        fertig: 'Passwort geändert',
      },
      { label: 'Zwei-Faktor-Anmeldung', icon: 'shield', wahl: ['Aus', 'Per SMS', 'Über eine App'], standard: 'Aus' },
      { label: 'Konto löschen', icon: 'block', gefahr: true, bestaetigen: 'Konto endgültig löschen?' },
    ],
  },
  {
    id: 'datenschutz',
    title: 'Datenschutz',
    items: [
      { label: 'Zuletzt online', icon: 'clock', wahl: ['Alle', 'Meine Kontakte', 'Niemand'], standard: 'Meine Kontakte' },
      { label: 'Profilbild sichtbar für', icon: 'image', wahl: ['Alle', 'Meine Kontakte', 'Niemand'], standard: 'Alle' },
      { label: 'Info sichtbar für', icon: 'info', wahl: ['Alle', 'Meine Kontakte', 'Niemand'], standard: 'Meine Kontakte' },
      { label: 'Blockierte Kontakte', icon: 'block', liste: 'blockiert' },
      { label: 'Gruppen: wer darf hinzufügen', icon: 'people', wahl: ['Alle', 'Meine Kontakte', 'Niemand'], standard: 'Meine Kontakte' },
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
      { label: 'Gruppen-Mitteilungen', icon: 'people', wahl: ['Alle Nachrichten', 'Nur Erwähnungen', 'Aus'], standard: 'Alle Nachrichten' },
      { label: 'Ruhezeiten', icon: 'moon', wahl: ['Aus', '22 – 7 Uhr', '23 – 8 Uhr', '0 – 9 Uhr'], standard: 'Aus' },
    ],
  },
  {
    id: 'messenger',
    title: 'Chats',
    items: [
      { label: 'Lesebestätigung', icon: 'checkDouble', toggle: 'lesebestaetigung' },
      { label: 'Standort-Sichtbarkeit', icon: 'mapPin', wahl: ['Alle Kontakte', 'Ausgewählte Kontakte', 'Niemand'], standard: 'Alle Kontakte' },
      { label: 'Story-Sichtbarkeit', icon: 'eye', wahl: ['Alle', 'Meine Kontakte', 'Enge Freunde'], standard: 'Meine Kontakte' },
      { label: 'Mit Enter senden', icon: 'send', toggle: 'entersenden' },
      { label: 'Chat-Hintergrund', icon: 'image', wahl: ['Hell', 'Dunkel', 'Farbverlauf'], standard: 'Hell' },
      { label: 'Schriftgröße', icon: 'info', wahl: ['Klein', 'Mittel', 'Groß'], standard: 'Mittel' },
      { label: 'Chat-Verlauf sichern', icon: 'bookmark', aktion: 'sicherung' },
      { label: 'Archivierte Chats', icon: 'bookmark', liste: 'archiv' },
    ],
  },
  {
    id: 'speicher',
    title: 'Speicher',
    items: [
      { label: 'Automatischer Download', icon: 'image', wahl: ['Nie', 'Nur im WLAN', 'Immer'], standard: 'Nur im WLAN' },
      { label: 'Speicher verwalten', icon: 'compass', liste: 'speicher' },
      { label: 'Datensparmodus', icon: 'portrait', toggle: 'datensparen' },
      { label: 'Medienqualität', icon: 'image', wahl: ['Standard', 'Hoch'], standard: 'Standard' },
    ],
  },
  {
    id: 'hilfe',
    title: 'Hilfe',
    items: [
      {
        label: 'Hilfebereich',
        icon: 'info',
        info: 'Fragen und Antworten zu All Media. Bei allem, was hier nicht steht: schreib uns über „Problem melden“ — wir antworten meist innerhalb eines Werktags.',
      },
      {
        label: 'Problem melden',
        icon: 'shield',
        eingabe: [
          { key: 'was', label: 'Was ist passiert?', typ: 'mehrzeilig', pflicht: true },
          { key: 'kontakt', label: 'Antwort an (freiwillig)', platzhalter: 'E-Mail oder Telefonnummer' },
        ],
        fertig: 'Danke, die Meldung ist bei uns angekommen',
      },
      {
        label: 'Nutzungsbedingungen',
        icon: 'bookmark',
        info: 'All Media ist für Menschen ab 13 Jahren. Inhalte, die andere herabwürdigen oder gegen geltendes Recht verstoßen, werden entfernt. Wer sein Konto löscht, verliert seine Beiträge unwiderruflich.',
      },
      {
        label: 'Datenschutzerklärung',
        icon: 'lock',
        info: 'Beiträge, Nachrichten und Profildaten liegen auf unseren Servern. Standortdaten nur, solange die Friend-Map eingeschaltet ist. Aufnahmen aus Kamera und Galerie bleiben auf deinem Gerät, bis du sie veröffentlichst.',
      },
      { label: 'Freunde einladen', icon: 'people', aktion: 'einladen' },
    ],
  },
  {
    id: 'videos',
    title: 'Videos',
    items: [
      { label: 'Privates Profil', icon: 'lock', toggle: 'videoPrivate' },
      {
        label: 'Spendencode',
        icon: 'bookmark',
        eingabe: [{ key: 'code', label: 'Dein Spendencode', platzhalter: 'z. B. HENRIK2026', pflicht: true }],
        fertig: 'Spendencode gespeichert',
      },
      { label: 'Insights', icon: 'compass', liste: 'insights' },
      { label: 'Mit Glocke markierte Profile', icon: 'bell', liste: 'glocke' },
      { label: 'Repost-Sichtbarkeit', icon: 'repeat', wahl: ['Alle', 'Meine Follower', 'Niemand'], standard: 'Alle' },
      { label: 'Likes-Sichtbarkeit', icon: 'heart', wahl: ['Alle', 'Nur ich'], standard: 'Alle' },
      { label: 'Downloadeinstellungen', icon: 'image', wahl: ['Erlaubt', 'Nur Follower', 'Aus'], standard: 'Erlaubt' },
      { label: 'Story-Sichtbarkeit', icon: 'eye', wahl: ['Alle', 'Meine Kontakte', 'Enge Freunde'], standard: 'Meine Kontakte' },
      { label: 'Nutzerstatus', icon: 'person', wahl: ['Aktiv', 'Beschäftigt', 'Unsichtbar'], standard: 'Aktiv' },
      { label: 'Profilbanner', icon: 'landscape', wahl: ['Ohne', 'Farbverlauf', 'Eigenes Bild'], standard: 'Ohne' },
    ],
  },
  {
    id: 'communitys',
    title: 'Communitys',
    items: [
      {
        label: 'Spendencode',
        icon: 'bookmark',
        eingabe: [{ key: 'code', label: 'Dein Spendencode', platzhalter: 'z. B. HENRIK2026', pflicht: true }],
        fertig: 'Spendencode gespeichert',
      },
      { label: 'Nutzerstatus', icon: 'person', wahl: ['Aktiv', 'Beschäftigt', 'Unsichtbar'], standard: 'Aktiv' },
      { label: 'Privates Profil', icon: 'lock', toggle: 'commPrivate' },
      { label: 'Nachrichtenerlaubnis', icon: 'chat', wahl: ['Alle', 'Mitglieder meiner Communitys', 'Niemand'], standard: 'Mitglieder meiner Communitys' },
      { label: 'Push-to-Talk Nachricht', icon: 'mic', wahl: ['An', 'Aus'], standard: 'An' },
      { label: 'Gestummte Communitys', icon: 'mute', liste: 'stummeKanaele' },
      { label: 'Gestummte Profile', icon: 'block', liste: 'stummeProfile' },
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

/* ---------------------------------------------- Ein Einstellungspunkt */
/*
 * Bisher gab jeder Punkt hier "folgt mit dem Backend" aus. Jetzt fuehrt
 * jeder zu etwas: einer Auswahl, einem Formular, einer Liste, einem
 * Erklaertext oder einer einmaligen Handlung.
 *
 * Was gewaehlt wurde, bleibt im Browser gespeichert - der Server teilt
 * seinen Speicher mit allen Besuchern, dort waeren es nicht "deine"
 * Einstellungen.
 */
const EINSTELLUNGEN_SPEICHER = 'am-einstellungen';

function einstellungenLaden() {
  try {
    return JSON.parse(localStorage.getItem(EINSTELLUNGEN_SPEICHER) || '{}');
  } catch {
    return {};
  }
}

function einstellung(punkt) {
  const gespeichert = einstellungenLaden()[punkt.label];
  return gespeichert && (!punkt.wahl || punkt.wahl.includes(gespeichert)) ? gespeichert : punkt.standard || '';
}

function einstellungSetzen(punkt, wert) {
  try {
    const alle = einstellungenLaden();
    alle[punkt.label] = wert;
    localStorage.setItem(EINSTELLUNGEN_SPEICHER, JSON.stringify(alle));
  } catch {
    /* Speicher gesperrt - dann gilt die Wahl nur fuer diese Sitzung */
  }
}

/** Inhalt der Listen-Punkte. Alles kommt aus dem echten Zustand. */
function einstellungsListe(art) {
  if (art === 'geraete') {
    return {
      leer: 'Es ist kein weiteres Gerät verknüpft.',
      zeilen: [
        { text: 'Dieses Gerät', neben: 'gerade aktiv' },
        { text: 'All Media Web', neben: 'zuletzt heute' },
      ],
      knopf: 'Gerät verknüpfen',
      knopfText: 'Zum Verknüpfen den QR-Code auf dem anderen Gerät scannen',
    };
  }
  if (art === 'blockiert') {
    const ids = state.blockiert || [];
    return {
      leer: 'Du hast niemanden blockiert.',
      zeilen: ids.map((id) => ({ text: user(id).name, neben: 'blockiert' })),
    };
  }
  if (art === 'archiv') {
    return { leer: 'Kein Chat ist archiviert.', zeilen: [] };
  }
  if (art === 'speicher') {
    const nachrichten = state.chats.length;
    return {
      leer: '',
      zeilen: [
        { text: 'Chats', neben: `${nachrichten} Unterhaltungen` },
        { text: 'Fotos und Videos', neben: `${Object.keys(eigeneMedien()).length} eigene Aufnahmen` },
        { text: 'Zwischenspeicher', neben: 'wird beim Beenden geleert' },
      ],
    };
  }
  if (art === 'insights') {
    const eigene = state.posts.filter((p) => p.userId === 'me');
    return {
      leer: '',
      zeilen: [
        { text: 'Eigene Beiträge', neben: String(eigene.length) },
        { text: 'Follower', neben: '340' },
        { text: 'Aufrufe (30 Tage)', neben: '1.284' },
        { text: 'Neue Follower (30 Tage)', neben: '46' },
      ],
    };
  }
  if (art === 'glocke') {
    const mit = state.posts.filter((p) => p.notify);
    return {
      leer: 'Du hast bei keinem Profil die Glocke angeschaltet.',
      zeilen: mit.map((p) => ({ text: user(p.userId).name, neben: 'Glocke an' })),
    };
  }
  if (art === 'stummeKanaele') {
    const stumm = state.chats.filter((c) => c.isGroup && c.muted);
    return {
      leer: 'Keine Community ist stummgeschaltet.',
      zeilen: stumm.map((c) => ({ text: c.name, neben: 'stumm' })),
    };
  }
  const stummeProfile = state.stummgeschaltet || [];
  return {
    leer: 'Kein Profil ist stummgeschaltet.',
    zeilen: stummeProfile.map((id) => ({ text: user(id).name, neben: 'stumm' })),
  };
}

/** `nachher` wird gerufen, wenn sich etwas geaendert hat - damit die
 *  aufrufende Seite ihren neuen Stand zeigen kann. */
function openEinstellung(punkt, nachher) {
  if (punkt.wahl) {
    const jetzt = einstellung(punkt);
    return openSheet(
      punkt.label,
      `<div class="sheet__body">${punkt.wahl
        .map(
          (w) => `<button class="item" data-wahl="${esc(w)}">
            <span class="item__label">${esc(w)}</span>
            ${w === jetzt ? `<span class="item__haken">${ICONS.check}</span>` : ''}
          </button>`
        )
        .join('')}</div>`,
      (sheet, close) => {
        sheet.querySelectorAll('[data-wahl]').forEach((b) =>
          b.addEventListener('click', () => {
            einstellungSetzen(punkt, b.dataset.wahl);
            close();
            // Nur dort neu zeichnen, wo die Liste auch steht. Aus der
            // Kontaktinfo heraus haette das sonst den Einstellungs-
            // Bildschirm unter das offene Fenster gebaut.
            if (state.area === 'settings') renderSettings();
            nachher?.();
            toast(`${punkt.label}: ${b.dataset.wahl}`);
          })
        );
      },
      { schliessen: true }
    );
  }

  if (punkt.eingabe) {
    return openFormular(
      punkt.label,
      punkt.eingabe,
      (werte) => {
        const fehler = punkt.pruefen?.(werte);
        if (fehler) return fehler;
        einstellungSetzen(punkt, werte[punkt.eingabe[0].key]);
        toast(punkt.fertig || 'Gespeichert');
        return null;
      },
      'Speichern'
    );
  }

  if (punkt.liste) {
    // Manche Aufrufer bringen ihre Zeilen selbst mit (Kontaktinfo).
    const { zeilen, leer, knopf, knopfText } = punkt._zeilen
      ? { zeilen: punkt._zeilen, leer: '', knopf: null, knopfText: '' }
      : einstellungsListe(punkt.liste);
    return openSheet(
      punkt.label,
      `<div class="sheet__body">
         ${
           zeilen.length
             ? zeilen
                 .map(
                   (z) => `<div class="item">
                     <span class="item__label">${esc(z.text)}</span>
                     <span class="item__value">${esc(z.neben)}</span>
                   </div>`
                 )
                 .join('')
             : `<div class="sheet__hint">${esc(leer)}</div>`
         }
       </div>
       ${knopf ? `<div class="sheet__footer"><button class="prof__btn is-primary" id="listenKnopf">${esc(knopf)}</button></div>` : ''}`,
      (sheet, close) => {
        sheet.querySelector('#listenKnopf')?.addEventListener('click', () => {
          close();
          toast(knopfText);
        });
      },
      { schliessen: true, hoch: zeilen.length > 4 }
    );
  }

  if (punkt.info) {
    return openSheet(
      punkt.label,
      `<div class="sheet__body"><p class="sheet__text">${esc(punkt.info)}</p></div>`,
      null,
      { schliessen: true }
    );
  }

  if (punkt.bestaetigen) {
    return openSheet(
      punkt.label,
      `<div class="sheet__body"><p class="sheet__text">${esc(punkt.bestaetigen)} Alle Beiträge, Nachrichten und Communitys gehen dabei unwiderruflich verloren.</p></div>
       <div class="sheet__footer"><button class="prof__btn is-danger" id="loeschJa">Ja, Konto löschen</button></div>`,
      (sheet, close) => {
        sheet.querySelector('#loeschJa').addEventListener('click', () => {
          close();
          // Ohne Backend wird nichts wirklich geloescht - das gehoert gesagt,
          // statt es vorzutaeuschen.
          toast('Löschauftrag vorgemerkt — er greift, sobald das Backend steht');
        });
      },
      { schliessen: true }
    );
  }

  if (punkt.aktion === 'sicherung') {
    const anzahl = state.chats.length;
    return toast(`Sicherung erstellt — ${anzahl} Unterhaltungen gespeichert`);
  }

  if (punkt.aktion === 'einladen') {
    const auswahl = state.contacts.filter((c) => state.users[c.id]);
    if (!auswahl.length) return toast('Du hast noch keinen Kontakt zum Einladen');
    return openSheet(
      'Freunde einladen',
      `<div class="sheet__body">${auswahl
        .map((c) => {
          const u = user(c.id);
          return `<button class="item" data-einladen="${c.id}">
            <span class="avatar avatar--36" style="background:${u.color}">${esc(u.initials)}</span>
            <span class="item__label">${esc(u.name)}</span>
            <span class="row__chevron">${ICONS.chevron}</span>
          </button>`;
        })
        .join('')}</div>`,
      (sheet, close) => {
        sheet.querySelectorAll('[data-einladen]').forEach((b) =>
          b.addEventListener('click', async () => {
            close();
            const chat = state.chats.find((c) => !c.isGroup && c.userId === b.dataset.einladen);
            if (!chat) return toast('Noch kein Chat mit dieser Person');
            await fetch(`/api/messages/${chat.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: 'Komm zu All Media: all-media.app' }),
            });
            toast(`Einladung an ${user(b.dataset.einladen).name} gesendet`);
          })
        );
      },
      { schliessen: true, hoch: true }
    );
  }

  toast(`${punkt.label} folgt mit dem Backend`);
}

function renderSettings() {
  const itemHtml = (it, sektionId) => {
    if (it.toggle) {
      const on = it.toggle === 'theme' ? state.theme === 'dark' : toggles[it.toggle];
      return `<div class="item">
        <span class="item__icon">${ICONS[it.icon]}</span>
        <span class="item__label">${esc(it.label)}</span>
        <button class="switch ${on ? 'is-on' : ''}" data-toggle="${it.toggle}" aria-label="${esc(it.label)}"><span class="switch__knob"></span></button>
      </div>`;
    }
    // Bei einer Auswahl steht rechts, was gerade gilt - sonst muesste man
    // jeden Punkt aufmachen, um den Stand zu sehen.
    const wert = it.wahl ? einstellung(it) : '';
    return `<button class="item ${it.gefahr ? 'item--danger' : ''}" data-setting="${esc(it.label)}" data-abschnitt="${esc(sektionId)}">
      <span class="item__icon">${ICONS[it.icon]}</span>
      <span class="item__label">${esc(it.label)}</span>
      ${wert ? `<span class="item__value">${esc(wert)}</span>` : ''}
      <span class="row__chevron">${ICONS.chevron}</span>
    </button>`;
  };

  main.innerHTML = `
    <div class="pagehead">
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
      <div class="pills">
        ${SETTINGS.map((sec) => `<button class="pill" data-jump="${sec.id}">${esc(sec.title)}</button>`).join('')}
      </div>
    </div>
    <div class="scroll" id="settingsScroll">
      ${SETTINGS.map(
        (sec) => `<div class="listhead" id="sec-${sec.id}">${esc(sec.title)} →</div>
          <div class="group">${sec.items.map((it) => itemHtml(it, sec.id)).join('')}</div>`
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

  // Aus dem Menü im eigenen Profil kommend: gleich beim richtigen Abschnitt
  // anfangen (Prototyp "VP + Einstellung" / "CP + Einstellung").
  if (state.settingsSprung) {
    const ziel = document.getElementById('sec-' + state.settingsSprung);
    state.settingsSprung = null;
    setTimeout(() => ziel?.scrollIntoView({ block: 'start' }), 30);
  }

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
    b.addEventListener('click', () => {
      const abschnitt = SETTINGS.find((sec) => sec.id === b.dataset.abschnitt);
      const punkt = abschnitt?.items.find((it) => it.label === b.dataset.setting);
      if (punkt) return openEinstellung(punkt);

      // Die zwei Punkte ganz unten stehen ausserhalb der Abschnitte.
      if (b.dataset.setting === 'Abmelden') return toast('Abmelden folgt mit dem Backend');
      toast('All Media 1.0.0 — gebaut aus dem Figma-Prototypen');
    })
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
  $('#camGallery').addEventListener('click', () => storyAufnehmen('photo'));
  $('#camSwitch').addEventListener('click', () => toast('Kamera gewechselt'));

  main.querySelectorAll('.camera__mode').forEach((b) =>
    b.addEventListener('click', () => {
      mode = b.dataset.mode;
      main.querySelectorAll('.camera__mode').forEach((x) => x.classList.toggle('is-active', x === b));
    })
  );

  $('#camShutter').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    if (mode === 'photo') return storyAufnehmen('photo');
    recording = !recording;
    btn.classList.toggle('is-rec', recording);
    if (recording) return toast('Aufnahme gestartet');
    storyAufnehmen('video');
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
  const filter = state.clipFilter || 'alle';
  const list = state.clips.filter(
    (c) => (!q || c.title.toLowerCase().includes(q) || user(c.userId).name.toLowerCase().includes(q))
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
      <div class="pills">
        ${['alle', 'standard', '360°', 'live'].map((f) => `<button class="pill ${filter === f ? 'is-active' : ''}" data-clipfilter="${f}">${f.charAt(0).toUpperCase() + f.slice(1)}</button>`).join('')}
      </div>
    </div>
    <div class="scroll">
      ${
        list.length
          ? list
              .map((c) => {
                const u = user(c.userId);
                return `<article class="clip" data-clip="${c.id}">
                  <div class="clip__thumb">${medienFlaeche(c.id, ICONS.landscape)}<span class="clip__time">${esc(c.duration)}</span></div>
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
    el.addEventListener('click', () => openClip(el.dataset.clip))
  );
  main.querySelectorAll('[data-clipfilter]').forEach((b) =>
    b.addEventListener('click', () => {
      state.clipFilter = b.dataset.clipfilter;
      renderLandscapeVideos();
    })
  );
}

/* -------------------------------- Videos: Explorer-Seiten */
function renderReelsExplorer() {
  main.innerHTML = `
    <div class="pagehead"><h2>Reels</h2></div>
    <div class="scroll">
      <div class="exp__grid">${state.videos.map((v) => `
        <button class="exp__card" data-openvideo="${v.id}">
          ${ICONS.portrait}
          <div class="exp__card-info">
            <strong>${esc(user(v.userId).name)}</strong>
            ${v.location ? `<small>${esc(v.location)}</small>` : ''}
          </div>
        </button>`).join('')}</div>
    </div>`;
  main.querySelectorAll('[data-openvideo]').forEach(b => b.addEventListener('click', () => openVideo(b.dataset.openvideo)));
}

function renderClipsExplorer() {
  main.innerHTML = `
    <div class="pagehead"><h2>Querformat</h2></div>
    <div class="scroll">
      ${state.clips.map((c) => `
        <button class="exp__row" data-openclip="${c.id}">
          <span class="exp__thumb">${ICONS.landscape}</span>
          <span class="exp__text">
            <strong>${esc(c.title)}</strong>
            <small>${esc(user(c.userId).name)} · ${esc(c.duration)}</small>
          </span>
        </button>`).join('')}
    </div>`;
  main.querySelectorAll('[data-openclip]').forEach(b => b.addEventListener('click', () => openClip(b.dataset.openclip)));
}

function renderPostsExplorer() {
  main.innerHTML = `
    <div class="pagehead"><h2>Beiträge</h2></div>
    <div class="scroll">
      <div class="exp__grid">${state.posts.map((p) => `
        <button class="griditem" data-openpost="${p.id}">${ICONS.image}</button>`).join('')}</div>
    </div>`;
  main.querySelectorAll('[data-openpost]').forEach(b => b.addEventListener('click', () => openPost(b.dataset.openpost)));
}

function renderHashtagExplorer(tag) {
  const items = state.videos.filter(v => v.tags?.includes(tag))
    .concat(state.clips.filter(c => c.tags?.includes(tag)))
    .concat(state.posts.filter(p => p.tags?.includes(tag)));
  main.innerHTML = `
    <div class="pagehead"><h2>${esc(tag)}</h2></div>
    <div class="scroll">
      <div class="exp__grid">${items.slice(0, 20).map((i) => `
        <button class="griditem" data-item="${i.id}" data-type="${i.userId ? (i.duration ? 'video' : 'post') : 'clip'}">${ICONS.image}</button>`).join('')}</div>
    </div>`;
}

function renderPlaceExplorer(placeId) {
  const place = state.places.find(p => p.id === placeId);
  const items = state.videos.filter(v => v.location === place?.name)
    .concat(state.clips.filter(c => c.location === place?.name))
    .concat(state.posts.filter(p => p.location === place?.name));
  main.innerHTML = `
    <div class="pagehead"><h2>${esc(place?.name || 'Standort')}</h2></div>
    <div class="scroll">
      <div class="exp__grid">${items.slice(0, 20).map((i) => `
        <button class="griditem" data-item="${i.id}">${ICONS.image}</button>`).join('')}</div>
    </div>`;
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
    b.addEventListener('click', () => openExplorer('hashtag', b.dataset.tag))
  );
  main.querySelectorAll('[data-place]').forEach((b) =>
    b.addEventListener('click', () => openExplorer('standort', b.dataset.place))
  );
  main.querySelectorAll('[data-sound]').forEach((b) =>
    b.addEventListener('click', () => openExplorer('sound', b.dataset.sound))
  );
}

/* ------------------------------- Glocke, Plus und Menü im eigenen Profil */
/*
 * Die drei Knoepfe oben rechts im eigenen Profil. Prototyp-Frames:
 *   Glocke -> "VP + Mitteilung" / "CP + Mitteilungen"
 *   Plus   -> "VP + erstellen"  / "CP + erstellen"
 *   Menü   -> "VP + Einstellung" / "CP + Einstellung"
 *
 * Die Einstellungen aus den beiden Menue-Frames stehen bereits im Bereich
 * Einstellungen (Abschnitte "Videos" und "Communitys"). Das Menü springt
 * deshalb dorthin, statt die Liste ein zweites Mal zu fuehren.
 */

/** Eine Mitteilung anklickbar machen: dorthin springen, wo sie herkommt. */
function mitteilungOeffnen(ziel) {
  if (ziel.art === 'profile') return openProfile(ziel.id);
  if (ziel.art === 'community') return openChat(ziel.id);

  if (ziel.art === 'post') {
    state.area = 'videos';
    state.sub.videos = 'home';
    render();
    setTimeout(() => document.getElementById('post-' + ziel.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    return;
  }
  if (ziel.art === 'video') {
    state.area = 'videos';
    state.sub.videos = 'portrait';
    render();
    setTimeout(() => document.getElementById('slide-' + ziel.id)?.scrollIntoView({ block: 'start' }), 60);
  }
}

async function openMitteilungen(bereich) {
  const res = await fetch(`/api/mitteilungen/${bereich}`);
  const { eintraege } = await res.json();

  const zeile = (m) => `
    <li>
      <button class="mitt ${m.gelesen ? '' : 'is-neu'}" data-mitt="${m.id}" data-ziel-art="${m.ziel.art}" data-ziel-id="${m.ziel.id}">
        <span class="mitt__icon">${ICONS.bell}${m.gelesen ? '' : '<i class="mitt__dot"></i>'}</span>
        <span class="mitt__text">${esc(m.text)}</span>
        <span class="mitt__zeit">${esc(m.zeit)}</span>
      </button>
    </li>`;

  openSheet(
    'Mitteilungen',
    `<div class="sheet__body">
       ${
         eintraege.length
           ? `<ul class="mitt-liste">${eintraege.map(zeile).join('')}</ul>`
           : `<div class="empty">${ICONS.bell}
                <div class="empty__title">Keine Mitteilungen</div>
                <div class="empty__text">Hier erscheint, was andere mit deinen Beiträgen machen.</div>
              </div>`
       }
     </div>
     ${eintraege.some((m) => !m.gelesen) ? `<div class="sheet__footer"><button class="prof__btn" id="mittAlle">Alle als gelesen markieren</button></div>` : ''}`,
    (sheet, close) => {
      sheet.querySelectorAll('[data-mitt]').forEach((b) =>
        b.addEventListener('click', async () => {
          await fetch(`/api/mitteilungen/${b.dataset.mitt}/gelesen`, { method: 'POST' });
          close();
          await mitteilungenZaehlen();
          mitteilungOeffnen({ art: b.dataset.zielArt, id: b.dataset.zielId });
        })
      );

      sheet.querySelector('#mittAlle')?.addEventListener('click', async () => {
        await fetch(`/api/mitteilungen/${bereich}/alle-gelesen`, { method: 'POST' });
        close();
        await mitteilungenZaehlen();
        render();
        toast('Alle Mitteilungen gelesen');
      });
    },
    { schliessen: true, hoch: true }
  );
}

/** Roten Punkt an der Glocke nachfuehren. */
async function mitteilungenZaehlen() {
  const res = await fetch('/api/bootstrap');
  const data = await res.json();
  state.ungelesen = data.ungelesen;
}

/** Glocke, Plus und Menü im Profilkopf verdrahten. */
function bindProfilAktionen(bereich) {
  main.querySelectorAll('[data-oact]').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.dataset.oact === 'bell') return openMitteilungen(bereich);
      if (b.dataset.oact === 'create') return openErstellen(bereich);

      // Menü: die Einstellungen zu diesem Bereich, wie im Prototyp-Frame
      // "VP + Einstellung" bzw. "CP + Einstellung".
      state.area = 'settings';
      state.settingsSprung = bereich === 'communities' ? 'communitys' : 'videos';
      render();
    })
  );
}

/* ---------------------------------------------------------- Plus: Erstellen */
// Genau die Punkte aus dem Prototyp-Frame "VP + erstellen".
const ERSTELLEN_VIDEOS = [
  { key: 'reels', label: 'Reels' },
  { key: 'landscape', label: 'Querformat' },
  { key: 'post', label: 'Beitrag' },
  { key: 'story', label: 'Story' },
  { key: 'highlight', label: 'Highlight' },
  { key: 'playlist', label: 'Playlist' },
  { key: 'livestream', label: 'Livestream' },
  { key: 'spende', label: 'Spendenaktion' },
];

function openErstellen(bereich) {
  const punkte = bereich === 'communities' ? [{ key: 'kanal', label: 'Neuen Kanal erstellen', icon: 'plus' }] : ERSTELLEN_VIDEOS;

  openSheet(
    'Erstellen',
    `<div class="sheet__body">
       <ul class="erstellen">
         ${punkte
           .map(
             (p) => `<li><button class="erstellen__punkt" data-erstellen="${p.key}">
               ${p.icon ? `<span class="erstellen__icon">${ICONS[p.icon]}</span>` : ''}
               <span>${esc(p.label)}</span>
             </button></li>`
           )
           .join('')}
       </ul>
     </div>`,
    (sheet, close) => {
      sheet.querySelectorAll('[data-erstellen]').forEach((b) =>
        b.addEventListener('click', () => {
          close();
          erstelle(b.dataset.erstellen);
        })
      );
    },
    { schliessen: true }
  );
}

/* ------------------------------ Weitere Optionen im Profil einer Person */
/*
 * Der Knopf gab bisher "folgen in Phase 3" aus. Jetzt hat jede Option
 * wirklich eine Folge: Stummschalten merkt sich der Server, Blockieren
 * nimmt die Person aus den Kontakten und sperrt den gemeinsamen Chat,
 * Melden haelt den Grund fest.
 */
const MELDE_GRUENDE = [
  'Spam oder Werbung',
  'Beleidigung oder Hass',
  'Gefälschtes Profil',
  'Nicht jugendfreie Inhalte',
  'Etwas anderes',
];

function openProfilOptionen(profile, aktualisiert) {
  const senden = async (was, koerper) => {
    const res = await fetch(`/api/profile/${profile.id}/${was}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(koerper || {}),
    });
    const daten = await res.json();
    if (!daten.ok) {
      toast(daten.error);
      return null;
    }
    if (daten.contacts) state.contacts = daten.contacts;
    if (daten.chats) state.chats = daten.chats;

    // Das Profil frisch holen, damit der Kopf den neuen Stand zeigt.
    const neu = await (await fetch(`/api/profile/${profile.id}`)).json();
    aktualisiert?.(neu);
    return daten;
  };

  const punkte = [
    { key: 'senden', label: 'Profil an einen Kontakt senden', icon: 'send' },
    { key: 'link', label: 'Link kopieren', icon: 'bookmark' },
    { key: 'stumm', label: profile.muted ? 'Stummschaltung aufheben' : 'Stummschalten', icon: 'mute' },
    { key: 'block', label: profile.blocked ? 'Blockierung aufheben' : 'Blockieren', icon: 'block', gefahr: true },
    { key: 'melden', label: 'Profil melden', icon: 'shield', gefahr: true },
  ];

  openSheet(
    profile.name,
    `<div class="sheet__body">${punkte
      .map(
        (p) => `<button class="item ${p.gefahr ? 'item--danger' : ''}" data-popt="${p.key}">
          <span class="item__icon">${ICONS[p.icon]}</span>
          <span class="item__label">${esc(p.label)}</span>
          <span class="row__chevron">${ICONS.chevron}</span>
        </button>`
      )
      .join('')}</div>`,
    (sheet, close) => {
      sheet.querySelectorAll('[data-popt]').forEach((b) =>
        b.addEventListener('click', async () => {
          const was = b.dataset.popt;

          if (was === 'link') {
            close();
            const adresse = `all-media.app/${profile.handle.replace('@', '')}`;
            try {
              await navigator.clipboard.writeText(adresse);
              return toast('Link kopiert');
            } catch {
              // Ohne Zwischenablage-Recht wenigstens die Adresse zeigen.
              return toast(adresse);
            }
          }

          if (was === 'senden') {
            close();
            return openProfilSenden(profile);
          }

          if (was === 'melden') {
            close();
            return openSheet(
              'Profil melden',
              `<div class="sheet__body">${MELDE_GRUENDE.map(
                (g) => `<button class="item" data-grund="${esc(g)}">
                  <span class="item__label">${esc(g)}</span>
                  <span class="row__chevron">${ICONS.chevron}</span>
                </button>`
              ).join('')}</div>`,
              (blatt, zu) => {
                blatt.querySelectorAll('[data-grund]').forEach((g) =>
                  g.addEventListener('click', async () => {
                    zu();
                    const daten = await senden('melden', { grund: g.dataset.grund });
                    if (daten) toast('Danke, wir sehen uns das an');
                  })
                );
              },
              { schliessen: true }
            );
          }

          close();
          const daten = await senden(was);
          if (!daten) return;
          if (was === 'stumm') return toast(daten.muted ? `${profile.name} stummgeschaltet` : 'Stummschaltung aufgehoben');
          toast(daten.blocked ? `${profile.name} blockiert` : 'Blockierung aufgehoben');
          render();
        })
      );
    },
    { schliessen: true }
  );
}

/** Ein Profil als Kontaktkarte an jemanden schicken. */
function openProfilSenden(profile) {
  const auswahl = state.contacts.filter((c) => state.users[c.id] && c.id !== profile.id);
  if (!auswahl.length) return toast('Du hast noch keinen Kontakt zum Weitergeben');

  openSheet(
    'Profil senden',
    `<div class="sheet__body">${auswahl
      .map((c) => {
        const u = user(c.id);
        return `<button class="item" data-an="${c.id}">
          <span class="avatar avatar--36" style="background:${u.color}">${esc(u.initials)}</span>
          <span class="item__label">${esc(u.name)}</span>
          <span class="row__chevron">${ICONS.chevron}</span>
        </button>`;
      })
      .join('')}</div>`,
    (sheet, close) => {
      sheet.querySelectorAll('[data-an]').forEach((b) =>
        b.addEventListener('click', async () => {
          close();
          const chat = state.chats.find((c) => !c.isGroup && c.userId === b.dataset.an);
          if (!chat) return toast('Noch kein Chat mit dieser Person');

          const res = await fetch(`/api/messages/${chat.id}/anhang`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ art: 'kontakt', id: profile.id }),
          });
          const daten = await res.json();
          if (!daten.ok) return toast(daten.error);
          toast(`Profil an ${user(b.dataset.an).name} gesendet`);
        })
      );
    },
    { schliessen: true, hoch: true }
  );
}

/* ------------------------------------------------------- Anhang im Chat */
/*
 * Das Plus in der Nachrichtenzeile. Foto, Standort und Kontakt - alles
 * drei landet wirklich im Chat, statt wie bisher nur einen Hinweis
 * auszugeben.
 */
function openAnhang(chat) {
  if (chat.requestState === 'pending') return toast('Warte, bis die Anfrage angenommen wurde');

  const punkte = [
    { key: 'kamera', label: 'Foto aufnehmen', icon: 'camera' },
    { key: 'galerie', label: 'Aus der Galerie', icon: 'image' },
    { key: 'standort', label: 'Standort senden', icon: 'mapPin' },
    { key: 'kontakt', label: 'Kontakt senden', icon: 'person' },
  ];

  openSheet(
    'Anhang',
    punkte
      .map(
        (p) => `<button class="item" data-anhang="${p.key}">
          <span class="item__icon">${ICONS[p.icon]}</span>
          <span class="item__label">${esc(p.label)}</span>
          <span class="row__chevron">${ICONS.chevron}</span>
        </button>`
      )
      .join(''),
    (sheet, close) => {
      sheet.querySelectorAll('[data-anhang]').forEach((b) =>
        b.addEventListener('click', () => {
          close();
          anhangSenden(chat, b.dataset.anhang);
        })
      );
    }
  );
}

/** Anhang wirklich verschicken und im Chat anzeigen. */
async function anhangSenden(chat, art) {
  const senden = async (koerper) => {
    const res = await fetch(`/api/messages/${chat.id}/anhang`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(koerper),
    });
    const daten = await res.json();
    if (!daten.ok) {
      toast(daten.error);
      return null;
    }
    return daten.message;
  };

  if (art === 'kamera' || art === 'galerie') {
    const datei = await dateiWaehlen('photo', art === 'galerie');
    if (!datei) return;

    let bild;
    try {
      bild = await bildVerkleinern(datei);
    } catch {
      return toast('Bild konnte nicht gelesen werden');
    }

    const nachricht = await senden({ art: 'foto' });
    if (!nachricht) return;
    eigenesMediumSichern(nachricht.id, bild);
    state.messages.push(nachricht);
    paintMessages(chat);
    return toast('Foto gesendet');
  }

  if (art === 'standort') {
    return openSheet(
      'Standort senden',
      `<div class="sheet__body">${state.places
        .map(
          (p) => `<button class="item" data-ort="${p.id}">
            <span class="item__icon">${ICONS.mapPin}</span>
            <span class="item__label">${esc(p.name)}</span>
            <span class="row__chevron">${ICONS.chevron}</span>
          </button>`
        )
        .join('')}</div>`,
      (sheet, close) => {
        sheet.querySelectorAll('[data-ort]').forEach((b) =>
          b.addEventListener('click', async () => {
            close();
            const nachricht = await senden({ art: 'standort', id: b.dataset.ort });
            if (!nachricht) return;
            state.messages.push(nachricht);
            paintMessages(chat);
            toast('Standort gesendet');
          })
        );
      },
      { schliessen: true, hoch: true }
    );
  }

  // Kontakt: nur Personen, die man auch wirklich kennt.
  const auswahl = state.contacts.filter((c) => state.users[c.id] && c.id !== chat.userId);
  if (!auswahl.length) return toast('Du hast noch keinen Kontakt zum Weitergeben');

  openSheet(
    'Kontakt senden',
    `<div class="sheet__body">${auswahl
      .map((c) => {
        const u = user(c.id);
        return `<button class="item" data-kontakt="${c.id}">
          <span class="avatar avatar--36" style="background:${u.color}">${esc(u.initials)}</span>
          <span class="item__label">${esc(u.name)}</span>
          <span class="row__chevron">${ICONS.chevron}</span>
        </button>`;
      })
      .join('')}</div>`,
    (sheet, close) => {
      sheet.querySelectorAll('[data-kontakt]').forEach((b) =>
        b.addEventListener('click', async () => {
          close();
          const nachricht = await senden({ art: 'kontakt', id: b.dataset.kontakt });
          if (!nachricht) return;
          state.messages.push(nachricht);
          paintMessages(chat);
          toast('Kontakt gesendet');
        })
      );
    },
    { schliessen: true, hoch: true }
  );
}

/* -------------------------------------------- Story: Ansichten und Menü */
/*
 * Zwei Knoepfe im Story-Betrachter, die bisher nur einen Hinweis ausgegeben
 * haben. Wer die eigene Story gesehen hat, steht jetzt namentlich da; das
 * Mehr-Menue unterscheidet zwischen eigener und fremder Story.
 */
function openStoryAnsichten(story, danach) {
  // Wer die Story gesehen hat: die eigenen Kontakte, in fester Reihenfolge
  // abhaengig von der Aufnahmezeit - sonst wechselt die Liste bei jedem
  // Oeffnen und wirkt zufaellig.
  const kontakte = state.contacts.filter((c) => state.users[c.id]);
  const wieviele = Math.min(kontakte.length, 1 + (Math.floor((story.aufgenommen || 0) / 60000) % kontakte.length));
  const seher = kontakte.slice(0, wieviele);

  openSheet(
    `${seher.length} ${seher.length === 1 ? 'Ansicht' : 'Ansichten'}`,
    `<div class="sheet__body">
       ${
         seher.length
           ? seher
               .map((c) => {
                 const u = user(c.id);
                 return `<button class="item" data-seher="${c.id}">
                   <span class="avatar avatar--36" style="background:${u.color}">${esc(u.initials)}</span>
                   <span class="item__label">${esc(u.name)}</span>
                   <span class="item__value">${esc(u.handle)}</span>
                 </button>`;
               })
               .join('')
           : `<div class="sheet__hint">Noch hat niemand deine Story gesehen.</div>`
       }
     </div>`,
    (sheet, close) => {
      sheet.querySelectorAll('[data-seher]').forEach((b) =>
        b.addEventListener('click', () => {
          close();
          openContactProfile(b.dataset.seher);
        })
      );
      sheet.addEventListener('click', (e) => {
        if (e.target === sheet) danach?.();
      });
    },
    { schliessen: true, hoch: seher.length > 5 }
  );
}

function openStoryOptionen(story, danach) {
  const eigene = !!story.own;
  const punkte = eigene
    ? [
        { key: 'sichtbar', label: 'Wer darf sie sehen', icon: 'eye' },
        { key: 'sichern', label: 'Auf dem Gerät sichern', icon: 'bookmark' },
        { key: 'loeschen', label: 'Story löschen', icon: 'trash', gefahr: true },
      ]
    : [
        { key: 'link', label: 'Link kopieren', icon: 'bookmark' },
        { key: 'stumm', label: `${user(story.userId).name} stummschalten`, icon: 'mute' },
        { key: 'melden', label: 'Story melden', icon: 'shield', gefahr: true },
      ];

  openSheet(
    eigene ? 'Deine Story' : user(story.userId).name,
    `<div class="sheet__body">${punkte
      .map(
        (p) => `<button class="item ${p.gefahr ? 'item--danger' : ''}" data-storyopt="${p.key}">
          <span class="item__icon">${ICONS[p.icon]}</span>
          <span class="item__label">${esc(p.label)}</span>
          <span class="row__chevron">${ICONS.chevron}</span>
        </button>`
      )
      .join('')}</div>`,
    (sheet, close) => {
      sheet.addEventListener('click', (e) => {
        if (e.target === sheet) danach?.();
      });

      sheet.querySelectorAll('[data-storyopt]').forEach((b) =>
        b.addEventListener('click', async () => {
          const was = b.dataset.storyopt;
          close();

          if (was === 'loeschen') {
            eigeneStorySichern(null);
            const meine = state.stories.find((x) => x.own);
            if (meine) {
              delete meine.mediaUri;
              delete meine.aufgenommen;
            }
            closeOverlay();
            toast('Deine Story wurde gelöscht');
            return render();
          }

          if (was === 'sichern') {
            const bild = story.mediaUri;
            if (!bild) return toast('Diese Story hat noch kein Bild');
            const a = document.createElement('a');
            a.href = bild;
            a.download = 'all-media-story.jpg';
            a.click();
            return toast('Story gesichert');
          }

          if (was === 'sichtbar') {
            danach?.();
            return openEinstellung({
              label: 'Story-Sichtbarkeit',
              wahl: ['Alle', 'Meine Kontakte', 'Enge Freunde'],
              standard: 'Meine Kontakte',
            });
          }

          if (was === 'link') {
            const adresse = `all-media.app/story/${story.id}`;
            try {
              await navigator.clipboard.writeText(adresse);
              toast('Link kopiert');
            } catch {
              toast(adresse);
            }
            return danach?.();
          }

          if (was === 'stumm') {
            const res = await fetch(`/api/profile/${story.userId}/stumm`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: '{}',
            });
            const daten = await res.json();
            toast(daten.muted ? `${user(story.userId).name} stummgeschaltet` : 'Stummschaltung aufgehoben');
            return danach?.();
          }

          // Melden: derselbe Weg wie im Profil.
          openSheet(
            'Story melden',
            `<div class="sheet__body">${MELDE_GRUENDE.map(
              (g) => `<button class="item" data-grund="${esc(g)}">
                <span class="item__label">${esc(g)}</span>
                <span class="row__chevron">${ICONS.chevron}</span>
              </button>`
            ).join('')}</div>`,
            (blatt, zu) => {
              blatt.querySelectorAll('[data-grund]').forEach((g) =>
                g.addEventListener('click', async () => {
                  zu();
                  await fetch(`/api/profile/${story.userId}/melden`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ grund: g.dataset.grund }),
                  });
                  toast('Danke, wir sehen uns das an');
                  danach?.();
                })
              );
            },
            { schliessen: true }
          );
        })
      );
    },
    { schliessen: true }
  );
}

/* --------------------------------------------------- Querformat-Player */
/*
 * Prototyp-Frame "VQ + Video": Zurueck-Pfeil, die Videoflaeche im
 * Querformat, darunter Ueberschrift mit Aufrufen und Datum und die Reihe
 * aus Like, Kommentar, Senden, Repost und Merken.
 *
 * Vorher liess sich ein Querformat-Video ueberhaupt nicht oeffnen - es kam
 * nur "Wiedergabe folgt mit dem Backend".
 */
function openClip(clipId) {
  let clip = state.clips.find((c) => c.id === clipId);
  if (!clip) return toast('Dieses Video gibt es nicht mehr');

  const sekunden = (dauer) => {
    const [min, sek] = String(dauer).split(':').map(Number);
    return min * 60 + sek;
  };
  let gesamt = sekunden(clip.duration);
  let bei = 0;
  let uhr = null;

  const zeit = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  overlay.hidden = false;

  const paint = () => {
    const u = user(clip.userId);
    const aehnlich = state.clips.filter((c) => c.id !== clip.id).slice(0, 4);

    overlay.innerHTML = `
      <div class="page">
        <div class="page__bar">
          <button class="topbar__btn" id="clipBack" aria-label="Zurück">${ICONS.back}</button>
        </div>
        <div class="scroll">
          <div class="player">
            <div class="player__stage" id="clipStage">
              ${medienFlaeche(clip.id, ICONS.play)}
              <button class="player__play" id="clipPlay" aria-label="Abspielen">${ICONS.play}</button>
            </div>
            <div class="player__leiste">
              <span class="player__zeit" id="clipZeit">${zeit(bei)}</span>
              <span class="player__balken"><i id="clipFortschritt" style="width:0%"></i></span>
              <span class="player__zeit">${esc(clip.duration)}</span>
            </div>
          </div>

          <div class="player__kopf">
            <div class="player__titel">${esc(clip.title)}</div>
            <div class="player__sub">${compactNumber(clip.views)} Aufrufe · ${esc(clip.age)}</div>
          </div>

          <div class="player__autor">
            <span data-profile="${u.id}">${avatarForUser(u.id, 44)}</span>
            <div class="player__autorText" data-profile="${u.id}">
              <div class="player__autorName">${esc(u.name)}</div>
              <div class="player__autorSub">${esc(u.handle)}</div>
            </div>
            <button class="prof__btn ${state.gefolgt?.[u.id] ? 'is-following' : 'is-primary'}" data-clipfollow="${u.id}">
              ${state.gefolgt?.[u.id] ? 'Gefolgt' : 'Folgen'}
            </button>
          </div>

          <div class="post__actions">
            <button class="postbtn ${clip.liked ? 'is-liked' : ''}" data-clipact="like" aria-label="Gefällt mir">
              ${ICONS.heart}${clip.likes ? `<span class="postbtn__zahl">${compactNumber(clip.likes)}</span>` : ''}
            </button>
            <button class="postbtn" data-clipact="comment" aria-label="Kommentieren">
              ${ICONS.chat}${clip.comments ? `<span class="postbtn__zahl">${compactNumber(clip.comments)}</span>` : ''}
            </button>
            <button class="postbtn" data-clipact="share" aria-label="Senden">${ICONS.send}</button>
            <button class="postbtn ${clip.reposted ? 'is-reposted' : ''}" data-clipact="repost" aria-label="Repost">${ICONS.repeat}</button>
            <button class="postbtn postbtn--end ${clip.saved ? 'is-saved' : ''}" data-clipact="save" aria-label="Speichern">${ICONS.bookmark}</button>
          </div>

          <div class="player__text">${esc(clip.description || '')}</div>

          ${
            clip.tags?.length
              ? `<div class="chips">${clip.tags.map((t) => `<button class="chip" data-cliptag="${esc(t)}">${esc(t)}</button>`).join('')}</div>`
              : ''
          }

          <div class="exp__head">Ähnliche Videos →</div>
          <div class="expclips">
            ${aehnlich
              .map((c) => {
                const au = user(c.userId);
                return `<article class="clip clip--klein" data-anderesclip="${c.id}">
                  <div class="clip__thumb">${medienFlaeche(c.id, ICONS.landscape)}<span class="clip__time">${esc(c.duration)}</span></div>
                  <div class="clip__meta">
                    <div class="avatar avatar--36" style="background:${au.color}">${esc(au.initials)}</div>
                    <div>
                      <div class="clip__title">${esc(c.title)}</div>
                      <div class="clip__sub">${esc(au.name)} · ${compactNumber(c.views)} Aufrufe</div>
                    </div>
                  </div>
                </article>`;
              })
              .join('')}
          </div>
        </div>
      </div>`;

    binden();
  };

  const schliessen = () => {
    clearInterval(uhr);
    overlay.hidden = true;
    overlay.innerHTML = '';
  };

  const binden = () => {
    overlay.querySelector('#clipBack').addEventListener('click', schliessen);

    const play = overlay.querySelector('#clipPlay');
    const stage = overlay.querySelector('#clipStage');
    const umschalten = () => {
      if (uhr) {
        clearInterval(uhr);
        uhr = null;
        play.innerHTML = ICONS.play;
        play.classList.remove('is-aus');
        return;
      }
      play.innerHTML = ICONS.pause;
      play.classList.add('is-aus');
      uhr = setInterval(() => {
        const zeitFeld = overlay.querySelector('#clipZeit');
        if (!zeitFeld) return clearInterval(uhr);
        bei = Math.min(gesamt, bei + 1);
        zeitFeld.textContent = zeit(bei);
        overlay.querySelector('#clipFortschritt').style.width = `${(bei / gesamt) * 100}%`;
        if (bei >= gesamt) {
          clearInterval(uhr);
          uhr = null;
          play.innerHTML = ICONS.play;
          play.classList.remove('is-aus');
        }
      }, 1000);
    };
    play.addEventListener('click', (e) => {
      e.stopPropagation();
      umschalten();
    });
    stage.addEventListener('click', umschalten);

    overlay.querySelectorAll('[data-clipact]').forEach((b) =>
      b.addEventListener('click', async () => {
        const was = b.dataset.clipact;

        if (was === 'comment') {
          return openComments(clip.id, (anzahl) => {
            clip.comments = anzahl;
            paint();
          });
        }
        if (was === 'share') return openTeilen('clip', clip.id);

        const res = await fetch(`/api/clips/${clip.id}/${was}`, { method: 'POST' });
        clip = await res.json();
        const stelle = state.clips.findIndex((c) => c.id === clip.id);
        if (stelle !== -1) state.clips[stelle] = clip;
        paint();

        if (was === 'repost') toast(clip.reposted ? 'Repostet' : 'Repost zurückgenommen');
        if (was === 'save') toast(clip.saved ? 'Gemerkt' : 'Nicht mehr gemerkt');
      })
    );

    overlay.querySelectorAll('[data-profile]').forEach((b) =>
      b.addEventListener('click', () => {
        schliessen();
        openProfile(b.dataset.profile, 'oeffentlich');
      })
    );

    overlay.querySelector('[data-clipfollow]')?.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.clipfollow;
      const res = await fetch(`/api/autoren/${id}/follow`, { method: 'POST' });
      const daten = await res.json();
      if (!daten.ok) return toast(daten.error);
      state.gefolgt = { ...state.gefolgt, [id]: daten.following };
      paint();
      toast(daten.following ? `Du folgst ${user(id).name}` : `${user(id).name} nicht mehr gefolgt`);
    });

    overlay.querySelectorAll('[data-cliptag]').forEach((b) =>
      b.addEventListener('click', () => openExplorer('hashtag', b.dataset.cliptag))
    );

    overlay.querySelectorAll('[data-anderesclip]').forEach((b) =>
      b.addEventListener('click', () => {
        clearInterval(uhr);
        uhr = null;
        bei = 0;
        clip = state.clips.find((c) => c.id === b.dataset.anderesclip);
        gesamt = sekunden(clip.duration);
        paint();
      })
    );
  };

  paint();
}

/* ------------------------------------------------------ Explorer-Seiten */
/*
 * Hashtag, Standort und Sound. Prototyp-Frames "VS# - Hashtagoptionen",
 * "VSS + Standort" und "VSSo + Sound". Alle drei sind gleich aufgebaut:
 * ein eigener Kopf und darunter Reels, Querformat und Beitraege.
 *
 * Vorher gab jeder dieser Knoepfe nur einen Hinweis aus.
 */
async function openExplorer(art, wert) {
  const res = await fetch(`/api/explorer/${art}/${encodeURIComponent(wert)}`);
  const daten = await res.json();
  if (!daten.ok) return toast(daten.error);

  const { kopf, reels, clips, beitraege } = daten;

  const abschnitt = (titel, inhalt) =>
    inhalt ? `<div class="exp__head">${titel} →</div>${inhalt}` : '';

  const reelsReihe = reels.length
    ? `<div class="expreels">${reels
        .map(
          (v) => `<button class="expreel" data-openvideo="${v.id}">
            ${medienFlaeche(v.id, ICONS.play)}
            <span class="expreel__text">${esc(v.description.slice(0, 40))}</span>
          </button>`
        )
        .join('')}</div>`
    : '';

  const clipListe = clips.length
    ? `<div class="expclips">${clips
        .map((c) => {
          const u = user(c.userId);
          return `<article class="clip clip--klein" data-clip="${c.id}">
            <div class="clip__thumb">${medienFlaeche(c.id, ICONS.landscape)}<span class="clip__time">${esc(c.duration)}</span></div>
            <div class="clip__meta">
              <div class="avatar avatar--36" style="background:${u.color}">${esc(u.initials)}</div>
              <div>
                <div class="clip__title">${esc(c.title)}</div>
                <div class="clip__sub">${esc(u.name)} · ${compactNumber(c.views)} Aufrufe</div>
              </div>
            </div>
          </article>`;
        })
        .join('')}</div>`
    : '';

  const beitragRaster = beitraege.length
    ? `<div class="exp__grid">${beitraege
        .map((p) => `<button class="griditem" data-openpost="${p.id}">${medienFlaeche(p.id, ICONS.image)}</button>`)
        .join('')}</div>`
    : '';

  const kopfHtml = {
    hashtag: () => `<div class="exp__titel">${esc(kopf.titel)}</div>
      <div class="exp__zahl">${compactNumber(kopf.anzahl)} Beiträge</div>`,

    standort: () => `<div class="exp__ortkopf">
        ${ICONS.mapPin}<span class="exp__titel">${esc(kopf.titel)}</span>
        <span class="exp__zahl">${compactNumber(kopf.anzahl)} Beiträge</span>
      </div>
      <div class="exp__adresse">${esc(kopf.adresse)}</div>
      <div class="exp__koordinaten">${esc(kopf.koordinaten)}</div>
      <div class="minikarte">
        <span class="minikarte__nadel" style="left:${kopf.x}%;top:${kopf.y}%">${ICONS.mapPin}</span>
      </div>
      <button class="exp__link" id="expFotos">Alle Fotos ansehen →</button>`,

    sound: () => `<div class="soundcover">${ICONS.music}</div>
      <div class="exp__titel exp__titel--mitte">${esc(kopf.titel)}</div>
      <div class="exp__zahl exp__zahl--mitte">${esc(kopf.produzent)} · ${compactNumber(kopf.anzahl)} Beiträge</div>
      <div class="welle">
        <button class="welle__play" id="soundPlay" aria-label="Abspielen">${ICONS.play}</button>
        <div class="welle__balken" id="welleBalken">
          ${Array.from({ length: 44 }, (_, i) => `<i style="height:${20 + Math.round(60 * Math.abs(Math.sin(i * 1.1)))}%"></i>`).join('')}
        </div>
        <span class="welle__zeit" id="welleZeit">0:00 / ${esc(kopf.dauer)}</span>
      </div>
      <div class="exp__lyrics">${esc(kopf.lyrics)}</div>`,
  }[kopf.art]();

  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="page">
      <div class="page__bar">
        <button class="topbar__btn" id="expBack" aria-label="Zurück">${ICONS.back}</button>
      </div>
      <div class="scroll">
        <div class="exp__kopf exp__kopf--${kopf.art}">${kopfHtml}</div>
        ${
          reels.length || clips.length || beitraege.length
            ? abschnitt('Reels', reelsReihe) + abschnitt('Querformat', clipListe) + abschnitt('Beiträge', beitragRaster)
            : `<div class="empty">${ICONS.search}
                 <div class="empty__title">Noch nichts hier</div>
                 <div class="empty__text">Zu ${esc(kopf.titel)} gibt es bisher keine Beiträge.</div>
               </div>`
        }
      </div>
    </div>`;

  overlay.querySelector('#expBack').addEventListener('click', () => {
    overlay.hidden = true;
    overlay.innerHTML = '';
  });

  overlay.querySelector('#expFotos')?.addEventListener('click', () => {
    const anzahl = beitraege.length + clips.length + reels.length;
    toast(anzahl ? `${anzahl} Aufnahmen von diesem Ort stehen unten` : 'Von diesem Ort gibt es noch nichts');
    overlay.querySelector('.exp__head')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Wellenform: der Balken laeuft mit, solange abgespielt wird.
  const play = overlay.querySelector('#soundPlay');
  if (play) {
    const [min, sek] = String(kopf.dauer).split(':').map(Number);
    const gesamt = min * 60 + sek;
    let bei = 0;
    let uhr = null;

    play.addEventListener('click', () => {
      if (uhr) {
        clearInterval(uhr);
        uhr = null;
        play.innerHTML = ICONS.play;
        return;
      }
      play.innerHTML = ICONS.pause;
      uhr = setInterval(() => {
        const zeitFeld = overlay.querySelector('#welleZeit');
        if (!zeitFeld) return clearInterval(uhr);
        bei = (bei + 1) % (gesamt + 1);
        zeitFeld.textContent = `${Math.floor(bei / 60)}:${String(bei % 60).padStart(2, '0')} / ${kopf.dauer}`;
        const balken = overlay.querySelectorAll('#welleBalken i');
        const bis = Math.round((bei / gesamt) * balken.length);
        balken.forEach((b, i) => b.classList.toggle('is-gespielt', i < bis));
      }, 1000);
    });
  }

  overlay.querySelectorAll('[data-openpost]').forEach((b) =>
    b.addEventListener('click', () => {
      overlay.hidden = true;
      overlay.innerHTML = '';
      state.area = 'videos';
      state.sub.videos = 'home';
      render();
      setTimeout(() => document.getElementById('post-' + b.dataset.openpost)?.scrollIntoView({ block: 'center' }), 60);
    })
  );

  overlay.querySelectorAll('[data-openvideo]').forEach((b) =>
    b.addEventListener('click', () => {
      overlay.hidden = true;
      overlay.innerHTML = '';
      state.area = 'videos';
      state.sub.videos = 'portrait';
      render();
      setTimeout(() => document.getElementById('slide-' + b.dataset.openvideo)?.scrollIntoView({ block: 'start' }), 60);
    })
  );

  overlay.querySelectorAll('[data-clip]').forEach((b) =>
    b.addEventListener('click', () => openClip(b.dataset.clip))
  );
}

/* --------------------------------------------------------------- Teilen */
/*
 * Prototyp-Frames "Nutzer B + Beitrag teilen" und "VQ + Video teilen": ein
 * Blatt mit einem Raster aus Personen. Wen man antippt, der bekommt den
 * Beitrag in den Chat - der Knopf gab vorher nur einen Hinweis aus.
 */
function openTeilen(art, id) {
  const kontakte = state.contacts.map((c) => c.id).filter((cid) => state.users[cid]);
  const uebrige = Object.keys(state.users).filter((uid) => uid !== 'me' && !kontakte.includes(uid));
  const kachel = (uid) => {
    const u = user(uid);
    return `<li>
      <button class="teilen__kachel" data-teilen="${uid}">
        <span class="avatar avatar--52" style="background:${u.color}">${esc(u.initials)}</span>
        <span class="teilen__name">${esc(u.name)}</span>
        <span class="teilen__haken">${ICONS.check}</span>
      </button>
    </li>`;
  };

  openSheet(
    art === 'video' ? 'Video teilen' : 'Beitrag teilen',
    `<div class="sheet__body">
       ${kontakte.length ? `<div class="teilen__kopf">Deine Kontakte</div><ul class="teilen">${kontakte.map(kachel).join('')}</ul>` : ''}
       ${uebrige.length ? `<div class="teilen__kopf">Weitere Vorschläge</div><ul class="teilen">${uebrige.map(kachel).join('')}</ul>` : ''}
     </div>`,
    (sheet) => {
      sheet.querySelectorAll('[data-teilen]').forEach((b) =>
        b.addEventListener('click', async () => {
          if (b.classList.contains('is-gesendet')) return;

          const res = await fetch('/api/teilen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ art, id, empfaenger: [b.dataset.teilen] }),
          });
          const daten = await res.json();
          if (!daten.ok) return toast(daten.error);

          state.chats = daten.chats;
          b.classList.add('is-gesendet');
          toast(`An ${user(b.dataset.teilen).name} gesendet`);
        })
      );
    },
    { schliessen: true, hoch: true }
  );
}

/* -------------------------------------- Eigene Bilder bleiben im Browser */
/*
 * Der Server teilt seinen Speicher mit allen Besuchern - eigene Fotos haben
 * dort nichts zu suchen. Auf dem Server steht nur der Eintrag, das Bild
 * liegt hier. Genauso ist es schon bei "Deine Story" geloest.
 */
const MEDIEN_SPEICHER = 'am-eigene-medien';

function eigeneMedien() {
  try {
    return JSON.parse(localStorage.getItem(MEDIEN_SPEICHER) || '{}');
  } catch {
    return {};
  }
}

function eigenesMediumSichern(id, bild) {
  if (!bild) return;
  try {
    const alle = eigeneMedien();
    alle[id] = bild;
    localStorage.setItem(MEDIEN_SPEICHER, JSON.stringify(alle));
  } catch {
    /* Speicher voll - dann bleibt der Eintrag ohne Bild, statt abzustuerzen */
  }
}

/** Bildflaeche fuer einen eigenen Eintrag, sonst das Platzhalter-Symbol. */
function medienFlaeche(id, symbol) {
  const bild = eigeneMedien()[id];
  return bild ? `<img class="eigenbild" src="${bild}" alt="">` : symbol;
}

/* ------------------------------------------------------ Formular-Blatt */
/**
 * Ein Blatt mit Eingabefeldern. felder: { key, label, typ, platzhalter,
 * pflicht, wert }. `aufSenden` bekommt die Werte und gibt bei einem Fehler
 * einen Text zurueck - dann bleibt das Blatt offen.
 */
function openFormular(titel, felder, senden, knopf = 'Fertig') {
  const feldHtml = (f) => {
    const gemeinsam = `id="f_${f.key}" placeholder="${esc(f.platzhalter || '')}"`;
    const eingabe =
      f.typ === 'mehrzeilig'
        ? `<textarea ${gemeinsam} rows="3">${esc(f.wert || '')}</textarea>`
        : `<input ${gemeinsam} type="${f.typ === 'zahl' ? 'number' : 'text'}" value="${esc(f.wert || '')}">`;
    return `<div class="sheet__field">
      <label class="sheet__label" for="f_${f.key}">${esc(f.label)}</label>
      ${eingabe}
    </div>`;
  };

  openSheet(
    titel,
    `<div class="sheet__body">${felder.map(feldHtml).join('')}</div>
     <div class="sheet__footer"><button class="prof__btn is-primary" id="formOk">${esc(knopf)}</button></div>`,
    (sheet, close) => {
      const ersteseingabe = sheet.querySelector('input, textarea');
      setTimeout(() => ersteseingabe?.focus(), 80);

      const absenden = async () => {
        const werte = {};
        for (const f of felder) werte[f.key] = sheet.querySelector('#f_' + f.key).value.trim();

        const fehlt = felder.find((f) => f.pflicht && !werte[f.key]);
        if (fehlt) return toast(`Bitte ${fehlt.label.toLowerCase()} ausfüllen`);

        const fehler = await senden(werte);
        if (fehler) return toast(fehler);
        close();
      };

      sheet.querySelector('#formOk').addEventListener('click', absenden);
      sheet.querySelectorAll('input').forEach((el) =>
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') absenden();
        })
      );
    },
    { schliessen: true }
  );
}

/* --------------------------------------------- Was der Plus-Knopf anlegt */
async function erstelle(was) {
  if (was === 'story') return storyAufnehmen('photo');
  if (was === 'kanal') return openKanalErstellen();

  if (was === 'highlight' || was === 'playlist') {
    const istHighlight = was === 'highlight';
    return openFormular(
      istHighlight ? 'Neues Highlight' : 'Neue Playlist',
      [{ key: 'name', label: 'Name', platzhalter: istHighlight ? 'z. B. Sommer' : 'z. B. Beste Clips', pflicht: true }],
      async ({ name }) => {
        const res = await fetch(`/api/eigene/${was}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        const daten = await res.json();
        if (!daten.ok) return daten.error;
        toast(`„${name}" angelegt`);
        render();
      },
      'Anlegen'
    );
  }

  if (was === 'spende') {
    return openFormular(
      'Spendenaktion',
      [
        { key: 'titel', label: 'Wofür sammelst du?', platzhalter: 'z. B. Bäume für den Stadtpark', pflicht: true },
        { key: 'ziel', label: 'Spendenziel in Euro', typ: 'zahl', platzhalter: '500', pflicht: true },
        { key: 'text', label: 'Beschreibung (freiwillig)', typ: 'mehrzeilig', platzhalter: 'Worum geht es?' },
      ],
      async (werte) => {
        const res = await fetch('/api/eigene/spende', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(werte),
        });
        const daten = await res.json();
        if (!daten.ok) return daten.error;
        toast('Spendenaktion läuft');
        render();
      },
      'Starten'
    );
  }

  if (was === 'livestream') return openLivestream();

  // Beitrag, Reels und Querformat: erst aufnehmen, dann beschreiben.
  const istBild = was === 'post';
  const datei = await dateiWaehlen(istBild ? 'photo' : 'video');
  if (!datei) return;

  let bild = null;
  try {
    bild = istBild ? await bildVerkleinern(datei) : await videoStandbild(datei);
  } catch {
    return toast('Aufnahme konnte nicht gelesen werden');
  }

  const quer = was === 'landscape';
  openFormular(
    { post: 'Neuer Beitrag', reels: 'Neues Reel', landscape: 'Neues Querformat-Video' }[was],
    [
      { key: 'beschreibung', label: quer ? 'Titel' : 'Beschreibung', typ: quer ? 'text' : 'mehrzeilig', pflicht: true },
      { key: 'ort', label: 'Ort (freiwillig)', platzhalter: 'z. B. Köln' },
    ],
    async (werte) => {
      const ziel = istBild ? '/api/eigene/beitrag' : '/api/eigene/video';
      const res = await fetch(ziel, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...werte, format: quer ? 'quer' : 'hoch' }),
      });
      const daten = await res.json();
      if (!daten.ok) return daten.error;

      const eintrag = daten.beitrag || daten.video || daten.clip;
      eigenesMediumSichern(eintrag.id, bild);

      // Erst das Ziel setzen, dann laden: bootstrap baut das Bild selbst auf.
      state.area = 'videos';
      state.sub.videos = istBild ? 'home' : quer ? 'landscape' : 'portrait';
      await bootstrap();
      toast(istBild ? 'Beitrag veröffentlicht' : 'Video veröffentlicht');
    },
    'Veröffentlichen'
  );
}

/** Neuen Kanal in einer Community anlegen (Prototyp "CP + erstellen"). */
function openKanalErstellen() {
  openFormular(
    'Neuen Kanal erstellen',
    [
      { key: 'name', label: 'Name des Kanals', platzhalter: 'z. B. Ankündigungen', pflicht: true },
      { key: 'thema', label: 'Worum geht es?', platzhalter: 'Kurz beschrieben', pflicht: true },
    ],
    async ({ name, thema }) => {
      const res = await fetch('/api/communities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, thema, sichtbarkeit: 'private' }),
      });
      const daten = await res.json();
      if (!daten.ok) return daten.error;

      state.area = 'communities';
      state.sub.communities = 'profile';
      await bootstrap();
      toast(`„${name}" erstellt`);
    },
    'Erstellen'
  );
}

/** Livestream: laufende Sendung mit Dauer, danach bleibt die Aufzeichnung. */
function openLivestream() {
  const begonnen = Date.now();
  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="live">
      <div class="live__stage">
        ${ICONS.video}
        <div class="live__marke"><span class="live__punkt"></span>LIVE</div>
        <div class="live__zeit" id="liveZeit">00:00</div>
      </div>
      <div class="live__leiste">
        <div class="live__zuschauer" id="liveZuschauer">0 Zuschauer</div>
        <button class="prof__btn is-primary" id="liveStop">Livestream beenden</button>
      </div>
    </div>`;

  fetch('/api/eigene/livestream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aktion: 'start' }),
  });

  // Die Zuschauerzahl waechst langsam - sonst sieht der Bildschirm tot aus.
  let zuschauer = 0;
  const uhr = setInterval(() => {
    const s = Math.round((Date.now() - begonnen) / 1000);
    const zeit = overlay.querySelector('#liveZeit');
    if (!zeit) return clearInterval(uhr);
    zeit.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    if (s % 3 === 0) {
      zuschauer += 1;
      overlay.querySelector('#liveZuschauer').textContent = `${zuschauer} ${zuschauer === 1 ? 'Zuschauer' : 'Zuschauer'}`;
    }
  }, 1000);

  overlay.querySelector('#liveStop').addEventListener('click', async () => {
    clearInterval(uhr);
    await fetch('/api/eigene/livestream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktion: 'stop' }),
    });
    overlay.hidden = true;
    overlay.innerHTML = '';
    state.area = 'videos';
    state.sub.videos = 'landscape';
    await bootstrap();
    toast('Livestream beendet, die Aufzeichnung steht im Querformat');
  });
}

/* ------------------------------------------------------- Videos: Profil */
/*
 * Prototyp-Frame "Videos - Profil": Leiste "Profil wechseln", darunter
 * @Nutzername mit Glocke/Plus/Menue, Bild links neben den Zahlen, dann Name,
 * Biografie und Link linksbuendig, Playlists und Highlights, Tab-Leiste und
 * das Beitragsraster.
 */
function ownProfileTop(handle, bereich) {
  const ungelesen = state.ungelesen?.[bereich] || 0;
  return `
    <div class="oprof__bar">
      <span class="oprof__handle">${esc(handle)}</span>
      <span class="oprof__acts">
        <button data-oact="bell" aria-label="Mitteilungen${ungelesen ? `, ${ungelesen} ungelesen` : ''}">${ICONS.bell}${
          ungelesen ? '<i class="oprof__dot"></i>' : ''
        }</button>
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
  const lauf = ++renderLauf;
  const res = await fetch('/api/profile/me');
  const me = await res.json();
  const tab = state.ownProfileTab;

  // Der Repost-Reiter war immer leer. Jetzt stehen dort die Beitraege und
  // Videos, die man selbst repostet hat.
  const meineReposts = tab === 'repost' ? await (await fetch('/api/reposts')).json() : [];

  // Inzwischen wurde etwas anderes aufgebaut - dann nichts mehr schreiben.
  if (lauf !== renderLauf) return;

  main.innerHTML = `
    ${switchBar('switchProfile')}
    <div class="scroll">
      ${ownProfileTop(me.handle, 'videos')}
      <div class="oprof__top">
        <div class="avatar avatar--88 has-status" style="background:${me.color}">${esc(me.initials)}</div>
        <div class="prof__stats">
          <div class="prof__stat"><span>Beiträge</span><strong>${compactNumber(me.posts)}</strong></div>
          <button class="prof__stat" id="followerBtn"><span>Follower</span><strong>${compactNumber(me.followers)}</strong></button>
          <button class="prof__stat" id="followingBtn"><span>Gefolgt</span><strong>${compactNumber(me.following)}</strong></button>
        </div>
      </div>
      <div class="prof__about">
        <div class="prof__name">Henrik</div>
        <div class="prof__bio">${esc(me.bio)}</div>
        <a class="prof__link" href="#" id="profLink">${esc(me.link)}</a>
      </div>
      ${
        me.spende
          ? `<div class="spende">
               <div class="spende__titel">${esc(me.spende.titel)}</div>
               ${me.spende.text ? `<div class="spende__text">${esc(me.spende.text)}</div>` : ''}
               <div class="spende__balken"><div class="spende__fuellung" style="width:${Math.min(
                 100,
                 Math.round((me.spende.gesammelt / me.spende.ziel) * 100)
               )}%"></div></div>
               <div class="spende__zahlen">${me.spende.gesammelt} € von ${me.spende.ziel} € gesammelt</div>
             </div>`
          : ''
      }
      <div class="highlights">
        ${(me.playlists || [])
          .map((pl) => `<button class="highlight" data-playlist="${esc(pl)}"><span class="highlight__ring is-playlist">${ICONS.play}</span><span class="highlight__label">${esc(pl)}</span></button>`)
          .join('')}
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
              .map((g) => `<div class="griditem">${medienFlaeche(g.id, g.kind === 'video' ? ICONS.play : ICONS.image)}</div>`)
              .join('')}</div>`
          : tab === 'repost' && meineReposts.length
          ? `<div class="prof__grid">${meineReposts
              .map(
                (r) => `<div class="griditem" title="${esc(r.eintrag.description || '')}">
                  ${r.art === 'video' ? ICONS.play : ICONS.image}
                  <span class="griditem__badge">${ICONS.repeat}</span>
                </div>`
              )
              .join('')}</div>`
          : `<div class="empty">${ICONS[PROFILE_TABS.find((t) => t.id === tab).icon]}
              <div class="empty__title">${tab === 'repost' ? 'Noch nichts repostet' : 'Noch nichts hier'}</div>
              <div class="empty__text">${
                tab === 'repost'
                  ? 'Tippe im Feed auf den Repost-Knopf, dann erscheint es hier.'
                  : 'Dieser Bereich füllt sich, sobald du ihn benutzt.'
              }</div>
            </div>`
      }
    </div>`;

  $('#switchProfile').addEventListener('click', openKontoWechsel);
  $('#profLink').addEventListener('click', (e) => {
    e.preventDefault();
    toast(me.link);
  });
  $('#followerBtn')?.addEventListener('click', () => openFollowerList(me, 'follower'));
  $('#followingBtn')?.addEventListener('click', () => openFollowerList(me, 'following'));
  main.querySelectorAll('[data-otab]').forEach((b) =>
    b.addEventListener('click', () => {
      state.ownProfileTab = b.dataset.otab;
      renderVideoProfile();
    })
  );
  bindProfilAktionen('videos');
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
      ${ownProfileTop(me.handle, 'communities')}
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
  bindProfilAktionen('communities');
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
  const profileBtn = overlay.querySelector('[data-profile]');
  if (profileBtn) {
    profileBtn.addEventListener('click', () => {
      state.openChatSettingsId = chat.id;
      render();
    });
  }
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
      openCall(chat.userId || chat, b.dataset.call === 'video' ? 'video' : 'audio')
    )
  );
  $('#attach').addEventListener('click', () => openAnhang(chat));
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

  // Angehaengter Kontakt fuehrt zu seinem Profil, ein Standort zu der
  // Standort-Seite - sonst waeren beide Karten nur Bilder.
  // Lange druecken markiert eine Nachricht mit einem Stern - so fuellt sich
  // "Mit Stern markiert" in der Kontaktinfo wirklich.
  box.querySelectorAll('[data-msgid]').forEach((el) => {
    let halten;
    const start = () => {
      halten = setTimeout(async () => {
        const res = await fetch(`/api/messages/${chat.id}/${el.dataset.msgid}/stern`, { method: 'POST' });
        const daten = await res.json();
        if (!daten.ok) return toast(daten.error);
        const m = state.messages.find((x) => x.id === daten.id);
        if (m) m.stern = daten.stern;
        paintMessages(chat);
        toast(daten.stern ? 'Nachricht markiert' : 'Markierung entfernt');
      }, 500);
    };
    const ende = () => clearTimeout(halten);

    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup', ende);
    el.addEventListener('pointerleave', ende);
    el.addEventListener('pointercancel', ende);
    // Ohne das oeffnet sich auf dem Handy beim Halten das Systemmenue.
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  box.querySelectorAll('[data-msgkontakt]').forEach((b) =>
    b.addEventListener('click', () => openContactProfile(b.dataset.msgkontakt))
  );
  box.querySelectorAll('[data-msgort]').forEach((b) =>
    b.addEventListener('click', () => {
      const platz = state.places.find((p) => p.name === b.dataset.msgort);
      if (platz) openExplorer('standort', platz.id);
    })
  );
}

function messageBubble(m, chat) {
  const out = m.from === 'me';
  // Ein selbst geschicktes Foto liegt im Browser, nicht auf dem Server.
  const eigenesBild = eigeneMedien()[m.id];
  const media =
    m.media === 'image'
      ? eigenesBild
        ? `<img class="msg__bild" src="${eigenesBild}" alt="Foto">`
        : `<div class="msg__media">${ICONS.image} Foto</div>`
      : m.media === 'audio'
      ? `<div class="msg__media">${ICONS.mic} Sprachnachricht · 0:14</div>`
      : '';

  const standort = m.standort
    ? `<button class="msg__standort" data-msgort="${esc(m.standort.name)}">
         <span class="msg__standortKarte">
           <i class="msg__standortNadel" style="left:${m.standort.x}%;top:${m.standort.y}%">${ICONS.mapPin}</i>
         </span>
         <span class="msg__standortName">${esc(m.standort.name)}</span>
         <span class="msg__standortSub">${esc(m.standort.adresse || m.standort.koordinaten || '')}</span>
       </button>`
    : '';

  const kontakt = m.kontakt
    ? `<button class="msg__kontakt" data-msgkontakt="${esc(m.kontakt.id)}">
         <span class="avatar avatar--44" style="background:${user(m.kontakt.id).color}">${esc(user(m.kontakt.id).initials)}</span>
         <span class="msg__kontaktText">
           <strong>${esc(m.kontakt.name)}</strong>
           <span>${esc(m.kontakt.handle)}</span>
         </span>
       </button>`
    : '';
  return `
    <div class="msg msg--${out ? 'out' : 'in'}" data-msgid="${esc(m.id)}">
      ${!out && chat.isGroup ? `<div class="msg__sender">${esc(user(m.from).name)}</div>` : ''}
      ${m.replyToStory ? `<div class="msg__reply">Antwort auf die Story von ${esc(m.replyToStory)}</div>` : ''}
      ${
        m.geteilt
          ? `<div class="msg__geteilt">
               <span class="msg__geteiltBild">${m.geteilt.art === 'video' ? ICONS.play : ICONS.image}</span>
               <span class="msg__geteiltText">
                 <strong>${esc(m.geteilt.autor)}</strong>
                 <span>${esc(m.geteilt.titel)}</span>
               </span>
             </div>`
          : standort || kontakt || media || esc(m.text)
      }
      <div class="msg__foot">${m.stern ? `<span class="msg__stern">${ICONS.star}</span>` : ''}${esc(m.time)}${out ? ICONS.checkDouble : ''}</div>
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
/** "vor 3 Min." aus dem Aufnahmezeitpunkt. */
function storyAlter(s) {
  if (!s.aufgenommen) return s.time || 'vor 2 Std.';
  const min = Math.floor((Date.now() - s.aufgenommen) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  return `vor ${Math.floor(min / 60)} Std.`;
}

let storyTimer;
const STORY_DURATION = 6000;
const STORY_STEP = 60;

function openStory(storyId) {
  // Die eigene Story ist nur dabei, wenn wirklich etwas aufgenommen wurde.
  const list = state.stories.filter((s) => !s.own || s.mediaUri);
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
        <div class="viewer__who" ${s.own ? '' : `data-profile="${u.id}"`}>
          <div class="viewer__name">${s.own ? 'Deine Story' : esc(u.name)}</div>
          <div class="viewer__time">${esc(storyAlter(s))}</div>
        </div>
        <button class="viewer__more" id="storyMore" aria-label="Mehr">${ICONS.settings}</button>
      </div>
      <div class="viewer__stage">
        <button class="viewer__zone viewer__zone--prev" id="storyPrev" aria-label="Vorherige Story"></button>
        <button class="viewer__zone viewer__zone--next" id="storyNext" aria-label="Nächste Story"></button>
        <div class="viewer__media">${
          s.mediaUri ? `<img class="viewer__bild" src="${s.mediaUri}" alt="Deine Story" />` : ICONS.image
        }</div>
        ${s.caption ? `<div class="viewer__caption">${esc(s.caption)}</div>` : ''}
      </div>
      ${
        s.own
          ? // Sich selbst antwortet man nicht - stattdessen der Blick darauf,
            // wer die Story gesehen hat.
            `<div class="viewer__foot">
              <button class="viewer__eigen" id="storyViews">${ICONS.eye}<span>Ansichten</span></button>
              <button class="viewer__act" id="storyDelete" aria-label="Story löschen">${ICONS.trash || ICONS.close}</button>
            </div>`
          : `<form class="viewer__foot" id="storyForm">
              <input class="viewer__reply" id="storyReply" placeholder="Antworten" autocomplete="off" />
              <button type="button" class="viewer__act ${s.liked ? 'is-liked' : ''}" id="storyLike" aria-label="Gefällt mir">${ICONS.heart}</button>
              <button type="submit" class="viewer__hidden" tabindex="-1" aria-hidden="true"></button>
            </form>`
      }
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

  // Die Zeit anhalten, solange ein Blatt offen ist - sonst laeuft die Story
  // im Hintergrund weiter. Genau das war schon beim Antworten das Problem.
  $('#storyMore').addEventListener('click', () => {
    pause();
    openStoryOptionen(s, resume);
  });

  // Bei der eigenen Story gibt es weder Herz noch Antwortfeld.
  if (s.own) {
    $('#storyViews').addEventListener('click', () => {
      pause();
      openStoryAnsichten(s, resume);
    });
    $('#storyDelete').addEventListener('click', () => {
      eigeneStorySichern(null);
      const eigene = state.stories.find((x) => x.own);
      if (eigene) {
        delete eigene.mediaUri;
        delete eigene.aufgenommen;
      }
      stop();
      closeOverlay();
      toast('Deine Story wurde gelöscht');
      render();
    });
    return;
  }

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
  // Aus der Galerie statt aus der Kamera - dieselbe Aufnahme, nur ohne
  // capture-Kennzeichen, damit das Handy den Bildordner oeffnet.
  $('#camGallery').addEventListener('click', async () => {
    const datei = await dateiWaehlen('photo', true);
    if (!datei) return;
    try {
      const bild = await bildVerkleinern(datei);
      eigeneStorySichern({ mediaUri: bild, aufgenommen: Date.now() });
      const eigene = state.stories.find((x) => x.own);
      if (eigene) {
        eigene.mediaUri = bild;
        eigene.aufgenommen = Date.now();
        eigene.viewed = false;
      }
      closeOverlay();
      toast('Deine Story ist online');
      render();
    } catch {
      toast('Bild konnte nicht gelesen werden');
    }
  });
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
