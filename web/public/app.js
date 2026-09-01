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
      // Haus wie bei Videos-Home. Vier Quadrate lasen sich als "Uebersicht",
      // nicht als Startseite des Bereichs.
      { id: 'home', label: 'Home', icon: 'home' },
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
  // Home startet bei den eigenen Communitys, nicht bei allen - siehe
  // renderCommunities.
  communityFilter: 'meine',
  commSearchQuery: '',
  commSearchFilter: 'all',
  // Filter der persoenlichen Chats im Community-Bereich.
  commChatFilter: 'all',
  videoSearchQuery: '',
  clipQuery: '',
  theme: localStorage.getItem('am-theme') || 'system',
  ownProfileTab: 'grid',
  openChatId: null,
  openChatSettingsId: null,
  openCommunityId: null,
  // Friend-Map: Vollbild und Kartenansicht.
  karteVollbild: false,
  karteStil: 'standard',
  openChannelId: null,
  communitiesFilter: 'joined',
  messages: [],
  currentUserId: localStorage.getItem('am-user-id') || 'me',
  profiles: JSON.parse(localStorage.getItem('am-profiles') || '["me"]'),
  blockedUsers: JSON.parse(localStorage.getItem('am-blocked') || '[]'),
  starredMessages: {},
  mutedChats: {},
  notifications: { sound: true, vibration: true, led: true },
  /*
   * Video-Einstellungen im Querformat (Henrik, Punkt 31: "Keine
   * Einstellungen. Nach YouTube - Untertitel, Geschwindigkeit, Qualität").
   * Sie gelten fuer alle Videos, nicht je Video - so haelt es YouTube auch.
   */
  video: {
    tempo: JSON.parse(localStorage.getItem('am-video-tempo') || '1'),
    qualitaet: localStorage.getItem('am-video-qualitaet') || 'Automatisch',
    untertitel: localStorage.getItem('am-video-untertitel') === 'an',
  },
};

const sub = () => state.sub[state.area];

const $ = (sel) => document.querySelector(sel);
const main = $('#main');
const overlay = $('#overlay');

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function user(id) {
  return state.users[id] || { name: '?', initials: '?', color: 'linear-gradient(135deg,#B4BBC7,#8C94A3)' };
}

/*
 * Die Farbe eines Nutzers ist ein CSS-Verlauf ("linear-gradient(...)") - gut
 * fuer einen Avatar, unbrauchbar als Fuellfarbe einer SVG-Nadel: Leaflet
 * reicht den Wert unveraendert weiter, und ein Verlauf faellt dort auf
 * Schwarz zurueck. Deshalb hier die erste Farbe aus dem Verlauf.
 */
function farbeFuerNadel(farbe) {
  const treffer = String(farbe || '').match(/#[0-9a-f]{3,8}\b|\brgba?\([^)]+\)/i);
  return treffer ? treffer[0] : '#0a66ff';
}

function avatarOf(chat, size = 54) {
  if (chat.isGroup) {
    return `<div class="avatar avatar--${size}" style="background:linear-gradient(135deg,#7E93C4,#4A6699)">${ICONS.people}</div>`
      .replace('<svg', '<svg style="width:45%;height:45%"');
  }
  const u = user(chat.userId);
  return `<div class="avatar avatar--${size}" style="background:${u.color}">${esc(u.initials)}</div>`;
}

function avatarForUser(id, size = 44) {
  if (id === 'me') return eigenerAvatar(state.users.me, size);
  const u = user(id);
  return `<div class="avatar avatar--${size}" style="background:${u.color}">${esc(u.initials)}</div>`;
}

/*
 * Der eigene Avatar zeigt das selbst gewaehlte Bild, wenn eines hinterlegt
 * ist. Es liegt nur im Browser (siehe openProfilBearbeiten), deshalb wird es
 * hier und nicht ueber die Daten vom Server geholt.
 */
function eigenerAvatar(me, size = 44, extra = '') {
  const bild = eigenesProfilbildLaden();
  const klassen = `avatar avatar--${size}${extra ? ' ' + extra : ''}`;
  if (bild) return `<div class="${klassen}"><img src="${bild}" alt="" /></div>`;
  return `<div class="${klassen}" style="background:${me.color}">${esc(me.initials)}</div>`;
}

/*
 * Der eigene Avatar mit Story-Ring, wenn gerade eine eigene Story laeuft.
 *
 * Henrik am 26.08.2026: "Neue Story wird nicht unter dem Profilbild mit
 * einem Kreis angezeigt." Sie stand nur in der Story-Leiste der Chatliste -
 * im eigenen Profil war ihr nichts anzusehen.
 *
 * Ein Klick fuehrt in die Story, genau wie in der Leiste. Ohne laufende
 * Story bleibt es der schlichte Avatar; ein Ring, der immer da ist, sagt
 * nichts mehr aus.
 */
function eigenerAvatarMitStory(me, size = 88) {
  const story = eigeneStoryLaden();
  if (!story?.mediaUri) return eigenerAvatar(me, size, 'has-status');

  return `<button class="profilstory" data-eigene-story aria-label="Deine Story ansehen">
    <span class="profilstory__ring">
      <span class="profilstory__innen">${eigenerAvatar(me, size)}</span>
    </span>
  </button>`;
}

/*
 * Link in der Profilbeschreibung. Henrik: "Links in Profilbeschreibungen
 * muessen anklickbar sein." Vorher stand dort ein Anker auf "#", der nur
 * einen Hinweis eingeblendet hat.
 *
 * Ohne Schema faengt der Browser sonst an, relativ zur eigenen Seite zu
 * suchen - "all-media.app" wuerde auf der App-Adresse landen statt auf der
 * Zielseite.
 */
function bioLink(adresse) {
  const ziel = /^https?:\/\//i.test(adresse) ? adresse : `https://${adresse}`;
  return `<a class="prof__link" href="${esc(ziel)}" target="_blank" rel="noopener noreferrer">${esc(adresse)}</a>`;
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
/*
 * Hier stand eine zweite Fassung von openKontoWechsel(), die Schein-Konten
 * im Browser anlegte ("Profil profile-1756…"). Sie war toter Code: weiter
 * unten steht eine gleichnamige Funktion, und JavaScript nimmt die letzte.
 * Mit der echten Anmeldung bei Supabase hatte sie ohnehin nichts zu tun.
 */

/*
 * Erster Aufbau. Bis hierher zeigt die Seite das Geruest aus index.html -
 * eine graue Chatliste, die schon steht, bevor irgendein Skript laeuft.
 *
 * Warum das wichtig ist: die Website liegt auf Render, und ein Dienst, der
 * eine Weile nicht angefragt wurde, faehrt erst hoch. Vorher war der
 * Bildschirm in dieser Zeit vollstaendig weiss - der erste Eindruck der App
 * war eine leere Flaeche. Und schlug der Aufruf fehl, blieb sie es fuer
 * immer, weil niemand den Fehler aufgefangen hat.
 */
async function bootstrap() {
  let data;

  // Erst klaeren, ob jemand angemeldet ist. Sonst holt der Aufruf unten die
  // Beispieldaten, obwohl eine Sitzung vorliegt und echte Daten da waeren.
  if (window.Anmeldung?.bereit) {
    await window.Anmeldung.bereit.catch(() => null);
  }

  try {
    const res = await fetch('/api/bootstrap');
    if (!res.ok) throw new Error('Server antwortet mit ' + res.status);
    data = await res.json();
  } catch (fehler) {
    zeigeStartfehler(fehler);
    return;
  }

  /*
   * Ohne Anmeldung gibt es keine Inhalte.
   *
   * Das ist keine Haerte der Oberflaeche, sondern die Regel der Datenbank:
   * Row Level Security laesst anonyme Zugriffe nicht zu. Bis zum 31.08.2026
   * sprang hier ersatzweise ein fester Bestand aus dem Server ein - und
   * genau der war der Grund, warum die Seite bei jedem aussah, als liefe
   * alles, waehrend in Wahrheit nichts ankam.
   */
  if (data && data.angemeldet === false) {
    zeigeAnmeldung();
    return;
  }

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
  document.body.classList.remove('is-startet');
  render();
}

/**
 * Was ein Besucher sieht, der nicht angemeldet ist.
 *
 * Bis zum 31.08.2026 sah er die Beispieldaten — Anna, Bob, Clara, acht Chats,
 * achtzehn Beiträge. Alles davon lag im Server und gehörte niemandem. Wer die
 * Seite öffnete, hatte den Eindruck einer benutzten App, ohne je ein Konto
 * gehabt zu haben.
 *
 * Jetzt steht hier, was Sache ist: die Inhalte liegen in der Datenbank, und
 * die zeigt sie nur einem angemeldeten Konto.
 */
function zeigeAnmeldung() {
  document.body.classList.remove('is-startet');
  /*
   * Obere Leiste und untere Navigation ausblenden. Sie gehören zu Bereichen,
   * die es ohne Anmeldung nicht gibt — die Insel oben schrumpfte sonst zu
   * einem schmalen dunklen Balken zusammen, weil sie nichts anzuzeigen hatte.
   */
  document.body.classList.add('ist-abgemeldet');
  const ziel = $('#main');
  if (!ziel) return;
  ziel.innerHTML = `
    <div class="startfehler">
      <div class="startfehler__symbol">${ICONS.person}</div>
      <div class="startfehler__titel">Willkommen bei All Media</div>
      <div class="startfehler__text">
        Melde dich an, um deine Chats, Beiträge und Communitys zu sehen.
        Noch kein Konto? Du kannst dir hier eines anlegen — den Benutzernamen
        wählst du selbst.
      </div>
      <button class="btn btn--primary" id="startAnmelden">Anmelden oder Konto anlegen</button>
    </div>`;

  $('#startAnmelden').addEventListener('click', () => openKontoWechsel());
}

/*
 * Wenn der erste Aufruf scheitert, muss etwas dastehen, das weiterhilft.
 * Ein stiller Fehlschlag ist die schlechteste aller Moeglichkeiten: die Seite
 * sieht dann aus, als lade sie noch, und tut es nie wieder.
 */
function zeigeStartfehler(fehler) {
  document.body.classList.remove('is-startet');
  const ziel = $('#main');
  if (!ziel) return;
  ziel.innerHTML = `
    <div class="startfehler">
      <div class="startfehler__symbol">${ICONS.info}</div>
      <div class="startfehler__titel">All Media ist gerade nicht erreichbar</div>
      <div class="startfehler__text">
        Der Server hat nicht geantwortet. Das passiert, wenn er nach einer
        Ruhephase erst wieder hochfährt — meist reicht ein zweiter Versuch.
      </div>
      <button class="btn btn--primary" id="startNochmal">Nochmal versuchen</button>
      <div class="startfehler__grund">${esc(String(fehler && fehler.message ? fehler.message : fehler))}</div>
    </div>`;
  $('#startNochmal').addEventListener('click', () => {
    document.body.classList.add('is-startet');
    ziel.innerHTML = geruest();
    bootstrap();
  });
}

/*
 * Das Geruest. Dieselbe Form wie die spaetere Chatliste - Kreis links, zwei
 * Zeilen rechts - nur ohne Inhalt. Ein Geruest, das der echten Liste gleicht,
 * wirkt wie "gleich da"; ein Kreisel wirkt wie "warte".
 */
function geruest() {
  const zeile = `
    <div class="geruest__zeile">
      <div class="skelett geruest__kreis"></div>
      <div class="geruest__text">
        <div class="skelett geruest__balken geruest__balken--kurz"></div>
        <div class="skelett geruest__balken"></div>
      </div>
    </div>`;
  return `
    <div class="geruest" aria-hidden="true">
      <div class="geruest__stories">
        ${Array.from({ length: 5 }, () => '<div class="skelett geruest__story"></div>').join('')}
      </div>
      <div class="geruest__suche skelett"></div>
      ${zeile.repeat(7)}
    </div>`;
}

/* ------------------------------------------------------------------ views */

/*
 * Ungelesene Nachrichten, aufgeschluesselt nach Bereich und Unterpunkt.
 *
 * Henrik hat am 26.08.2026 zurueckgemeldet, dass eine neue Nachricht nur
 * unten am Bereich auftaucht, aber nicht oben am Unterpunkt, zu dem sie
 * gehoert. Beide sollen sie zeigen: kommt eine Nachricht im Chat an, steht
 * die "1" am Bereich Messenger *und* an dessen Unterpunkt Chats.
 *
 * Gezaehlt wird genau das, was der jeweilige Bildschirm auch auflistet:
 * state.chats im Messenger, state.communityChats im Bereich Communitys,
 * die ungelesenen Mitteilungen hinter der Glocke im Profil bei Videos.
 * Archivierte und der gerade offene Chat bleiben draussen - der gilt als
 * gelesen, solange man darin steht.
 *
 * Das Feld am Chat heisst `unread` (so liefert es der Server) - nicht
 * `unreadCount` wie in den App-Mocks. Genau daran haben die Zaehler beim
 * ersten Anlauf nichts angezeigt, und genau deshalb wird jede Aenderung hier
 * am Bild geprueft und nicht nur an gruenen Pruefungen.
 */
function ungelesen() {
  const weg = state.archiviert || [];
  const zaehle = (liste) =>
    (liste || [])
      .filter((c) => !weg.includes(c.id) && c.id !== state.openChatId)
      .reduce((summe, c) => summe + (c.unread || 0), 0);

  const messenger = zaehle(state.chats);
  const commChats = zaehle(state.communityChats);
  const commMitteilungen = state.ungelesen?.communities || 0;
  const videos = state.ungelesen?.videos || 0;
  const communities = commChats + commMitteilungen;

  return {
    bereich: { messenger, communities, videos, settings: 0 },
    unterpunkt: {
      messenger: { chats: messenger },
      // Mitteilungen liegen hinter der Glocke im eigenen Profil - deshalb
      // steht ihr Zaehler auf dem Unterpunkt "Profil", nicht auf "Home".
      communities: { chats: commChats, profile: commMitteilungen },
      videos: { profile: videos },
      settings: {},
    },
  };
}

/** Kleiner roter Zaehler. Ab 99 abgekuerzt, sonst sprengt er die Insel. */
function badge(zahl, klasse) {
  if (!zahl) return '';
  return `<span class="${klasse}">${zahl > 99 ? '99+' : zahl}</span>`;
}

// Untere Leiste: die vier Bereiche. Sie aendert sich nie.
function renderBottomNav() {
  const nav = $('#bottomnav');
  const zahlen = ungelesen().bereich;

  nav.innerHTML = AREAS.map((id) => `
    <button class="navbtn ${state.area === id ? 'is-active' : ''}" data-area="${id}">
      <span class="navbtn__icon">${ICONS[NAV[id].icon]}${badge(zahlen[id], 'navbtn__badge')}</span>
      <span class="navbtn__label">${NAV[id].label}</span>
    </button>`).join('');

  nav.querySelectorAll('[data-area]').forEach((b) =>
    b.addEventListener('click', () => {
      const ziel = b.dataset.area;
      /*
       * Jeder Bereich faengt auf seiner Hauptseite an - Messenger bei den
       * Chats, Videos und Communitys bei Home. Vorher merkte sich jeder
       * Bereich seinen zuletzt offenen Unterpunkt; wer den Messenger zuletzt
       * auf der Kamera verlassen hatte, landete beim naechsten Mal wieder
       * dort statt in der Chatliste.
       *
       * Beim erneuten Tippen auf den bereits offenen Bereich springt es
       * ebenfalls zurueck auf die Hauptseite - so wie in jeder App mit
       * unterer Leiste.
       */
      state.area = ziel;
      state.sub[ziel] = STARTPUNKT[ziel];
      verlasseExplorer();
      render();
    })
  );
}

/*
 * Wo jeder Bereich anfaengt. Aus dem Prototyp: Messenger -> Chats,
 * Videos -> Home, Communitys -> Home. Einstellungen haben nur eine Seite.
 */
const STARTPUNKT = { messenger: 'chats', videos: 'home', communities: 'home', settings: 'main' };

// Obere Leiste: die Unterpunkte des offenen Bereichs, als schwebende Insel.
function renderTopBar() {
  const bar = $('#topbar');
  const subs = NAV[state.area].subs;

  if (!subs.length) {
    bar.hidden = true;
    bar.innerHTML = '';
    main.classList.remove('main--insel');
    return;
  }

  bar.hidden = false;
  main.classList.add('main--insel');

  const zahlen = ungelesen().unterpunkt[state.area] || {};
  bar.innerHTML = subs.map((s) => `
    <button class="topbar__btn ${sub() === s.id ? 'is-active' : ''}" data-sub="${s.id}" title="${s.label}" aria-label="${s.label}">
      ${ICONS[s.icon]}${badge(zahlen[s.id], 'topbar__badge')}
    </button>`).join('');

  bar.querySelectorAll('[data-sub]').forEach((b) =>
    b.addEventListener('click', () => {
      state.sub[state.area] = b.dataset.sub;
      verlasseExplorer();
      render();
    })
  );
}

/*
 * Eine offene Uebersichtsseite der Video-Suche schliessen.
 *
 * Das war der Fehler hinter "nach Klick auf einen Unterpunkt buggt die ganze
 * App" (Henrik, 26.08.2026): render() prueft state.explorerView ganz oben und
 * kehrt sofort zurueck, wenn dort noch etwas steht. Wer eine Uebersichtsseite
 * offen hatte und dann irgendwohin tippte, bekam wieder dieselbe Seite - egal
 * welchen Bereich oder Unterpunkt er gewaehlt hatte. Die App wirkte fest.
 *
 * Deshalb raeumt jeder Navigationsklick den Zustand ab. Das ist die einzige
 * Stelle, an der er ausser vom Zurueck-Pfeil geleert wird.
 */
function verlasseExplorer() {
  state.explorerView = null;
  state.explorerParam = null;
  /*
   * Auch der Weg zurueck ins Profil gilt nur fuer den Besuch, aus dem er kam.
   * Wer die Einstellungen ueber die untere Leiste oeffnet, soll dort keinen
   * Zurueck-Pfeil sehen - es gibt kein "zurueck".
   */
  state.settingsAus = null;
  state.settingsPunkt = null;
  state.commProfilView = null;
  state.sammlung = null;
  /*
   * Auch die offene Community. Sie hatte denselben Fehler wie die
   * Uebersichtsseiten der Video-Suche: wer in einer Community stand und
   * unten auf einen Bereich tippte, bekam beim Zurueckkommen wieder dieselbe
   * Community statt der Liste - und beim Tippen auf "Communitys" selbst
   * passierte gar nichts sichtbar. Aufgefallen ist das erst, als die
   * Pruefung fuer die neue Kanalseite zweimal hintereinander oeffnen wollte.
   */
  state.openCommunityId = null;
  state.openChannelId = null;
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

  // Ausgewählte Kontakte für Standortfreigabe bearbeiten
  if (state.ausgewaehlteKontakteEdit) return renderAusgewaehlteKontakte();

  /*
   * Die Seite hinter einer Playlist bzw. einem Highlight. Sie steht ganz
   * oben, weil man sie auch von einem fremden Profil aus oeffnen kann - und
   * das liegt in einem beliebigen Bereich. Geleert wird sie vom Zurueck-Pfeil
   * und von jedem Navigationsklick (verlasseExplorer).
   */
  if (state.sammlung) return renderSammlung();

  // Explorer-Übersichtsseiten (Kategorien aus Video-Suche)
  if (state.explorerView) {
    if (state.explorerView === 'reels') return renderReelsExplorer();
    if (state.explorerView === 'clips') return renderClipsExplorer();
    if (state.explorerView === 'posts') return renderPostsExplorer();
    if (state.explorerView === 'hashtag') return renderHashtagExplorer(state.explorerParam);
    if (state.explorerView === 'place') return renderPlaceExplorer(state.explorerParam);
    if (state.explorerView === 'profile') return renderProfileExplorer();
    if (state.explorerView === 'hashtags') return renderHashtagsExplorer();
    if (state.explorerView === 'standorte') return renderStandorteExplorer();
    if (state.explorerView === 'sounds') return renderSoundsExplorer();
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
    // Die Seite hinter "Erstellt"/"Beigetreten". Sie wird hier mit
    // abgefragt, damit ein erneutes render() sie nicht wegwischt - und in
    // verlasseExplorer() geleert, damit sie nicht haengen bleibt.
    if (v === 'profile') return state.commProfilView ? renderCommunityListe() : renderCommunityProfile();
  }
  return renderSettings();
}

/* ---------------------------------------------------------- chats view */
function filteredChats() {
  const q = state.query.trim().toLowerCase();
  const weg = state.archiviert || [];
  return state.chats.filter((c) => {
    // Archivierte liegen unter Einstellungen > Messenger > Archivierte Chats.
    if (weg.includes(c.id)) return false;
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
          : state.query
          ? `<div class="empty">${ICONS.search}
              <div class="empty__title">Keine Treffer</div>
              <div class="empty__text">Für „${esc(state.query)}" wurde nichts gefunden.</div>
            </div>`
          : /*
             * Kein Suchbegriff und trotzdem nichts da: Das ist ein frisches
             * Konto, keine erfolglose Suche. "Keine Treffer" waere hier
             * schlicht falsch - der Nutzer hat nichts gesucht.
             */
            `<div class="empty">${ICONS.chat}
              <div class="empty__title">${
                state.filter === 'groups'
                  ? 'Noch keine Gruppen'
                  : state.filter === 'contacts'
                  ? 'Noch keine Kontakte'
                  : 'Noch keine Chats'
              }</div>
              <div class="empty__text">
                ${
                  state.filter === 'groups'
                    ? 'Lege eine Gruppe an und hole die Leute dazu, mit denen du gemeinsam schreiben willst.'
                    : 'Such dir jemanden über das Plus oben rechts — dann steht hier euer Verlauf.'
                }
              </div>
              <button class="prof__btn is-primary empty__knopf" id="chatLeerNeu">
                ${state.filter === 'groups' ? 'Gruppe anlegen' : 'Person suchen'}
              </button>
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
  // Der Knopf im leeren Zustand fuehrt an dieselbe Stelle wie das Plus oben.
  $('#chatLeerNeu')?.addEventListener('click', openNewMenu);
  main.querySelectorAll('.pill').forEach((p) =>
    p.addEventListener('click', () => {
      state.filter = p.dataset.filter;
      renderChats();
    })
  );
  main.querySelectorAll('[data-chat]').forEach((r) =>
    r.addEventListener('click', () => openChat(r.dataset.chat))
  );
  bindChatVerwaltung();
  bindStoryRail();
}

/*
 * Chats verwalten wie bei WhatsApp.
 *
 * Henrik: "Messenger- und Community-Chats sollen sich wie bei WhatsApp
 * verwalten lassen: nach links swipen oder lange gedrueckt halten - Optionen
 * wie Archivieren, Loeschen und weitere Chat-Einstellungen anzeigen."
 *
 * Umgesetzt sind langes Druecken und Wischen nach links. Beides fuehrt zum
 * selben Blatt - am Rechner gibt es keine Wischgeste, und mit der Tastatur
 * waere eine reine Wischloesung gar nicht bedienbar.
 */
function bindChatVerwaltung() {
  main.querySelectorAll('[data-chat]').forEach((zeile) => {
    const id = zeile.dataset.chat;
    let halten;
    let startX = null;
    let langGedrueckt = false;

    const oeffnen = () => {
      langGedrueckt = true;
      chatOptionen(id);
    };

    zeile.addEventListener('pointerdown', (e) => {
      langGedrueckt = false;
      startX = e.clientX;
      halten = setTimeout(oeffnen, 550);
    });

    const abbrechen = () => clearTimeout(halten);
    zeile.addEventListener('pointerup', abbrechen);
    zeile.addEventListener('pointerleave', abbrechen);
    zeile.addEventListener('pointercancel', abbrechen);

    // Wischen nach links: ab 60 Pixeln zaehlt es als Geste.
    zeile.addEventListener('pointermove', (e) => {
      if (startX === null) return;
      if (startX - e.clientX > 60) {
        clearTimeout(halten);
        startX = null;
        oeffnen();
      }
    });

    // Nach langem Druecken oder Wischen soll der Chat nicht auch noch aufgehen.
    zeile.addEventListener('click', (e) => {
      if (langGedrueckt) {
        e.preventDefault();
        e.stopImmediatePropagation();
        langGedrueckt = false;
      }
    }, true);
  });
}

/** Das Blatt mit den Optionen zu einem Chat. */
function chatOptionen(chatId) {
  const chat =
    state.chats.find((c) => c.id === chatId) ||
    (state.communityChats || []).find((c) => c.id === chatId);
  if (!chat) return;

  const archiviert = (state.archiviert || []).includes(chatId);

  /*
   * Punkt 15: das Blatt sah aus wie eine nackte Liste. WhatsApp zeigt beim
   * langen Druecken zuerst, um wen es ueberhaupt geht - Bild, Name, Zustand -
   * und setzt das Loeschen von den harmlosen Punkten ab. Genau das hier:
   * Kopfzeile mit Avatar, darunter die Aktionen, das Loeschen abgetrennt.
   */
  const zustand = chat.isGroup
    ? `${((chat.members || []).length + 1).toLocaleString('de-DE')} Mitglieder`
    : archiviert
      ? 'Im Archiv'
      : chat.muted
        ? 'Stummgeschaltet'
        : 'Online';

  openSheet(
    chat.name,
    `<div class="coptkopf">
      ${avatarOf(chat, 54)}
      <div class="coptkopf__text">
        <div class="coptkopf__name">${esc(chat.name)}</div>
        <div class="coptkopf__sub">${esc(zustand)}</div>
      </div>
    </div>
    <button class="item" data-copt="archiv">
      <span class="item__icon">${ICONS.bookmark}</span>
      <span class="item__label">${archiviert ? 'Aus dem Archiv holen' : 'Archivieren'}</span>
    </button>
    <button class="item" data-copt="stumm">
      <span class="item__icon">${ICONS.mute}</span>
      <span class="item__label">${chat.muted ? 'Stummschaltung aufheben' : 'Stummschalten'}</span>
    </button>
    <button class="item" data-copt="gelesen">
      <span class="item__icon">${ICONS.checkDouble}</span>
      <span class="item__label">${chat.unread ? 'Als gelesen markieren' : 'Als ungelesen markieren'}</span>
    </button>
    <button class="item" data-copt="einstellungen">
      <span class="item__icon">${ICONS.settings}</span>
      <span class="item__label">Chat-Einstellungen</span>
      <span class="row__chevron">${ICONS.chevron}</span>
    </button>
    <div class="copt__trenner"></div>
    <button class="item item--danger" data-copt="loeschen">
      <span class="item__icon">${ICONS.trash || ICONS.close}</span>
      <span class="item__label">Chat löschen</span>
    </button>`,
    (sheet, close) => {
      sheet.querySelectorAll('[data-copt]').forEach((b) =>
        b.addEventListener('click', async () => {
          const was = b.dataset.copt;
          close();

          if (was === 'einstellungen') return openChatSettings(chatId);

          const antwort = await fetch(`/api/chats/${chatId}/${was}`, { method: 'POST' })
            .then((r) => r.json())
            .catch(() => ({ ok: false, error: 'Das hat gerade nicht geklappt' }));

          if (!antwort.ok) return toast(antwort.error || 'Das hat gerade nicht geklappt');

          await bootstrap();
          toast(antwort.meldung);
        })
      );
    }
  );
}

function chatRow(c) {
  const mediaIcon = c.mediaPreview === 'image' ? ICONS.image : c.mediaPreview === 'audio' ? ICONS.mic : '';
  /*
   * Ein gesperrter Chat zeigt keine Vorschau - das ist der halbe Sinn der
   * Sperre. Statt des Textes steht dort ein Schloss.
   */
  const vorschau = c.gesperrt
    ? `<span class="row__preview row__preview--gesperrt">${ICONS.lock}Gesperrt</span>`
    : `<span class="row__preview">${mediaIcon}${esc(c.preview)}</span>`;
  return `
    <li>
      <button class="row ${c.unread ? 'is-unread' : ''}" data-chat="${c.id}">
        ${avatarOf(c, 54)}
        <div class="row__body">
          <div class="row__top">
            <span class="row__name">${esc(c.name)}</span>
            <span class="row__time">${esc(c.time)}</span>
          </div>
          <div class="row__bottom">
            ${vorschau}
            <span class="row__meta">
              ${c.gesperrt ? ICONS.lock : ''}
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

/**
 * Aufnahme oder Galeriebild holen und als Datenadresse zurueckgeben.
 * `ausGalerie` laesst das capture-Kennzeichen weg, damit das Handy den
 * Bildordner statt der Kamera oeffnet (Punkt 18).
 */
async function aufnahmeHolen(art = 'photo', ausGalerie = false) {
  const datei = await dateiWaehlen(art, ausGalerie);
  if (!datei) return null;

  try {
    // Vom Video wird das erste Standbild genommen - so hat die Aufnahme auch
    // dann ein Bild, wenn das Video selbst nicht abgespielt werden kann.
    const bild = art === 'video' ? await videoStandbild(datei) : await bildVerkleinern(datei);
    if (!bild) {
      toast('Aus dieser Aufnahme ließ sich kein Bild gewinnen');
      return null;
    }
    return bild;
  } catch {
    toast('Aufnahme konnte nicht gelesen werden');
    return null;
  }
}

/** Ein fertiges Bild als eigene Story setzen. */
function alsStorySetzen(bild) {
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
}

/** Dateiauswahl oeffnen und das Ergebnis als eigene Story uebernehmen. */
async function storyAufnehmen(art = 'photo', ausGalerie = false) {
  const bild = await aufnahmeHolen(art, ausGalerie);
  if (bild) alsStorySetzen(bild);
}

/*
 * Punkt 17: die Kamera nimmt auf und fragt danach, was mit der Aufnahme
 * geschehen soll. Vorher landete jedes Foto stillschweigend in der Story -
 * wer es jemandem schicken wollte, musste den Umweg ueber den Chat nehmen.
 */
async function aufnahmeVerwenden(art = 'photo', ausGalerie = false) {
  const bild = await aufnahmeHolen(art, ausGalerie);
  if (bild) aufnahmeMenue(bild);
}

/** Die Frage selbst - getrennt, weil die Kamera im Overlay sie auch braucht. */
function aufnahmeMenue(bild) {
  const punkte = [
    { key: 'story', label: 'Zu deiner Story hinzufügen', icon: 'camera' },
    { key: 'chat', label: 'An einen Chat senden', icon: 'chat' },
    { key: 'beitrag', label: 'Als Beitrag veröffentlichen', icon: 'image' },
  ];

  openSheet(
    'Was möchtest du damit machen?',
    `<div class="sheet__body">
       <div class="aufnahme__vorschau" style="background-image:url(${bild})"></div>
       ${punkte
         .map(
           (p) => `<button class="item" data-verwenden="${p.key}">
             <span class="item__icon">${ICONS[p.icon]}</span>
             <span class="item__label">${esc(p.label)}</span>
             <span class="row__chevron">${ICONS.chevron}</span>
           </button>`
         )
         .join('')}
     </div>`,
    (sheet, close) => {
      sheet.querySelectorAll('[data-verwenden]').forEach((b) =>
        b.addEventListener('click', () => {
          close();
          if (b.dataset.verwenden === 'story') return alsStorySetzen(bild);
          if (b.dataset.verwenden === 'chat') return aufnahmeAnChat(bild);
          aufnahmeAlsBeitrag(bild);
        })
      );
    },
    { schliessen: true }
  );
}

/** Aufnahme in einen Chat schicken - erst fragen, in welchen. */
function aufnahmeAnChat(bild) {
  const auswahl = state.chats.filter((c) => c.requestState !== 'pending');
  if (!auswahl.length) return toast('Du hast noch keinen Chat, in den das passt');

  openSheet(
    'An welchen Chat?',
    `<div class="sheet__body">${auswahl
      .map(
        (c) => `<button class="item" data-zielchat="${c.id}">
          <span class="item__icon">${ICONS.chat}</span>
          <span class="item__label">${esc(c.name)}</span>
          <span class="row__chevron">${ICONS.chevron}</span>
        </button>`
      )
      .join('')}</div>`,
    (sheet, close) => {
      sheet.querySelectorAll('[data-zielchat]').forEach((b) =>
        b.addEventListener('click', async () => {
          close();
          const chat = state.chats.find((c) => c.id === b.dataset.zielchat);
          const res = await fetch(`/api/messages/${chat.id}/anhang`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ art: 'foto' }),
          });
          const daten = await res.json();
          if (!daten.ok) return toast(daten.error);

          eigenesMediumSichern(daten.message.id, bild);
          state.messages.push(daten.message);
          toast(`An ${chat.name} gesendet`);
          openChat(chat.id);
        })
      );
    },
    { schliessen: true, hoch: true }
  );
}

/** Aufnahme als Beitrag veroeffentlichen - Beschreibung und Ort dazu. */
function aufnahmeAlsBeitrag(bild) {
  openFormular(
    'Neuer Beitrag',
    [
      { key: 'beschreibung', label: 'Beschreibung', typ: 'mehrzeilig', pflicht: true },
      { key: 'ort', label: 'Ort (freiwillig)', platzhalter: 'z. B. Köln' },
    ],
    async (werte) => {
      const res = await fetch('/api/eigene/beitrag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...werte, format: 'hoch' }),
      });
      const daten = await res.json();
      if (!daten.ok) return daten.error;

      eigenesMediumSichern((daten.beitrag || daten.video || daten.clip).id, bild);
      state.area = 'videos';
      state.sub.videos = 'home';
      await bootstrap();
      toast('Beitrag veröffentlicht');
    },
    'Veröffentlichen'
  );
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
          ? // Punkt 16: "Ausstehende Anfragen" steht ueber den Kontakten.
            // Eine offene Anfrage will beantwortet werden - sie gehoert nach
            // oben, nicht ans Ende einer langen Kontaktliste.
            `${pending.length ? `<div class="listhead">Ausstehende Anfragen</div><ul class="rows">${pending.map(item).join('')}</ul>` : ''}
             ${friends.length ? `<div class="listhead">Kontakte auf All Media</div><ul class="rows">${friends.map(item).join('')}</ul>` : ''}`
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
/*
 * Der Kopf eines Blattes. Als eigene Funktion, weil ein Blatt seinen Inhalt
 * auch nachtraeglich ersetzen kann (siehe openChatSettings) - und dabei
 * denselben Kopf wieder braucht. Vorher stand die Form nur hier inline, und
 * ein neu gezeichnetes Blatt verlor seinen Schliessen-Knopf.
 */
function sheetKopf(title, mitX) {
  return mitX
    ? `<div class="sheet__kopf">
         <button class="sheet__x" data-sheet-close aria-label="Zurück">${ICONS.chevron}</button>
         <div class="sheet__titel-mitte">${esc(title)}</div>
       </div>`
    : `<div class="sheet__handle"></div>
       <div class="sheet__title">${esc(title)}</div>`;
}

/*
 * Ein Blatt nach unten wegziehen.
 *
 * Henrik am 26.08.2026, Punkt 23: "Kommentar-Sheet schließt nicht durch
 * Downswipe." Es gab nur den Weg ueber das X oder einen Klick daneben - beide
 * verlangen, dass man genau trifft, waehrend der Daumen ohnehin schon auf dem
 * Blatt liegt.
 *
 * Als eigene Funktion, weil es fuer jedes Blatt gilt und nicht nur fuer die
 * Kommentare. Zwei Regeln halten die Geste aus dem Weg des normalen
 * Bedienens:
 *
 *   1. Gezogen wird nur, wenn der Inhalt oben steht. Sonst waere Scrollen in
 *      einer langen Liste nicht mehr moeglich - jeder Zug nach unten wuerde
 *      das Blatt schliessen statt zu blaettern.
 *   2. Erst ab 90px oder einem schnellen Zug faellt es zu. Ein kurzes
 *      Verrutschen federt zurueck.
 */
function ziehenZumSchliessen(blatt, zumachen) {
  let startY = null;
  let startZeit = 0;
  let weg = 0;

  const scrollbar = () => blatt.querySelector('.sheet__body, .scroll') || blatt;

  blatt.addEventListener(
    'touchstart',
    (e) => {
      // Nur wenn oben - siehe Regel 1.
      if (scrollbar().scrollTop > 0) return;
      startY = e.touches[0].clientY;
      startZeit = Date.now();
      weg = 0;
      blatt.style.transition = 'none';
    },
    { passive: true }
  );

  blatt.addEventListener(
    'touchmove',
    (e) => {
      if (startY === null) return;
      weg = e.touches[0].clientY - startY;
      // Nach oben ziehen tut nichts - das Blatt sitzt bereits am Anschlag.
      if (weg <= 0) return;
      blatt.style.transform = `translateY(${weg}px)`;
    },
    { passive: true }
  );

  const loslassen = () => {
    if (startY === null) return;
    const schnell = weg > 40 && Date.now() - startZeit < 300;
    blatt.style.transition = 'transform .2s ease';

    if (weg > 90 || schnell) {
      blatt.style.transform = 'translateY(100%)';
      setTimeout(zumachen, 180);
    } else {
      blatt.style.transform = '';
    }
    startY = null;
  };

  blatt.addEventListener('touchend', loslassen);
  blatt.addEventListener('touchcancel', loslassen);
}

function openSheet(title, bodyHtml, onMount, opts = {}) {
  const sheet = document.createElement('div');
  sheet.className = 'sheet-backdrop';
  sheet.innerHTML = `
    <div class="sheet ${opts.hoch ? 'sheet--tall' : ''}" role="dialog" aria-label="${esc(title)}">
      ${sheetKopf(title, opts.schliessen)}
      ${bodyHtml}
    </div>`;
  document.querySelector('.app').appendChild(sheet);

  /*
   * Ein Blatt kann auf drei Wegen zugehen: Klick daneben, Klick auf das X,
   * oder von innen ueber close(). `beimSchliessen` laeuft in allen drei
   * Faellen genau einmal - bestaetigen() haengt daran und wartet auf die
   * Antwort.
   */
  let schonZu = false;
  const zumachen = () => {
    if (schonZu) return;
    schonZu = true;
    sheet.remove();
    opts.beimSchliessen?.();
  };

  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) zumachen();
  });
  sheet.querySelector('[data-sheet-close]')?.addEventListener('click', zumachen);

  ziehenZumSchliessen(sheet.querySelector('.sheet'), zumachen);

  onMount?.(sheet, zumachen);
  return sheet;
}

/*
 * Eigenes Profil bearbeiten. Henrik: "Profilbild, Name, Info/Bio, Link usw.
 * ueber eine Bearbeitungseinstellung aendern koennen."
 *
 * Das Bild bleibt im Browser - der Server teilt seinen Speicher mit allen
 * Besuchern, so wie schon bei "Deine Story". Auf dem Server steht nur die
 * Ersatzfarbe.
 */
const PROFILBILD_SPEICHER = 'allmedia.eigenesProfilbild';

function eigenesProfilbildLaden() {
  try {
    return localStorage.getItem(PROFILBILD_SPEICHER) || null;
  } catch {
    return null;
  }
}

function eigenesProfilbildSichern(datenUri) {
  try {
    if (datenUri) localStorage.setItem(PROFILBILD_SPEICHER, datenUri);
    else localStorage.removeItem(PROFILBILD_SPEICHER);
  } catch {
    /* Speicher voll oder gesperrt - dann bleibt es bei den Initialen. */
  }
}

// Auswahl der Ersatzfarbe, wenn kein Bild hinterlegt ist.
// Verläufe statt einzelner Farben - dieselben Paare wie in der App
// (app/constants/design.ts, AVATAR_PAIRS), damit ein Profil auf beiden
// Wegen gleich aussieht.
const PROFILFARBEN = [
  'linear-gradient(135deg,#7C6BF0,#4B32C9)',
  'linear-gradient(135deg,#FFB877,#EE5F2A)',
  'linear-gradient(135deg,#93AEFF,#4152D8)',
  'linear-gradient(135deg,#FBA0C4,#DC3F7C)',
  'linear-gradient(135deg,#6FE2D0,#12907F)',
  'linear-gradient(135deg,#C4A4F7,#7C46EE)',
  'linear-gradient(135deg,#A3B6F7,#5062D0)',
  'linear-gradient(135deg,#FCA2BC,#E04570)',
];

function openProfilBearbeiten(fertig) {
  const me = state.users.me;
  const profil = state.eigenesProfil || {};
  const bild = eigenesProfilbildLaden();

  openSheet(
    'Profil bearbeiten',
    `<div class="sheet__body">
      <div class="bearbeiten__bild">
        <div class="avatar avatar--88" id="pbVorschau" style="background:${me.color}">
          ${bild ? `<img src="${bild}" alt="" />` : esc(me.initials)}
        </div>
        <div class="bearbeiten__bildaktionen">
          <button class="pill is-active" id="pbWaehlen">Bild wählen</button>
          ${bild ? '<button class="pill" id="pbEntfernen">Entfernen</button>' : ''}
        </div>
        <input type="file" accept="image/*" id="pbDatei" hidden />
      </div>

      <label class="feld">
        <span class="feld__label">Name</span>
        <input class="feld__eingabe" id="pbName" value="${esc(me.name)}" maxlength="40" />
      </label>

      <label class="feld">
        <span class="feld__label">Info</span>
        <textarea class="feld__eingabe feld__eingabe--mehrzeilig" id="pbBio" rows="3" maxlength="150">${esc(profil.bio || '')}</textarea>
        <span class="feld__zaehler" id="pbZaehler"></span>
      </label>

      <label class="feld">
        <span class="feld__label">Link</span>
        <input class="feld__eingabe" id="pbLink" value="${esc(profil.link || '')}" placeholder="deine-seite.de" />
      </label>

      <div class="feld">
        <span class="feld__label">Farbe, wenn kein Bild gewählt ist</span>
        <div class="farbwahl">
          ${PROFILFARBEN.map(
            (f) =>
              `<button class="farbwahl__punkt ${f === me.color ? 'is-gewaehlt' : ''}" data-farbe="${f}" style="background:${f}" aria-label="Farbe ${f}"></button>`
          ).join('')}
        </div>
      </div>
    </div>
    <div class="sheet__footer">
      <button class="btn btn--primary" id="pbSichern">Merken</button>
    </div>`,
    (sheet, close) => {
      let farbe = me.color;
      let neuesBild = bild;

      const zaehler = sheet.querySelector('#pbZaehler');
      const bio = sheet.querySelector('#pbBio');
      const zaehlerAktualisieren = () => {
        zaehler.textContent = `${bio.value.length}/150`;
      };
      bio.addEventListener('input', zaehlerAktualisieren);
      zaehlerAktualisieren();

      sheet.querySelectorAll('[data-farbe]').forEach((b) =>
        b.addEventListener('click', () => {
          farbe = b.dataset.farbe;
          sheet.querySelectorAll('[data-farbe]').forEach((x) => x.classList.remove('is-gewaehlt'));
          b.classList.add('is-gewaehlt');
          const vorschau = sheet.querySelector('#pbVorschau');
          if (!neuesBild) vorschau.style.background = farbe;
        })
      );

      sheet.querySelector('#pbWaehlen').addEventListener('click', () => sheet.querySelector('#pbDatei').click());

      sheet.querySelector('#pbDatei').addEventListener('change', async (e) => {
        const datei = e.target.files?.[0];
        if (!datei) return;
        neuesBild = await bildVerkleinern(datei, 400);
        sheet.querySelector('#pbVorschau').innerHTML = `<img src="${neuesBild}" alt="" />`;
      });

      sheet.querySelector('#pbEntfernen')?.addEventListener('click', () => {
        neuesBild = null;
        const vorschau = sheet.querySelector('#pbVorschau');
        vorschau.innerHTML = esc(state.users.me.initials);
        vorschau.style.background = farbe;
      });

      sheet.querySelector('#pbSichern').addEventListener('click', async () => {
        const antwort = await fetch('/api/eigene/profil', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: sheet.querySelector('#pbName').value,
            bio: bio.value,
            link: sheet.querySelector('#pbLink').value,
            color: farbe,
          }),
        }).then((r) => r.json());

        if (!antwort.ok) return toast(antwort.error);

        eigenesProfilbildSichern(neuesBild);
        Object.assign(state.users.me, {
          name: antwort.profil.name,
          initials: antwort.profil.initials,
          color: antwort.profil.color,
        });
        state.eigenesProfil = { ...state.eigenesProfil, bio: antwort.profil.bio, link: antwort.profil.link };

        close();
        toast('Profil gespeichert');
        fertig?.();
      });
    },
    { schliessen: true, hoch: true }
  );
}

/* Verkleinert ein gewaehltes Bild, bevor es im Browser abgelegt wird -
   sonst sprengt es den Platz im localStorage. */
function bildVerkleinern(datei, maxKante) {
  return new Promise((fertig) => {
    const leser = new FileReader();
    leser.onload = () => {
      const bild = new Image();
      bild.onload = () => {
        const faktor = Math.min(1, maxKante / Math.max(bild.width, bild.height));
        const flaeche = document.createElement('canvas');
        flaeche.width = Math.round(bild.width * faktor);
        flaeche.height = Math.round(bild.height * faktor);
        flaeche.getContext('2d').drawImage(bild, 0, 0, flaeche.width, flaeche.height);
        fertig(flaeche.toDataURL('image/jpeg', 0.85));
      };
      bild.src = leser.result;
    };
    leser.readAsDataURL(datei);
  });
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
                <span>Videoübertragung kommt bald</span>
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
      'Merken'
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
          ${/*
              Punkt 12: "Story von fremdem Profil öffnet nicht."
              Der Ring war ein <div> ohne jede Verdrahtung - er sah aus wie
              eine laufende Story und war doch nur Zierde. Jetzt traegt ihn
              ein Knopf, aber nur, wenn diese Person auch wirklich eine Story
              hat; sonst bliebe der Ring ein Versprechen ohne Inhalt.
            */ ''}
          ${
            state.stories.some((st) => st.userId === userId)
              ? `<button class="story__ring" data-profilstory="${esc(userId)}" style="width:88px;height:88px;padding:3px" aria-label="Story von ${esc(profile.name)} ansehen">
                   <span class="story__inner" style="background:${profile.color};font-size:28px">${esc(profile.initials)}</span>
                 </button>`
              : `<div class="story__ring is-viewed" style="width:88px;height:88px;padding:3px">
                   <div class="story__inner" style="background:${profile.color};font-size:28px">${esc(profile.initials)}</div>
                 </div>`
          }
          <div class="prof__stats">
            <button class="prof__stat" data-stat="posts"><strong>${compactNumber(profile.posts)}</strong><span>Beiträge</span></button>
            <button class="prof__stat" data-stat="followers"><strong>${compactNumber(profile.followers)}</strong><span>Follower</span></button>
            <button class="prof__stat" data-stat="following"><strong>${compactNumber(profile.following)}</strong><span>Gefolgt</span></button>
          </div>
        </div>

        <div class="prof__about">
          <div class="prof__name">${esc(profile.name)}</div>
          <div class="prof__bio">${esc(profile.bio)}</div>
          ${/* Ein echter Link, der im Browser aufgeht - vorher stand hier
                href="#" und ein Klick gab nur die Adresse als Hinweis aus.
                Das war Henriks Punkt 9. bioLink macht daraus dasselbe
                target="_blank"-Element wie im eigenen Profil. */ ''}
          ${bioLink(profile.link)}
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
            ? // Dieselbe Reihe wie im eigenen Profil - vorher standen die
              // Highlights hier als nicht klickbare Story-Kreise.
              sammlungenReihe(profile.id, profile.playlists, profile.highlights)
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
    bindSammlungen(overlay);

    // Punkt 12: der Story-Ring auf einem fremden Profil oeffnet die Story.
    overlay.querySelector('[data-profilstory]')?.addEventListener('click', () => {
      const story = state.stories.find((st) => st.userId === userId);
      if (!story) return;
      closeOverlay();
      openStory(story.id);
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

    /*
     * Punkt 23: nach unten wegziehen. Dieses Blatt baut sein Markup selbst
     * und geht nicht durch openSheet, deshalb wird die Geste hier
     * eingehaengt - und weil paint() den Inhalt bei jedem Like neu aufbaut,
     * muss das am Ende von paint() stehen und nicht daneben.
     */
    ziehenZumSchliessen(sheet.querySelector('.sheet'), () => sheet.remove());

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

/*
 * Eine Kommentarzeile.
 *
 * Henrik am 26.08.2026, Punkt 24: "Keine Anzahl der Likes unter Kommentaren."
 * Sie stand zwar in der Metazeile ("14:02 · 3 Gefällt mir"), aber nur wenn es
 * ueberhaupt Likes gab, und dort sucht sie niemand. Jetzt steht sie unter dem
 * Herz rechts - genau dort, wo man sie von Instagram und TikTok her erwartet,
 * und direkt neben dem Knopf, der sie veraendert.
 */
function commentRow(c) {
  const u = user(c.userId);
  return `
    <div class="comment">
      <div class="avatar avatar--36" style="background:${u.color}">${esc(u.initials)}</div>
      <div class="comment__body">
        <div class="comment__text"><strong data-profile="${c.userId}">${esc(u.name)}</strong> ${esc(c.text)}</div>
        <div class="comment__meta">${esc(c.time)}</div>
      </div>
      <button class="comment__like ${c.liked ? 'is-on' : ''}" data-clike="${c.id}" aria-label="${
        c.likes ? `Gefällt mir, ${c.likes} mal` : 'Gefällt mir'
      }">
        ${ICONS.heart}
        <span class="comment__likes">${c.likes || ''}</span>
      </button>
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
  /*
   * Punkt 21: "Klick auf das Profilbild zeigt 'Keine Story' statt zum Profil
   * zu gehen."
   *
   * Zwei Dinge waren falsch. Erstens ging ohne Story nur ein Hinweis auf -
   * ein Profilbild soll aber zum Profil fuehren, wenn es nichts anderes zu
   * zeigen gibt. Zweitens bekam openStory die Kennung der PERSON statt die
   * der Story; selbst mit Story waere also nichts aufgegangen.
   */
  main.querySelectorAll('[data-story-user]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const userId = btn.dataset.storyUser;
      const story = state.stories.find((s) => s.userId === userId);
      if (story) return openStory(story.id);
      openProfile(userId);
    })
  );

  main.querySelectorAll('[data-paction]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const { paction, pid } = btn.dataset;

      if (paction === 'comment') {
        return openComments(pid, (count) => {
          const idx = state.posts.findIndex((x) => x.id === pid);
          state.posts[idx] = { ...state.posts[idx], comments: count };
          /*
           * Henrik am 26.08.2026, Punkt 25: "Angezeigte Anzahl ≠ echte
           * Anzahl." Der Zustand wurde zwar mitgezaehlt, aber niemand hat es
           * dem Knopf gesagt - der Feed wird nicht neu gebaut, solange man
           * darin steht. Also den Text direkt setzen; ein render() waere
           * hier falsch, das wuerde die Scrollposition verlieren.
           */
          const knopf = main.querySelector(`.post__comments[data-pid="${pid}"]`);
          if (knopf) knopf.textContent = kommentarZeile(count);
        });
      }
      if (paction === 'share') return openTeilen('post', pid);

      // Nur der zuletzt gestartete Bildaufbau darf schreiben — siehe die
      // gleiche Stelle im Video-Feed.
      const lauf = renderLauf;

      const res = await fetch(`/api/posts/${pid}/${paction}`, { method: 'POST' });
      const updated = await res.json();
      const idx = state.posts.findIndex((p) => p.id === updated.id);
      state.posts[idx] = updated;

      // Punkt 42: Folgen gilt der Person, nicht dem einzelnen Beitrag - alle
      // ihre Beitraege im Feed ziehen mit, sonst widersprechen sie sich.
      if (paction === 'follow') {
        for (const p of state.posts) if (p.userId === updated.userId) p.following = updated.following;
      }

      if (paction === 'repost') toast(updated.reposted ? 'Repostet' : 'Repost zurückgenommen');
      if (paction === 'save') toast(updated.saved ? 'Gespeichert' : 'Nicht mehr gespeichert');
      if (paction === 'follow') toast(updated.following ? 'Du folgst jetzt' : 'Nicht mehr gefolgt');
      if (paction === 'notify') toast(updated.notify ? 'Benachrichtigungen an' : 'Benachrichtigungen aus');

      if (lauf !== renderLauf) return;

      const flaeche = $('#homeScroll');
      const scrollTop = flaeche ? flaeche.scrollTop : 0;
      renderHomeFeed();
      const neueFlaeche = $('#homeScroll');
      if (neueFlaeche) neueFlaeche.scrollTop = scrollTop;
    })
  );
}

function postCard(p) {
  const u = user(p.userId);
  return `
    <article class="post" id="post-${p.id}">
      <header class="post__head">
        ${/*
            Das Attribut heisst bewusst data-story-user und nicht
            data-openStory: HTML schreibt Attributnamen klein, aus
            data-openStory wird data-openstory - und dataset.openStory liest
            data-open-story. Der Wert war deshalb immer undefined, und der
            Klick auf ein Profilbild im Feed hat nie etwas geoeffnet.
          */ ''}
        <button class="story__ring story-ring-btn" style="width:40px;height:40px;padding:2px" data-story-user="${p.userId}">
          <div class="story__inner" style="background:${u.color};font-size:13px">${esc(u.initials)}</div>
        </button>
        <div class="post__who">
          <button class="post__name" data-profile="${p.userId}">${esc(u.name)}</button>
          <div class="post__sub">
            ${p.location ? `<button class="post__meta" data-postort="${esc(p.location)}">${esc(p.location)}</button>` : ''}
            ${p.location && p.music ? '<span class="post__punkt">·</span>' : ''}
            ${p.music ? `<button class="post__meta" data-postsound="${esc(p.music)}">${esc(p.music)}</button>` : ''}
          </div>
        </div>
        ${/*
            Am eigenen Beitrag stehen weder "Folgen" noch die Glocke. Vorher
            konnte man sich selbst folgen und sich selbst benachrichtigen
            lassen - derselbe Fehler wie bei Punkt 62, wo sich die eigene
            Community verlassen liess.
          */ ''}
        ${
          p.userId === state.currentUserId
            ? ''
            : `<button class="post__follow ${p.following ? 'is-on' : ''}" data-paction="follow" data-pid="${p.id}">
                ${p.following ? 'Gefolgt' : 'Folgen'}
              </button>`
        }
        ${/*
            Punkt 22: die abgeschaltete Glocke traegt einen Strich. Vorher
            stand hier text-decoration: line-through - das wirkt auf Text und
            nicht auf ein SVG, es war also nie ein Strich zu sehen, nur ein
            blasses Grau. Jetzt ist es ein eigenes Symbol.

            Die Farbe kam ausserdem aus einer festen Angabe im Markup und war
            noch das alte Blau (#0A66FF), das die App sonst nirgends mehr
            benutzt. Sie steht jetzt im CSS und folgt der Marke.
          */ ''}
        ${
          p.userId === state.currentUserId
            ? ''
            : `<button class="post__bell ${p.notify ? 'is-on' : ''}" data-paction="notify" data-pid="${p.id}" aria-label="${
                p.notify ? 'Benachrichtigungen aus' : 'Benachrichtigungen an'
              }">
                ${p.notify ? ICONS.bell : ICONS.bellOff}
              </button>`
        }
      </header>

      <div class="post__media">${medienFlaeche(p.id, ICONS.image, p.mediaUrl)}</div>

      <div class="post__actions">
        <button class="postbtn ${p.liked ? 'is-liked' : ''}" data-paction="like" data-pid="${p.id}" aria-label="Gefällt mir">${ICONS.heart}</button>
        <button class="postbtn" data-paction="comment" data-pid="${p.id}" aria-label="Kommentieren">${ICONS.chat}</button>
        <button class="postbtn" data-paction="share" data-pid="${p.id}" aria-label="Senden">${ICONS.send}</button>
        <button class="postbtn ${p.reposted ? 'is-reposted' : ''}" data-paction="repost" data-pid="${p.id}" aria-label="Repost">
          ${ICONS.repeat}${p.reposts ? `<span class="postbtn__zahl">${p.reposts}</span>` : ''}
        </button>
        <button class="postbtn postbtn--end ${p.saved ? 'is-saved' : ''}" data-paction="save" data-pid="${p.id}" aria-label="Merken">${ICONS.bookmark}</button>
      </div>

      ${p.likes ? `<div class="post__likes">${likeZeile(p.likes, p.likedBy)}</div>` : ''}
      <div class="post__desc"><strong>${esc(u.name)}</strong> ${esc(p.description)}</div>
      <button class="post__comments" data-paction="comment" data-pid="${p.id}">
        ${kommentarZeile(p.comments)}
      </button>
    </article>`;
}

/*
 * Der Satz unter dem Beitrag richtet sich nach der Zahl. "Alle 3 Kommentare
 * ansehen" klingt falsch, wenn ohnehin alle drei ins Bild passen, und bei
 * null Kommentaren gibt es nichts anzusehen - dann lädt der Knopf zum
 * Schreiben ein.
 */
function kommentarZeile(anzahl) {
  if (!anzahl) return 'Kommentar schreiben';
  if (anzahl === 1) return '1 Kommentar ansehen';
  if (anzahl <= 3) return `${anzahl} Kommentare ansehen`;
  return `Alle ${anzahl} Kommentare ansehen`;
}

/*
 * Dasselbe fuer die Zeile ueber der Beschreibung. Sie stand vorher fest als
 * "Gefaellt <Name> und N weiteren Personen" - bei einem frischen Beitrag las
 * sich das als "Gefaellt und 0 weiteren Personen": kein Name, eine Null, und
 * ein Satz, der nicht aufgeht.
 *
 * Bei null Likes steht dort jetzt nichts. Das ist kein Mangel, sondern der
 * uebliche Zustand eines gerade veroeffentlichten Beitrags.
 */
function likeZeile(anzahl, ersterName) {
  if (!anzahl) return '';
  if (!ersterName) {
    return anzahl === 1 ? '1 Like' : `${compactNumber(anzahl)} Likes`;
  }
  const name = `<strong>${esc(ersterName)}</strong>`;
  if (anzahl === 1) return `Gefällt ${name}`;
  if (anzahl === 2) return `Gefällt ${name} und einer weiteren Person`;
  return `Gefällt ${name} und ${compactNumber(anzahl - 1)} weiteren Personen`;
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
          // Dieselbe Sache wie beim Beitrag - siehe dort.
          const zahl = main.querySelector(`[data-vaction="comment"][data-vid="${vid}"] span`);
          if (zahl) zahl.textContent = compactNumber(count);
        });
      }

      if (vaction === 'share') return openTeilen('video', vid);

      /*
       * Die Nummer des aktuellen Bildaufbaus merken.
       *
       * Der Klick geht zum Server und zurueck. Wer in dieser Zeit den
       * Bildschirm wechselt — und das ist eine Zehntelsekunde, kein
       * Kunststueck —, bekam den Hochformat-Feed hinterher wieder
       * uebergestuelpt: die Navigation zeigte "Querformat", der Inhalt war
       * der alte. Genauso beim Bild-Feed darunter.
       *
       * Dasselbe Mittel wie bei renderCommunityChannels: nur der zuletzt
       * gestartete Aufbau darf schreiben.
       */
      const lauf = renderLauf;

      const res = await fetch(`/api/videos/${vid}/${vaction}`, { method: 'POST' });
      const updated = await res.json();
      const idx = state.videos.findIndex((v) => v.id === updated.id);
      state.videos[idx] = updated;

      if (vaction === 'repost') toast(updated.reposted ? 'Repostet' : 'Repost zurückgenommen');
      if (vaction === 'save') toast(updated.saved ? 'Gespeichert' : 'Nicht mehr gespeichert');

      if (lauf !== renderLauf) return;

      // Die Scrollhoehe merken, damit der Feed nach dem Neuzeichnen nicht
      // nach oben springt.
      const feed = $('#feed');
      const scrollTop = feed ? feed.scrollTop : 0;
      renderVideoFeed();
      const neuerFeed = $('#feed');
      if (neuerFeed) neuerFeed.scrollTop = scrollTop;
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
      <div class="slide__stage">${medienFlaeche(v.id, ICONS.play, v.mediaUrl)}</div>

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
        <div class="slide__sub">
          ${v.location ? `<button class="slide__ziel" data-slideort="${esc(v.location)}">${esc(v.location)}</button>` : ''}
          ${v.location && v.music ? '<span class="slide__punkt">·</span>' : ''}
          ${v.music ? `<button class="slide__ziel" data-slidesound="${esc(v.music)}">${esc(v.music)}</button>` : ''}
        </div>
      </div>
    </section>`;
}

/* ---------------------------------------------------------- communities */
function communityAvatar(c, size = 52) {
  // Verlaeufe wie bei den Personen-Avataren, aber eigene Farbwege - eine
  // Community soll sich von einem Menschen unterscheiden lassen. Das
  // abgerundete Quadrat unten tut den Rest.
  const palette = [
    'linear-gradient(135deg,#93AEFF,#4152D8)',
    'linear-gradient(135deg,#6FE2D0,#12907F)',
    'linear-gradient(135deg,#FCA2BC,#E04570)',
    'linear-gradient(135deg,#FBD277,#D88F1C)',
    'linear-gradient(135deg,#C4A4F7,#7C46EE)',
    'linear-gradient(135deg,#75DCF2,#1791BA)',
  ];
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

/*
 * Aufbau einer Community nach dem Prototyp-Frame "CH + Kanal".
 *
 * Henrik: "Beim Oeffnen einer Community muss die Seite wie im Figma-Prototyp
 * auf 'CH+ Kanal' aufgebaut sein. Erst nach Auswahl eines Themas gelangt man
 * in den eigentlichen Chat."
 *
 * Es sind also drei Ebenen: Community -> Kanal -> Thema -> Chat. Vorher
 * standen hier drei fest eingetippte Kanaele, und der Klick fuehrte sofort in
 * einen Platzhalter-Chat. Die echten Kanaele und ihre Themen liegen auf dem
 * Server.
 */
async function renderCommunityChannels(communityId) {
  const lauf = ++renderLauf;
  const daten = await fetch(`/api/communities/${communityId}`).then((r) => r.json());
  if (lauf !== renderLauf) return;

  if (daten.error) {
    state.openCommunityId = null;
    return renderCommunities();
  }

  /*
   * Aufbau nach dem Prototyp-Frame "CH + Kanal". Henrik am 26.08.2026:
   * "Design ist völlig falsch, geht am Prototyp vorbei."
   *
   * Der Frame gibt von oben nach unten vor:
   *
   *   ←                                   Zurueck-Pfeil, frei ueber dem Bild
   *   [ grosses Kopfbild, 344x258 ]       also rund 4:3, fast volle Breite
   *   Name        Mitglieder     [Knopf]  eine Zeile, Knopf rechts
   *                  ...                  Mehr-Menue darunter
   *   Biografie
   *   Link
   *   (+) neues Unterthema erstellen
   *   # Unterthema                        Zeilen ueber die volle Breite
   *   # Unterthema
   *
   * Vorher stand hier eine schmale Kopfzeile mit Name und Untertitel und
   * darunter eine Liste im Stil der Chatliste - kein Kopfbild, keine
   * Biografie, kein Link, kein Weg, ein Unterthema anzulegen.
   */
  const eigen = !!daten.eigen;

  main.innerHTML = `
    <div class="kanal">
      <div class="kanal__bild">
        ${medienFlaeche('community-' + daten.id, ICONS.people)}
        <button class="kanal__zurueck" id="backBtn" aria-label="Zurück">${ICONS.back}</button>
      </div>

      <div class="kanal__kopfzeile">
        <button class="kanal__titel" id="communityKopf">
          <span class="kanal__name">${esc(daten.name)}</span>
          <span class="kanal__mitglieder">${daten.members.toLocaleString('de-DE')} Mitglieder</span>
        </button>
        ${
          /*
           * Der Knopf rechts. Eine eigene Community laesst sich nicht
           * verlassen - vorher konnte Henrik sich aus seiner eigenen
           * Community als Mitglied entfernen und stand dann davor.
           */
          eigen
            ? '<span class="kanal__eigen">Deine Community</span>'
            : // Beitreten traegt den Verlauf, Verlassen bleibt die leise
              // Kante - der Weg hinein soll der auffaellige sein.
              `<button class="btn ${daten.joined ? '' : 'btn--primary'}" data-join="${esc(daten.id)}">${
                daten.joined ? 'Verlassen' : daten.visibility === 'private' ? 'Anfrage' : 'Beitreten'
              }</button>`
        }
        ${/*
            Das "..." aus dem Frame. Dort steht es unter der Mitgliederzahl;
            hier sitzt es rechts in derselben Zeile. Auf einem echten Geraet
            stand es sonst allein unter dem Text und wirkte verloren - der
            Frame arbeitet mit dem Platzhalter "Name", echte Namen sind
            laenger und schieben die Zeile anders.
          */ ''}
        <button class="kanal__mehr" id="communityMehr" aria-label="Mehr">${ICONS.dots || '···'}</button>
      </div>

      ${daten.bio ? `<div class="kanal__bio">${esc(daten.bio)}</div>` : ''}
      ${daten.link ? `<div class="kanal__link">${bioLink(daten.link)}</div>` : ''}

      <button class="kanal__neu" id="neuesUnterthema">
        <span class="kanal__neu-kreis">${ICONS.plus}</span>
        <span>neues Unterthema erstellen</span>
      </button>

      <div class="kanal__themen">
        ${daten.channels
          .map(
            (ch) => `<button class="kanal__thema" data-channel="${esc(ch.id)}">
              <span class="kanal__thema-name"># ${esc(ch.name)}</span>
              <span class="kanal__thema-sub">${
                ch.topics.length ? ch.topics.map(esc).join(' · ') : 'Noch keine Themen'
              }</span>
            </button>`
          )
          .join('')}
      </div>
    </div>`;

  $('#backBtn').addEventListener('click', () => {
    state.openCommunityId = null;
    renderCommunities();
  });
  // Henrik: "Gruppennamen muessen anklickbar sein und zu den vorgesehenen
  // Einstellungen fuehren." Das gilt fuer den Namen und fuer das "...".
  const einstellungen = () => openCommunityEinstellungen(daten);
  $('#communityKopf').addEventListener('click', einstellungen);
  $('#communityMehr').addEventListener('click', einstellungen);

  $('#neuesUnterthema').addEventListener('click', () => neuesUnterthema(daten));

  main.querySelectorAll('[data-join]').forEach((b) =>
    b.addEventListener('click', async () => {
      await fetch(`/api/communities/${b.dataset.join}/join`, { method: 'POST' });
      const frisch = state.communities.find((c) => c.id === b.dataset.join);
      if (frisch) {
        frisch.joined = !frisch.joined;
        frisch.members += frisch.joined ? 1 : -1;
      }
      renderCommunityChannels(communityId);
    })
  );

  main.querySelectorAll('[data-channel]').forEach((b) =>
    b.addEventListener('click', () => {
      const kanal = daten.channels.find((ch) => ch.id === b.dataset.channel);
      renderKanalThemen(daten, kanal);
    })
  );
}

/*
 * "neues Unterthema erstellen" aus dem Prototyp-Frame "CH + Unterthema
 * erstellen". Vorher gab es den Punkt auf dieser Seite gar nicht.
 */
function neuesUnterthema(daten) {
  openFormular(
    'Neues Unterthema',
    [{ key: 'name', label: 'Name des Unterthemas', platzhalter: 'z. B. Ankündigungen', pflicht: true }],
    async ({ name }) => {
      const res = await fetch(`/api/communities/${daten.id}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }).then((r) => r.json());
      if (!res.ok) return res.error || 'Das hat nicht geklappt';
      toast(`„${name}" angelegt`);
      renderCommunityChannels(daten.id);
      return null;
    },
    'Anlegen'
  );
}

/** Zweite Ebene: die Themen eines Kanals. */
function renderKanalThemen(community, kanal) {
  main.innerHTML = `
    <div class="pagehead pagehead__row">
      <button class="back-btn" id="backBtn" aria-label="Zurück">${ICONS.back}</button>
      <button class="kanalkopf" id="kanalKopf">
        <span class="kanalkopf__name">#${esc(kanal.name)}</span>
        <span class="kanalkopf__sub">${esc(community.name)}</span>
      </button>
    </div>
    <div class="scroll">
      <div class="listhead">Themen</div>
      ${kanal.topics
        .map(
          (thema) => `
        <button class="row" data-thema="${esc(thema)}">
          <span class="avatar avatar--44" style="background:var(--surface-3);color:var(--text-2)">${ICONS.chat}</span>
          <div class="row__body">
            <div class="row__top"><span class="row__name">${esc(thema)}</span></div>
          </div>
          <span class="row__chevron">${ICONS.chevron}</span>
        </button>`
        )
        .join('')}
    </div>`;

  $('#backBtn').addEventListener('click', () => renderCommunityChannels(community.id));
  $('#kanalKopf').addEventListener('click', () => openCommunityEinstellungen(community));
  main.querySelectorAll('[data-thema]').forEach((b) =>
    b.addEventListener('click', () => renderCommunityChat(community, kanal, b.dataset.thema))
  );
}

/** Dritte Ebene: der Chat zu einem Thema. */
async function renderCommunityChat(community, kanal, thema) {
  const lauf = ++renderLauf;
  const daten = await fetch(`/api/communities/${community.id}/channels/${kanal.id}`)
    .then((r) => r.json())
    .catch(() => ({ messages: [] }));
  if (lauf !== renderLauf) return;

  const nachrichten = daten.messages || [];

  main.innerHTML = `
    <div class="pagehead pagehead__row">
      <button class="back-btn" id="backBtn" aria-label="Zurück">${ICONS.back}</button>
      <button class="kanalkopf" id="kanalKopf">
        <span class="kanalkopf__name">${esc(thema)}</span>
        <span class="kanalkopf__sub">#${esc(kanal.name)} · ${esc(community.name)}</span>
      </button>
    </div>
    <div class="messages" id="commMsgs">
      ${
        nachrichten.length
          ? nachrichten.map(kanalNachricht).join('')
          : `<div class="empty">${ICONS.chat}
              <div class="empty__title">Noch keine Nachricht</div>
              <div class="empty__text">Schreib die erste zu „${esc(thema)}".</div>
            </div>`
      }
    </div>
    <form class="composer" id="commForm">
      <div class="composer__field">
        <textarea id="commMsgInput" rows="1" placeholder="Nachricht schreiben ..."></textarea>
      </div>
      <button type="submit" class="composer__send" id="commSend" aria-label="Senden" disabled>${ICONS.send}</button>
    </form>`;

  $('#backBtn').addEventListener('click', () => renderKanalThemen(community, kanal));
  $('#kanalKopf').addEventListener('click', () => openCommunityEinstellungen(community));

  // Der Verlauf steht unten - wie in jedem Chat.
  const liste = $('#commMsgs');
  liste.scrollTop = liste.scrollHeight;

  const feld = $('#commMsgInput');
  const sendKnopf = $('#commSend');
  feld.addEventListener('input', () => {
    sendKnopf.disabled = !feld.value.trim();
  });
  // Enter sendet, Umschalt+Enter macht eine neue Zeile - wie im Einzelchat.
  feld.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $('#commForm').requestSubmit();
    }
  });

  $('#commForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = feld.value.trim();
    if (!text) return;
    feld.value = '';
    sendKnopf.disabled = true;

    await fetch(`/api/messages/${kanal.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    renderCommunityChat(community, kanal, thema);
  });
}

/*
 * Eine Nachricht im Kanal.
 *
 * Henrik: "Bei Nachrichten im Community-Chat links klein das Profilbild des
 * Absenders anzeigen. Anklicken fuehrt zum Profil." Beim eigenen Beitrag
 * steht kein Bild - man weiss, wer man ist.
 */
function kanalNachricht(m) {
  // Eigene Nachrichten behalten den bestehenden Aufbau: .msg IST die Blase.
  if (m.from === 'me') {
    return `<div class="msg msg--out">${esc(m.text)}<div class="msg__foot">${esc(m.time)}</div></div>`;
  }
  const u = user(m.from);
  return `<div class="msgzeile">
    <button class="msgzeile__avatar" data-profile="${esc(m.from)}" style="background:${u.color}" aria-label="Profil von ${esc(u.name)}">${esc(u.initials)}</button>
    <div class="msg msg--in">
      <button class="msg__sender" data-profile="${esc(m.from)}">${esc(u.name)}</button>
      ${esc(m.text)}
      <div class="msg__foot">${esc(m.time)}</div>
    </div>
  </div>`;
}

/** Einstellungen einer Community - erreichbar ueber den Namen im Kopf. */
function openCommunityEinstellungen(community) {
  openSheet(
    community.name,
    `<div class="sheet__body">
      <div class="item">
        <span class="item__icon">${ICONS.people}</span>
        <div class="item__body">
          <span class="item__label">Mitglieder</span>
          <span class="item__sub">${community.members.toLocaleString('de-DE')} in dieser Community</span>
        </div>
      </div>
      <div class="item">
        <span class="item__icon">${ICONS.lock}</span>
        <div class="item__body">
          <span class="item__label">Sichtbarkeit</span>
          <span class="item__sub">${community.visibility === 'private' ? 'Privat — nur auf Anfrage' : 'Öffentlich'}</span>
        </div>
      </div>
      <div class="item">
        <span class="item__icon">${ICONS.bell}</span>
        <span class="item__label">Benachrichtigungen</span>
        <button class="switch is-on" data-commtoggle="mitteilungen" aria-label="Benachrichtigungen"><span class="switch__knob"></span></button>
      </div>
      <button class="item item--danger" data-commaction="verlassen">
        <span class="item__icon">${ICONS.close}</span>
        <span class="item__label">Community verlassen</span>
      </button>
    </div>`,
    (sheet, close) => {
      sheet.querySelector('[data-commtoggle]')?.addEventListener('click', (e) => {
        e.currentTarget.classList.toggle('is-on');
        toast(e.currentTarget.classList.contains('is-on') ? 'Benachrichtigungen an' : 'Benachrichtigungen aus');
      });
      sheet.querySelector('[data-commaction="verlassen"]')?.addEventListener('click', async () => {
        close();
        await fetch(`/api/communities/${community.id}/join`, { method: 'POST' });
        state.openCommunityId = null;
        await bootstrap();
        toast(`„${community.name}" verlassen`);
      });
    },
    { schliessen: true }
  );
}

/*
 * Communitys-Startseite.
 *
 * Henrik: "Home zeigt nur Communitys, denen der Nutzer bereits beigetreten
 * ist. Noch nicht beigetretene Communitys unter 'Entdecken' o. Ae. anzeigen."
 *
 * Vorher standen alle in einer Liste, getrennt nur nach oeffentlich/privat -
 * beigetreten und nicht beigetreten waren nicht auseinanderzuhalten.
 */
function renderCommunities() {
  // Ist eine Community offen, gehoert der Bildschirm ihren Kanaelen.
  if (state.openCommunityId) return renderCommunityChannels(state.openCommunityId);

  const q = state.communityQuery.trim().toLowerCase();
  const passt = (c) => !q || c.name.toLowerCase().includes(q) || c.topic.toLowerCase().includes(q);

  const meine = state.communities.filter((c) => c.joined && passt(c));
  const entdecken = state.communities.filter((c) => !c.joined && passt(c));
  const list = state.communityFilter === 'entdecken' ? entdecken : meine;

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
    ${/*
        Ohne Zahlen. Henrik am 26.08.2026: "Zahl bei Entdecken wird angezeigt.
        Nur Communitys, keine Zahl." Die Zahl an einem Filter liest sich wie
        ein Zaehler fuer Ungelesenes - hier zaehlte sie nur, wie lang die
        Liste dahinter ist, und das sieht man ohnehin sofort.
      */ ''}
    <div class="pills">
      ${[
        ['meine', 'Meine'],
        ['entdecken', 'Entdecken'],
      ]
        .map(
          ([f, label]) =>
            `<button class="pill ${state.communityFilter === f ? 'is-active' : ''}" data-cfilter="${f}">${label}</button>`
        )
        .join('')}
    </div>
    <div class="scroll">
      ${
        list.length
          ? `<ul class="rows">${list.map(communityRow).join('')}</ul>`
          : `<div class="empty">${ICONS.people}
              <div class="empty__title">${
                state.communityQuery
                  ? 'Keine Community gefunden'
                  : state.communityFilter === 'entdecken'
                    ? 'Du bist überall dabei'
                    : 'Noch keiner Community beigetreten'
              }</div>
              <div class="empty__text">${
                state.communityQuery
                  ? `Für „${esc(state.communityQuery)}" wurde nichts gefunden.`
                  : state.communityFilter === 'entdecken'
                    ? 'Es gibt gerade nichts Neues zu entdecken.'
                    : 'Unter „Entdecken" findest du Communitys zum Beitreten.'
              }</div>
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
            <span class="row__preview row__preview--text">${esc(c.topic)}</span>
          </div>
          <div class="row__bottom">
            <span class="row__preview row__preview--text" style="font-size:12px;color:var(--text-3)">${members} Mitglieder</span>
          </div>
        </div>
        <span class="row__meta">
          ${c.unread ? `<span class="badge">${c.unread}</span>` : ''}
          ${/*
              Punkt 62: an der eigenen Community steht kein Knopf. Er hiess
              dort "Mitglied" und trug einen Klick, der aus der eigenen
              Community austrat - die Mitgliederzahl ging um eins herunter und
              der eigene Kanal verschwand aus "Erstellt".

              Statt eines Ersatztextes steht dort nichts: der Prototyp-Frame
              "Community - Profil" zeigt an der Stelle ebenfalls nichts, und
              ein Hinweis wie "Deine Community" nahm dem Namen daneben so viel
              Platz, dass er abgeschnitten wurde.
            */ ''}
          ${
            c.eigen
              ? ''
              : `<span class="joinbtn ${c.joined ? 'is-joined' : ''}" data-join="${c.id}">${c.joined ? 'Mitglied' : 'Beitreten'}</span>`
          }
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
    // Henrik: "Insbesondere einen Messenger-Unterpunkt ergaenzen, analog zu
    // Videos und Communitys." Der Abschnitt hiess "Chats" und war damit der
    // einzige, der nicht nach seinem Bereich benannt war.
    id: 'messenger',
    title: 'Messenger',
    items: [
      { label: 'Lesebestätigung', icon: 'checkDouble', toggle: 'lesebestaetigung' },
      { label: 'Standort-Sichtbarkeit', icon: 'mapPin', wahl: ['Alle Kontakte', 'Ausgewählte Kontakte', 'Niemand'], standard: 'Alle Kontakte' },
      { label: 'Story-Sichtbarkeit', icon: 'eye', wahl: ['Alle', 'Meine Kontakte', 'Enge Freunde'], standard: 'Meine Kontakte' },
      { label: 'Zuletzt online', icon: 'eye', wahl: ['Alle', 'Meine Kontakte', 'Niemand'], standard: 'Meine Kontakte' },
      { label: 'Mit Enter senden', icon: 'send', toggle: 'entersenden' },
      { label: 'Chat-Hintergrund', icon: 'image', wahl: ['Hell', 'Dunkel', 'Farbverlauf'], standard: 'Hell' },
      { label: 'Schriftgröße', icon: 'info', wahl: ['Klein', 'Mittel', 'Groß'], standard: 'Mittel' },
      { label: 'Wer darf mich zu Gruppen hinzufügen', icon: 'people', wahl: ['Alle', 'Meine Kontakte', 'Niemand'], standard: 'Meine Kontakte' },
      { label: 'Selbstlöschende Nachrichten', icon: 'clock', wahl: ['Aus', 'Nach 24 Stunden', 'Nach 7 Tagen', 'Nach 90 Tagen'], standard: 'Aus' },
      { label: 'Chat-Verlauf sichern', icon: 'bookmark', aktion: 'sicherung' },
      { label: 'Archivierte Chats', icon: 'bookmark', liste: 'archiv' },
      { label: 'Blockierte Kontakte', icon: 'shield', liste: 'blockiert' },
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
      { label: 'Wem ich folge', icon: 'person', liste: 'gefolgt' },
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
    const ids = state.archiviert || [];
    const alle = [...state.chats, ...(state.communityChats || [])];
    return {
      leer: 'Kein Chat ist archiviert.',
      zeilen: ids
        .map((id) => alle.find((c) => c.id === id))
        .filter(Boolean)
        .map((c) => ({ text: c.name, neben: 'archiviert' })),
    };
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
  /*
   * Henrik: "In den Einstellungen muss man sehen koennen, wem man folgt."
   * `state.gefolgt` kommt aus /api/bootstrap und ist dieselbe Quelle, aus
   * der auch die Folgen-Knoepfe im Feed ihren Zustand nehmen - damit stimmt
   * die Liste immer mit den Knoepfen ueberein.
   */
  if (art === 'gefolgt') {
    const ids = Object.keys(state.gefolgt || {}).filter((id) => state.gefolgt[id]);
    return {
      leer: 'Du folgst noch niemandem.',
      zeilen: ids.map((id) => ({ text: user(id).name, neben: user(id).handle })),
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
      'Merken'
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

  // Diese Einstellung ist noch in Entwicklung
  toast(`${punkt.label} ist noch in Entwicklung`);
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
      ${
        // Nur wenn man aus einem Profil kam - wer die Einstellungen ueber die
        // untere Leiste oeffnet, hat kein "zurueck".
        state.settingsAus
          ? `<div class="pagehead__row">
              <button class="iconbtn" id="settingsBack" aria-label="Zurück zum Profil">${ICONS.back}</button>
              <h2 class="pagehead__title">Einstellungen</h2>
            </div>`
          : ''
      }
      ${(() => {
        // Der Kopf zeigt das angemeldete Konto. Ohne Anmeldung kommt man gar
        // nicht bis hierher - dann steht der Willkommensbildschirm da.
        const ich = state.users?.me || {};
        const sitzung = window.Anmeldung?.angemeldet?.() ? window.Anmeldung.nutzer() : null;
        const aktiv = {
          name: ich.name || sitzung?.handle || 'Ich',
          email: sitzung?.email || '',
          initials: ich.initials || '',
          color: ich.color || '',
        };
        return `
        <div class="konto__kopf" id="kontoKopf">
          <span class="avatar avatar--52" style="background:${aktiv.color}">${esc(aktiv.initials)}</span>
          <div class="konto__body">
            <div class="konto__name">${esc(aktiv.name)}</div>
            <div class="konto__mail">${esc(aktiv.email)}</div>
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
    const abschnittId = state.settingsSprung;
    const ziel = document.getElementById('sec-' + abschnittId);
    state.settingsSprung = null;
    setTimeout(() => ziel?.scrollIntoView({ block: 'start' }), 30);

    /*
     * Kam man ueber einen einzelnen Unterpunkt (z. B. "Story-Sichtbarkeit" im
     * Messenger-Profil), geht der Punkt gleich auf. Vorher landete man in der
     * langen Liste und musste ihn selbst suchen - das war Henriks Punkt.
     */
    if (state.settingsPunkt) {
      const abschnitt = SETTINGS.find((sec) => sec.id === abschnittId);
      const punkt = abschnitt?.items.find((it) => it.label === state.settingsPunkt);
      state.settingsPunkt = null;
      if (punkt) setTimeout(() => openEinstellung(punkt), 60);
    }
  }

  /*
   * Zurueck zum Profil, aus dem man kam. Ohne diesen Pfeil fuehrte der Weg
   * nur ueber die untere Leiste - und die landet auf der Hauptseite des
   * Bereichs, nicht wieder im Profil.
   */
  $('#settingsBack')?.addEventListener('click', () => {
    const zurueck = state.settingsAus;
    state.settingsAus = null;
    state.area = zurueck;
    state.sub[zurueck] = 'profile';
    render();
  });

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
      if (b.dataset.setting === 'Abmelden') {
        // Abmelden: Sitzung clearen (aktuell Mock-User "me")
        localStorage.clear();
        location.reload();
        return;
      }
      toast('All Media 1.0.0 — gebaut aus dem Figma-Prototypen');
    })
  );
}

/* ------------------------------------------------- Messenger: Friend-Map */
/*
 * Die drei Kartenansichten hinter dem Ebenen-Knopf. Henrik: "Kartenansicht-
 * Umschalter (Satellit, etc.) - kleines Fenster neben dem Knopf, nicht
 * Click-through."
 *
 * Alle drei Anbieter liefern ohne Schluessel und ohne Vertrag - es entstehen
 * keine Kosten. Dafuer gilt bei allen dreien eine Nutzungsgrenze fuer
 * automatisierte Zugriffe; fuer eine echte Veroeffentlichung braeuchte es
 * einen bezahlten Anbieter. Das ist Henriks Entscheidung, nicht meine.
 */
const KARTEN_STILE = [
  {
    key: 'standard',
    label: 'Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    quelle: '© OpenStreetMap',
    maxZoom: 19,
  },
  {
    key: 'satellit',
    label: 'Satellit',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    quelle: '© Esri',
    maxZoom: 19,
  },
  {
    key: 'gelaende',
    label: 'Gelände',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    quelle: '© OpenTopoMap',
    maxZoom: 17,
  },
];

// Prototyp-Frame "Messenger - Friend-Map": Karte mit Freunden, darunter eine
// Liste mit letztem Standort.
function renderFriendMap() {
  const freigabeTexte = {
    niemand: 'Dein Standort bleibt privat',
    kontakte: 'Alle deine Kontakte sehen dich',
    ausgewaehlt: 'Nur wen du freigibst',
  };
  if (state.standort === undefined) state.standort = { an: true, wer: 'kontakte' };
  if (!state.karte) state.karte = { aktiv: null, mapInstance: null, markers: {} };

  const percentToCoords = (x, y) => {
    const lat = 55.1 - ((y / 100) * (55.1 - 47.3));
    const lng = 5.9 + ((x / 100) * (15.0 - 5.9));
    return [lat, lng];
  };

  const stil = KARTEN_STILE.find((s) => s.key === state.karteStil) || KARTEN_STILE[0];
  const voll = state.karteVollbild;

  main.innerHTML = `
    <div class="scroll">
      <div id="map" class="map map--${stil.key}${voll ? ' map--voll' : ''}">
        <div id="mapFlaeche" class="map__flaeche"></div>
        <div class="map__ansicht">${stil.label}</div>
        <div class="map__werkzeuge">
          <button class="map__werkzeug" data-mapfull aria-label="${voll ? 'Vollbild verlassen' : 'Karte im Vollbild'}">${
            voll ? ICONS.einklappen : ICONS.ausklappen
          }</button>
          <button class="map__werkzeug" data-mapstil aria-label="Kartenansicht: ${stil.label}">${ICONS.ebenen}</button>
        </div>
      </div>

      ${voll ? '' : `
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
              </div>
              ${
                state.standort.wer === 'ausgewaehlt'
                  ? `<button class="linkbtn" id="bearbeiteAusgewaehlt" style="margin-top:8px; padding: 0; color: var(--brand); font-weight: 600; font-size: 13px;">→ Ausgewählte Kontakte bearbeiten</button>`
                  : ''
              }`
            : ''
        }
      </div>

      <div class="listhead">In deiner Nähe</div>
      <ul class="rows">
        ${state.friends
          .map((f) => {
            const u = user(f.id);
            return `<li><div class="row ${state.karte.aktiv === f.id ? 'is-aktiv' : ''}" data-zoom="${f.id}">
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
      `}
    </div>`;

  setTimeout(() => {
    const mapContainer = $('#mapFlaeche');
    if (!mapContainer) return;

    if (state.karte.mapInstance) {
      state.karte.mapInstance.remove();
      state.karte.mapInstance = null;
      state.karte.markers = {};
    }

    const map = L.map(mapContainer, { zoomControl: false }).setView(
      state.karte.mitte || [51.5, 10],
      state.karte.zoom || 4
    );
    state.karte.mapInstance = map;

    L.tileLayer(stil.url, { attribution: stil.quelle, maxZoom: stil.maxZoom }).addTo(map);

    // Der Ausschnitt ueberlebt das Neuzeichnen - sonst springt die Karte bei
    // jedem Umschalten von Ansicht oder Vollbild zurueck nach Mitteleuropa.
    map.on('moveend', () => {
      state.karte.mitte = map.getCenter();
      state.karte.zoom = map.getZoom();
    });

    state.friends.forEach((f) => {
      const u = user(f.id);
      const [lat, lng] = percentToCoords(f.x, f.y);
      const isActive = state.karte.aktiv === f.id;
      const marker = L.circleMarker([lat, lng], {
        radius: isActive ? 12 : 8,
        fillColor: isActive ? '#ff3b30' : farbeFuerNadel(u.color),
        // Weisser Rand: die Nutzerfarben sind kraeftig, aber auf einer
        // Satellitenkachel geht jede von ihnen ohne Absetzung unter.
        color: '#fff',
        weight: 2.5,
        opacity: 1,
        fillOpacity: 1,
        // Der Test und das Vollbild greifen die Nadeln ueber diese Klassen.
        className: `map__pin${isActive ? ' is-aktiv' : ''}`,
      })
        .bindPopup(`<div style="text-align: center; font-weight: 600;">${esc(u.name)}</div>`)
        .addTo(map);

      marker.on('click', () => {
        state.karte.aktiv = f.id;
        renderFriendMap();
      });

      state.karte.markers[f.id] = marker;
    });

    // Henrik: "Standort ausschalten wird nicht beachtet - der Nutzer wird noch
    // angezeigt." Die eigene Nadel haengt deshalb am Schalter, nicht an der
    // Karte. Steht die Freigabe auf "Niemand", ist sie ebenfalls weg.
    if (state.standort.an && state.standort.wer !== 'niemand') {
      const ort = state.karte.eigenerOrt || [52.52, 13.405];
      // Zwei Kreise: der weite blasse Ring hebt die eigene Nadel von den
      // Kontakten ab. Mit nur einem Punkt war sie von einem blauen Kontakt
      // nicht zu unterscheiden.
      L.circleMarker(ort, {
        radius: 18,
        fillColor: '#0a84ff',
        stroke: false,
        fillOpacity: 0.2,
        interactive: false,
      }).addTo(map);
      L.circleMarker(ort, {
        radius: 8,
        fillColor: '#0a84ff',
        color: '#fff',
        weight: 3,
        opacity: 1,
        fillOpacity: 1,
        className: 'map__me',
      })
        .bindPopup('<div style="text-align:center;font-weight:600;">Du</div>')
        .addTo(map);
    }
  }, 0);

  main.querySelector('[data-mapfull]').addEventListener('click', () => {
    state.karteVollbild = !state.karteVollbild;
    renderFriendMap();
  });
  main.querySelector('[data-mapstil]').addEventListener('click', () => {
    const i = KARTEN_STILE.findIndex((s) => s.key === stil.key);
    const naechster = KARTEN_STILE[(i + 1) % KARTEN_STILE.length];
    state.karteStil = naechster.key;
    toast(`Kartenansicht: ${naechster.label}`);
    renderFriendMap();
  });

  if (!voll) {
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

    const bearbeiteBtn = $('#bearbeiteAusgewaehlt');
    if (bearbeiteBtn) {
      bearbeiteBtn.addEventListener('click', () => {
        state.ausgewaehlteKontakteEdit = true;
        render();
      });
    }
  }

  main.querySelectorAll('[data-zoom]').forEach((el) =>
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-friend-profil]')) return;
      const id = el.dataset.zoom;
      state.karte.aktiv = id;
      const f = state.friends.find((x) => x.id === id);
      if (f && state.karte.mapInstance) {
        const [lat, lng] = percentToCoords(f.x, f.y);
        state.karte.mapInstance.setView([lat, lng], 10, { animate: true });
      }
      renderFriendMap();
    })
  );
  main.querySelectorAll('[data-friend-profil]').forEach((el) =>
    el.addEventListener('click', () => openProfile(el.dataset.friendProfil, 'kontakt'))
  );
}

/* Ausgewählte Kontakte für Standortfreigabe verwalten */
function renderAusgewaehlteKontakte() {
  if (!state.standortAusgewaehlt) state.standortAusgewaehlt = [];

  main.innerHTML = `
    <div class="scroll">
      <div class="profil__kopf">
        <button class="zurueck-pfeil" id="zurueckVonAusgewaehlt" aria-label="Zurück">${ICONS.chevron}</button>
        <h1 class="profil__titel">Standort teilen mit</h1>
      </div>

      <ul class="rows">
        ${state.friends
          .map((f) => {
            const u = user(f.id);
            const ist = state.standortAusgewaehlt.includes(f.id);
            return `<li><label class="row" style="cursor: pointer;">
              <input type="checkbox" class="checkAusgewaehlt" data-id="${f.id}" ${ist ? 'checked' : ''} style="width: 18px; height: 18px;" />
              ${avatarForUser(f.id, 44)}
              <div class="row__body">
                <div class="row__name">${esc(u.name)}</div>
              </div>
            </label></li>`;
          })
          .join('')}
      </ul>
    </div>`;

  const zurueckBtn = $('#zurueckVonAusgewaehlt');
  if (zurueckBtn) {
    zurueckBtn.addEventListener('click', () => {
      state.ausgewaehlteKontakteEdit = false;
      render();
    });
  }

  main.querySelectorAll('.checkAusgewaehlt').forEach((ch) => {
    ch.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      if (e.target.checked) {
        if (!state.standortAusgewaehlt.includes(id)) state.standortAusgewaehlt.push(id);
      } else {
        state.standortAusgewaehlt = state.standortAusgewaehlt.filter((x) => x !== id);
      }
    });
  });
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
      <div class="camera__stage">${ICONS.camera}<span class="camera__sucher"><span></span><span></span><span></span><span></span></span></div>
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
  // Punkt 18: das Bildsymbol geht in die Galerie, nicht noch einmal in die
  // Kamera - dafuer ist der Ausloeser in der Mitte da.
  $('#camGallery').addEventListener('click', () => aufnahmeVerwenden(mode, true));
  $('#camSwitch').addEventListener('click', () => toast('Kamera gewechselt'));

  main.querySelectorAll('.camera__mode').forEach((b) =>
    b.addEventListener('click', () => {
      mode = b.dataset.mode;
      main.querySelectorAll('.camera__mode').forEach((x) => x.classList.toggle('is-active', x === b));
    })
  );

  $('#camShutter').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    if (mode === 'photo') return aufnahmeVerwenden('photo');
    recording = !recording;
    btn.classList.toggle('is-rec', recording);
    if (recording) return toast('Aufnahme gestartet');
    aufnahmeVerwenden('video');
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
  /*
   * Die Kontoliste zeigt, wer wirklich angemeldet ist.
   *
   * Hier stand bis zum 31.08.2026 ein erfundener Eintrag ("Henrik,
   * henrik@allmedia.de"), der auch dann dastand, wenn sich nie jemand
   * angemeldet hatte. Wer die Seite zum ersten Mal oeffnete, sah ein Konto,
   * das es nicht gab.
   */
  const angemeldet = window.Anmeldung?.angemeldet?.() ? window.Anmeldung.nutzer() : null;
  if (angemeldet) {
    const ich = state.users?.me;
    state.konten = [
      {
        id: 'me',
        name: ich?.name || angemeldet.handle || 'Ich',
        email: angemeldet.email || '',
        initials: ich?.initials || '',
        color: ich?.color || '',
      },
    ];
    state.kontoAktiv = 'me';
  } else {
    state.konten = [];
    state.kontoAktiv = null;
  }

  /*
   * Der Ablauf folgt dem Prototyp-Frame "V + VP + NP + ...":
   *
   *   liste      Kontoliste mit "bei bestehendem Konto anmelden" / "neues Profil erstellen"
   *   anmelden   ein Feld "Benutzername, E-Mail, Telefonnummer" + Passwort
   *   neu        Benutzername + Passwort -> "weiter"
   *   neu-mail   "registriere deine E-Mail" -> "neues Konto erstellen"
   *
   * Der Benutzername gehoert dem Nutzer: Er gibt ihn als Erstes selbst ein,
   * und die Datenbank uebernimmt ihn unveraendert. Frueher wurde er aus der
   * E-Mail-Adresse abgeleitet.
   */
  const zustand = {
    ansicht: 'liste',
    benutzername: '',
    passwort: '',
    email: '',
    kennung: '',
    hinweis: '',
    hinweisArt: '',
  };

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
        <div class="row__body"><div class="konto__aktion">bei bestehendem Konto anmelden</div></div>
      </button>
      <button class="row" data-konto-neu="neu">
        <span class="konto__rund">${ICONS.plus}</span>
        <div class="row__body"><div class="konto__aktion">neues Profil erstellen</div></div>
      </button>
    </div>`;

  /* Meldung unter den Feldern: Fehler rot, Bestaetigung gruen. */
  const hinweis = () =>
    zustand.hinweis
      ? `<div class="sheet__hinweis ${zustand.hinweisArt === 'gut' ? 'is-gut' : 'is-fehler'}">${esc(
          zustand.hinweis
        )}</div>`
      : '';

  /* Anmelden: ein Feld fuer Benutzername, E-Mail oder Telefonnummer. */
  const formularAnmelden = () => `
    <div class="sheet__field">
      <label class="sheet__label" for="kontoKennung">Benutzername, E-Mail oder Telefonnummer</label>
      <input id="kontoKennung" placeholder="@name oder name@beispiel.de" value="${esc(zustand.kennung)}"
             autocapitalize="off" autocomplete="username" />
    </div>
    <div class="sheet__field">
      <label class="sheet__label" for="kontoPass">Passwort</label>
      <input id="kontoPass" type="password" placeholder="••••••••" value="${esc(zustand.passwort)}"
             autocomplete="current-password" />
    </div>
    ${hinweis()}
    <div class="sheet__zeile">
      <button class="linkbtn" id="kontoVergessen">Passwort vergessen?</button>
    </div>
    <div class="sheet__footer">
      <button class="prof__btn is-primary" id="kontoOk">anmelden</button>
    </div>`;

  /* Neues Profil, Schritt 1: Benutzername und Passwort. */
  const formularNeu = () => `
    <div class="sheet__field">
      <label class="sheet__label" for="kontoBenutzer">Benutzername</label>
      <input id="kontoBenutzer" placeholder="@wunschname" value="${esc(zustand.benutzername)}"
             autocapitalize="off" autocomplete="username" />
      <div class="sheet__fussnote">Drei bis vierundzwanzig Zeichen: Buchstaben, Ziffern, Punkt und Unterstrich.</div>
    </div>
    <div class="sheet__field">
      <label class="sheet__label" for="kontoPass">Passwort</label>
      <input id="kontoPass" type="password" placeholder="mindestens 6 Zeichen" value="${esc(zustand.passwort)}"
             autocomplete="new-password" />
    </div>
    ${hinweis()}
    <div class="sheet__footer">
      <button class="prof__btn is-primary" id="kontoOk">weiter</button>
    </div>`;

  /* Neues Profil, Schritt 2: E-Mail. */
  const formularNeuMail = () => `
    <div class="sheet__erklaerung">
      Dein Benutzername ist <strong>@${esc(zustand.benutzername.replace(/^@+/, ''))}</strong>.
      Die E-Mail brauchen wir, um dein Konto zu bestätigen und dir bei einem
      vergessenen Passwort zu helfen.
    </div>
    <div class="sheet__field">
      <label class="sheet__label" for="kontoMail">E-Mail</label>
      <input id="kontoMail" type="email" placeholder="name@beispiel.de" value="${esc(zustand.email)}"
             autocapitalize="off" autocomplete="email" />
    </div>
    ${hinweis()}
    <div class="sheet__footer">
      <button class="prof__btn is-primary" id="kontoOk">neues Konto erstellen</button>
    </div>`;

  const formular = () =>
    zustand.ansicht === 'anmelden'
      ? formularAnmelden()
      : zustand.ansicht === 'neu'
      ? formularNeu()
      : formularNeuMail();

  const titel = () =>
    zustand.ansicht === 'liste'
      ? 'Konto wechseln'
      : zustand.ansicht === 'anmelden'
      ? 'bei bestehendem Konto anmelden'
      : zustand.ansicht === 'neu'
      ? 'neues Profil erstellen'
      : 'registriere deine E-Mail';

  openSheet('Konto wechseln', liste(), (sheet, close) => {
    const neuZeichnen = () => {
      sheet.querySelector('.sheet').innerHTML = `
        <div class="sheet__handle"></div>
        <div class="sheet__title">${titel()}</div>
        ${zustand.ansicht === 'liste' ? liste() : formular()}`;
      binden();
    };

    /*
     * Echte Anmeldung bei Supabase. Klappt sie, laedt die Seite ihre Daten
     * neu - dann steht dort dasselbe wie in der App. Ist die Anmeldung nicht
     * eingerichtet, bleibt es beim bisherigen Verhalten: ein Konto, das nur
     * im Browser existiert.
     */
    /* Setzt eine Meldung unter die Felder und zeichnet neu. */
    const meldung = (text, art = 'fehler') => {
      zustand.hinweis = text;
      zustand.hinweisArt = art;
      neuZeichnen();
    };

    /* Sperrt den Knopf waehrend eines laufenden Vorgangs. */
    const arbeitet = (text) => {
      const knopf = sheet.querySelector('#kontoOk');
      if (!knopf) return () => {};
      const vorher = knopf.textContent;
      knopf.disabled = true;
      knopf.textContent = text;
      return () => {
        knopf.disabled = false;
        knopf.textContent = vorher;
      };
    };

    /* Felder in den Zustand uebernehmen, bevor neu gezeichnet wird. */
    const merken = () => {
      const k = sheet.querySelector('#kontoKennung');
      const b = sheet.querySelector('#kontoBenutzer');
      const m = sheet.querySelector('#kontoMail');
      const p = sheet.querySelector('#kontoPass');
      if (k) zustand.kennung = k.value;
      if (b) zustand.benutzername = b.value;
      if (m) zustand.email = m.value;
      if (p) zustand.passwort = p.value;
    };

    const anmeldenAbsenden = async () => {
      merken();
      const kennung = zustand.kennung.trim();
      if (!kennung) return meldung('Bitte Benutzername, E-Mail oder Telefonnummer eingeben.');
      if (!zustand.passwort) return meldung('Bitte Passwort eingeben.');

      if (!window.Anmeldung) return meldung('Die Anmeldung ist gerade nicht erreichbar.');

      const fertig = arbeitet('wird angemeldet…');
      const ergebnis = await window.Anmeldung.anmelden(kennung, zustand.passwort);
      fertig();

      if (!ergebnis.ok) return meldung(ergebnis.fehler);

      close();
      toast(`Angemeldet als ${ergebnis.nutzer?.handle || kennung}`);
      return bootstrap();
    };

    /* Schritt 1: Benutzername pruefen, dann weiter zur E-Mail. */
    const neuWeiter = async () => {
      merken();
      const name = zustand.benutzername.trim();
      if (!name) return meldung('Bitte einen Benutzernamen eingeben.');
      if (zustand.passwort.length < 6) return meldung('Das Passwort braucht mindestens 6 Zeichen.');

      if (!window.Anmeldung) return meldung('Die Anmeldung ist gerade nicht erreichbar.');

      const fertig = arbeitet('wird geprüft…');
      const pruefung = await window.Anmeldung.benutzernameFrei(name);
      fertig();

      if (!pruefung.frei) return meldung(pruefung.meldung);

      zustand.benutzername = pruefung.handle.replace(/^@/, '');
      zustand.ansicht = 'neu-mail';
      meldung('', '');
    };

    /* Schritt 2: E-Mail eingeben und Konto anlegen. */
    const neuAnlegen = async () => {
      merken();
      const email = zustand.email.trim();
      if (!email || !email.includes('@')) return meldung('Bitte eine gültige E-Mail-Adresse eingeben.');

      const fertig = arbeitet('Konto wird erstellt…');
      const ergebnis = await window.Anmeldung.registrieren({
        benutzername: zustand.benutzername,
        passwort: zustand.passwort,
        email,
      });
      fertig();

      if (!ergebnis.ok) {
        // Ist der Name inzwischen weg, zurueck zum ersten Schritt.
        if (ergebnis.feld === 'benutzername') {
          zustand.ansicht = 'neu';
          return meldung(ergebnis.fehler);
        }
        return meldung(ergebnis.fehler);
      }

      if (ergebnis.bestaetigen) {
        close();
        return toast(ergebnis.hinweis);
      }

      close();
      toast(`Konto @${zustand.benutzername} erstellt`);
      return bootstrap();
    };

    const anlegen = () =>
      zustand.ansicht === 'anmelden'
        ? anmeldenAbsenden()
        : zustand.ansicht === 'neu'
        ? neuWeiter()
        : neuAnlegen();

    const passwortVergessen = async () => {
      merken();
      const kennung = zustand.kennung.trim();
      if (!kennung.includes('@') || kennung.startsWith('@')) {
        return meldung('Bitte die E-Mail-Adresse eingeben, mit der du dich registriert hast.');
      }
      const fertig = arbeitet('wird gesendet…');
      const ergebnis = await window.Anmeldung.passwortVergessen(kennung);
      fertig();
      meldung(
        ergebnis.ok ? 'Wir haben dir eine E-Mail zum Zurücksetzen geschickt.' : ergebnis.fehler,
        ergebnis.ok ? 'gut' : 'fehler'
      );
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
          b.addEventListener('click', async () => {
            const id = b.dataset.kontoWeg;
            const k = state.konten.find((x) => x.id === id);
            state.konten = state.konten.filter((x) => x.id !== id);
            if (state.kontoAktiv === id) state.kontoAktiv = state.konten[0]?.id || null;
            toast(`${k.name} abgemeldet`);

            // Auch die echte Sitzung beenden, sonst bleibt die Seite
            // angemeldet, obwohl das Konto aus der Liste verschwunden ist.
            if (window.Anmeldung?.angemeldet()) {
              await window.Anmeldung.abmelden();
              close();
              return bootstrap();
            }
            neuZeichnen();
          })
        );
        sheet.querySelectorAll('[data-konto-neu]').forEach((b) =>
          b.addEventListener('click', () => {
            zustand.ansicht = b.dataset.kontoNeu;
            zustand.hinweis = '';
            neuZeichnen();
          })
        );
        return;
      }

      sheet.querySelector('#kontoOk')?.addEventListener('click', anlegen);

      // Eingabetaste sendet ab — in jedem Feld des jeweiligen Schritts.
      sheet.querySelectorAll('.sheet__field input').forEach((feld) =>
        feld.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') anlegen();
        })
      );

      sheet.querySelector('#kontoVergessen')?.addEventListener('click', passwortVergessen);

      // Der erste Schritt gehoert dem Benutzernamen: Feld gleich scharf stellen.
      const zuerst =
        sheet.querySelector('#kontoBenutzer') ||
        sheet.querySelector('#kontoKennung') ||
        sheet.querySelector('#kontoMail');
      zuerst?.focus();
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
  const profil = state.eigenesProfil || {};
  main.innerHTML = `
    ${switchBar('switchProfile')}
    <div class="scroll">
      <div class="mprof">
        <div class="avatar avatar--88" style="background:${me.color}">${esc(me.initials)}</div>
        <div class="mprof__text">
          ${/* Wie im Videos- und Community-Profil aus dem Konto, nicht fest
                im Markup - sonst zeigt "Profil bearbeiten" hier keine
                Wirkung. */ ''}
          <div class="mprof__name">${esc(me.name)}</div>
          ${profil.bio ? `<div class="mprof__bio">${esc(profil.bio)}</div>` : ''}
        </div>
      </div>
      <div class="mprof__links">
        <button data-switch="videos">@videoprofil</button>
        <button data-switch="communities">@communityprofil</button>
      </div>

      ${/*
          "Profil bearbeiten" gab es nur im Videos-Profil. Henrik hat das fuer
          alle drei gemeldet - Name, Info und Link gehoeren zum Konto, nicht zu
          einem einzelnen Profil, also fuehrt der Knopf ueberall zu demselben
          Formular.
        */ ''}
      <div class="prof__aktionen">
        <button class="btn btn--breit" id="profilBearbeiten">Profil bearbeiten</button>
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
  $('#profilBearbeiten')?.addEventListener('click', () => openProfilBearbeiten(renderMessengerProfile));
  main.querySelectorAll('[data-switch]').forEach((b) =>
    b.addEventListener('click', () => {
      state.area = b.dataset.switch;
      state.sub[state.area] = 'profile';
      render();
    })
  );
  /*
   * Henrik am 26.08.2026: "Klick auf einen Einstellungs-Unterpunkt leitet zu
   * den Haupt-Einstellungen statt zur spezifischen Seite. Nur die dicke
   * Schrift soll zu den Haupt-Einstellungen fuehren."
   *
   * Vorher wechselte jeder dieser Knoepfe nur in den Bereich Einstellungen
   * und gab einen Hinweis aus, wo der Punkt zu finden sei - man musste ihn
   * dann selbst suchen. Jetzt geht der Punkt direkt auf.
   */
  main.querySelectorAll('[data-mact]').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.dataset.mact === 'settings') return zuDenEinstellungen('messenger');
      const punkte = {
        location: 'Standort-Sichtbarkeit',
        story: 'Story-Sichtbarkeit',
        read: 'Lesebestätigung',
      };
      zuDenEinstellungen('messenger', punkte[b.dataset.mact]);
    })
  );
}

/*
 * In die Einstellungen wechseln - wahlweise direkt zu einem Punkt.
 *
 * `abschnitt` bestimmt, wo die Liste anfaengt. Steht `punkt` dabei, geht
 * dieser Punkt gleich auf (Auswahl, Formular oder Liste). `state.settingsAus`
 * merkt sich, aus welchem Bereich man kam - daraus wird der Zurueck-Pfeil
 * oben links, den Henrik ebenfalls gemeldet hat.
 */
function zuDenEinstellungen(abschnitt, punkt) {
  state.settingsAus = state.area;
  state.settingsSprung = abschnitt;
  state.settingsPunkt = punkt || null;
  state.area = 'settings';
  render();
}

/* --------------------------------------------------- Videos: Querformat */
// Prototyp-Frame "Videos - Querformat": Suchleiste und Liste von
// Querformat-Videos mit Vorschaubild, Titel, Kanal und Laufzeit.
/*
 * Die vier Knoepfe der Querformat-Leiste und was sie zeigen.
 *
 * Henrik hat am 26.08.2026 gemeldet, dass die Leiste nichts tut: der Wert
 * wurde gelesen, aber nie auf die Liste angewandt - alle vier Knoepfe zeigten
 * dieselben Videos. Jetzt entscheidet `art` am Video, wohin es gehoert.
 */
const CLIP_FILTER = {
  alle: { label: 'Alle', passt: () => true },
  standard: { label: 'Standard', passt: (c) => (c.art || 'standard') === 'standard' },
  '360°': { label: '360°', passt: (c) => c.art === '360' },
  live: { label: 'Live', passt: (c) => c.art === 'live' },
};

function renderLandscapeVideos() {
  const q = state.clipQuery.trim().toLowerCase();
  const filter = CLIP_FILTER[state.clipFilter] ? state.clipFilter : 'alle';
  const passt = CLIP_FILTER[filter].passt;
  const list = state.clips.filter(
    (c) =>
      passt(c) &&
      (!q || c.title.toLowerCase().includes(q) || user(c.userId).name.toLowerCase().includes(q))
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
        ${Object.entries(CLIP_FILTER)
          .map(
            ([id, f]) =>
              `<button class="pill ${filter === id ? 'is-active' : ''}" data-clipfilter="${id}">${f.label}</button>`
          )
          .join('')}
      </div>
    </div>
    <div class="scroll">
      ${
        list.length
          ? list
              .map((c) => {
                const u = user(c.userId);
                const art = c.art || 'standard';
                /*
                 * Live und 360° bekommen ein Abzeichen auf der Kachel. Ohne
                 * es waere am Ergebnis nicht zu sehen, dass der Filter etwas
                 * getan hat - die Kacheln saehen alle gleich aus.
                 */
                const marke =
                  art === 'live'
                    ? '<span class="clip__art clip__art--live">LIVE</span>'
                    : art === '360'
                      ? '<span class="clip__art clip__art--360">360°</span>'
                      : '';
                const rechts =
                  art === 'live'
                    ? `${compactNumber(c.zuschauer || 0)} sehen zu`
                    : `${compactNumber(c.views)} Aufrufe · ${esc(c.age)}`;
                return `<article class="clip" data-clip="${c.id}">
                  <div class="clip__thumb">${medienFlaeche(c.id, ICONS.landscape, c.mediaUrl)}${marke}<span class="clip__time">${esc(c.duration)}</span></div>
                  <div class="clip__meta">
                    <div class="avatar avatar--36" style="background:${u.color}" data-profile="${u.id}">${esc(u.initials)}</div>
                    <div>
                      <div class="clip__title">${esc(c.title)}</div>
                      <div class="clip__sub">${esc(u.name)} · ${rechts}</div>
                    </div>
                  </div>
                </article>`;
              })
              .join('')
          : `<div class="empty">${ICONS.landscape}
              <div class="empty__title">Kein Video gefunden</div>
              <div class="empty__text">${
                state.clipQuery
                  ? `Für „${esc(state.clipQuery)}" gibt es unter „${CLIP_FILTER[filter].label}" keinen Treffer.`
                  : `Unter „${CLIP_FILTER[filter].label}" liegt gerade nichts.`
              }</div>
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
/*
 * Seitenkopf der Uebersichtsseiten aus der Video-Suche.
 *
 * Henrik am 26.08.2026: "Keine Moeglichkeit, von der Detail-Seite zurueck zur
 * Suche." Die Seiten hatten nur eine Ueberschrift - man kam nur ueber die
 * untere Leiste weg, und die warf einen aus dem Bereich.
 */
function explorerKopf(titel) {
  return `<div class="pagehead">
    <div class="pagehead__row">
      <button class="iconbtn" data-explorer-back aria-label="Zurück zur Suche">${ICONS.back}</button>
      <h2 class="pagehead__title">${titel}</h2>
    </div>
  </div>`;
}

/** Den Zurueck-Pfeil verdrahten. Jede Uebersichtsseite ruft das am Ende auf. */
function explorerZurueck() {
  main.querySelector('[data-explorer-back]')?.addEventListener('click', () => {
    state.explorerView = null;
    state.explorerParam = null;
    render();
  });
}

function renderReelsExplorer() {
  main.innerHTML = `
    ${explorerKopf('Reels')}
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
  explorerZurueck();
}

function renderClipsExplorer() {
  main.innerHTML = `
    ${explorerKopf('Querformat')}
    <div class="scroll">
      ${state.clips.map((c) => `
        <button class="exp__row" data-openclip="${c.id}">
          <span class="exp__thumb">${medienFlaeche(c.id, ICONS.landscape, c.mediaUrl)}</span>
          <span class="exp__text">
            <strong>${esc(c.title)}</strong>
            <small>${esc(user(c.userId).name)} · ${esc(c.duration)}</small>
          </span>
        </button>`).join('')}
    </div>`;
  main.querySelectorAll('[data-openclip]').forEach(b => b.addEventListener('click', () => openClip(b.dataset.openclip)));
  explorerZurueck();
}

function renderPostsExplorer() {
  main.innerHTML = `
    ${explorerKopf('Beiträge')}
    <div class="scroll">
      <div class="exp__grid">${state.posts.map((p) => `
        <button class="griditem" data-openpost="${p.id}">${medienFlaeche(p.id, ICONS.image, p.mediaUrl)}</button>`).join('')}</div>
    </div>`;
  main.querySelectorAll('[data-openpost]').forEach(b => b.addEventListener('click', () => openPost(b.dataset.openpost)));
  explorerZurueck();
}

function renderHashtagExplorer(tag) {
  const items = state.videos.filter(v => v.tags?.includes(tag))
    .concat(state.clips.filter(c => c.tags?.includes(tag)))
    .concat(state.posts.filter(p => p.tags?.includes(tag)));
  main.innerHTML = `
    ${explorerKopf(esc(tag))}
    <div class="scroll">
      <div class="exp__grid">${items.slice(0, 20).map((i) => `
        <button class="griditem" data-item="${i.id}" data-type="${i.userId ? (i.duration ? 'video' : 'post') : 'clip'}">${medienFlaeche(i.id, ICONS.image, i.mediaUrl)}</button>`).join('')}</div>
    </div>`;
  explorerZurueck();
}

/*
 * Uebersichtsseiten fuer Profile, Hashtags, Standorte und Sounds.
 *
 * Henrik am 26.08.2026: "Profile, Hashtags, Standorte, Sounds haben keinen
 * Pfeil zum Mehr anzeigen." Reels, Querformat und Beitraege hatten laengst
 * eine eigene Seite, diese vier nicht — die Suche zeigte dort nur die ersten
 * Treffer und man kam nicht weiter.
 *
 * Alle vier zeigen dieselbe Liste wie die Suche, nur vollstaendig und ohne
 * die Beschraenkung auf den Suchbegriff.
 */
function renderProfileExplorer() {
  const leute = Object.values(state.users).filter((u) => u.id !== 'me');
  main.innerHTML = `
    ${explorerKopf('Profile')}
    <div class="scroll">
      <div class="exp__list">${leute
        .map(
          (u) => `<button class="exp__row" data-profile="${u.id}">
            <span class="avatar avatar--44" style="background:${u.color}">${esc(u.initials)}</span>
            <span class="exp__text"><strong>${esc(u.name)}</strong><small>${esc(u.handle)}</small></span>
          </button>`
        )
        .join('')}</div>
    </div>`;
  // data-profile faengt der Klickfaenger an .app ab - hier nichts verdrahten,
  // sonst ginge das Profil zweimal auf.
  explorerZurueck();
}

function renderHashtagsExplorer() {
  main.innerHTML = `
    ${explorerKopf('# Hashtags')}
    <div class="scroll">
      <div class="exp__list">${state.hashtags
        .map(
          (h) => `<button class="exp__row" data-tag="${esc(h.tag)}">
            <span class="exp__thumb exp__thumb--kategorie">${ICONS.hash || ICONS.search}</span>
            <span class="exp__text"><strong>${esc(h.tag)}</strong><small>${compactNumber(h.posts)} Beiträge</small></span>
          </button>`
        )
        .join('')}</div>
    </div>`;
  main.querySelectorAll('[data-tag]').forEach((b) =>
    b.addEventListener('click', () => openExplorer('hashtag', b.dataset.tag))
  );
  explorerZurueck();
}

function renderStandorteExplorer() {
  main.innerHTML = `
    ${explorerKopf('Standorte')}
    <div class="scroll">
      <div class="exp__list">${state.places
        .map(
          (pl) => `<button class="exp__row" data-place="${pl.id}">
            <span class="exp__thumb exp__thumb--kategorie">${ICONS.mapPin}</span>
            <span class="exp__text"><strong>${esc(pl.name)}</strong><small>${compactNumber(pl.posts)} Beiträge</small></span>
          </button>`
        )
        .join('')}</div>
    </div>`;
  main.querySelectorAll('[data-place]').forEach((b) =>
    b.addEventListener('click', () => openExplorer('standort', b.dataset.place))
  );
  explorerZurueck();
}

function renderSoundsExplorer() {
  main.innerHTML = `
    ${explorerKopf('Sounds')}
    <div class="scroll">
      <div class="exp__list">${state.sounds
        .map(
          (so) => `<button class="exp__row" data-sound="${so.id}">
            <span class="exp__thumb exp__thumb--kategorie">${ICONS.music}</span>
            <span class="exp__text"><strong>${esc(so.title)}</strong><small>${esc(so.artist)} · ${compactNumber(so.uses)} Videos</small></span>
          </button>`
        )
        .join('')}</div>
    </div>`;
  main.querySelectorAll('[data-sound]').forEach((b) =>
    b.addEventListener('click', () => openExplorer('sound', b.dataset.sound))
  );
  explorerZurueck();
}

function renderPlaceExplorer(placeId) {
  const place = state.places.find(p => p.id === placeId);
  const items = state.videos.filter(v => v.location === place?.name)
    .concat(state.clips.filter(c => c.location === place?.name))
    .concat(state.posts.filter(p => p.location === place?.name));
  main.innerHTML = `
    ${explorerKopf(esc(place?.name || 'Standort'))}
    <div class="scroll">
      <div class="exp__grid">${items.slice(0, 20).map((i) => `
        <button class="griditem" data-item="${i.id}">${medienFlaeche(i.id, ICONS.image, i.mediaUrl)}</button>`).join('')}</div>
    </div>`;
  explorerZurueck();
}

/*
 * Kachel fuer Reels und Beitraege in den Uebersichten.
 *
 * Henrik wollte unter jedem Video dieselben Angaben sehen wie im Kurzformat:
 * Profilbild, Name und - wenn vorhanden - Ort und Musik. Vorher stand dort
 * nur der Name mitten in einer leeren Flaeche.
 *
 * `art` ist das data-Attribut, ueber das der Klick verarbeitet wird
 * ("openvideo" oder "openpost"), `form` unterscheidet die waagerechte Reihe
 * von der dreispaltigen Rasterdarstellung.
 */
function medienKachel(eintrag, art, symbol, form) {
  const u = user(eintrag.userId);
  const zusatz = [eintrag.location, eintrag.music].filter(Boolean).join(' · ');

  return `
    <button class="exp__card exp__card--${form}" data-${art}="${eintrag.id}">
      <span class="exp__card-media">${medienFlaeche(eintrag.id, symbol, eintrag.mediaUrl)}</span>
      <span class="exp__card-info">
        <span class="exp__card-kopf">
          <span class="exp__card-avatar" style="background:${u.color}">${esc(u.initials)}</span>
          <strong>${esc(u.name)}</strong>
        </span>
        ${zusatz ? `<small>${esc(zusatz)}</small>` : ''}
      </span>
    </button>`;
}

/*
 * Wechselt in einen Unterpunkt und stellt das genannte Element oben hin.
 *
 * Der Aufbau laeuft ueber render(); erst danach steht das Element im
 * Dokument. requestAnimationFrame wartet genau diesen einen Bildaufbau ab -
 * ein fester Zeitwert waere geraten und bei langsamen Geraeten zu kurz.
 */
function springeZu(unterpunkt, elementId) {
  state.sub.videos = unterpunkt;
  render();
  requestAnimationFrame(() => {
    const ziel = document.getElementById(elementId);
    if (ziel) ziel.scrollIntoView({ block: 'start' });
  });
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

  /*
   * Henrik: "Die Kategorien muessen jeweils auf eigene Uebersichtsseiten
   * fuehren, wenn man auf die Ueberschrift bzw. den Pfeil drueckt."
   *
   * Die Uebersichtsseiten gab es schon (renderReelsExplorer und die anderen),
   * aber die Ueberschrift war ein <div> - man kam also nie hin. `ziel` ist
   * der Wert fuer state.explorerView; ohne Ziel bleibt die Zeile eine reine
   * Beschriftung.
   */
  const section = (title, body, ziel) => {
    if (!body) return '';
    const kopf = ziel
      ? `<button class="exp__head" data-explorer="${ziel}">${title} →</button>`
      : `<div class="exp__head">${title}</div>`;
    return `<div class="exp">${kopf}${body}</div>`;
  };
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
                    .map((v) => medienKachel(v, 'openvideo', ICONS.portrait, 'reihe'))
                    .join('')}</div>`
                : '',
              'reels'
            ) +
            section(
              'Querformat',
              clips.length
                ? `<div class="exp__list">${clips
                    .map(
                      (c) => `<button class="exp__row" data-openclip="${c.id}">
                        <span class="exp__thumb">${medienFlaeche(c.id, ICONS.landscape, c.mediaUrl)}</span>
                        <span class="exp__text"><strong>${esc(c.title)}</strong><small>${esc(user(c.userId).name)} · ${esc(c.duration)}</small></span>
                      </button>`
                    )
                    .join('')}</div>`
                : '',
              'clips'
            ) +
            section(
              'Beiträge',
              posts.length
                ? `<div class="exp__grid">${posts.map((p) => medienKachel(p, 'openpost', ICONS.image, 'raster')).join('')}</div>`
                : '',
              'posts'
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
                : '',
              'profile'
            ) +
            section(
              '# Hashtags',
              tags.length
                ? `<div class="exp__tags">${tags
                    .map((h) => `<button class="chip" data-tag="${esc(h.tag)}">${esc(h.tag)} · ${compactNumber(h.posts)}</button>`)
                    .join('')}</div>`
                : '',
              'hashtags'
            ) +
            section(
              'Standorte',
              places.length
                ? `<div class="exp__list">${places
                    .map(
                      (pl) => `<button class="exp__row" data-place="${pl.id}">
                        <span class="exp__thumb exp__thumb--kategorie">${ICONS.mapPin}</span>
                        <span class="exp__text"><strong>${esc(pl.name)}</strong><small>${compactNumber(pl.posts)} Beiträge</small></span>
                      </button>`
                    )
                    .join('')}</div>`
                : '',
              'standorte'
            ) +
            section(
              'Sounds',
              sounds.length
                ? `<div class="exp__list">${sounds
                    .map(
                      (so) => `<button class="exp__row" data-sound="${so.id}">
                        <span class="exp__thumb exp__thumb--kategorie">${ICONS.music}</span>
                        <span class="exp__text"><strong>${esc(so.title)}</strong><small>${esc(so.artist)} · ${compactNumber(so.uses)} Videos</small></span>
                      </button>`
                    )
                    .join('')}</div>`
                : '',
              'sounds'
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

  /*
   * Henrik: "Beim Anklicken eines Reels direkt zum jeweiligen Reel gehen,
   * nicht zur Startseite." Dasselbe fuer Querformat und Beitraege.
   *
   * Vorher wurde nur der Bereich gewechselt - man landete oben im Feed und
   * musste das angetippte Video selbst wiederfinden.
   */
  main.querySelectorAll('[data-openvideo]').forEach((b) =>
    b.addEventListener('click', () => springeZu('portrait', `slide-${b.dataset.openvideo}`))
  );
  main.querySelectorAll('[data-openclip]').forEach((b) =>
    b.addEventListener('click', () => openClip(b.dataset.openclip))
  );
  main.querySelectorAll('[data-openpost]').forEach((b) =>
    b.addEventListener('click', () => springeZu('home', `post-${b.dataset.openpost}`))
  );
  // Ueberschrift oder Pfeil oeffnet die Uebersichtsseite der Kategorie.
  main.querySelectorAll('[data-explorer]').forEach((b) =>
    b.addEventListener('click', () => {
      state.explorerView = b.dataset.explorer;
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
      // "VP + Einstellung" bzw. "CP + Einstellung". Der Pfeil oben links
      // fuehrt von dort wieder ins Profil zurueck.
      zuDenEinstellungen(bereich === 'communities' ? 'communitys' : 'videos');
    })
  );
}

/* ---------------------------------------------------------- Plus: Erstellen */
// Genau die Punkte aus dem Prototyp-Frame "VP + erstellen".
// Die Symbole kamen spaeter dazu. Vorher standen hier acht nackte Textzeilen
// untereinander - das liest sich wie eine unfertige Liste, nicht wie das
// Menue, ueber das in dieser App alles entsteht. Gleiche Zuordnung wie in der
// App (components/ErstellenSheet.tsx).
const ERSTELLEN_VIDEOS = [
  { key: 'reels', label: 'Reels', icon: 'portrait' },
  { key: 'landscape', label: 'Querformat', icon: 'landscape' },
  { key: 'post', label: 'Beitrag', icon: 'image' },
  { key: 'story', label: 'Story', icon: 'camera' },
  // Livestream steht direkt unter Story: beides ist im Augenblick aufgenommen
  // und nach kurzer Zeit wieder weg. Highlight und Playlist sortieren dagegen
  // vorhandene Beitraege und gehoeren darum weiter nach unten.
  { key: 'livestream', label: 'Livestream', icon: 'video' },
  { key: 'highlight', label: 'Highlight', icon: 'folder' },
  { key: 'playlist', label: 'Playlist', icon: 'ebenen' },
  { key: 'spende', label: 'Spendenaktion', icon: 'heart' },
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
               <span class="erstellen__icon">${ICONS[p.icon]}</span>
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
/*
 * Video-Einstellungen im Querformat — Henrik, Punkt 31: "Keine Einstellungen
 * (Untertitel, Geschwindigkeit). Nach YouTube."
 *
 * Aufgebaut wie dort: ein Blatt mit drei Punkten, jeder zeigt rechts seinen
 * Stand. Die Auswahl gilt fuer alle Videos und ueberlebt einen Neustart -
 * eine Geschwindigkeit, die man bei jedem Video neu einstellen muss, waere
 * keine Einstellung, sondern ein Schalter.
 *
 * Untertitel bietet nur an, wer welche hat. Ein Punkt, der bei jedem zweiten
 * Video ins Leere fuehrt, ist schlechter als keiner.
 */
function openVideoOptionen(clip, danach) {
  const TEMPO = [0.5, 0.75, 1, 1.25, 1.5, 2];
  const QUALITAET = ['Automatisch', '1080p', '720p', '480p', '240p'];
  const tempoText = (t) => (t === 1 ? 'Normal' : `${String(t).replace('.', ',')}×`);

  const sichern = () => {
    localStorage.setItem('am-video-tempo', JSON.stringify(state.video.tempo));
    localStorage.setItem('am-video-qualitaet', state.video.qualitaet);
    localStorage.setItem('am-video-untertitel', state.video.untertitel ? 'an' : 'aus');
  };

  /** Eine der Listen als eigenes Blatt oeffnen. */
  const waehlen = (titel, werte, aktuell, beschriften, uebernehmen) => {
    openSheet(
      titel,
      `<div class="sheet__body">
         ${werte
           .map(
             (w) => `<button class="item ${w === aktuell ? 'is-aktiv' : ''}" data-vwahl="${esc(String(w))}">
               <span class="item__label">${esc(beschriften(w))}</span>
               ${w === aktuell ? `<span class="item__value">${ICONS.check}</span>` : ''}
             </button>`
           )
           .join('')}
       </div>`,
      (blatt, zu) => {
        blatt.querySelectorAll('[data-vwahl]').forEach((b) =>
          b.addEventListener('click', () => {
            uebernehmen(b.dataset.vwahl);
            sichern();
            zu();
            toast(`${titel}: ${beschriften(werte.find((w) => String(w) === b.dataset.vwahl))}`);
            danach?.();
          })
        );
      },
      { schliessen: true }
    );
  };

  /*
   * Nur wer das Feld hat, hat Untertitel. Andersherum (`!== false`) waere es
   * falsch: ein Video ohne Angabe bekaeme den Punkt angeboten und der
   * Schalter fuehrte ins Leere. Live-Videos und 360°-Aufnahmen haben in
   * dieser Fassung keine.
   */
  const hatUntertitel = !!clip.untertitel;

  openSheet(
    'Video-Einstellungen',
    `<div class="sheet__body">
       <button class="item" data-vopt="tempo">
         <span class="item__icon">${ICONS.clock}</span>
         <span class="item__label">Wiedergabegeschwindigkeit</span>
         <span class="item__value">${esc(tempoText(state.video.tempo))}</span>
         <span class="row__chevron">${ICONS.chevron}</span>
       </button>
       <button class="item" data-vopt="qualitaet">
         <span class="item__icon">${ICONS.settings}</span>
         <span class="item__label">Qualität</span>
         <span class="item__value">${esc(state.video.qualitaet)}</span>
         <span class="row__chevron">${ICONS.chevron}</span>
       </button>
       ${
         hatUntertitel
           ? `<div class="item">
                <span class="item__icon">${ICONS.checkDouble}</span>
                <span class="item__label">Untertitel</span>
                <button class="switch ${state.video.untertitel ? 'is-on' : ''}" data-vopt="untertitel" aria-label="Untertitel"><span class="switch__knob"></span></button>
              </div>`
           : `<div class="sheet__hint">Für dieses Video gibt es keine Untertitel.</div>`
       }
     </div>`,
    (blatt, zu) => {
      blatt.querySelectorAll('[data-vopt]').forEach((b) =>
        b.addEventListener('click', () => {
          const was = b.dataset.vopt;

          if (was === 'untertitel') {
            state.video.untertitel = !state.video.untertitel;
            sichern();
            b.classList.toggle('is-on');
            return toast(state.video.untertitel ? 'Untertitel an' : 'Untertitel aus');
          }

          zu();
          if (was === 'tempo') {
            return waehlen('Geschwindigkeit', TEMPO, state.video.tempo, tempoText, (w) => {
              state.video.tempo = Number(w);
            });
          }
          waehlen('Qualität', QUALITAET, state.video.qualitaet, (w) => w, (w) => {
            state.video.qualitaet = w;
          });
        })
      );
    },
    { schliessen: true }
  );
}

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
          <button class="seitenbtn" id="clipBack" aria-label="Zurück">${ICONS.back}</button>
        </div>
        <div class="scroll">
          <div class="player">
            <div class="player__stage" id="clipStage">
              ${medienFlaeche(clip.id, ICONS.play, clip.mediaUrl)}
              <button class="player__play" id="clipPlay" aria-label="Abspielen">${ICONS.play}</button>
            </div>
            <div class="player__leiste">
              <span class="player__zeit" id="clipZeit">${zeit(bei)}</span>
              <span class="player__balken" id="clipBalken"><i id="clipFortschritt" style="width:0%"></i></span>
              <span class="player__zeit">${esc(clip.duration)}</span>
              ${/*
                  Punkt 31 und 30: Einstellungen und Vollbild. Beide sitzen in
                  der Leiste unter dem Bild, dort sucht man sie von YouTube her.
                */ ''}
              <button class="player__knopf" id="clipOptionen" aria-label="Video-Einstellungen">${ICONS.settings}</button>
              <button class="player__knopf" id="clipVollbild" aria-label="Vollbild">${ICONS.ausklappen}</button>
            </div>
          </div>

          ${
            /*
             * Kapitel (Punkt 32). Nur wenn das Video welche hat - eine leere
             * Ueberschrift ueber nichts waere schlechter als gar keine.
             */
            clip.kapitel?.length
              ? `<div class="kapitel">
                   <div class="kapitel__kopf">Kapitel</div>
                   ${clip.kapitel
                     .map(
                       (k, i) => `<button class="kapitel__zeile" data-kapitel="${k.bei}">
                         <span class="kapitel__zeit">${zeit(k.bei)}</span>
                         <span class="kapitel__titel">${esc(k.titel)}</span>
                         <span class="kapitel__dauer">${
                           clip.kapitel[i + 1] ? zeit(clip.kapitel[i + 1].bei - k.bei) : zeit(gesamt - k.bei)
                         }</span>
                       </button>`
                     )
                     .join('')}
                 </div>`
              : ''
          }

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

          ${/*
              Henrik am 26.08.2026, Punkte 28 und 29: "Merken zu weit
              entfernt; Teilen/Repost zu nah beieinander. Alle fünf sauber
              nebeneinander." Und: "Aktionsspalte verändert sich beim Liken."

              Beides kam aus derselben Ecke. "Merken" trug
              postbtn--end (margin-left: auto) und wurde deshalb ans Ende
              geschoben, waehrend die anderen vier links zusammenklebten. Und
              weil die Zahl neben Herz und Sprechblase erst auftaucht, wenn es
              etwas zu zaehlen gibt, sprang beim ersten Like die ganze Reihe.

              Jetzt ein Raster aus fuenf gleichen Spalten: jeder Knopf hat
              seinen Platz, unabhaengig davon, was in ihm steht. Die Zahl
              steht unter dem Symbol statt daneben - so aendert sie die Breite
              gar nicht mehr.
            */ ''}
          <div class="post__actions post__actions--fuenf">
            <button class="postbtn ${clip.liked ? 'is-liked' : ''}" data-clipact="like" aria-label="Gefällt mir">
              ${ICONS.heart}<span class="postbtn__zahl">${clip.likes ? compactNumber(clip.likes) : 'Like'}</span>
            </button>
            <button class="postbtn" data-clipact="comment" aria-label="Kommentieren">
              ${ICONS.chat}<span class="postbtn__zahl">${clip.comments ? compactNumber(clip.comments) : 'Kommentar'}</span>
            </button>
            <button class="postbtn" data-clipact="share" aria-label="Senden">
              ${ICONS.send}<span class="postbtn__zahl">Teilen</span>
            </button>
            <button class="postbtn ${clip.reposted ? 'is-reposted' : ''}" data-clipact="repost" aria-label="Repost">
              ${ICONS.repeat}<span class="postbtn__zahl">Repost</span>
            </button>
            <button class="postbtn ${clip.saved ? 'is-saved' : ''}" data-clipact="save" aria-label="Speichern">
              ${ICONS.bookmark}<span class="postbtn__zahl">${clip.saved ? 'Gespeichert' : 'Speichern'}</span>
            </button>
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
                  <div class="clip__thumb">${medienFlaeche(c.id, ICONS.landscape, c.mediaUrl)}<span class="clip__time">${esc(c.duration)}</span></div>
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

    /*
     * Vollbild (Punkt 30). Zwei Wege, weil keiner allein reicht: im Browser
     * die Fullscreen-API, und wo die fehlt oder abgelehnt wird - iOS Safari
     * erlaubt sie nur fuer echte <video>-Elemente - eine Klasse, die den
     * Player ueber den ganzen Bildschirm legt. Beides zusammen heisst: der
     * Knopf tut immer etwas.
     */
    const vollbildKnopf = overlay.querySelector('#clipVollbild');
    const spieler = overlay.querySelector('.player');

    const vollbildAn = () => document.fullscreenElement === spieler || spieler.classList.contains('player--voll');

    const vollbildUmschalten = async () => {
      if (vollbildAn()) {
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
        spieler.classList.remove('player--voll');
        vollbildKnopf.innerHTML = ICONS.ausklappen;
        vollbildKnopf.setAttribute('aria-label', 'Vollbild');
        return;
      }

      if (spieler.requestFullscreen) {
        try {
          await spieler.requestFullscreen();
        } catch {
          spieler.classList.add('player--voll');
        }
      } else {
        spieler.classList.add('player--voll');
      }
      vollbildKnopf.innerHTML = ICONS.einklappen;
      vollbildKnopf.setAttribute('aria-label', 'Vollbild beenden');
    };

    vollbildKnopf.addEventListener('click', (e) => {
      e.stopPropagation();
      vollbildUmschalten();
    });

    // Escape oder die Geste des Systems beenden das Vollbild ohne unseren
    // Knopf - dann muss das Symbol trotzdem zurueckspringen.
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && !spieler.classList.contains('player--voll')) {
        vollbildKnopf.innerHTML = ICONS.ausklappen;
        vollbildKnopf.setAttribute('aria-label', 'Vollbild');
      }
    });

    /* Video-Einstellungen (Punkt 31), nach dem Vorbild von YouTube. */
    overlay.querySelector('#clipOptionen').addEventListener('click', (e) => {
      e.stopPropagation();
      openVideoOptionen(clip, paint);
    });

    /* Kapitel (Punkt 32): ein Klick springt an die Stelle. */
    overlay.querySelectorAll('[data-kapitel]').forEach((b) =>
      b.addEventListener('click', () => {
        bei = Math.min(gesamt, Number(b.dataset.kapitel));
        const zeitFeld = overlay.querySelector('#clipZeit');
        if (zeitFeld) zeitFeld.textContent = zeit(bei);
        const balken = overlay.querySelector('#clipFortschritt');
        if (balken) balken.style.width = `${(bei / gesamt) * 100}%`;
        overlay.querySelectorAll('[data-kapitel]').forEach((x) => x.classList.remove('is-aktiv'));
        b.classList.add('is-aktiv');
      })
    );

    /* Im Balken an eine Stelle springen - ohne das ist er nur Deko. */
    overlay.querySelector('#clipBalken').addEventListener('click', (e) => {
      const kasten = e.currentTarget.getBoundingClientRect();
      const anteil = Math.min(1, Math.max(0, (e.clientX - kasten.left) / kasten.width));
      bei = Math.round(gesamt * anteil);
      overlay.querySelector('#clipZeit').textContent = zeit(bei);
      overlay.querySelector('#clipFortschritt').style.width = `${anteil * 100}%`;
    });

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
/*
 * Alle Fotos an einem Ort — Prototyp-Frame "VSS + Standort + Alle Fotos".
 *
 * Der Frame zeigt untereinander quadratische Aufnahmen, jede mit Autorzeile
 * (Bild, Name, "Standort · Musik") und der Aktionsreihe darunter. Also ein
 * Feed, keine Rasteruebersicht - und ausdruecklich nur Fotos: Reels und
 * Querformat-Videos bleiben draussen.
 */
function openOrtFotos(ort, fotos) {
  const zeichnen = (liste) => {
    overlay.innerHTML = `
      <div class="page">
        <div class="page__bar">
          <button class="seitenbtn" id="fotosBack" aria-label="Zurück">${ICONS.back}</button>
          <div class="page__titel">Alle Fotos</div>
          ${/*
              Punkt 10, zweiter Teil: "Möglichkeit für User, Fotos
              hochzuladen." Der Knopf nimmt eine Datei entgegen und legt sie
              als Beitrag an diesem Ort ab.
            */ ''}
          <button class="seitenbtn" id="fotosNeu" aria-label="Foto hinzufügen">${ICONS.plus}</button>
        </div>
        <div class="scroll">
          <div class="ortfotos__sub">${esc(ort.titel)} · ${liste.length} ${
            liste.length === 1 ? 'Foto' : 'Fotos'
          }</div>
          ${
            liste.length
              ? liste
                  .map((p) => {
                    const u = user(p.userId);
                    return `<article class="ortfoto">
                      <div class="ortfoto__bild">${
                        p.mediaUri
                          ? `<img src="${esc(p.mediaUri)}" alt="" />`
                          : medienFlaeche(p.id, ICONS.image, p.mediaUrl)
                      }</div>
                      <div class="ortfoto__zeile">
                        <span data-profile="${p.userId}">${avatarForUser(p.userId, 36)}</span>
                        <div class="ortfoto__wer">
                          <div class="ortfoto__name" data-profile="${p.userId}">${esc(u.name)}</div>
                          <div class="ortfoto__meta">${esc(p.location || ort.titel)}${
                            p.music ? ` · ${esc(p.music)}` : ''
                          }</div>
                        </div>
                        <button class="postbtn ${p.liked ? 'is-liked' : ''}" data-fotolike="${p.id}" aria-label="Gefällt mir">${ICONS.heart}</button>
                      </div>
                    </article>`;
                  })
                  .join('')
              : `<div class="empty">${ICONS.image}
                   <div class="empty__title">Noch keine Fotos</div>
                   <div class="empty__text">Über das Plus oben rechts legst du das erste hier ab.</div>
                 </div>`
          }
        </div>
      </div>`;

    overlay.querySelector('#fotosBack').addEventListener('click', () => openExplorer('standort', ort.id));

    overlay.querySelectorAll('[data-fotolike]').forEach((b) =>
      b.addEventListener('click', async () => {
        const res = await fetch(`/api/posts/${b.dataset.fotolike}/like`, { method: 'POST' });
        const frisch = await res.json();
        const stelle = liste.findIndex((x) => x.id === frisch.id);
        if (stelle !== -1) liste[stelle] = frisch;
        const imFeed = state.posts.findIndex((x) => x.id === frisch.id);
        if (imFeed !== -1) state.posts[imFeed] = frisch;
        zeichnen(liste);
      })
    );

    overlay.querySelector('#fotosNeu').addEventListener('click', async () => {
      const datei = await dateiWaehlen('photo');
      if (!datei) return;

      let bild = null;
      try {
        bild = await bildVerkleinern(datei);
      } catch {
        return toast('Aufnahme konnte nicht gelesen werden');
      }

      /*
       * Der Ort steht schon fest - man kam ja von seiner Seite. Deshalb nur
       * die Beschreibung erfragen und nicht noch einmal nach dem Ort.
       */
      openFormular(
        'Foto an diesem Ort',
        [{ key: 'beschreibung', label: 'Beschreibung', typ: 'mehrzeilig', pflicht: true }],
        async ({ beschreibung }) => {
          const res = await fetch('/api/eigene/beitrag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ beschreibung, ort: ort.titel }),
          }).then((r) => r.json());

          if (!res.ok) return res.error || 'Das hat nicht geklappt';

          // Das Bild selbst bleibt im Browser - der Server teilt seinen
          // Speicher mit allen, siehe eigenesMediumSichern.
          eigenesMediumSichern(res.beitrag.id, bild);
          res.beitrag.mediaUri = bild;
          liste.unshift(res.beitrag);
          state.posts.unshift(res.beitrag);
          toast('Foto hinzugefügt');
          zeichnen(liste);
          return null;
        },
        'Hinzufügen'
      );
    });
  };

  overlay.hidden = false;
  zeichnen([...fotos]);
}

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
            ${medienFlaeche(v.id, ICONS.play, v.mediaUrl)}
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
            <div class="clip__thumb">${medienFlaeche(c.id, ICONS.landscape, c.mediaUrl)}<span class="clip__time">${esc(c.duration)}</span></div>
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
        .map((p) => `<button class="griditem" data-openpost="${p.id}">${medienFlaeche(p.id, ICONS.image, p.mediaUrl)}</button>`)
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
      ${/*
          Punkt 11: der Liedtext. Prototyp-Frame "VSSo + Sound + Lyrics" -
          Songname, Produzent/in, Trennlinie, darunter der Text ueber die
          ganze Seite. Vorher stand hier eine einzige Zeile, und bei einem
          Instrumental das Wort "Instrumental" als waere es eine Liedzeile.

          Leere Eintraege in der Liste sind Strophenabstaende - sie bekommen
          eine eigene Klasse, damit die Luecke im CSS steht und nicht als
          leerer Absatz im Text.
        */ ''}
      ${
        kopf.lyrics?.length
          ? `<div class="lyrics">
               <div class="lyrics__kopf">Liedtext</div>
               ${kopf.lyrics
                 .map((zeile) =>
                   zeile.trim()
                     ? `<div class="lyrics__zeile">${esc(zeile)}</div>`
                     : '<div class="lyrics__luecke"></div>'
                 )
                 .join('')}
             </div>`
          : `<div class="lyrics lyrics--ohne">Zu diesem Sound gibt es keinen Liedtext.</div>`
      }`,
  }[kopf.art]();

  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="page">
      <div class="page__bar">
        <button class="seitenbtn" id="expBack" aria-label="Zurück">${ICONS.back}</button>
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

  /*
   * Punkt 10: "Alle Fotos ansehen bei einem Ort leitet zu Videos/Beiträgen;
   * soll nur Fotos zeigen. Eigene Seite nur mit Fotos an diesem Ort;
   * Möglichkeit für User, Fotos hochzuladen."
   *
   * Vorher scrollte der Knopf nur nach unten und gab einen Hinweis aus - man
   * landete in derselben Liste aus Reels, Querformat und Beitraegen, aus der
   * man kam.
   */
  overlay.querySelector('#expFotos')?.addEventListener('click', () => openOrtFotos(kopf, beitraege));

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
/*
 * Wo noch kein echtes Bild liegt, stand bisher ein graues Feld mit einem
 * durchgestrichenen Bildsymbol darin - das liest sich wie ein Ladefehler und
 * zieht die ganze Seite nach unten. Stattdessen bekommt jeder Beitrag eine
 * ruhige Farbflaeche, stabil aus seiner Kennung gewaehlt. Das Symbol liegt
 * blass darauf und sagt nur noch, um welche Art Medium es geht.
 */
const MOTIVE = 8;

function motivVon(id) {
  let h = 0;
  for (const z of String(id)) h = (h * 31 + z.charCodeAt(0)) >>> 0;
  return h % MOTIVE;
}

/**
 * Die Bildflaeche eines Beitrags.
 *
 * Drei Faelle, in dieser Reihenfolge:
 *
 *   1. Eine Aufnahme, die auf diesem Geraet gemacht wurde. Sie liegt im
 *      Browser, nicht auf dem Server — der teilt seinen Speicher mit allen
 *      Besuchern.
 *   2. Das Bild aus der Datenbank. Bis zum 01.09.2026 wurde es hier gar nicht
 *      abgefragt: der Server liefert es als `mediaUrl`, gesucht wurde nur in
 *      den eigenen Aufnahmen. Die Testbeitraege trugen deshalb im Browser
 *      eine Ersatzflaeche, waehrend die App ihr Bild zeigte.
 *   3. Sonst die Ersatzflaeche — eine ruhige Farbe, kein grauer Kasten.
 */
function medienFlaeche(id, symbol, adresse) {
  const bild = eigeneMedien()[id] || adresse;
  if (bild) return `<img class="eigenbild" src="${esc(bild)}" alt="">`;
  return `<span class="motiv motiv--${motivVon(id)}">${symbol}</span>`;
}

/* ------------------------------------------------------ Formular-Blatt */
/**
 * Ein Blatt mit Eingabefeldern. felder: { key, label, typ, platzhalter,
 * pflicht, wert }. `aufSenden` bekommt die Werte und gibt bei einem Fehler
 * einen Text zurueck - dann bleibt das Blatt offen.
 */
/*
 * Nachfrage mit zwei Knoepfen. Gibt true zurueck, wenn bestaetigt wurde.
 *
 * Gebraucht fuer gesperrte Chats: dort muss eine Antwort abgewartet werden,
 * bevor der Chat aufgeht. window.confirm waere der kuerzere Weg, sieht aber
 * auf dem Handy nach Browser aus und nicht nach App.
 */
function bestaetigen(titel, text, knopf = 'Weiter') {
  return new Promise((fertig) => {
    let antwort = false;
    openSheet(
      titel,
      `<div class="sheet__body">
         <div class="sheet__hint">${esc(text)}</div>
         <div class="sheet__footer">
           <button class="btn" id="nachfrageNein">Abbrechen</button>
           <button class="btn btn--primary" id="nachfrageJa">${esc(knopf)}</button>
         </div>
       </div>`,
      (sheet, close) => {
        sheet.querySelector('#nachfrageJa').addEventListener('click', () => {
          antwort = true;
          close();
        });
        sheet.querySelector('#nachfrageNein').addEventListener('click', close);
      },
      { schliessen: true, beimSchliessen: () => fertig(antwort) }
    );
  });
}

function openFormular(titel, felder, senden, knopf = 'Fertig') {
  const feldHtml = (f) => {
    const gemeinsam = `id="f_${f.key}" placeholder="${esc(f.platzhalter || '')}"`;
    const eingabe =
      f.typ === 'mehrzeilig'
        ? `<textarea ${gemeinsam} rows="3">${esc(f.wert || '')}</textarea>`
        : // Punkt 38: eine Auswahl statt eines Textfelds - Musik tippt man
          // nicht ab, man sucht sie aus dem aus, was es gibt.
          f.typ === 'auswahl'
          ? `<select id="f_${f.key}">${(f.auswahl || [])
              .map((w) => `<option value="${esc(w)}" ${w === f.wert ? 'selected' : ''}>${esc(w)}</option>`)
              .join('')}</select>`
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
      // Eine Auswahl bekommt keinen Fokus - sonst klappt sie beim Oeffnen auf.
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
        // Punkt 44: das Ziel ist freiwillig. Nicht jede Sammlung hat einen
        // Betrag, auf den sie zulaeuft - manche laufen einfach.
        { key: 'ziel', label: 'Spendenziel in Euro (freiwillig)', typ: 'zahl', platzhalter: '500' },
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
      // Punkt 38: Musik zum Beitrag. Zur Wahl steht, was es an Sounds gibt -
      // dieselbe Liste, die auch hinter den Sound-Seiten steckt.
      {
        key: 'music',
        label: 'Musik',
        typ: 'auswahl',
        auswahl: ['Originalton', ...(state.sounds || []).map((s) => `${s.title} – ${s.artist}`)],
        wert: 'Originalton',
      },
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
        ${/*
            Punkt 46: "Keine Lösch-Option. Löschen möglich (neben Beenden)."
            "Beenden" behaelt die Aufzeichnung und legt sie ins Querformat -
            "Verwerfen" laesst gar nichts zurueck. Beides muss zur Wahl
            stehen, sonst bleibt jeder Versuchsstream fuer immer im Profil.
          */ ''}
        <button class="prof__btn" id="liveWeg">Verwerfen</button>
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

  overlay.querySelector('#liveWeg').addEventListener('click', async () => {
    const sicher = await bestaetigen(
      'Livestream verwerfen',
      'Der Stream endet und es bleibt keine Aufzeichnung zurück.',
      'Verwerfen'
    );
    if (!sicher) return;

    clearInterval(uhr);
    /*
     * Erst beenden, dann die entstandene Aufzeichnung wieder loeschen. Der
     * Server legt sie beim Beenden an - ein eigener "abbrechen"-Weg waere
     * eine zweite Stelle, an der dieselbe Logik steht.
     */
    const daten = await fetch('/api/eigene/livestream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktion: 'stop' }),
    }).then((r) => r.json());

    if (daten.clip?.id) {
      await fetch(`/api/eigene/${daten.clip.id}/loeschen`, { method: 'POST' });
    }

    overlay.hidden = true;
    overlay.innerHTML = '';
    await bootstrap();
    toast('Livestream verworfen');
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
        <button data-oact="menu" aria-label="Menü">${ICONS.menu}</button>
      </span>
    </div>`;
}

/*
 * Die Reihe aus Playlists und Highlights unter einem Profil.
 *
 * Als eigene Funktion, weil Henrik am 26.08.2026 zwei Dinge dazu gemeldet
 * hat, die beide daher kamen, dass es die Reihe zweimal gab:
 *
 *   Punkt 39  Playlist und Highlight waren nicht zu unterscheiden.
 *   Punkt 48  Auf fremden Profilen waren sie ueberhaupt nicht klickbar - dort
 *             standen sie als <div> in der Story-Leiste, im eigenen Profil
 *             als <button> in einer anderen Leiste.
 *
 * Jetzt bauen beide Profile dieselbe Reihe. Das Aussehen (Kreis gegen weiches
 * Quadrat, zwei Verlaeufe, Kennzeichen) steckt im CSS unter `.highlight`.
 *
 * `userId` wandert mit ins Attribut, damit die Seite dahinter weiss, wessen
 * Sammlung sie zeigt.
 */
function sammlungenReihe(userId, playlists, highlights) {
  const eintraege = [
    ...(playlists || []).map((name) => ({ art: 'playlist', name })),
    ...(highlights || []).map((name) => ({ art: 'highlight', name })),
  ];
  if (!eintraege.length) return '';

  return `<div class="highlights">${eintraege
    .map(({ art, name }) => {
      const symbol = art === 'playlist' ? ICONS.play : ICONS.image;
      return `<button class="highlight" data-sammlung="${art}" data-sammlung-name="${esc(name)}" data-sammlung-user="${esc(userId)}">
        <span class="highlight__ring is-${art}">${medienFlaeche(art.slice(0, 2) + '-' + name, symbol)}</span>
        <span class="highlight__label">${esc(name)}</span>
      </button>`;
    })
    .join('')}</div>`;
}

/*
 * Die Knoepfe der Reihe verdrahten.
 *
 * `wurzel` ist noetig, weil das fremde Profil kein Teil von #main ist,
 * sondern eine Vollbild-Ebene darueber. Sie muss zugeklappt werden, sonst
 * laege die Sammlung darunter.
 */
function bindSammlungen(wurzel = main) {
  wurzel.querySelectorAll('[data-sammlung]').forEach((b) =>
    b.addEventListener('click', () => {
      state.sammlung = {
        art: b.dataset.sammlung,
        name: b.dataset.sammlungName,
        userId: b.dataset.sammlungUser,
      };
      if (wurzel !== main) closeOverlay();
      renderSammlung();
    })
  );
}

/*
 * Was in einer Playlist oder einem Highlight steckt.
 * Prototyp-Frames "VP + Playlist" und "VP + Highlight".
 *
 * Die Zuordnung ist bewusst schlicht: eine Playlist sammelt Videos, ein
 * Highlight Beitraege. Welche genau, entscheidet sich stabil aus dem Namen -
 * es gibt im Prototyp keine echte Zuordnung, und eine erfundene waere bei
 * jedem Aufruf eine andere.
 */
function renderSammlung() {
  const { art, name, userId } = state.sammlung;
  const istPlaylist = art === 'playlist';
  const quelle = istPlaylist ? state.videos : state.posts;
  const eigen = quelle.filter((e) => e.userId === userId);
  const liste = (eigen.length ? eigen : quelle).filter((_, i) => i % 2 === (name.length % 2));

  main.innerHTML = `
    <div class="pagehead">
      <div class="pagehead__row">
        <button class="iconbtn" id="sammlungBack" aria-label="Zurück zum Profil">${ICONS.back}</button>
        <h2 class="pagehead__title">${esc(name)}</h2>
      </div>
      <div class="pagehead__sub">${istPlaylist ? 'Playlist' : 'Highlight'} · ${liste.length} ${
        liste.length === 1 ? 'Beitrag' : 'Beiträge'
      }</div>
    </div>
    <div class="scroll">
      ${
        liste.length
          ? `<div class="exp__grid">${liste
              .map(
                (e) =>
                  `<button class="griditem" data-${istPlaylist ? 'openvideo' : 'openpost'}="${e.id}">${medienFlaeche(
                    e.id,
                    istPlaylist ? ICONS.portrait : ICONS.image,
                    e.mediaUrl
                  )}</button>`
              )
              .join('')}</div>`
          : `<div class="empty">${istPlaylist ? ICONS.play : ICONS.image}
              <div class="empty__title">Noch nichts drin</div>
              <div class="empty__text">Über das Plus oben rechts legst du etwas hinein.</div>
            </div>`
      }
    </div>`;

  $('#sammlungBack').addEventListener('click', () => {
    const zurueck = state.sammlung.userId;
    state.sammlung = null;
    if (zurueck === 'me') render();
    else openProfile(zurueck);
  });
  main.querySelectorAll('[data-openvideo]').forEach((b) =>
    b.addEventListener('click', () => openVideo(b.dataset.openvideo))
  );
  main.querySelectorAll('[data-openpost]').forEach((b) =>
    b.addEventListener('click', () => openPost(b.dataset.openpost))
  );
}

const PROFILE_TABS = [
  { id: 'grid', icon: 'grid' },
  { id: 'repost', icon: 'repeat' },
  { id: 'tagged', icon: 'person' },
  { id: 'saved', icon: 'bookmark' },
];

/*
 * Was man mit einem eigenen Beitrag machen kann — Loeschen und Einsortieren.
 * Henriks Punkte 37 und 40.
 */
function openEigenerBeitrag(id, art, me) {
  const sammlungen = [
    ...(me.playlists || []).map((name) => ({ art: 'playlist', name })),
    ...(me.highlights || []).map((name) => ({ art: 'highlight', name })),
  ];

  openSheet(
    art === 'video' ? 'Dein Video' : 'Dein Beitrag',
    `<div class="sheet__body">
       ${
         sammlungen.length
           ? `<div class="listhead">Hinzufügen zu</div>
              ${sammlungen
                .map(
                  (sml) => `<button class="item" data-sml="${esc(sml.art)}" data-smlname="${esc(sml.name)}">
                    <span class="item__icon">${sml.art === 'playlist' ? ICONS.play : ICONS.image}</span>
                    <span class="item__label">${esc(sml.name)}</span>
                    <span class="item__value">${sml.art === 'playlist' ? 'Playlist' : 'Highlight'}</span>
                  </button>`
                )
                .join('')}`
           : `<div class="sheet__hint">Du hast noch keine Playlist und kein Highlight. Über das Plus oben rechts legst du eine an.</div>`
       }
       <div class="listhead">Verwalten</div>
       <button class="item item--danger" data-eigenaktion="loeschen">
         <span class="item__icon">${ICONS.trash}</span>
         <span class="item__label">${art === 'video' ? 'Video löschen' : 'Beitrag löschen'}</span>
       </button>
     </div>`,
    (blatt, zu) => {
      blatt.querySelectorAll('[data-sml]').forEach((b) =>
        b.addEventListener('click', async () => {
          const res = await fetch(`/api/eigene/${id}/sammlung`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ art: b.dataset.sml, name: b.dataset.smlname }),
          }).then((r) => r.json());
          zu();
          toast(res.ok ? res.meldung : res.error);
        })
      );

      blatt.querySelector('[data-eigenaktion="loeschen"]').addEventListener('click', async () => {
        zu();
        const sicher = await bestaetigen(
          art === 'video' ? 'Video löschen' : 'Beitrag löschen',
          'Das lässt sich nicht rückgängig machen.',
          'Löschen'
        );
        if (!sicher) return;

        const res = await fetch(`/api/eigene/${id}/loeschen`, { method: 'POST' }).then((r) => r.json());
        if (!res.ok) return toast(res.error);
        toast(res.meldung);
        await bootstrap();
      });
    },
    { schliessen: true }
  );
}

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
        ${eigenerAvatarMitStory(me)}
        <div class="prof__stats">
          <div class="prof__stat"><span>Beiträge</span><strong>${compactNumber(me.posts)}</strong></div>
          <button class="prof__stat" id="followerBtn"><span>Follower</span><strong>${compactNumber(me.followers)}</strong></button>
          <button class="prof__stat" id="followingBtn"><span>Gefolgt</span><strong>${compactNumber(me.following)}</strong></button>
        </div>
      </div>
      <div class="prof__about">
        <div class="prof__name">${esc(me.name)}</div>
        ${me.bio ? `<div class="prof__bio">${esc(me.bio)}</div>` : ''}
        ${me.link ? bioLink(me.link) : ''}
      </div>
      <div class="prof__aktionen">
        <button class="btn btn--breit" id="profilBearbeiten">Profil bearbeiten</button>
      </div>
      ${
        me.spende
          ? // Punkt 44: das Ziel ist freiwillig. Ohne Ziel gibt es keinen
            // Balken - er waere ohne Bezugsgroesse sinnlos, und die Rechnung
            // gesammelt/ziel ergaebe eine Division durch null.
            `<div class="spende">
               <div class="spende__titel">${esc(me.spende.titel)}</div>
               ${me.spende.text ? `<div class="spende__text">${esc(me.spende.text)}</div>` : ''}
               ${
                 me.spende.ziel > 0
                   ? `<div class="spende__balken"><div class="spende__fuellung" style="width:${Math.min(
                       100,
                       Math.round((me.spende.gesammelt / me.spende.ziel) * 100)
                     )}%"></div></div>
                      <div class="spende__zahlen">${me.spende.gesammelt} € von ${me.spende.ziel} € gesammelt</div>`
                   : `<div class="spende__zahlen">${me.spende.gesammelt} € gesammelt</div>`
               }
             </div>`
          : ''
      }
      ${sammlungenReihe('me', me.playlists, me.highlights)}
      <div class="prof__tabs">
        ${PROFILE_TABS.map(
          (t) => `<button class="prof__tab ${tab === t.id ? 'is-active' : ''}" data-otab="${t.id}">${ICONS[t.icon]}</button>`
        ).join('')}
      </div>
      ${
        tab === 'grid'
          ? // Punkt 37 und 40: langes Druecken oeffnet die Optionen zu einem
            // eigenen Beitrag - loeschen, oder in eine Playlist bzw. ein
            // Highlight legen. Vorher war die Kachel ein totes <div>.
            `<div class="prof__grid">${me.grid
              .map(
                (g) => `<button class="griditem" data-eigen="${esc(g.id)}" data-eigenart="${
                  g.kind === 'video' ? 'video' : 'post'
                }">${medienFlaeche(g.id, g.kind === 'video' ? ICONS.play : ICONS.image, g.mediaUrl)}</button>`
              )
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
  $('#profilBearbeiten')?.addEventListener('click', () => openProfilBearbeiten(renderVideoProfile));
  bindSammlungen();
  $('#followerBtn')?.addEventListener('click', () => openFollowerList(me, 'follower'));
  $('#followingBtn')?.addEventListener('click', () => openFollowerList(me, 'following'));
  /*
   * Punkt 37: "Eigene Beiträge können nicht gelöscht werden. Lange drücken →
   * Einstellungen-Panel mit Löschen-Option." Dazu Punkt 40, das Einsortieren
   * in eine Playlist oder ein Highlight.
   *
   * Langes Druecken statt eines Menue-Knopfes an jeder Kachel: der Knopf
   * waere auf einer Drittel-Breite kaum zu treffen und wuerde das Raster
   * unruhig machen.
   */
  main.querySelectorAll('[data-eigen]').forEach((kachel) => {
    let halten = null;
    const los = () => {
      clearTimeout(halten);
      halten = null;
    };
    const start = () => {
      halten = setTimeout(() => openEigenerBeitrag(kachel.dataset.eigen, kachel.dataset.eigenart, me), 500);
    };

    kachel.addEventListener('pointerdown', start);
    kachel.addEventListener('pointerup', los);
    kachel.addEventListener('pointerleave', los);
    kachel.addEventListener('pointercancel', los);
    // Rechtsklick am Rechner tut dasselbe wie langes Druecken.
    kachel.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openEigenerBeitrag(kachel.dataset.eigen, kachel.dataset.eigenart, me);
    });
  });

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
/*
 * Persoenliche Chats im Community-Bereich.
 *
 * Henrik: "Hier nur persoenliche Chats zwischen Nutzern anzeigen, keine
 * Community-Chats. Messenger = Chat ueber Telefonnummer/Kontakt.
 * Community-Chat = Kommunikation ohne Telefonnummer."
 *
 * Vorher standen hier die Communitys selbst - die stehen aber schon unter
 * Home. Jetzt kommen die Eintraege aus `communityChats`: Leute, die man aus
 * einer Community kennt und nicht aus dem Telefonbuch.
 */
function renderCommunityChats() {
  const q = state.commSearchQuery.trim().toLowerCase();
  const alle = state.communityChats || [];

  const list = alle.filter((c) => {
    if (state.commChatFilter === 'chats' && c.isGroup) return false;
    if (state.commChatFilter === 'groups' && !c.isGroup) return false;
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || (c.preview || '').toLowerCase().includes(q);
  });

  main.innerHTML = `
    <div class="pagehead">
      <div class="searchrow">
        <label class="searchbox">
          ${ICONS.search}
          <input id="commChatSearch" type="search" placeholder="Suche hier nach Kontakten/Gruppen..." value="${esc(state.commSearchQuery)}" autocomplete="off" />
          ${state.commSearchQuery ? `<button class="searchbox__clear" id="commChatSearchClear" aria-label="Suche löschen">${ICONS.close}</button>` : ''}
        </label>
        <button class="iconbtn-primary" id="commNewChat" aria-label="Person hinzufügen">${ICONS.plus}</button>
      </div>
    </div>
    <div class="pills">
      ${['all', 'chats', 'groups']
        .map(
          (f) =>
            `<button class="pill ${state.commChatFilter === f ? 'is-active' : ''}" data-ccfilter="${f}">${
              { all: 'Alle', chats: 'Chats', groups: 'Gruppen' }[f]
            }</button>`
        )
        .join('')}
    </div>
    <div class="scroll">
      ${
        list.length
          ? `<ul class="rows">${list.map(chatRow).join('')}</ul>`
          : `<div class="empty">${ICONS.chat}
              <div class="empty__title">${state.commSearchQuery ? 'Kein Chat gefunden' : 'Noch keine Unterhaltung'}</div>
              <div class="empty__text">${
                state.commSearchQuery
                  ? `Für „${esc(state.commSearchQuery)}" gibt es keinen Treffer.`
                  : 'Über das Plus rechts oben findest du Leute aus deinen Communitys.'
              }</div>
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
  /*
   * Henrik am 26.08.2026: "Plus leitet zur Suche weiter. Es soll auf der
   * Chats-Seite bleiben, neuer Kontakt oder neue Gruppe öffnet direkt."
   *
   * Vorher sprang das Plus in den Unterpunkt "Suchen" - man verlor die Liste
   * und musste sich selbst zurueckfinden. Jetzt geht ein Menue auf, genau wie
   * beim Plus in der Chatliste des Messengers.
   */
  $('#commNewChat')?.addEventListener('click', () => {
    openSheet(
      'Neu',
      `<div class="sheet__body">
         <button class="item" data-cneu="gruppe">
           <span class="item__icon">${ICONS.people}</span>
           <span class="item__label">Neue Gruppe</span>
         </button>
         <button class="item" data-cneu="kontakt">
           <span class="item__icon">${ICONS.userPlus}</span>
           <span class="item__label">Kontakt hinzufügen</span>
         </button>
         <button class="item" data-cneu="suchen">
           <span class="item__icon">${ICONS.search}</span>
           <span class="item__label">In Communitys suchen</span>
         </button>
       </div>`,
      (sheet, close) => {
        sheet.querySelectorAll('[data-cneu]').forEach((b) =>
          b.addEventListener('click', () => {
            const was = b.dataset.cneu;
            close();
            if (was === 'gruppe') return openNewGroup();
            if (was === 'kontakt') return openAddContact();
            // Nur dieser dritte Punkt fuehrt noch in die Suche - und zwar,
            // weil man ihn ausdruecklich gewaehlt hat.
            state.sub.communities = 'search';
            render();
          })
        );
      },
      { schliessen: true }
    );
  });
  main.querySelectorAll('[data-ccfilter]').forEach((p) =>
    p.addEventListener('click', () => {
      state.commChatFilter = p.dataset.ccfilter;
      renderCommunityChats();
    })
  );
  main.querySelectorAll('[data-chat]').forEach((r) =>
    r.addEventListener('click', () => openChat(r.dataset.chat))
  );
  bindChatVerwaltung();
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
          ? // Punkt 55: die Liste heisst nach dem, was drinsteht. "Kanäle"
            // ist der Name der Unterthemen INNERHALB einer Community - hier
            // stehen aber die Communitys selbst.
            // Punkt 56: die beiden Ueberschriften waren tote <div>s mit einem
            // Pfeil daran. Jetzt fuehren sie auf die Liste mit nur dieser
            // Kategorie - derselbe Weg wie bei den Kategorien der Video-Suche.
            `${chans.length ? `<button class="exp__head" data-csmehr="channels">Communitys →</button><ul class="rows">${chans.map(communityRow).join('')}</ul>` : ''}
             ${
               people.length
                 ? `<button class="exp__head" data-csmehr="people">Profile →</button><ul class="rows">${people
                     .map((u) => {
                       const st = statusOf(u.id);
                       /*
                        * Punkt 57: bei einem privaten Profil geht erst eine
                        * Anfrage raus. "+ Befreunden" waere dort ein
                        * Versprechen, das der Knopf nicht halten kann.
                        */
                       const privat = (state.privateProfile || []).includes(u.id);
                       const label =
                         st === 'friend'
                           ? 'Befreundet'
                           : st === 'pending'
                             ? 'Angefragt'
                             : privat
                               ? 'Anfrage senden'
                               : '+ Befreunden';
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
  // Punkt 56: die Ueberschrift schaltet auf genau diese Kategorie um.
  main.querySelectorAll('[data-csmehr]').forEach((b) =>
    b.addEventListener('click', () => {
      state.commSearchFilter = b.dataset.csmehr;
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
      if (result.chat) state.chats.unshift(result.chat);
      // Punkt 57: die Meldung sagt, was wirklich passiert ist - bei einem
      // privaten Profil laeuft eine Anfrage, sonst steht der Kontakt schon.
      toast(result.privat ? `Anfrage an ${u.name} gesendet` : `${u.name} ist jetzt dein Kontakt`);
      renderCommunitySearch();
    })
  );
}

/* --------------------------------------------------- Communitys: Profil */
// Prototyp-Frame "Community - Profil": erstellte und beigetretene Communitys.
function renderCommunityProfile() {
  const me = user('me');
  const profil = state.eigenesProfil || {};
  const created = state.communities.filter((c) => c.visibility === 'private' && c.joined);
  const joined = state.communities.filter((c) => c.joined && !created.includes(c));

  main.innerHTML = `
    ${switchBar('switchProfile')}
    <div class="scroll">
      ${ownProfileTop(me.handle, 'communities')}
      <div class="oprof__top">
        ${eigenerAvatarMitStory(me)}
        <div class="prof__stats">
          <button class="prof__stat" data-stat="created"><span>Erstellte Communitys</span><strong>${created.length}</strong></button>
          <button class="prof__stat" data-stat="joined"><span>Beigetretene Communitys</span><strong>${joined.length}</strong></button>
        </div>
      </div>
      ${/*
          Name, Info und Link standen hier fest im Markup. Damit zeigte das
          Community-Profil "Henrik", waehrend im Videos-Profil der Name aus
          dem Konto kam - und wer sein Profil bearbeitete, sah die Aenderung
          nur an einer der beiden Stellen. Jetzt dieselbe Quelle wie dort.
        */ ''}
      <div class="prof__about">
        <div class="prof__name">${esc(me.name)}</div>
        ${profil.bio ? `<div class="prof__bio">${esc(profil.bio)}</div>` : ''}
        ${profil.link ? bioLink(profil.link) : ''}
      </div>
      ${/*
          "Profil bearbeiten" gab es nur im Videos-Profil. Hier fuehrt derselbe
          Knopf zu demselben Formular - Name, Info und Link gehoeren zum Konto,
          nicht zu einem der drei Profile.
        */ ''}
      <div class="prof__aktionen">
        <button class="btn btn--breit" id="profilBearbeiten">Profil bearbeiten</button>
      </div>
      ${
        /*
         * "Erstellt" und "Beigetreten" fuehren jetzt auf eine eigene Seite mit
         * nur dieser Kategorie - vorher war die Ueberschrift samt Pfeil ein
         * totes <div>, genau wie bei den Kategorien der Video-Suche.
         */
        created.length
          ? `<button class="exp__head" data-commview="erstellt">Erstellt →</button><ul class="rows">${created.map(communityRow).join('')}</ul>`
          : ''
      }
      ${
        joined.length
          ? `<button class="exp__head" data-commview="beigetreten">Beigetreten →</button><ul class="rows">${joined.map(communityRow).join('')}</ul>`
          : ''
      }
    </div>`;

  $('#switchProfile').addEventListener('click', openKontoWechsel);
  $('#profilBearbeiten')?.addEventListener('click', () => openProfilBearbeiten(renderCommunityProfile));
  main.querySelectorAll('[data-commview]').forEach((b) =>
    b.addEventListener('click', () => {
      state.commProfilView = b.dataset.commview;
      renderCommunityListe();
    })
  );
  bindProfilAktionen('communities');
  main.querySelectorAll('[data-community]').forEach((r) =>
    r.addEventListener('click', () => openChat(r.dataset.community))
  );
  bindJoinButtons(renderCommunityProfile);
}

/*
 * Die Seite hinter "Erstellt" bzw. "Beigetreten" im Communitys-Profil.
 *
 * Prototyp-Frames "CP + erstellte Kanäle" und "CP + beigetretene Kanäle".
 * Aufgebaut wie die Uebersichtsseiten der Video-Suche: Zurueck-Pfeil oben
 * links, darunter nur diese eine Kategorie.
 */
function renderCommunityListe() {
  const erstellt = state.commProfilView === 'erstellt';
  const created = state.communities.filter((c) => c.visibility === 'private' && c.joined);
  const joined = state.communities.filter((c) => c.joined && !created.includes(c));
  const liste = erstellt ? created : joined;

  main.innerHTML = `
    <div class="pagehead">
      <div class="pagehead__row">
        <button class="iconbtn" id="commListeBack" aria-label="Zurück zum Profil">${ICONS.back}</button>
        <h2 class="pagehead__title">${erstellt ? 'Erstellte Communitys' : 'Beigetretene Communitys'}</h2>
      </div>
    </div>
    <div class="scroll">
      ${
        liste.length
          ? `<ul class="rows">${liste.map(communityRow).join('')}</ul>`
          : `<div class="empty">${ICONS.people}
              <div class="empty__title">${erstellt ? 'Noch nichts erstellt' : 'Noch nichts beigetreten'}</div>
              <div class="empty__text">${
                erstellt
                  ? 'Über das Plus oben rechts legst du eine eigene Community an.'
                  : 'Unter „Suchen" findest du Communitys zum Beitreten.'
              }</div>
            </div>`
      }
    </div>`;

  $('#commListeBack').addEventListener('click', () => {
    state.commProfilView = null;
    renderCommunityProfile();
  });
  main.querySelectorAll('[data-community]').forEach((r) =>
    r.addEventListener('click', () => openChat(r.dataset.community))
  );
  bindJoinButtons(renderCommunityListe);
}

/* ------------------------------------------------- Chat-Einstellungen Modal */
/*
 * Die Einstellungen eines Chats — Prototyp-Frame "MC + Kontakteinstellungen".
 *
 * Henrik am 26.08.2026: "Bearbeitungsansicht wirkt leer; Einstellungen (z. B.
 * Chat sperren) sind nicht funktionsfähig. Inspiration WhatsApp — mehr Felder
 * hinzufügen; Einstellungen müssen echte Funktion haben."
 *
 * Beides stimmte. Vorher standen hier sechs Punkte, von denen kein einziger
 * wirklich etwas tat: die Schalter kippten nur ihre eigene Farbe, "Chat
 * leeren" leerte die Ansicht und nicht den Verlauf (beim naechsten Oeffnen
 * war alles zurueck), "Blockieren" schob eine Kennung in eine Liste im
 * Browser, die niemand ausgewertet hat, und "Melden" gab einen Hinweis aus
 * und vergass ihn. "Chat sperren" fehlte ganz.
 *
 * Jetzt geht jeder Punkt an den Server und der Stand kommt von dort zurueck.
 * Was dort passiert, steht in CHAT_AKTIONEN in web/server/app.js.
 */
async function openChatSettings(chatId) {
  const treffer =
    state.chats.find((c) => c.id === chatId) ||
    (state.communityChats || []).find((c) => c.id === chatId);
  if (!treffer) return;

  let chat = treffer;

  /** Einen Punkt am Server umschalten und das Blatt neu zeichnen. */
  const schalte = async (was, sheet) => {
    const antwort = await fetch(`/api/chats/${chatId}/${was}`, { method: 'POST' })
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: 'Das hat gerade nicht geklappt' }));
    if (!antwort.ok) return toast(antwort.error || 'Das hat gerade nicht geklappt');

    // Den Stand am Chat mitfuehren, damit die Liste ihn gleich zeigt.
    if ('muted' in antwort) chat.muted = antwort.muted;
    if ('gesperrt' in antwort) chat.gesperrt = antwort.gesperrt;
    if ('aus' in antwort) chat.mitteilungenAus = antwort.aus;
    if ('blocked' in antwort) chat.blocked = antwort.blocked;

    toast(antwort.meldung);
    zeichne(sheet);
  };

  const koerper = () => {
    const person = chat.isGroup ? null : user(chat.userId);
    return `
    ${/*
        Der Kopf. Er war der Grund fuer "wirkt leer": das Blatt fing frueher
        direkt mit den Schaltern an, ohne zu zeigen, um wen es ueberhaupt
        geht.
      */ ''}
    <div class="chatopt__kopf">
      ${avatarOf(chat, 54)}
      <div class="chatopt__text">
        <div class="chatopt__name">${esc(chat.name)}</div>
        <div class="chatopt__sub">${
          chat.isGroup
            ? `${(chat.members || []).length + 1} Mitglieder`
            : esc(person?.handle || '')
        }</div>
      </div>
    </div>

    <div class="sheet__body">
      <div class="listhead">Benachrichtigungen</div>
      <div class="item">
        <span class="item__icon">${ICONS.bell}</span>
        <span class="item__label">Mitteilungen</span>
        <button class="switch ${chat.mitteilungenAus ? '' : 'is-on'}" data-chatopt="mitteilungen" aria-label="Mitteilungen"><span class="switch__knob"></span></button>
      </div>
      <div class="item">
        <span class="item__icon">${ICONS.mute}</span>
        <span class="item__label">Stumm</span>
        <button class="switch ${chat.muted ? 'is-on' : ''}" data-chatopt="stumm" aria-label="Stummschalten"><span class="switch__knob"></span></button>
      </div>

      <div class="listhead">Datenschutz</div>
      <div class="item">
        <span class="item__icon">${ICONS.lock}</span>
        <span class="item__label">Chat sperren</span>
        <button class="switch ${chat.gesperrt ? 'is-on' : ''}" data-chatopt="sperren" aria-label="Chat sperren"><span class="switch__knob"></span></button>
      </div>
      <div class="sheet__hint">Ein gesperrter Chat zeigt in der Liste keine Vorschau und fragt vor dem Öffnen nach.</div>

      <div class="listhead">Inhalt</div>
      <button class="item" data-chatopt-aktion="medien">
        <span class="item__icon">${ICONS.image}</span>
        <span class="item__label">Medien und Anhänge</span>
        <span class="row__chevron">${ICONS.chevron}</span>
      </button>
      <button class="item" data-chatopt-aktion="markiert">
        <span class="item__icon">${ICONS.star}</span>
        <span class="item__label">Markierte Nachrichten</span>
        <span class="row__chevron">${ICONS.chevron}</span>
      </button>
      <button class="item" data-chatopt-aktion="suche">
        <span class="item__icon">${ICONS.search}</span>
        <span class="item__label">Im Chat suchen</span>
        <span class="row__chevron">${ICONS.chevron}</span>
      </button>
      <button class="item" data-chatopt-aktion="export">
        <span class="item__icon">${ICONS.bookmark}</span>
        <span class="item__label">Chat exportieren</span>
      </button>

      <div class="listhead">Verwalten</div>
      <button class="item" data-chatopt-aktion="archiv">
        <span class="item__icon">${ICONS.bookmark}</span>
        <span class="item__label">Archivieren</span>
      </button>
      <button class="item item--danger" data-chatopt-aktion="leeren">
        <span class="item__icon">${ICONS.trash}</span>
        <span class="item__label">Chat leeren</span>
      </button>
      ${
        chat.isGroup
          ? ''
          : `<button class="item item--danger" data-chatopt="blockieren">
              <span class="item__icon">${ICONS.block}</span>
              <span class="item__label">${chat.blocked ? 'Blockierung aufheben' : 'Blockieren'}</span>
            </button>
            <button class="item item--danger" data-chatopt-aktion="melden">
              <span class="item__icon">${ICONS.shield}</span>
              <span class="item__label">Melden</span>
            </button>`
      }
      <button class="item item--danger" data-chatopt-aktion="loeschen">
        <span class="item__icon">${ICONS.trash}</span>
        <span class="item__label">Chat löschen</span>
      </button>
    </div>`;
  };

  /** Den Inhalt des offenen Blattes ersetzen, ohne es zu schliessen. */
  const zeichne = (sheet) => {
    const koerperEl = sheet.querySelector('.sheet');
    koerperEl.innerHTML = sheetKopf('Chat-Einstellungen', true) + koerper();
    // Der Schliessen-Knopf ist mit neu entstanden und braucht seinen Griff
    // wieder - openSheet hat ihn nur am urspruenglichen Element gehabt.
    koerperEl
      .querySelector('[data-sheet-close]')
      ?.addEventListener('click', () => sheet.remove());
    verdrahte(sheet);
  };

  const verdrahte = (sheet) => {
    sheet.querySelectorAll('[data-chatopt]').forEach((b) =>
      b.addEventListener('click', () => schalte(b.dataset.chatopt, sheet))
    );

    sheet.querySelectorAll('[data-chatopt-aktion]').forEach((b) =>
      b.addEventListener('click', async () => {
        const was = b.dataset.chatoptAktion;

        if (was === 'medien' || was === 'markiert') {
          const daten = await (await fetch(`/api/chats/${chatId}/medien`)).json();
          return openChatMedien(
            chat,
            was === 'medien' ? daten.medien : daten.markiert,
            was === 'medien' ? 'Medien und Anhänge' : 'Markierte Nachrichten'
          );
        }

        if (was === 'suche') return openChatSuche(chat);

        if (was === 'export') {
          /*
           * Der Verlauf kommt vom Server, nicht aus state.messages - dort
           * steht nur, was gerade offen ist. Vorher exportierte der Knopf
           * bei einem Chat, den man nicht offen hatte, eine leere Datei.
           */
          const verlauf = await (await fetch(`/api/messages/${chatId}`)).json();
          const text = verlauf
            .map((m) => `${m.from === 'me' ? 'Du' : user(m.from).name} (${m.time}): ${m.text || ''}`)
            .join('\n');
          const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
          const a = document.createElement('a');
          a.href = url;
          a.download = `chat-${chatId}.txt`;
          a.click();
          URL.revokeObjectURL(url);
          return toast('Chat exportiert');
        }

        if (was === 'melden') {
          return openFormular(
            'Chat melden',
            [{ key: 'grund', label: 'Was ist passiert?', typ: 'mehrzeilig', pflicht: true }],
            async ({ grund }) => {
              const res = await fetch(`/api/chats/${chatId}/melden`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ grund }),
              }).then((r) => r.json());
              if (!res.ok) return res.error || 'Das hat nicht geklappt';
              toast(res.meldung);
              return null;
            },
            'Melden'
          );
        }

        if (was === 'leeren') {
          const res = await (await fetch(`/api/chats/${chatId}/leeren`, { method: 'POST' })).json();
          if (!res.ok) return toast('Das hat gerade nicht geklappt');
          state.messages = [];
          chat.preview = 'Keine Nachrichten';
          toast('Chat geleert');
          return render();
        }

        // Archivieren und Loeschen gehen ueber dieselbe Route wie in der
        // Chatliste - der Chat verschwindet danach, also Blatt zu.
        const res = await fetch(`/api/chats/${chatId}/${was}`, { method: 'POST' })
          .then((r) => r.json())
          .catch(() => ({ ok: false }));
        if (!res.ok) return toast(res.error || 'Das hat gerade nicht geklappt');
        toast(res.meldung);
        state.openChatId = null;
        state.openChatSettingsId = null;
        closeOverlay();
        document.querySelector('.sheet-backdrop')?.remove();
        // bootstrap() holt die Listen frisch - der Chat ist am Server weg
        // bzw. archiviert, und die Liste muss das zeigen.
        await bootstrap();
      })
    );
  };

  openSheet('Chat-Einstellungen', koerper(), (sheet) => verdrahte(sheet), { schliessen: true });
}

/* ---------------------------------------------------------- chat detail */
async function openChat(chatId) {
  /*
   * Henrik am 26.08.2026: "Einzelne Chats oder Gruppenchats im
   * Community-Bereich lassen sich nicht öffnen."
   *
   * Der Grund stand hier: gesucht wurde in state.chats und in
   * state.communities - die persoenlichen Chats des Community-Bereichs
   * liegen aber in state.communityChats. Ein Klick fand nichts, die Funktion
   * kehrte still zurueck, und auf dem Bildschirm passierte gar nichts.
   */
  let chat =
    state.chats.find((c) => c.id === chatId) ||
    (state.communityChats || []).find((c) => c.id === chatId);

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

  /*
   * Gesperrte Chats fragen vor dem Oeffnen nach. Ohne echte Anmeldung mit
   * Face ID oder Code ist eine Rueckfrage die ehrliche Fassung - eine
   * Abfrage, die nichts prueft, waere Theater.
   */
  if (chat.gesperrt) {
    const weiter = await bestaetigen(
      'Gesperrter Chat',
      `„${chat.name}" ist gesperrt. Trotzdem öffnen?`,
      'Öffnen'
    );
    if (!weiter) return;
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
  // Aus dem Chat heraus steht das Ziel fest: die Aufnahme geht hierher.
  $('#camBtn').addEventListener('click', () => openCamera(chat));

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

}

/*
 * Hier stand bis zum 31.08.2026 eine Antwort, die sich der Chat selbst gab:
 * nach 1,4 Sekunden schrieb „Anna" von allein zurueck (antworten.js).
 *
 * Das ging nur, solange der Verlauf im Browser lag. Jetzt steht er in der
 * Datenbank, und dort kann niemand eine Nachricht in fremdem Namen einstellen
 * - die Regeln lassen nur `sender_id = ich` zu. Das ist richtig so: Anna ist
 * kein Mensch, der antworten koennte.
 *
 * Die App (Expo) hatte dieselbe Nachahmung und hat sie aus demselben Grund
 * verloren. Beide Fassungen verhalten sich damit wieder gleich.
 */

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
          s.mediaUri ? `<img class="viewer__bild" src="${s.mediaUri}" alt="Deine Story" />` : medienFlaeche(s.id, ICONS.image)
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
          : // Henrik: "Antworten auf Stories nicht per Enter absenden.
            // Stattdessen einen kleinen Senden-Button mit Pfeil verwenden."
            // Der Absende-Knopf war vorher versteckt (viewer__hidden), das
            // Formular ging nur mit Enter ab - man konnte also nicht sehen,
            // wie man abschickt.
            `<form class="viewer__foot" id="storyForm">
              <input class="viewer__reply" id="storyReply" placeholder="Antworten" autocomplete="off" />
              <button type="submit" class="viewer__senden" id="storySenden" aria-label="Antwort senden" disabled>${ICONS.send}</button>
              <button type="button" class="viewer__act ${s.liked ? 'is-liked' : ''}" id="storyLike" aria-label="Gefällt mir">${ICONS.heart}</button>
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

  const storyZu = () => {
    stop();
    markSeen();
    closeOverlay();
  };

  $('#storyClose').addEventListener('click', storyZu);

  /*
   * Punkt 5: nach unten wischen beendet den Story-Betrachter.
   *
   * Vorher gab es nur den kleinen Pfeil oben links - und der liegt genau
   * dort, wo beim Halten des Handys die andere Hand ist. Nach unten wischen
   * ist die Geste, die man von Instagram und TikTok her kennt.
   *
   * Das Antwortfeld ist ausgenommen: dort wischt man zum Auswaehlen von
   * Text, nicht zum Schliessen.
   */
  const betrachter = overlay.querySelector('.viewer');
  let ziehStart = null;
  let ziehWeg = 0;
  let ziehZeit = 0;

  betrachter.addEventListener(
    'touchstart',
    (e) => {
      if (e.target.closest('.viewer__reply, input, textarea')) return;
      ziehStart = e.touches[0].clientY;
      ziehZeit = Date.now();
      ziehWeg = 0;
      betrachter.style.transition = 'none';
      pause();
    },
    { passive: true }
  );

  betrachter.addEventListener(
    'touchmove',
    (e) => {
      if (ziehStart === null) return;
      ziehWeg = e.touches[0].clientY - ziehStart;
      if (ziehWeg <= 0) return;
      betrachter.style.transform = `translateY(${ziehWeg}px)`;
      // Mit dem Ziehen wird der Hintergrund frei - das zeigt, wohin es geht.
      betrachter.style.opacity = String(Math.max(0.35, 1 - ziehWeg / 500));
    },
    { passive: true }
  );

  const ziehEnde = () => {
    if (ziehStart === null) return;
    const schnell = ziehWeg > 40 && Date.now() - ziehZeit < 300;
    betrachter.style.transition = 'transform .2s ease, opacity .2s ease';

    if (ziehWeg > 110 || schnell) {
      betrachter.style.transform = 'translateY(100%)';
      betrachter.style.opacity = '0';
      setTimeout(storyZu, 180);
    } else {
      betrachter.style.transform = '';
      betrachter.style.opacity = '';
      resume();
    }
    ziehStart = null;
  };

  betrachter.addEventListener('touchend', ziehEnde);
  betrachter.addEventListener('touchcancel', ziehEnde);

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
    // Enter schickt nicht mehr ab - dafuer gibt es den Pfeil daneben.
    if (e.key === 'Enter') e.preventDefault();
  });

  // Der Pfeil ist nur nutzbar, solange etwas dasteht. Sonst laedt er dazu
  // ein, eine leere Antwort zu schicken.
  const senden = $('#storySenden');
  const sendenPruefen = () => {
    if (senden) senden.disabled = !reply.value.trim();
  };
  reply.addEventListener('input', sendenPruefen);
  sendenPruefen();

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
/*
 * `zielChat` gesetzt heisst: die Kamera wurde aus einem Chat heraus geoeffnet.
 * Dann steht das Ziel schon fest und die Aufnahme geht ohne Rueckfrage dorthin
 * - wer aus einem Chat die Kamera aufmacht, will das Bild diesem Chat
 * schicken, nicht erst wieder gefragt werden.
 */
function openCamera(zielChat = null) {
  let mode = 'photo';
  let recording = false;

  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="camera">
      <div class="camera__top">
        <button id="camClose" aria-label="Schließen">${ICONS.close}</button>
        <button id="camFlash" aria-label="Blitz">${ICONS.flash}</button>
      </div>
      <div class="camera__stage">${ICONS.camera}<span class="camera__sucher"><span></span><span></span><span></span><span></span></span></div>
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

  /** Aufnahme fertig: entweder in den Chat, aus dem sie kam, oder zur Wahl. */
  const aufnahmeFertig = async (bild) => {
    if (!zielChat) {
      closeOverlay();
      return aufnahmeMenue(bild);
    }

    const res = await fetch(`/api/messages/${zielChat.id}/anhang`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ art: 'foto' }),
    });
    const daten = await res.json();
    if (!daten.ok) return toast(daten.error);

    eigenesMediumSichern(daten.message.id, bild);
    state.messages.push(daten.message);
    closeOverlay();
    openChat(zielChat.id);
    toast('Foto gesendet');
  };

  $('#camClose').addEventListener('click', close);
  $('#camFlash').addEventListener('click', () => toast('Blitz umgeschaltet'));
  // Aus der Galerie statt aus der Kamera - dieselbe Aufnahme, nur ohne
  // capture-Kennzeichen, damit das Handy den Bildordner oeffnet.
  $('#camGallery').addEventListener('click', async () => {
    const bild = await aufnahmeHolen('photo', true);
    if (!bild) return;
    aufnahmeFertig(bild);
  });
  $('#camSwitch').addEventListener('click', () => toast('Kamera gewechselt'));

  overlay.querySelectorAll('.camera__mode').forEach((b) =>
    b.addEventListener('click', () => {
      mode = b.dataset.mode;
      overlay.querySelectorAll('.camera__mode').forEach((x) => x.classList.toggle('is-active', x === b));
    })
  );

  // Punkt 17: aufnehmen und danach fragen, wohin damit - statt nur einen
  // Hinweis auszugeben, bei dem die Aufnahme nirgends ankam.
  $('#camShutter').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (mode === 'photo') {
      const bild = await aufnahmeHolen('photo');
      if (bild) aufnahmeFertig(bild);
      return;
    }
    recording = !recording;
    btn.classList.toggle('is-rec', recording);
    if (recording) return toast('Aufnahme gestartet');

    const bild = await aufnahmeHolen('video');
    if (bild) aufnahmeFertig(bild);
  });
}

function closeOverlay() {
  overlay.hidden = true;
  overlay.innerHTML = '';
  render();
}

/* ---------------------------------------------------------- navigation */
/*
 * Ein Handler fuer die Sprungziele, die es an vielen Stellen zugleich gibt.
 * Er haengt an der ganzen App, damit neu aufgebaute Bildschirme ihn nicht
 * jedes Mal neu binden muessen - vergisst man das an einer Stelle, ist der
 * Knopf dort tot, und genau solche Faelle hatte Henrik gemeldet.
 */
document.querySelector('.app').addEventListener('click', (e) => {
  /*
   * Der Story-Ring am eigenen Profilbild. Er steht im Videos- und im
   * Communitys-Profil; ueber den Klickfaenger hier gilt er in beiden, ohne
   * ihn zweimal verdrahten zu muessen.
   */
  if (e.target.closest('[data-eigene-story]')) {
    e.stopPropagation();
    const eigene = state.stories.find((x) => x.own);
    if (eigene) return openStory(eigene.id);
  }

  // Profil
  const profil = e.target.closest('[data-profile]');
  if (profil) {
    e.stopPropagation();
    clearInterval(storyTimer);
    document.querySelector('.sheet-backdrop')?.remove();
    return openProfile(profil.dataset.profile);
  }

  /*
   * Henrik: "Standort und Musik eines Beitrags muessen anklickbar sein."
   * Die Uebersichtsseiten dahinter gab es schon (openExplorer), sie waren
   * bisher nur ueber die Suche erreichbar.
   */
  const ort = e.target.closest('[data-postort], [data-slideort]');
  if (ort) {
    e.stopPropagation();
    clearInterval(storyTimer);
    return openExplorer('standort', ort.dataset.postort || ort.dataset.slideort);
  }

  const sound = e.target.closest('[data-postsound], [data-slidesound]');
  if (sound) {
    e.stopPropagation();
    clearInterval(storyTimer);
    return openExplorer('sound', sound.dataset.postsound || sound.dataset.slidesound);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.hidden) {
    clearInterval(storyTimer);
    if (state.openChatId) closeChat();
    else closeOverlay();
  }
});

bootstrap();

// Phase 3: Pull-to-Refresh Feature
const ptr = new PullToRefresh({
  container: document.querySelector('.main'),
  onRefresh: async () => {
    try {
      const res = await fetch('/api/bootstrap');
      if (!res.ok) throw new Error('Network error');
      const data = await res.json();
      Object.assign(state, data);
      render();
      toast('Inhalte aktualisiert');
    } catch (error) {
      console.error('Refresh error:', error);
      toast('Fehler beim Aktualisieren');
    }
  }
});

// Phase 3: Offline Status Indicator
function updateOfflineStatus() {
  const indicator = document.getElementById('offlineIndicator');
  if (navigator.onLine) {
    indicator.hidden = true;
  } else {
    indicator.hidden = false;
  }
}

window.addEventListener('online', updateOfflineStatus);
window.addEventListener('offline', updateOfflineStatus);
updateOfflineStatus();

/*
 * Auffangnetz fuer Fehler, die sonst nur in der Entwicklerkonsole landen.
 *
 * Hier stand bis zum 31.08.2026 showToast() — eine Funktion, die es nie gab;
 * sie heisst toast(). Das Netz riss also genau dann, wenn es gebraucht wurde:
 * jeder aufgefangene Fehler loeste einen zweiten aus ("showToast is not
 * defined"), und der Nutzer sah gar nichts. Aufgefallen ist es erst, als das
 * Anlegen einer Gruppe fehlschlug und niemand sagen konnte, warum.
 */
window.addEventListener('error', (e) => {
  console.error('Global error caught:', e.error);
  toast('Ein Fehler ist aufgetreten — versuche erneut zu laden');
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection:', e.reason);
  toast('Verbindungsfehler — versuche es später noch einmal');
});

// Graceful fallback für API-Fehler
const originalFetch = window.fetch;
window.fetch = function(...args) {
  return originalFetch.apply(this, args).catch((error) => {
    console.error('Fetch error:', error);
    toast('Netzwerkfehler — überprüfe deine Verbindung');
    return Promise.reject(error);
  });
};
