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
/*
 * Die Passwortregel kommt aus gemeinsam/passwort.js — derselben Datei, die
 * die App benutzt. Sie stand vorher dreimal im Code und war dreimal falsch:
 * sechs Zeichen beim Anlegen, acht beim Ändern, zehn bei Supabase.
 *
 * Der Rückfall greift nur, wenn das Skript nicht geladen ist; dann prüft
 * immer noch Supabase, nur eben mit einer englischen Meldung.
 */
const PASSWORT_REGEL = window.Passwort
  ? window.Passwort.REGEL_TEXT
  : 'Mindestens 10 Zeichen, davon ein kleiner, ein großer Buchstabe und eine Ziffer';
const passwortPruefen = (wert) => (window.Passwort ? window.Passwort.pruefe(wert) : null);

// Dasselbe für die Telefonnummer — gemeinsam/telefon.js, siehe index.html.
const TELEFON_REGEL = window.Telefon ? window.Telefon.REGEL_TEXT : 'Zum Beispiel +49 151 2345678';
const telefonPruefen = (wert) => (window.Telefon ? window.Telefon.pruefe(wert) : null);

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

/*
 * Die Kamerafilter — dieselben Namen und Werte wie in
 * app/constants/filter.ts. Der gewählte Name wird am Insight gespeichert,
 * damit die Aufnahme beim Ansehen genauso aussieht wie beim Verschicken —
 * und zwar auf beiden Seiten gleich.
 *
 * Im Browser ginge ein echter Bildfilter über CSS `filter`. Er steht hier
 * trotzdem als Farbschicht, weil die App keinen echten Filter kann (React
 * Native hat keinen) und beide Fassungen dasselbe zeigen müssen. Eine
 * Aufnahme, die im Browser anders aussieht als im Handy, wäre schlimmer als
 * eine, die überall gleich einfach ist.
 */
const FILTER = [
  { key: 'keiner', label: 'Ohne', ton: '', staerke: 0, ecken: 0 },
  { key: 'warm', label: 'Warm', ton: '#FF9A3C', staerke: 0.22, ecken: 0.18 },
  { key: 'kalt', label: 'Kühl', ton: '#3C7DFF', staerke: 0.2, ecken: 0.14 },
  { key: 'sw', label: 'S/W', ton: '#6E6E73', staerke: 0.55, ecken: 0 },
  { key: 'sepia', label: 'Sepia', ton: '#A9743A', staerke: 0.35, ecken: 0.2 },
  { key: 'kino', label: 'Kino', ton: '#0E2B4A', staerke: 0.26, ecken: 0.34 },
  { key: 'sonne', label: 'Sonne', ton: '#FFD166', staerke: 0.24, ecken: 0 },
  { key: 'nacht', label: 'Nacht', ton: '#101033', staerke: 0.4, ecken: 0.3 },
];

const filterZu = (key) => FILTER.find((f) => f.key === key) || FILTER[0];

/**
 * Die Farbschicht eines Filters als CSS-Hintergrund.
 *
 * Zwei Verläufe übereinander: der Ton über der ganzen Fläche, darüber die
 * Abdunkelung zu den Rändern. Ohne die zweite wirken warme Filter flach,
 * weil nur die Farbe kippt und die Bildtiefe gleich bleibt.
 */
function filterSchicht(key) {
  const f = filterZu(key);
  if (!f.staerke) return '';
  const schichten = [`linear-gradient(${f.ton}${Math.round(f.staerke * 255).toString(16).padStart(2, '0')}, ${f.ton}${Math.round(f.staerke * 255).toString(16).padStart(2, '0')})`];
  if (f.ecken) {
    schichten.push(
      `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${f.ecken}) 100%)`
    );
  }
  return schichten.join(', ');
}

/*
 * Die Sticker. Gleiche Liste wie app/constants/sticker.ts — es sind Zeichen
 * und keine Grafiken, weil es noch keine gezeichneten gibt. Sie werden ohne
 * Blase dargestellt, also genau wie ein Sticker.
 */
const STICKER = [
  '👍', '👏', '🙌', '🤝', '💪', '🫶', '🙏', '👀',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔',
  '😂', '🥹', '😍', '🤩', '😎', '🥳', '🤔', '😴',
  '🔥', '✨', '🎉', '🎂', '☕️', '🍕', '⚽️', '🎧',
  '☀️', '🌧️', '❄️', '🌈', '🌙', '⭐️', '🌍', '🚀',
];

/** Die sechs Reaktionen — dieselben wie in app/components/NachrichtSheet.tsx. */
const REAKTIONEN = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

const state = {
  users: {},
  chats: [],
  /*
   * Insight Time und was dazugehört (Handbuch-Abgleich 01.09.2026).
   *
   * Ein *Insight* ist ein Foto oder Video an ausgewählte Personen — das
   * Snapchat-Äquivalent. Die *Insight Time* zählt die Tage in Folge, an
   * denen sich beide Seiten gegenseitig einen geschickt haben. Nicht zu
   * verwechseln mit den „Insights" im Einstellungsmenü: das ist Statistik
   * zum eigenen Profil.
   */
  insights: [],
  insightStreaks: {},
  insightZiele: [],
  /** Sichtbarkeitsstufen je Bereich, mit Ausnahmelisten. */
  sichtbarkeit: {},
  /** Der in der Kamera gewählte Filter. */
  kameraFilter: 'keiner',
  stories: [],
  /*
   * Die Storyleiste des Videos-Bereichs. Sie zeigt die gefolgten Profile,
   * `stories` die Kontakte — so trennt es das Handbuch. Bis zum 07.09.2026
   * stand in beiden Bereichen dieselbe Liste.
   */
  storiesVideos: [],
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
/*
 * Eine Farbe aus den Daten, bevor sie in ein style-Attribut geht.
 *
 * WARUM: `profiles.color` darf jeder fuer sein eigenes Profil frei setzen —
 * die Regel auf `profiles` erlaubt das Aendern der Zeile, und Postgres kann
 * in einer RLS-Regel keine einzelne Spalte ausnehmen. Wer dort
 * `"><img src=x onerror=...>` hineinschreibt, bricht aus dem Attribut aus,
 * sobald irgendein anderer Nutzer ihn in einer Liste sieht. Das waere eine
 * Kontouebernahme, denn die Sitzung liegt im Browser.
 *
 * `esc()` allein reicht hier nicht: es macht den Wert nur harmlos, laesst
 * aber jeden Unsinn als CSS stehen. Darum wird gar nicht escaped, sondern
 * geprueft — durchgelassen wird ausschliesslich, was wirklich eine Farbe
 * ist: Hex, rgb()/rgba() und linear-gradient(). Alles andere faellt auf die
 * Standardfarbe zurueck. Vorbild ist farbeFuerNadel() weiter unten, das fuer
 * die Kartennadeln schon so arbeitet.
 */
const FARBE_STANDARD = '#0a66ff';
function farbe(wert) {
  const text = String(wert == null ? '' : wert).trim();
  if (!text || text.length > 200) return FARBE_STANDARD;
  // Keine Zeichen, mit denen sich das Attribut oder die Regel verlassen
  // laesst — auch nicht in einem Verlauf.
  if (/[<>"'`;\\]/.test(text)) return FARBE_STANDARD;
  const hex = /^#[0-9a-f]{3,8}$/i;
  const rgb = /^rgba?\(\s*[0-9.\s%,/]+\)$/i;
  const verlauf = /^(linear|radial)-gradient\(\s*[#0-9a-z.,()%\s-]+\)$/i;
  if (hex.test(text) || rgb.test(text) || verlauf.test(text)) return text;
  return FARBE_STANDARD;
}

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
  return `<div class="avatar avatar--${size}" style="background:${farbe(u.color)}">${esc(u.initials)}</div>`;
}

function avatarForUser(id, size = 44) {
  if (id === 'me') return eigenerAvatar(state.users.me, size);
  const u = user(id);
  return `<div class="avatar avatar--${size}" style="background:${farbe(u.color)}">${esc(u.initials)}</div>`;
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
  return `<div class="${klassen}" style="background:${farbe(me.color)}">${esc(me.initials)}</div>`;
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
  // Ob eine eigene Story laeuft, steht in der geladenen Leiste — bis zum
  // 09.09.2026 stand es im Browserspeicher, und der wusste nichts von
  // Storys, die auf dem Handy entstanden oder abgelaufen waren.
  const story = (state.stories || []).find((s) => s.own);
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
/**
 * Ein Schreibzugriff auf die API.
 *
 * Nimmt das ab, was sonst an fünfzig Stellen dastünde: Methode, Kopfzeile,
 * JSON und das Auspacken der Antwort. Ein Fehler wird zu `{ ok: false,
 * error }` und nicht zu einer geworfenen Ausnahme — die Aufrufer wollen
 * durchweg eine Meldung anzeigen, nicht abstürzen.
 *
 * Das Zugangstoken hängt der globale fetch-Aufsatz aus anmeldung.js an; hier
 * steht davon nichts, damit es genau eine Stelle bleibt.
 */
async function api(pfad, koerper) {
  try {
    const res = await fetch(pfad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(koerper || {}),
    });
    const daten = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: daten.error || `Server antwortet mit ${res.status}` };
    return daten;
  } catch (fehler) {
    console.error(`${pfad} fehlgeschlagen:`, fehler);
    return { ok: false, error: 'Keine Verbindung' };
  }
}

/*
 * Den Verlauf eines Chats holen — und aufschliessen, was verschluesselt ist.
 *
 * Es gibt diesen Helfer, weil der Verlauf an vier Stellen geholt wird: beim
 * Oeffnen des Chats, bei der Suche darin, beim Export und in den
 * Chateinstellungen. Ohne ihn haette man das Aufschliessen viermal
 * hingeschrieben und beim fuenften Mal vergessen — und dort staende dann
 * „Auf diesem Geraet nicht lesbar" an einer Nachricht, die sehr wohl lesbar
 * ist.
 *
 * Ab hier steht der Klartext wieder in `text`. Alles danach — Blasen,
 * Vorschau, Suche, Export — rechnet damit, als haette es nie eine Chiffre
 * gegeben.
 */
/*
 * Die Vorschauen der Chatliste aufschliessen.
 *
 * Der Server schickt sie leer mit — er hat den geheimen Schluessel nicht.
 * Ohne diesen Schritt stuende in der Liste bei jedem verschluesselten Chat
 * eine leere Zeile.
 */
function vorschauenOeffnen(chats) {
  if (!window.KryptoWeb) return chats;
  for (const c of chats || []) {
    if (!c.previewKrypto || !Number(c.previewKrypto.krypto)) continue;
    // Schon geoeffnet: `filteredChats` laeuft bei jedem Zeichnen, und
    // zweimal dasselbe zu entschluesseln waere Arbeit ohne Ergebnis.
    if (c._vorschauOffen) continue;
    /*
     * Ohne Schluessel gaebe `oeffnen` hier „Auf diesem Geraet nicht lesbar"
     * zurueck — und mit dem Merker davor waere das der Endstand, obwohl der
     * Schluessel eine Sekunde spaeter da ist. Also erst merken, wenn er da
     * ist; bis dahin bleibt die Vorschau, wie sie war.
     */
    if (!window.KryptoWeb.bereit()) continue;
    c._vorschauOffen = true;
    const gedeutet = window.KryptoWeb.oeffnen({ ...c.previewKrypto, text: '' });
    c.preview = gedeutet.text;
    // Das Schloss in der Chatliste haengt daran, nicht an einer Vermutung.
    c.verschluesselt = true;
  }
  return chats;
}

async function nachrichtenHolen(chatId) {
  const res = await fetch(`/api/messages/${chatId}`);
  const verlauf = await res.json();
  // Wer den Verlauf holt, hat ihn offen — also gelesen. Ob daraus eine
  // Bestaetigung wird, entscheidet `chat_gelesen` in der Datenbank anhand des
  // Schalters des Lesers; dieselbe Zeile steht im ChatDetailScreen der App.
  // Ohne await: eine ausgebliebene Bestaetigung darf den Verlauf nicht aufhalten.
  fetch(`/api/messages/${chatId}/gelesen`, { method: 'POST' }).catch(() => {});
  return window.KryptoWeb ? window.KryptoWeb.stapelOeffnen(verlauf) : verlauf;
}

/*
 * Einen Text fuer einen Chat verschliessen und den Koerper der Sendeanfrage
 * bauen.
 *
 * Geht es nicht — Gruppe, Gegenueber ohne Geraet, kein Schluessel —, steht
 * der Klartext im Koerper wie vor Schema 31. Das ist kein Fehlerfall: die
 * Nachricht kommt an, und die Oberflaeche behauptet dann auch nichts ueber
 * Verschluesselung.
 */
async function sendeKoerper(chatId, text, weiteres = {}) {
  const paket = window.KryptoWeb ? await window.KryptoWeb.verschliessen(chatId, text) : null;
  if (!paket) return { text, ...weiteres };
  return { text: '', ...paket, ...weiteres };
}

async function bootstrap() {
  let data;

  // Erst klaeren, ob jemand angemeldet ist. Sonst holt der Aufruf unten die
  // Beispieldaten, obwohl eine Sitzung vorliegt und echte Daten da waeren.
  if (window.Anmeldung?.bereit) {
    await window.Anmeldung.bereit.catch(() => null);
  }

  /*
   * Den Geraetschluessel vor dem ersten Laden anmelden: erst dann steht seine
   * Kennung im Kopf jeder Anfrage, und der Server gibt zu den Vorschauen das
   * Kuvert genau dieses Browsers heraus (24.09.2026). Ohne Sitzung geht es
   * nicht — dann holt es der Aufruf weiter unten nach.
   */
  if (window.KryptoWeb && window.Anmeldung?.angemeldet?.()) {
    await window.KryptoWeb.anmelden();
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

  /*
   * Angemeldet heißt noch nicht freigegeben (Schema 52): ein Konto unter der
   * Altersgrenze wartet auf die Zustimmung eines Elternteils. Die Datenbank
   * zeigt ihm bis dahin nichts — hier steht, warum. Gleiche Tür in
   * app/components/KontoFreigabe.tsx.
   */
  const kontostand = await window.Anmeldung?.kontostand?.().catch(() => null);
  if (kontostand && kontostand.stand !== 'frei' && kontostand.stand !== 'abgemeldet') {
    zeigeFreigabe(kontostand);
    return;
  }
  clearInterval(freigabeUhr);
  document.body.classList.remove('ist-abgemeldet');

  /*
   * Den Geraetschluessel dieses Browsers anmelden — vor `Object.assign`,
   * weil `vorschauenOeffnen` gleich darunter ihn schon braucht.
   *
   * Am 07.09.2026 stand hier kurz die scheinbar bessere Fassung: die
   * Anmeldung nicht abwarten und nachtraeglich neu zeichnen. Der Gedanke war
   * richtig — der Schluessel wird erst beim Lesen gebraucht, nicht damit die
   * Seite aufgeht —, die Folge war es nicht. Der Rundlauf lief dann in das
   * Fenster, in dem die Pruefläufe auf „networkidle" warten, und vier Laeufe
   * kippten mit Zeitueberschreitung. Erwartet man ihn hier, ist er vorher
   * fertig.
   *
   * Geht es nicht, laeuft alles weiter wie vor Schema 31: im Klartext, ohne
   * Schloss. Eine Seite, die wegen der Verschluesselung gar nicht erst
   * aufgeht, waere der schlechtere Zustand.
   */
  if (window.KryptoWeb) await window.KryptoWeb.anmelden();

  Object.assign(state, data);

  /*
   * Das Design gehoert zum Konto, nicht zum Browser.
   *
   * Bis zum 17.09.2026 lag es nur in localStorage['am-theme']: wer in der App
   * auf dunkel stellte, sah die Website hell, und ein zweites Geraet wusste
   * von nichts. Jetzt steht es zusaetzlich in user_settings und wird hier
   * beim Start uebernommen. Der localStorage bleibt als Sofortwert, damit die
   * Seite nicht erst hell aufblitzt.
   *
   * Die Einstellungen wurden bisher erst beim Oeffnen der Einstellungsseite
   * geholt — fuer das Design ist das zu spaet. Gleiche Regel in
   * app/lib/theme.tsx.
   */
  await einstellungenHolen();
  const design = state.einstellungen?.theme;
  if (design === 'dark' || design === 'light' || design === 'system') state.theme = design;

  applyTheme();
  document.body.classList.remove('is-startet');
  praesenzMelden();
  render();
  geteiltenBeitragOeffnen();
  elternfrageStarten();
}

/*
 * Ein Kinderkonto wartet — Wartebildschirm statt einer leeren Seite.
 *
 *   wartet + Elternteil   „@mama muss zustimmen", erneut prüfen, anderen fragen
 *   wartet ohne / abgelehnt   Feld für den Benutzernamen eines Elternteils
 *   ohne_datum            Konto von vor Schema 52 ohne Datum: nachtragen
 */
let freigabeUhr = null;
function zeigeFreigabe(stand, anderer = false) {
  document.body.classList.remove('is-startet');
  document.body.classList.add('ist-abgemeldet');
  const ziel = $('#main');
  if (!ziel) return;

  const ohneDatum = stand.stand === 'ohne_datum';
  const abgelehnt = stand.stand === 'abgelehnt';
  const ohneEltern = stand.stand === 'wartet' && !stand.eltern;
  const mitFeld = ohneDatum || abgelehnt || ohneEltern || anderer;

  const titel = ohneDatum
    ? 'Geburtsdatum fehlt'
    : abgelehnt
    ? 'Nicht bestätigt'
    : ohneEltern
    ? 'Zustimmung nötig'
    : 'Warte auf Zustimmung';
  const text = ohneDatum
    ? 'Seit dem 22.09.2026 braucht jedes neue Konto ein Geburtsdatum, weil jedes Land eine eigene Altersgrenze hat. Bitte trag deines nach.'
    : abgelehnt
    ? `${stand.eltern || 'Dein Elternteil'} hat dein Konto nicht bestätigt. Du kannst einen anderen Elternteil fragen.`
    : ohneEltern
    ? `In ${stand.land || 'deinem Land'} brauchst du unter ${stand.mindestalter} Jahren die Zustimmung eines Elternteils. Gib seinen All-Media-Benutzernamen ein.`
    : `${stand.eltern} muss dein Konto bestätigen. Dafür öffnet dein Elternteil All Media im eigenen Konto — die Anfrage erscheint dort von selbst.`;

  ziel.innerHTML = `
    <div class="startfehler" id="freigabe">
      <div class="startfehler__symbol">${ICONS.person}</div>
      <div class="startfehler__titel">${esc(titel)}</div>
      <div class="startfehler__text">${esc(text)}</div>
      ${
        mitFeld
          ? `<input class="freigabe__feld" id="freigabeEingabe" autocapitalize="off"
                    ${ohneDatum ? `type="date" max="${new Date().toISOString().slice(0, 10)}"` : 'placeholder="@elternteil"'}
                    aria-label="${ohneDatum ? 'Geburtsdatum' : 'Benutzername deines Elternteils'}" />
             <div class="startfehler__grund is-fehler" id="freigabeMeldung" aria-live="polite"></div>
             <button class="btn btn--primary" id="freigabeOk">${ohneDatum ? 'Speichern' : 'Anfrage senden'}</button>`
          : `<button class="btn btn--primary" id="freigabePruefen">Erneut prüfen</button>
             <button class="linkbtn" id="freigabeAnderer">Anderen Elternteil fragen</button>`
      }
      <button class="linkbtn" id="freigabeAbmelden">Abmelden</button>
    </div>`;

  $('#freigabePruefen')?.addEventListener('click', () => bootstrap());
  $('#freigabeAnderer')?.addEventListener('click', () => zeigeFreigabe(stand, true));
  $('#freigabeAbmelden').addEventListener('click', async () => {
    clearInterval(freigabeUhr);
    await window.Anmeldung.abmelden();
    window.KryptoWeb?.vergessen();
    bootstrap();
  });
  const absenden = async () => {
    const wert = $('#freigabeEingabe').value.trim();
    if (!wert) return;
    const knopf = $('#freigabeOk');
    knopf.disabled = true;
    const antwort = ohneDatum
      ? await window.Anmeldung.geburtsdatumNachtragen(wert)
      : await window.Anmeldung.elternAnfragen(wert);
    knopf.disabled = false;
    if (!antwort.ok) {
      $('#freigabeMeldung').textContent = antwort.meldung || 'Das hat nicht geklappt.';
      return;
    }
    bootstrap();
  };
  $('#freigabeOk')?.addEventListener('click', absenden);
  $('#freigabeEingabe')?.addEventListener('keydown', (e) => e.key === 'Enter' && absenden());

  // Stimmt der Elternteil zu, geht die Seite von selbst auf.
  clearInterval(freigabeUhr);
  freigabeUhr = setInterval(async () => {
    const neu = await window.Anmeldung.kontostand().catch(() => null);
    if (neu && neu.stand === 'frei') {
      clearInterval(freigabeUhr);
      bootstrap();
    }
  }, 15000);
}

/*
 * Wartet ein Kind auf meine Zustimmung? Einmal beim Start und danach jede
 * Minute — die Anfrage soll auftauchen, ohne dass jemand irgendwo sucht.
 * Gleiche Frage in app/components/KontoFreigabe.tsx (Elternfrage).
 */
let elternUhr = null;
let elternBlattOffen = false;
function elternfrageStarten() {
  const fragen = async () => {
    if (elternBlattOffen || !window.Anmeldung?.angemeldet?.()) return;
    const offen = await window.Anmeldung.einwilligungenOffen().catch(() => []);
    if (offen?.length) elternfrageZeigen(offen[0]);
  };
  clearInterval(elternUhr);
  elternUhr = setInterval(fragen, 60000);
  fragen();
}

function elternfrageZeigen(kind) {
  elternBlattOffen = true;
  const body = `
    <div class="sheet__body">
      <div class="sheet__erklaerung">
        <strong>${esc(kind.name)}</strong> (${esc(kind.handle)}, ${esc(String(kind.alter))} Jahre) hat dich als
        Elternteil angegeben. In ${esc(kind.land || 'diesem Land')} braucht ein Konto unter
        ${esc(String(kind.mindestalter))} Jahren die Zustimmung eines Elternteils.
      </div>
      <div class="sheet__hint">
        Stimmst du zu, kann ${esc(kind.handle)} All Media nutzen. Lehnst du ab, bleibt das Konto gesperrt.
      </div>
      <div class="sheet__hinweis is-fehler" id="elternMeldung" hidden></div>
      <div class="sheet__footer">
        <button class="btn" id="elternNein">Ablehnen</button>
        <button class="btn btn--primary" id="elternJa">Zustimmen</button>
      </div>
    </div>`;
  openSheet(
    'Zustimmung als Elternteil',
    body,
    (sheet, close) => {
      const entscheiden = async (zustimmen) => {
        sheet.querySelectorAll('.sheet__footer .btn').forEach((b) => (b.disabled = true));
        const antwort = await window.Anmeldung.einwilligungEntscheiden(kind.kind, zustimmen);
        if (!antwort.ok) {
          const m = sheet.querySelector('#elternMeldung');
          m.hidden = false;
          m.textContent = antwort.meldung || 'Das hat nicht geklappt.';
          sheet.querySelectorAll('.sheet__footer .btn').forEach((b) => (b.disabled = false));
          return;
        }
        close();
        toast(zustimmen ? `${kind.handle} ist freigegeben` : `${kind.handle} bleibt gesperrt`);
      };
      sheet.querySelector('#elternJa').addEventListener('click', () => entscheiden(true));
      sheet.querySelector('#elternNein').addEventListener('click', () => entscheiden(false));
    },
    {
      beimSchliessen: () => {
        elternBlattOffen = false;
      },
    }
  );
}

/*
 * "Ich bin da" — einmal beim Start und danach alle zwei Minuten.
 *
 * Der Zeitpunkt kommt aus der Datenbank, nicht aus dem Browser: eine Uhr auf
 * einem Geraet kann falsch gehen, und "zuletzt online in vier Stunden" waere
 * schwer zu erklaeren.
 */
let praesenzUhr = null;
function praesenzMelden() {
  const melden = () => fetch('/api/praesenz', { method: 'POST' }).catch(() => {});
  melden();
  if (praesenzUhr) clearInterval(praesenzUhr);
  praesenzUhr = setInterval(melden, 120000);
}

/*
 * "Online", "zuletzt online vor 12 Min.", oder gar nichts.
 *
 * Gar nichts ist der Fall, in dem der andere seinen Status verbirgt — dann
 * kommt vom Server `null`, genau wie bei jemandem, der noch nie da war. Ein
 * Wort wie "verborgen" waere selbst die Auskunft, die die Einstellung
 * verhindern soll.
 *
 * Dieselben Schwellen wie praesenzText() in app/lib/aktionen.ts. Wenn die
 * beiden Seiten hier auseinanderlaufen, zeigt dieselbe Person in App und
 * Browser einen anderen Zustand.
 */
function praesenzText(iso) {
  if (!iso) return '';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 3) return 'Online';
  if (min < 60) return `zuletzt online vor ${min} Min.`;
  const std = Math.floor(min / 60);
  if (std < 24) return `zuletzt online vor ${std} Std.`;
  const tage = Math.floor(std / 24);
  if (tage === 1) return 'zuletzt online gestern';
  if (tage < 7) return `zuletzt online vor ${tage} Tagen`;
  return 'zuletzt online vor längerer Zeit';
}

/*
 * Holt den Status nach und traegt ihn in ein bereits gezeichnetes Element
 * ein. Nachtraeglich, weil der Chatkopf sofort dastehen soll — auf eine
 * zweite Abfrage zu warten, bevor der Name erscheint, waere ein Rueckschritt
 * gegenueber dem festen Wort "Online".
 */
async function praesenzEintragen(userId, ziel) {
  if (!userId || !ziel) return;
  try {
    const r = await fetch(`/api/praesenz/${encodeURIComponent(userId)}`);
    const d = await r.json();
    if (!ziel.isConnected) return;
    ziel.textContent = praesenzText(d.zuletzt);
  } catch {
    /* Kein Status ist besser als ein falscher. */
  }
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
  // Der Chat traegt sein `archiviert` selbst. Hier stand
  // `!state.archiviert.includes(c.id)` — state.archiviert sind aber
  // Chat-Objekte, die Pruefung traf also nie zu.
  const zaehle = (liste) =>
    (liste || [])
      .filter((c) => !c.archiviert && c.id !== state.openChatId)
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
  /*
   * Auch der Sprung zum Abschnitt. Henrik am 07.09.2026: "danach normaler
   * Einstellungen-Eintritt soll Standardseite laden (aktuell manchmal noch
   * alter Messenger-Screen)." Genau das war der Grund — settingsSprung
   * ueberlebte den Ausstieg ueber die untere Leiste und liess die
   * Einstellungen beim naechsten Oeffnen wieder beim Messenger anfangen.
   */
  state.settingsSprung = null;
  state.settingsNur = null;
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
  // Die Kamera laeuft weiter, solange niemand sie abschaltet — auch dann,
  // wenn ihre Seite laengst weggezeichnet ist. Am Handy bliebe das Licht an.
  kameraStromStoppen();
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
  /*
   * Hier und nicht an den sechs Stellen, an denen `state.chats` neu gesetzt
   * wird. Dort haette man es beim siebten Mal vergessen — und dann stuende
   * in genau einem Zustand der Oberflaeche eine leere Vorschau, ohne dass
   * ein Pruefaluf etwas zu melden haette.
   */
  vorschauenOeffnen(state.chats);

  const q = state.query.trim().toLowerCase();
  return state.chats.filter((c) => {
    // Archivierte liegen unter Einstellungen > Messenger > Archivierte Chats.
    // Gepruft wird das Feld am Chat, nicht state.archiviert — das enthaelt
    // Objekte, kein `includes(c.id)` hat dort je gegriffen.
    if (c.archiviert) return false;
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
  /*
   * Das Kamerasymbol in der Zeile öffnet den Insight, nicht den Chat.
   * Deshalb wird die Weitergabe gestoppt — sonst läge darunter der Knopf für
   * den Chat und beide lösten zugleich aus.
   */
  main.querySelectorAll('[data-insight]').forEach((k) =>
    k.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      openInsightAnsehen(k.dataset.insight);
    })
  );

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
    (state.communityChats || []).find((c) => c.id === chatId) ||
    // Ein archivierter Chat steht in keiner der beiden Listen — der Server
    // haelt ihn getrennt. Ohne diese Zeile fuehrt kein Weg mehr zu seinen
    // Optionen, und damit auch keiner zurueck aus dem Archiv.
    (state.archiviert || []).find((c) => c.id === chatId);
  if (!chat) return;

  // state.archiviert sind Chat-Objekte, keine Kennungen — siehe
  // einstellungsListe('archiv'). Mit includes(chatId) stand hier immer
  // "Archivieren", auch bei einem bereits archivierten Chat.
  const archiviert =
    Boolean(chat.archiviert) || (state.archiviert || []).some((c) => c.id === chatId);

  /*
   * Punkt 15: das Blatt sah aus wie eine nackte Liste. WhatsApp zeigt beim
   * langen Druecken zuerst, um wen es ueberhaupt geht - Bild, Name, Zustand -
   * und setzt das Loeschen von den harmlosen Punkten ab. Genau das hier:
   * Kopfzeile mit Avatar, darunter die Aktionen, das Loeschen abgetrennt.
   */
  /*
   * Hier stand am Ende der Kette das feste Wort "Online". Es galt fuer jeden
   * Menschen zu jeder Zeit — es gab bis zum 03.09.2026 keine Angabe, aus der
   * sich etwas anderes haette ergeben koennen. Jetzt bleibt die Zeile leer
   * und wird nachgetragen, sobald die Antwort da ist.
   */
  const zustand = chat.isGroup
    ? `${((chat.members || []).length + 1).toLocaleString('de-DE')} Mitglieder`
    : archiviert
      ? 'Im Archiv'
      : chat.muted
        ? 'Stummgeschaltet'
        : '';

  /*
   * Der Weg von der Community in den Messenger.
   *
   * Henrik am 18.09.2026: „in den Community-Chats eine Option einbauen, dass
   * man den jeweils anderen User anfragen kann, über Messenger zu chatten."
   * Und am 21.09.: erst nach etwas Austausch, annehmen führt in den
   * Messenger, ablehnen lässt alles unter Communitys.
   *
   * Bis zum 24.09.2026 legte der Punkt den Messenger-Chat sofort an — damit
   * stand man beim anderen im Messenger, bevor er gefragt war. Jetzt ist es
   * eine echte Anfrage (Schema 57). Der Punkt steht nur, wo er etwas bewirkt:
   * im Zweierchat unter Communitys, mit jemandem, der noch kein Kontakt ist,
   * solange keine Anfrage läuft. Gleiche Bedingung in app/App.tsx.
   */
  const messengerAnfrageMoeglich =
    !chat.isGroup &&
    Boolean(chat.userId) &&
    (state.communityChats || []).some((c) => c.id === chatId) &&
    bereichFuer(chat.userId) === 'community' &&
    (chat.messengerAnfrage || 'keine') === 'keine';

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
    ${messengerAnfrageMoeglich
      ? `<button class="item" data-copt="messenger">
      <span class="item__icon">${ICONS.chat}</span>
      <span class="item__label">Messenger-Anfrage senden</span>
    </button>`
      : ''}
    <div class="copt__trenner"></div>
    <button class="item item--danger" data-copt="loeschen">
      <span class="item__icon">${ICONS.trash || ICONS.close}</span>
      <span class="item__label">Chat löschen</span>
    </button>`,
    (sheet, close) => {
      if (!chat.isGroup && !archiviert && !chat.muted) {
        praesenzEintragen(chat.userId, sheet.querySelector('.coptkopf__sub'));
      }
      sheet.querySelectorAll('[data-copt]').forEach((b) =>
        b.addEventListener('click', async () => {
          const was = b.dataset.copt;
          close();

          if (was === 'einstellungen') return openChatSettings(chatId);

          if (was === 'messenger') return messengerAnfragen(chat);

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
   *
   * Dasselbe gilt fuer den Schalter "Vorschau anzeigen" aus den
   * Einstellungen. Er stand seit Anfang an in der Liste und wurde
   * gespeichert, ohne dass ihn jemals etwas gelesen hat (Audit vom
   * 17.09.2026, Befund 1). Ist er aus, steht statt des Nachrichtentextes nur
   * "Neue Nachricht". Gleiche Regel in app/screens/messenger/ChatListScreen.tsx.
   */
  const vorschauZeigen = schalterAn('vorschau');
  const vorschau = c.gesperrt
    ? `<span class="row__preview row__preview--gesperrt">${ICONS.lock}Gesperrt</span>`
    : vorschauZeigen
      ? `<span class="row__preview">${mediaIcon}${esc(c.preview)}</span>`
      : `<span class="row__preview">${c.preview ? 'Neue Nachricht' : ''}</span>`;
  /*
   * Insight Time und offene Insights. Das Handbuch verlangt die Anzeige
   * genau hier ("Anzeige im Chatbereich -> jeweilige(n/r) Chat/Gruppe").
   * Nur im Zweierchat: eine Gruppe hat mehrere Ketten, und eine Zahl für
   * alle zusammen wäre keine.
   */
  const marke = !c.isGroup && c.userId ? insightMarke(c.userId) : '';
  const offene = !c.isGroup && c.userId ? offeneInsights(c.userId) : [];
  const insightKnopf = offene.length
    ? `<span class="row__insight" data-insight="${c.userId}" role="button" tabindex="0" title="Insight ansehen">
         ${ICONS.camera}${offene.length > 1 ? `<b>${offene.length}</b>` : ''}
       </span>`
    : '';

  return `
    <li>
      <button class="row ${c.unread ? 'is-unread' : ''}" data-chat="${c.id}">
        ${avatarOf(c, 54)}
        <div class="row__body">
          <div class="row__top">
            <span class="row__name">${esc(c.name)}</span>
            ${insightKnopf}
            ${marke}
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
 * Die Aufnahme geht seit dem 09.09.2026 an den Server (/api/hochladen) und
 * von dort in die Datenbank. Vorher lag sie nur im Browserspeicher: sie war
 * auf dem Handy nie zu sehen, ueberlebte jedes Loeschen und stand nach dem
 * naechsten Start wieder da. Vor dem Hochladen auf 1200 Pixel verkleinert.
 */

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

/*
 * Ein fertiges Bild als eigene Story setzen.
 *
 * ZWEI DINGE WAREN HIER FALSCH (bis 09.09.2026)
 *
 * 1. Die Story kam nie in der Datenbank an. Sie ging in den `localStorage`
 *    dieses einen Browsers, und darueber stand „Deine Story ist online".
 *    Niemand sonst konnte sie sehen. Denselben Fehler hatte die App bis zum
 *    01.09.2026; dort wurde er behoben, hier nicht.
 *
 * 2. Sie erschien in beiden Leisten — Messenger und Videos —, weil die
 *    eigene Kachel ueberall unbesehen vorne dranhing.
 *
 * Henrik am 07.09.2026: „Storys nicht mehr bereichsuebergreifend
 * (Messenger/Videos strikt getrennt); beim Posten fragen ob uebergreifend
 * teilen." Gefragt wird jetzt — aber nur, wenn es etwas zu entscheiden gibt:
 * steht die Story-Sichtbarkeit nicht auf „Alle", kann sie ohnehin nicht in
 * einen Bereich, in dem einem auch Fremde folgen. Eine Frage mit nur einer
 * moeglichen Antwort ist keine Frage.
 *
 * Gleiche Regel in App.tsx (`storyAufgenommen` / `storyPosten`).
 */
function alsStorySetzen(bild) {
  if (sicht('story').stufe !== 'alle') return storyPosten(bild, false);

  openSheet(
    'Wo soll die Story stehen?',
    `<div class="sheet__body">
       <div class="aufnahme__vorschau" style="background-image:url(${bild})"></div>
       <div class="sheet__hint">
         Im Messenger sehen sie deine Kontakte, unter Videos alle, die dir folgen.
       </div>
       <button class="item" data-wo="messenger">
         <span class="item__icon">${ICONS.chat}</span>
         <span class="item__label">Nur im Messenger</span>
         <span class="row__chevron">${ICONS.chevron}</span>
       </button>
       <button class="item" data-wo="beides">
         <span class="item__icon">${ICONS.play}</span>
         <span class="item__label">Auch unter Videos</span>
         <span class="row__chevron">${ICONS.chevron}</span>
       </button>
     </div>`,
    (sheet, close) => {
      sheet.querySelectorAll('[data-wo]').forEach((b) =>
        b.addEventListener('click', () => {
          close();
          storyPosten(bild, b.dataset.wo === 'beides');
        })
      );
    },
    { schliessen: true }
  );
}

/**
 * Die Story wirklich abschicken: erst die Aufnahme in den Speicher, dann die
 * Zeile in die Datenbank.
 *
 * Erst hochladen, dann anlegen — genau wie `storyAnlegen` in
 * app/lib/useAktionen.ts. Was hier vorliegt, ist eine Datenadresse
 * (`data:image/jpeg;base64,…`) aus `bildVerkleinern`. Stuende die in der
 * Datenbank, waere die Zeile ein halbes Megabyte gross und die App saehe an
 * der Stelle nichts.
 */
async function storyPosten(bild, inVideos) {
  const hoch = await api('/api/hochladen', { ordner: 'stories', aufnahme: bild });
  if (!hoch.ok) return toast(hoch.error || 'Die Aufnahme ließ sich nicht speichern');

  const antwort = await api('/api/stories', {
    mediaUrl: hoch.url,
    mediaTyp: 'image',
    inVideos,
  });
  if (!antwort.ok) return toast(antwort.error || 'Die Story ließ sich nicht anlegen');

  /*
   * Der Server schickt beide Leisten frisch zurueck. Sie zu uebernehmen ist
   * kuerzer als zu raten, wie die eigene Kachel jetzt aussieht — und es ist
   * der einzige Weg, an dem sich die Trennung ablesen laesst: unter Videos
   * steht die Story nur, wenn eben „Auch unter Videos" gewaehlt wurde.
   */
  state.stories = antwort.stories || state.stories;
  state.storiesVideos = antwort.storiesVideos || state.storiesVideos;

  toast(inVideos ? 'Deine Story ist online — auch unter Videos' : 'Deine Story ist online');
  render();
}

/*
 * Eigene Story loeschen — in der Datenbank, nicht nur auf dem Bildschirm.
 *
 * Die Plus-Kachel ohne Bild hat keine Story dahinter; da gibt es nichts zu
 * loeschen. Nach dem Loeschen kommen beide Leisten frisch vom Server, sonst
 * bliebe die Kachel unter Videos stehen.
 */
async function storyLoeschen(id) {
  if (!id || id === 'eigene') return;

  const antwort = await api(`/api/stories/${encodeURIComponent(id)}/loeschen`, {});
  if (!antwort.ok) return toast(antwort.error || 'Die Story ließ sich nicht löschen');

  state.stories = antwort.stories || state.stories;
  state.storiesVideos = antwort.storiesVideos || state.storiesVideos;
  toast('Deine Story wurde gelöscht');
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
    /*
     * Der Insight steht oben. Er ist die Gattung, für die diese Kamera im
     * Handbuch überhaupt da ist — eine Aufnahme an ausgewählte Personen, die
     * für die Insight Time zählt. Bis zum 01.09.2026 gab es ihn hier nicht:
     * die Kamera kannte nur Story, Chat und Beitrag.
     */
    { key: 'insight', label: 'Als Insight senden', icon: 'flash' },
    { key: 'story', label: 'Zu deiner Story hinzufügen', icon: 'camera' },
    { key: 'chat', label: 'An einen Chat senden', icon: 'chat' },
    /*
     * Hier stand "Als Beitrag veröffentlichen".
     *
     * Henrik, 07.09.2026: "Beiträge nur Videos, nicht Messenger — Messenger
     * privat/nummerbasiert, Videos öffentlich." Das ist die Trennlinie
     * zwischen den beiden Bereichen. Ein Knopf, der aus der privaten Kamera
     * heraus etwas öffentlich stellt, führt über diese Linie, und zwar aus
     * Versehen: er stand zwischen drei Zielen, die alle im Messenger bleiben.
     * Beiträge entstehen im Videos-Bereich über das Erstellen-Blatt.
     * Gleiche Regel in app/screens/messenger/CameraScreen.tsx.
     */
  ];

  openSheet(
    'Was möchtest du damit machen?',
    `<div class="sheet__body">
       <div class="aufnahme__vorschau" style="background-image:${
         filterSchicht(state.kameraFilter)
           ? filterSchicht(state.kameraFilter) + ', url(' + bild + ')'
           : 'url(' + bild + ')'
       }"></div>
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
          if (b.dataset.verwenden === 'insight') return openInsightSenden(bild);
          if (b.dataset.verwenden === 'story') return alsStorySetzen(bild);
          aufnahmeAnChat(bild);
        })
      );
    },
    { schliessen: true }
  );
}

/** Aufnahme in einen Chat schicken - erst fragen, in welchen. */
function aufnahmeAnChat(bild) {
  // Nicht in Chats, in denen man gerade nicht schreiben darf.
  const auswahl = state.chats.filter((c) => !chatGesperrt(c));
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

/*
 * Hier stand `aufnahmeAlsBeitrag` — der Weg von der Messenger-Kamera in einen
 * öffentlichen Beitrag. Er ist am 07.09.2026 entfallen; die Begründung steht
 * oben bei `aufnahmeMenue`. Beiträge entstehen im Videos-Bereich.
 */

/*
 * Beide Leisten zusammen, ohne Doppelte. Wer sowohl Kontakt ist als auch
 * gefolgt wird, steht in beiden Listen — gesucht wird eine Story aber nur
 * einmal.
 */
function alleStorys() {
  const raus = [];
  const gesehen = new Set();
  for (const s of [...state.stories, ...state.storiesVideos]) {
    if (gesehen.has(s.id)) continue;
    gesehen.add(s.id);
    raus.push(s);
  }
  return raus;
}

/*
 * Die Story-Leiste — eine Kachel je PERSON, nicht je Story.
 *
 * Henrik, 07.09.2026: "Story-Kreis-Logik (grau=gesehen, farbig=neu, ohne=keine
 * Story) fehlerhaft." Drei Zustände, und keiner davon stimmte hier ganz:
 *
 *  * Wer drei Storys hatte, stand dreimal in der Reihe, und jede Kachel färbte
 *    sich für sich. Derselbe Name einmal grau, daneben zweimal bunt — daran
 *    fällt die Logik als kaputt auf. Jetzt: bunt, solange auch nur eine Story
 *    der Person ungesehen ist, grau erst, wenn alle gesehen sind.
 *
 *  * Die eigene, leere Kachel trug den grauen Ring der gesehenen Story. Grau
 *    heißt "schon angesehen"; da war aber nie etwas. Der dritte Zustand
 *    verlangt gar keinen Ring, und den bekommt sie jetzt.
 *
 *  * Fremde Kacheln zeigten immer die Initialen. In der App steht dort das
 *    Bild der Story — dieselbe Leiste sah in App und Website verschieden aus.
 *
 * Gleiche Regel in app/components/StoryRail.tsx.
 */
function storyRail(liste) {
  const nachPerson = new Map();
  for (const s of liste || state.stories) {
    if (!nachPerson.has(s.userId)) nachPerson.set(s.userId, []);
    nachPerson.get(s.userId).push(s);
  }
  // Die Map behält die Reihenfolge des Eintragens: die eigene Kachel bleibt
  // links, die fremden dahinter so, wie der Server sie geliefert hat.
  return `<div class="storyrail">${[...nachPerson.values()].map(storyItem).join('')}</div>`;
}

function storyItem(storys) {
  const ungesehen = storys.find((x) => !x.viewed);
  const s = ungesehen || storys[storys.length - 1];
  const u = user(s.userId);
  // Ein Bild hat die Kachel, sobald irgendeine der Storys eines hat — eine
  // Person mit Story soll nie aussehen wie eine ohne.
  const bild = s.mediaUri || (storys.find((x) => x.mediaUri) || {}).mediaUri;
  const kern = bild
    ? `<div class="story__inner" style="background-image:url(${bild});background-size:cover;background-position:center"></div>`
    : `<div class="story__inner" style="background:${farbe(u.color)}">${esc(u.initials)}</div>`;

  // Der dritte Zustand: keine Story, kein Ring. Es gibt ihn nur bei der
  // eigenen Kachel — fremde ohne Story stehen gar nicht erst in der Leiste.
  if (s.own && !bild) {
    return `
      <button class="story" data-story="${s.id}">
        <div class="story__ring is-ohne story__add">
          ${kern}
          <span class="story__add-badge">${ICONS.plus}</span>
        </div>
        <div class="story__name">${esc(s.name)}</div>
      </button>`;
  }

  return `
    <button class="story" data-story="${s.id}">
      <div class="story__ring ${ungesehen ? '' : 'is-viewed'}">${kern}</div>
      <div class="story__name">${esc(s.name)}</div>
    </button>`;
}

function bindStoryRail() {
  main.querySelectorAll('[data-story]').forEach((el) =>
    el.addEventListener('click', () => {
      const s = alleStorys().find((x) => x.id === el.dataset.story);
      /*
       * Henrik, 07.09.2026: "Story-Plus-Button zeigt unnötig „Was möchtest du
       * damit machen"-Dialog (nur bei normaler Kamera nötig)." Wer auf das
       * Plus an der eigenen Story tippt, hat das Ziel schon genannt — die
       * Kamera fragt danach nicht noch einmal.
       * Gleiche Regel in app/App.tsx (`zielStory`).
       */
      if (s.own && !s.mediaUri) return openCamera(null, { zielStory: true });
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

/**
 * Follower- und Gefolgt-Liste einer Person.
 *
 * Bis zum 02.09.2026 las diese Funktion `state.users.followers` und
 * `state.users.following`. `state.users` ist die Karte aller Nutzer nach
 * Kennung — die beiden Eigenschaften hat nie jemand gesetzt, die Liste war
 * also immer leer. Auffaellig war das nicht, weil daneben die echte Zahl aus
 * `profile_zahlen` stand: 340 Follower, und darunter „Noch niemand".
 *
 * Die App hatte den umgekehrten Fehler — dort standen fuenf feste Kennungen
 * im Code. Beide Seiten lesen jetzt dieselbe Tabelle `follows`, die App ueber
 * ladeFolgeListe() in app/lib/daten.ts, die Website hierueber.
 *
 * Ein Klick auf einen Namen ging frueher immer auf das eigene Profil, egal
 * wen man angetippt hat. Jetzt oeffnet er das Profil dieser Person.
 */
async function openFollowerList(profile, art) {
  const wessen = profile?.userId || profile?.id || 'me';
  const schluessel = art === 'follower' ? 'follower' : 'gefolgt';

  let ids = [];
  try {
    const res = await fetch(`/api/profile/${wessen}/folge/${schluessel}`);
    if (res.ok) ids = (await res.json()).ids || [];
    else toast('Die Liste konnte nicht geladen werden.');
  } catch (fehler) {
    console.error('Folgeliste fehlgeschlagen:', fehler);
    toast('Keine Verbindung');
  }

  const liste = ids.map((id) => user(id)).filter(Boolean);
  const titel = art === 'follower' ? 'Follower' : 'Gefolgt';
  openSheet(
    titel,
    `<div class="sheet__body">${liste.length ? liste.map(u => `
      <button class="item" data-uid="${u.id}">
        <span class="avatar avatar--40" style="background:${farbe(u.color)}">${esc(u.initials)}</span>
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
          openProfile(b.dataset.uid, 'oeffentlich');
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

  /*
   * Und mit Escape. Vierter Weg — vorher war die Taste am Blatt wirkungslos:
   * sie schloss nur das Overlay darunter. Am 03.09.2026 hat das einen
   * Pruefteil lahmgelegt, weil ein offen gebliebenes Blatt jeden weiteren
   * Klick abfing. Auf dem Telefon spielt die Taste keine Rolle, am
   * Schreibtisch erwartet sie jeder.
   *
   * Es schliesst immer das oberste Blatt: Blaetter koennen uebereinander
   * liegen, und die Taste soll das schliessen, was man sieht.
   */
  const beiEscape = (e) => {
    if (e.key !== 'Escape' || schonZu) return;
    const oberstes = [...document.querySelectorAll('.sheet-backdrop')].pop();
    if (oberstes !== sheet) return;
    e.stopPropagation();
    zumachen();
  };
  document.addEventListener('keydown', beiEscape, true);
  const vorher = opts.beimSchliessen;
  opts.beimSchliessen = () => {
    document.removeEventListener('keydown', beiEscape, true);
    vorher?.();
  };

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
        <div class="avatar avatar--88" id="pbVorschau" style="background:${farbe(me.color)}">
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

/*
 * Kontakt hinzufuegen — Telefonnummer oder QR-Code.
 *
 * Henrik am 07.09.2026: „Kontakt hinzufügen nur über Telefonnummer/QR-Code,
 * nicht Username."
 *
 * Der Benutzername ist damit als Weg raus. Er stand hier gleichberechtigt
 * daneben („@greta"): jeder war ueber einen Namen auffindbar, den er sich
 * selbst gibt und der in seinem Profil steht. Eine Nummer kennt nur, wem man
 * sie gegeben hat.
 *
 * Das Feld allein waere aber keine Regel — der Riegel steht im Server
 * (`/api/contacts` in web/server/app.js). Gleiche Regel in der App:
 * app/components/AddContactSheet.tsx.
 */
function openAddContact() {
  openSheet(
    'Kontakt hinzufügen',
    `<div class="sheet__field">
      <input id="contactHandle" placeholder="Telefonnummer" inputmode="tel" autocomplete="off" />
    </div>
    <div class="sheet__hint">${esc(window.Telefon.REGEL_TEXT)}</div>
    <div class="sheet__fehler" id="contactFehler" role="status" hidden></div>
    <div class="qrReihe">
      <button class="prof__btn" id="contactQrZeigen">${ICONS.qr} Mein Code</button>
      <button class="prof__btn" id="contactQrScannen">${ICONS.scan} Code scannen</button>
    </div>
    <div class="qrFlaeche" id="contactQrFlaeche" hidden></div>
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
      const flaeche = sheet.querySelector('#contactQrFlaeche');
      input.focus();

      /*
       * Meldungen stehen im Blatt unter der Nummer. Als Toast lagen sie
       * halbdurchsichtig über „Anfrage senden" und waren kaum zu lesen; die
       * App zeigte sie bis zum 24.09.2026 gar nicht. Gleiche Stelle in
       * app/components/AddContactSheet.tsx.
       */
      const fehlerFeld = sheet.querySelector('#contactFehler');
      const melden = (text) => {
        fehlerFeld.textContent = text || '';
        fehlerFeld.hidden = !text;
      };
      input.addEventListener('input', () => melden(''));

      const submit = async () => {
        const handle = input.value.trim();
        if (!handle) return melden('Bitte eine Telefonnummer eingeben');

        // Dieselbe Regel wie in der App und im Server — gemeinsam/telefon.js.
        const grund = window.Telefon.pruefe(handle);
        if (grund) return melden(grund);

        const nachricht = msg.value.trim();
        const res = await fetch('/api/contacts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handle, nachricht }),
        });
        const result = await res.json();

        if (!result.ok) return melden(result.error);

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

      /*
       * Der eigene Code. Das Bild zeichnet der Server (/api/qr.svg) — die
       * Nummer steht dort schon und muss dafuer nicht erst in den Browser.
       * Bleibt das <img> leer, hat der Server einen Grund geschickt; ihn
       * unsichtbar zu verschlucken hiesse, dass ein weisses Feld dasteht.
       */
      sheet.querySelector('#contactQrZeigen').addEventListener('click', async () => {
        if (!flaeche.hidden) {
          flaeche.hidden = true;
          flaeche.innerHTML = '';
          return;
        }
        const res = await fetch('/api/qr.svg');
        if (!res.ok || !(res.headers.get('content-type') || '').includes('svg')) {
          const grund = await res.json().catch(() => null);
          return melden((grund && grund.error) || 'Dein Code lässt sich gerade nicht zeigen');
        }
        flaeche.innerHTML = await res.text();
        flaeche.hidden = false;
      });

      sheet.querySelector('#contactQrScannen').addEventListener('click', async () => {
        const text = await qrScannerOeffnen();
        if (!text) return;
        const nummer = window.QrKontakt.nummerAus(text);
        // Ein fremder Code — Fahrkarte, Werbeplakat — ist kein Fehler des
        // Nutzers, nur der falsche Code.
        if (!nummer) return melden('Das ist kein All-Media-Code');
        input.value = nummer;
        submit();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') msg.focus();
      });
      sheet.querySelector('#contactAdd').addEventListener('click', submit);
    }
  );
}

/*
 * Einen QR-Code mit der Kamera lesen. Gibt den Inhalt zurueck, oder null,
 * wenn abgebrochen wurde.
 *
 * WARUM jsQR UND NICHT BarcodeDetector
 *
 * `BarcodeDetector` steht im Browser bereit und koennte das ohne jede
 * Bibliothek — aber nur in Chrome. Safari kennt ihn nicht, und Henrik prueft
 * die Website auf dem iPhone. Ein Weg, der auf dem Geraet des Nutzers nicht
 * funktioniert, ist kein Weg. jsQR (Apache-2.0, liegt als public/jsQR.js
 * daneben) rechnet es selbst und laeuft ueberall.
 *
 * Die 250 KB werden erst geladen, wenn wirklich gescannt wird — sie beim
 * Seitenstart mitzuschicken hiesse, dass jeder Aufruf der Startseite einen
 * Decoder mitbringt, den fast niemand braucht.
 *
 * Gegenstueck in der App: app/components/QrScanner.tsx, dort macht das
 * `expo-camera` selbst.
 */
let jsQrGeladen;

function jsQrLaden() {
  if (jsQrGeladen) return jsQrGeladen;
  jsQrGeladen = new Promise((fertig, fehlgeschlagen) => {
    if (window.jsQR) return fertig(window.jsQR);
    const s = document.createElement('script');
    s.src = '/jsQR.js';
    s.onload = () => fertig(window.jsQR);
    s.onerror = () => {
      // Sonst haengt ein zweiter Versuch fuer immer an der kaputten Zusage.
      jsQrGeladen = null;
      fehlgeschlagen(new Error('jsQR konnte nicht geladen werden'));
    };
    document.head.appendChild(s);
  });
  return jsQrGeladen;
}

function qrScannerOeffnen() {
  return new Promise(async (fertig) => {
    let jsQR;
    try {
      jsQR = await jsQrLaden();
    } catch (fehler) {
      console.error('QR-Scanner:', fehler.message);
      toast('Der Scanner lässt sich gerade nicht laden');
      return fertig(null);
    }

    let strom = null;
    let bild = 0;

    const schicht = document.createElement('div');
    schicht.className = 'qrScanner';
    schicht.innerHTML =
      '<video playsinline muted></video>' +
      '<div class="qrScanner__rahmen"></div>' +
      '<p class="qrScanner__titel">QR-Code der anderen Person scannen</p>' +
      `<button class="qrScanner__zu" aria-label="Schließen">${ICONS.close}</button>`;
    document.body.appendChild(schicht);

    const video = schicht.querySelector('video');
    const leinwand = document.createElement('canvas');
    const stift = leinwand.getContext('2d', { willReadFrequently: true });

    const beenden = (ergebnis) => {
      cancelAnimationFrame(bild);
      if (strom) strom.getTracks().forEach((spur) => spur.stop());
      schicht.remove();
      document.removeEventListener('keydown', taste);
      fertig(ergebnis);
    };
    const taste = (e) => {
      if (e.key === 'Escape') beenden(null);
    };
    document.addEventListener('keydown', taste);
    schicht.querySelector('.qrScanner__zu').addEventListener('click', () => beenden(null));

    try {
      // `facingMode: environment` ist die Rueckkamera. Ohne die Angabe nimmt
      // das Handy die Frontkamera, und man scannt sich selbst.
      strom = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
    } catch (fehler) {
      console.error('Kamera:', fehler.message);
      toast('Ohne Kamerazugriff geht das Scannen nicht');
      return beenden(null);
    }

    video.srcObject = strom;
    await video.play().catch(() => {});

    const schauen = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        leinwand.width = video.videoWidth;
        leinwand.height = video.videoHeight;
        stift.drawImage(video, 0, 0, leinwand.width, leinwand.height);
        const daten = stift.getImageData(0, 0, leinwand.width, leinwand.height);
        const treffer = jsQR(daten.data, daten.width, daten.height, {
          inversionAttempts: 'dontInvert',
        });
        if (treffer && treffer.data) return beenden(treffer.data);
      }
      bild = requestAnimationFrame(schauen);
    };
    bild = requestAnimationFrame(schauen);
  });
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
                  .map((id) => `<span class="avatar avatar--52" style="background:${farbe(user(id).color)}">${esc(user(id).initials)}</span>`)
                  .join('')}</div>`
              : `<div class="anruf__avatar ${zustand === 'klingelt' ? 'is-klingelt' : ''}"
                   style="background:${farbe(u.color)}">${u.initials ? esc(u.initials) : gruppe ? ICONS.people : ''}</div>`
          }
          <div class="anruf__name">${esc(u.name)}</div>
          ${
            gruppe && teilnehmer.length
              ? `<div class="anruf__teilnehmer">${teilnehmer.map((id) => esc(user(id).name.split(' ')[0])).join(', ')}</div>`
              : ''
          }
          <div class="anruf__status" id="anrufStatus">${esc(status)}</div>
          <!--
            Hier stand bis zum 07.09.2026 "Ende-zu-Ende-verschlüsselt". Das war
            unzutreffend, und zwar doppelt: verschlüsselt wurde damals nichts,
            und ein Anruf wird es auch jetzt nicht — Schema 31 nimmt Anrufe
            ausdrücklich aus. Es gibt an dieser Stelle nicht einmal eine
            Übertragung. Ein Schloss, das nichts verschließt, ist schlimmer als
            gar keins, weil sich jemand darauf verlässt.
          -->
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

    /*
     * Henrik 7.9.: „Anrufe sollen als Chatnachricht protokolliert werden (wie
     * WhatsApp)." Bei einem Gruppenanruf gibt es keinen Chat zu zweit, deshalb
     * nur beim Zweiergespräch. Gleiche Stelle in der App: CallScreen.tsx,
     * `auflegen`.
     */
    if (userId) {
      fetch(`/api/kontakte/${userId}/anruf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ art, dauer, status: dauer > 0 ? 'beendet' : 'verpasst' }),
      })
        // Erst danach neu laden, sonst steht der Eintrag zwar in der
        // Datenbank, aber nicht im Chat, in den man zurückkehrt.
        .then(() => bootstrap())
        .catch((f) => console.error('Anruf konnte nicht im Chat vermerkt werden:', f));
    }

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
/*
 * Der Verschluesselungszustand eines Chats zu zweit — nachgesehen, nicht
 * behauptet.
 *
 * Bis zum 07.09.2026 stand im Kontaktprofil fest "Ende-zu-Ende", ganz gleich
 * ob etwas verschluesselt war. Genau das war Punkt 11 des Handbuch-Abgleichs:
 * eine Zusage an den Nutzer, die niemand einloest.
 *
 * Jetzt haengt sie an zwei Tatsachen: hat das Gegenueber ein Geraet
 * angemeldet, und ist es ein Chat zu zweit. Nur dann kann ueberhaupt
 * verschlossen werden. Geht die Abfrage schief, bleibt es bei "Nicht aktiv" —
 * nichts zu behaupten ist hier die richtige Antwort auf einen Fehler.
 */
async function kryptoZustand(userId, chat) {
  if (!chat || chat.isGroup || !window.KryptoWeb) return { an: false, fingerabdruck: null };
  try {
    const { oeffentlich } = await (await fetch(`/api/krypto/kontakt/${userId}`)).json();
    const meiner = await window.KryptoWeb.anmelden();
    return {
      an: Boolean(meiner && oeffentlich),
      fingerabdruck: oeffentlich ? window.KryptoWeb.fingerabdruck(oeffentlich) : null,
    };
  } catch (fehler) {
    console.warn('Verschlüsselungszustand unbekannt:', fehler.message);
    return { an: false, fingerabdruck: null };
  }
}

async function openContactProfile(userId) {
  const u = user(userId);
  if (!u) return toast('Diese Person gibt es nicht');

  const chat = state.chats.find((c) => !c.isGroup && c.userId === userId);
  const profil = await (await fetch(`/api/profile/${userId}`)).json().catch(() => ({}));
  let daten = { medien: [], markiert: [], gesamt: 0 };
  if (chat) daten = await (await fetch(`/api/chats/${chat.id}/medien`)).json();
  const krypto = await kryptoZustand(userId, chat);

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
        <!-- Henrik 7.9.: „Kontaktinfo: Button zum direkten Chat-Sprung fehlt."
             Gleiche Schaltfläche in app/screens/messenger/ContactProfileScreen.tsx. -->
        <button data-kp="chat">${ICONS.chat}<span>Nachricht</span></button>
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
          <button class="switch ${chat?.gesperrt ? 'is-on' : ''}" id="kpSperre" aria-label="Chat sperren"><span class="switch__knob"></span></button>
        </div>
        ${zeile('Erweiterter Chat-Datenschutz', einstellung({ label: 'Erweiterter Chat-Datenschutz', wahl: ['Aus', 'An'], standard: 'Aus' }))}
        ${zeile('Verschlüsselung', krypto.an ? 'Ende-zu-Ende' : 'Nicht aktiv')}
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
        {
          key: 'notiz',
          label: 'Notiz (nur für dich)',
          wert: (state.contacts || []).find((k) => k.id === userId)?.notiz || '',
        },
      ],
      ({ name, notiz }) => {
        /*
         * Henrik 7.9.: „Kontaktinfo-Änderungen (z.B. Name) speichern/
         * synchronisieren nicht."
         *
         * Hier standen zwei Zuweisungen auf state — der Name war nach dem
         * naechsten Laden wieder weg und auf dem Telefon nie da. Jetzt geht er
         * nach contacts.spitzname (Schema 33) und kommt beim naechsten
         * Bootstrap fuer jedes Geraet zurueck. Der angezeigte Name gilt weiter
         * nur fuer mich - am Profil der anderen Person aendert er nichts.
         *
         * Gleiche Regel in app/screens/messenger/ContactProfileScreen.tsx.
         */
        void (async () => {
          const res = await fetch(`/api/kontakte/${userId}/bearbeiten`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spitzname: name, notiz: notiz || '' }),
          });
          const antwort = await res.json();
          if (!antwort.ok) return toast(antwort.error);
          // Neu laden, weil der Name auch in Chatliste und Chatkopf steht.
          await bootstrap();
          toast('Kontakt gespeichert');
          openContactProfile(userId);
        })();
        return null;
      },
      'Speichern'
    )
  );

  /*
   * Hier stand nur `state.chatGesperrt[userId] = !…` — ein Wert im
   * Arbeitsspeicher des Browsers. Er war beim naechsten Laden weg, und auf dem
   * Telefon war von ihm nie etwas zu sehen, obwohl die App die Sperre seit
   * jeher nach chat_members.is_locked schreibt
   * (app/screens/messenger/ContactProfileScreen.tsx).
   *
   * Die Route /api/chats/:chatId/sperren gab es die ganze Zeit — sie wurde
   * von hier aus nur nie gerufen.
   */
  $('#kpSperre')?.addEventListener('click', (e) => {
    if (!chat) return toast('Dafür braucht es erst einen Chat');
    const knopf = e.currentTarget;
    const neu = !chat.gesperrt;
    knopf.classList.toggle('is-on', neu);
    void (async () => {
      const res = await fetch(`/api/chats/${chat.id}/sperren`, { method: 'POST' });
      const antwort = await res.json();
      if (!antwort.ok) {
        knopf.classList.toggle('is-on', !neu);
        return toast(antwort.error || 'Das hat nicht geklappt');
      }
      chat.gesperrt = Boolean(antwort.gesperrt);
      knopf.classList.toggle('is-on', chat.gesperrt);
      toast(antwort.meldung || (chat.gesperrt ? 'Chat gesperrt' : 'Chatsperre aufgehoben'));
    })();
  });

  overlay.querySelectorAll('[data-kp]').forEach((b) =>
    b.addEventListener('click', async () => {
      const was = b.dataset.kp;
      if (was === 'audio' || was === 'video') return openCall(userId, was);
      if (was === 'search') return openChatSuche(chat);
      // Sprung in den Chat. Gibt es noch keinen, legt der Server ihn an —
      // dieselbe chatMit-Regel wie in der App.
      if (was === 'chat') {
        schliessen();
        if (chat) return openChat(chat.id);
        // Der Bereich entscheidet, in welcher Chatliste der neue Chat landet —
        // nach der Person, nicht nach dem Bildschirm. Gleiche Regel wie beim
        // Teilen (bereichFuer).
        const res = await fetch(`/api/kontakte/${userId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bereich: bereichFuer(userId) }),
        });
        const antwort = await res.json();
        if (!antwort.ok) return toast(antwort.error);
        await bootstrap();
        return openChat(antwort.chatId);
      }
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
    /*
     * Frueher schaltete diese Zeile nur die Kopie im Browser um. Nach einem
     * Neuladen stand wieder "An" - und im Chat-Blatt, das denselben Schalter
     * am Server fuehrt, hatte sich nie etwas geaendert. Jetzt geht beides
     * durch dieselbe Stelle wie dort.
     */
    const antwort = await fetch(`/api/chats/${chat.id}/stumm`, { method: 'POST' })
      .then((r) => r.json())
      .catch(() => ({ ok: false }));
    if (!antwort.ok) return toast(antwort.error || 'Das hat gerade nicht geklappt');
    chat.muted = Boolean(antwort.muted);
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
    const krypto = await kryptoZustand(userId, chat);
    /*
     * Der Text sagt, was gilt — und was nicht gilt. Der zweite Teil ist der
     * wichtigere: Anrufe und Anhaenge sind nicht verschluesselt, und wer das
     * hier nicht liest, nimmt es an. Wortgleich mit der App, weil derselbe
     * Satz auf beiden Seiten dasselbe heissen muss.
     */
    return openEinstellung({
      label: 'Verschlüsselung',
      info: krypto.an
        ? 'Neue Textnachrichten in diesem Chat werden auf deinem Gerät ' +
          'verschlüsselt und erst auf dem des Gegenübers wieder geöffnet. ' +
          'All Media kann sie nicht lesen.\n\n' +
          'Nicht verschlüsselt sind: Anrufe, Bilder und Dateien, und ' +
          'Nachrichten von vor dem 07.09.2026. Wer mit wem schreibt, ist ' +
          'ebenfalls sichtbar — verschlüsselt ist der Inhalt, nicht die ' +
          'Verbindung.\n\n' +
          (krypto.fingerabdruck
            ? 'Sicherheitsnummer des Gegenübers:\n' +
              krypto.fingerabdruck +
              '\n\nVergleicht sie einmal persönlich. Nur dann steht fest, ' +
              'dass niemand dazwischen sitzt.'
            : '')
        : 'Für diesen Chat ist keine Verschlüsselung aktiv. Das Gegenüber ' +
          'hat All Media noch auf keinem Gerät geöffnet, seit es sie gibt — ' +
          'ohne dessen Schlüssel gibt es niemanden, für den verschlossen ' +
          'werden könnte.\n\nSobald es so weit ist, gilt sie für neue ' +
          'Nachrichten von selbst.',
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
    const verlauf = await nachrichtenHolen(chat.id);
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
  const verlauf = await nachrichtenHolen(chat.id);

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

  /*
   * Die beiden anderen Reiter, aus der Datenbank.
   *
   * Sie standen bis zum 03.09.2026 fest auf "Keine Reposts" bzw. "Keine
   * Markierungen" — nicht, weil nichts da war, sondern weil niemand danach
   * gefragt hat. Im eigenen Profil holt `renderVideoProfile` dieselben zwei
   * Listen laengst; hier fehlte der Aufruf.
   *
   * `null` heisst "noch nicht geholt", `[]` heisst "wirklich nichts da".
   * Ohne diesen Unterschied stuende beim Oeffnen kurz "Keine Reposts", und
   * das waere eine Auskunft, die noch niemand geprueft hat.
   */
  const reiterListen = { repost: null, tagged: null };

  /*
   * "Nachrichten senden deaktivieren" — Sichtbarkeitsbereich `dm`.
   *
   * Gefragt wird vor dem Zeichnen, nicht beim Klick: ein Knopf, der beim
   * Antippen "darfst du nicht" sagt, ist die schlechtere Antwort als einer,
   * der von vornherein gesperrt ist und den Grund danebenschreibt. Gleicher
   * Aufbau in der App (UserProfileScreen).
   *
   * Im Zweifel erlaubt: die Datenbank weist ohnehin ab (Schema 22), und ein
   * gesperrter Knopf nach einem Netzfehler waere nicht erklaerbar.
   */
  let darfSchreiben = true;
  try {
    const r = await fetch(`/api/dm-erlaubt/${encodeURIComponent(userId)}`);
    darfSchreiben = (await r.json()).erlaubt !== false;
  } catch {
    darfSchreiben = true;
  }

  const reiterLaden = async (welcher) => {
    if (reiterListen[welcher] !== null) return;
    const pfad = welcher === 'repost' ? '/api/reposts' : '/api/markierungen';
    try {
      reiterListen[welcher] = await (await fetch(`${pfad}?user=${encodeURIComponent(userId)}`)).json();
    } catch {
      reiterListen[welcher] = [];
    }
    if (tab === welcher) paint();
  };

  /*
   * Den Aufruf vermerken. Ohne das bleibt die Profilstatistik in den
   * Einstellungen dauerhaft bei null: sie kann nur zaehlen, was jemand
   * aufschreibt. Nicht abgewartet — das Profil soll deswegen nicht spaeter
   * erscheinen. Das eigene Profil zaehlt nicht mit.
   */
  void api(`/api/profile/${userId}/aufruf`);

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
            alleStorys().some((st) => st.userId === userId)
              ? `<button class="story__ring" data-profilstory="${esc(userId)}" style="width:88px;height:88px;padding:3px" aria-label="Story von ${esc(profile.name)} ansehen">
                   <span class="story__inner" style="background:${farbe(profile.color)};font-size:28px">${esc(profile.initials)}</span>
                 </button>`
              : `<div class="story__ring is-viewed" style="width:88px;height:88px;padding:3px">
                   <div class="story__inner" style="background:${farbe(profile.color)};font-size:28px">${esc(profile.initials)}</div>
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
            : !darfSchreiben
            ? // Der dritte Grund, aus dem hier kein Chat zustande kommt, und
              // der einzige, der nicht von mir ausgeht. Bewusst ohne Angabe,
              // welche Stufe dahintersteckt: ob "Niemand" oder "Alle bis auf
              // dich" waere eine Auskunft ueber eine Liste, die absichtlich
              // privat ist.
              `<div class="prof__hinweis">${ICONS.chat} ${esc(profile.name)} empfängt keine Nachrichten.</div>`
            : profile.muted
            ? `<div class="prof__hinweis">${ICONS.mute} ${esc(profile.name)} ist stummgeschaltet.</div>`
            : ''
        }

        <div class="prof__buttons">
          <button class="prof__btn ${profile.following_me ? 'is-following' : 'is-primary'}" id="profFollow">
            ${profile.following_me ? 'Gefolgt' : 'Folgen'}
          </button>
          <button class="prof__btn" id="profMessage" ${profile.blocked || !darfSchreiben ? 'disabled' : ''}>Nachricht</button>
        </div>

        ${
          // Dieselbe Reihe wie im eigenen Profil - vorher standen die
          // Highlights hier als nicht klickbare Story-Kreise. Ohne Bedingung:
          // die Reihe entscheidet selbst, ob sie sichtbar ist, und sie wird
          // gleich durch die echten Sammlungen ersetzt.
          sammlungenReihe(profile.id, profile.playlists, profile.highlights)
        }

        <div class="prof__tabs">
          <button class="prof__tab ${tab === 'grid' ? 'is-active' : ''}" data-ptab="grid" aria-label="Beiträge">${ICONS.image}</button>
          <button class="prof__tab ${tab === 'repost' ? 'is-active' : ''}" data-ptab="repost" aria-label="Reposts">${ICONS.repeat}</button>
          <button class="prof__tab ${tab === 'tagged' ? 'is-active' : ''}" data-ptab="tagged" aria-label="Markiert">${ICONS.person}</button>
        </div>

        ${profilRaster(profile, tab, reiterListen)}
      </div>`;

    $('#profBack').addEventListener('click', closeOverlay);
    $('#profMore').addEventListener('click', () => openProfilOptionen(profile, (neu) => { profile = neu; paint(); }));
    bindSammlungen(overlay);
    // Die echten Kreise kommen nach: Bild und Inhalt stehen in sammlungen.
    void ladeSammlungen(profile.id, overlay);

    // Punkt 12: der Story-Ring auf einem fremden Profil oeffnet die Story.
    overlay.querySelector('[data-profilstory]')?.addEventListener('click', () => {
      const story = alleStorys().find((st) => st.userId === userId);
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

    /*
     * Die drei Zahlen ueber dem Namen waren Knoepfe, an denen nichts hing —
     * ein Klick tat nichts. Follower und Gefolgt oeffnen jetzt die Liste
     * dieser Person; "Beitraege" bleibt ohne Ziel, das Raster steht ohnehin
     * darunter.
     */
    overlay.querySelectorAll('.prof__stat[data-stat]').forEach((b) =>
      b.addEventListener('click', () => {
        if (b.dataset.stat === 'followers') openFollowerList(profile, 'follower');
        if (b.dataset.stat === 'following') openFollowerList(profile, 'following');
      })
    );

    overlay.querySelectorAll('[data-ptab]').forEach((b) =>
      b.addEventListener('click', () => {
        tab = b.dataset.ptab;
        paint();
        // Erst beim Oeffnen holen: das Raster sieht jeder, die beiden
        // anderen Reiter sieht kaum jemand an.
        if (tab !== 'grid') void reiterLaden(tab);
      })
    );
  };

  paint();
}

/*
 * Das Raster unter den drei Reitern eines fremden Profils.
 *
 * Bis zum 03.09.2026 zeichnete der erste Reiter zwar die echten Beitraege,
 * aber jede Kachel als graues Symbol — die Bilder lagen in der Antwort und
 * wurden nicht benutzt. Das eigene Profil zeigt sie an derselben Stelle
 * laengst ueber `medienFlaeche`.
 */
function profilRaster(profile, tab, listen) {
  if (tab === 'grid') {
    if (!profile.grid.length) {
      return `<div class="empty">${ICONS.image}
        <div class="empty__title">Noch keine Beiträge</div>
        <div class="empty__text">Hier ist noch nichts.</div>
      </div>`;
    }
    return `<div class="prof__grid">${profile.grid
      .map(
        (g) => `<div class="griditem">
          ${medienFlaeche(g.id, g.kind === 'video' ? ICONS.play : ICONS.image, g.mediaUrl, g.thumbnail)}
          ${g.kind === 'video' ? `<span class="griditem__badge">${ICONS.play}</span>` : ''}
        </div>`
      )
      .join('')}</div>`;
  }

  const liste = listen[tab];
  if (liste === null) {
    return `<div class="empty">${tab === 'repost' ? ICONS.repeat : ICONS.person}
      <div class="empty__title">Wird geladen …</div>
    </div>`;
  }
  if (!liste.length) {
    /*
     * Absichtlich derselbe Satz, ob nun nichts da ist oder die Person es
     * verbirgt. Ein "verborgen" waere selbst die Auskunft, die die
     * Sichtbarkeitseinstellung verhindern soll.
     */
    return `<div class="empty">${tab === 'repost' ? ICONS.repeat : ICONS.person}
      <div class="empty__title">${tab === 'repost' ? 'Keine Reposts' : 'Keine Markierungen'}</div>
      <div class="empty__text">Hier ist noch nichts.</div>
    </div>`;
  }
  return `<div class="prof__grid">${liste
    .map(
      (e) => `<div class="griditem" title="${esc(e.eintrag.description || '')}">
        ${medienFlaeche(
          e.eintrag.id,
          e.art === 'post' ? ICONS.image : ICONS.play,
          e.eintrag.mediaUrl,
          e.eintrag.thumbnail
        )}
        <span class="griditem__badge">${tab === 'repost' ? ICONS.repeat : ICONS.person}</span>
      </div>`
    )
    .join('')}</div>`;
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
          <div class="avatar avatar--36" style="background:${farbe(user('me').color)}">DU</div>
          <div class="composer__field">
            <textarea id="commentInput" rows="1" placeholder="Kommentar hinzufügen"></textarea>
          </div>
          <button type="submit" class="composer__send" id="commentSend" aria-label="Senden" disabled>${ICONS.send}</button>
        </form>
      </div>`;

    /*
     * Erst umschalten, dann senden.
     *
     * Vorher wurde auf die Antwort des Servers gewartet und erst danach neu
     * gezeichnet. Das Herz hing damit an der Leitung: auf einer langsamen
     * Verbindung passierte nach dem Tippen eine gute Sekunde lang nichts,
     * und man tippte ein zweites Mal. Die App macht es seit dem 01.09.2026
     * andersherum (app/lib/useAktionen.ts) — hier zieht die Website nach.
     *
     * Geht das Schreiben schief, wird zurueckgestellt statt eine Zahl stehen
     * zu lassen, die nirgends gespeichert ist.
     */
    sheet.querySelectorAll('[data-clike]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const id = btn.dataset.clike;
        const vorher = list.find((c) => c.id === id);
        if (!vorher) return;

        list = list.map((c) =>
          c.id === id
            ? { ...c, liked: !c.liked, likes: Math.max(0, (c.likes || 0) + (c.liked ? -1 : 1)) }
            : c
        );
        paint();

        try {
          const r = await fetch(`/api/comments/${targetId}/${id}/like`, { method: 'POST' });
          if (!r.ok) throw new Error('Server sagt ' + r.status);
          const updated = await r.json();
          list = list.map((c) => (c.id === updated.id ? updated : c));
        } catch (fehler) {
          console.error('Kommentar-Like fehlgeschlagen:', fehler.message);
          list = list.map((c) => (c.id === id ? vorher : c));
          toast('Das Like hat nicht geklappt');
        }
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

      /*
       * Der Kommentarfilter aus dem Handbuch („Inhalts-/Kommentarfilter").
       *
       * Er greift vor dem Absenden und nicht danach: einen Kommentar erst zu
       * veröffentlichen und dann wieder zu entfernen hieße, dass ihn in der
       * Zwischenzeit jemand gelesen hat. Der Entwurf bleibt stehen, damit man
       * ihn umformulieren kann, statt ihn neu zu tippen.
       *
       * Geprüft wird auf Wortgrenzen — sonst wäre „Spastik" ein Verstoß.
       */
      const pruefung = await api('/api/wortfilter', { text });
      if (pruefung?.treffer) {
        return toast(`„${pruefung.treffer.wort}" geht hier nicht. Formuliere es bitte anders.`);
      }

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
      <div class="avatar avatar--36" style="background:${farbe(u.color)}">${esc(u.initials)}</div>
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
/**
 * Eine Umfrage — an einem Beitrag, einer Story oder in einem Kanal.
 *
 * Vor der eigenen Stimme steht nur die Antwort da, ohne Zahl und ohne
 * Balken. Wer die Verteilung vorher sieht, stimmt nicht mehr für seine
 * eigene Antwort, sondern für die führende — das ist bei jeder Umfrage so
 * und der Grund, warum Instagram und Twitter es genauso halten.
 *
 * Bei einer beendeten Umfrage stehen die Zahlen ohne Stimme da: dort ist
 * nichts mehr zu beeinflussen.
 *
 * Das Gegenstück in der App: app/components/UmfrageKarte.tsx.
 */
function umfrageKarte(u) {
  const hatGestimmt = u.antworten.some((a) => a.gewaehlt);
  const zeigeZahlen = hatGestimmt || u.beendet;

  return `
    <div class="umfrage">
      <p class="umfrage__frage">${esc(u.frage)}</p>
      ${u.antworten
        .map((a) => {
          const anteil = u.gesamt ? Math.round((a.stimmen / u.gesamt) * 100) : 0;
          return `<button class="umfrage__antwort${a.gewaehlt ? ' is-gewaehlt' : ''}"
                    data-umfrage="${u.id}" data-option="${a.id}"${u.beendet ? ' disabled' : ''}>
            ${zeigeZahlen ? `<span class="umfrage__balken" style="width:${anteil}%"></span>` : ''}
            <span class="umfrage__text">${esc(a.text)}</span>
            ${zeigeZahlen ? `<span class="umfrage__anteil">${anteil} %</span>` : ''}
            ${a.gewaehlt ? `<span class="umfrage__haken">${ICONS.check}</span>` : ''}
          </button>`;
        })
        .join('')}
      <p class="umfrage__fuss">
        ${u.gesamt} ${u.gesamt === 1 ? 'Stimme' : 'Stimmen'}${
          u.beendet ? '  ·  beendet' : u.mehrfach ? '  ·  Mehrfachauswahl' : ''
        }${!hatGestimmt && !u.beendet ? '  ·  tippe zum Abstimmen' : ''}
      </p>
    </div>`;
}

/**
 * Die Umfragen zu den Beiträgen im Feed holen.
 *
 * In einem Rutsch für alle sichtbaren Beiträge — je Beitrag eine Abfrage
 * wären bei zwanzig Karten zwanzig Anfragen beim Blättern.
 */
async function umfragenHolen() {
  const ids = (state.posts || []).map((p) => p.id);
  if (!ids.length) return;
  try {
    const res = await fetch(`/api/umfragen/post?ids=${encodeURIComponent(ids.join(','))}`);
    if (!res.ok) return;
    const daten = await res.json();
    state.umfragen = daten.umfragen || {};
  } catch (fehler) {
    console.error('Umfragen laden fehlgeschlagen:', fehler);
  }
}

function renderHomeFeed() {
  main.innerHTML = `
    <div class="scroll" id="homeScroll">
      ${storyRail(state.storiesVideos)}
      <div class="postlist">${state.posts.filter(imFeed).map(postCard).join('')}</div>
    </div>`;

  bindStoryRail();
  /*
   * Mitschreiben, was tatsaechlich gesehen wurde — die Grundlage des
   * spaeteren Feed-Rankings. Muss nach jedem Neuzeichnen erneut aufgerufen
   * werden: die Elemente von eben gibt es nach `innerHTML =` nicht mehr.
   */
  window.Impressionen?.beobachten();

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
      const story = alleStorys().find((s) => s.userId === userId);
      if (story) return openStory(story.id);
      openProfile(userId);
    })
  );

  /*
   * Doppelklick auf das Bild likt — von Henrik gewünscht, am 01.09.2026
   * nachgetragen.
   *
   * Er nimmt nie weg: wer versehentlich zweimal klickt, soll nicht sein Like
   * verlieren. So halten es Instagram und TikTok auch.
   *
   * Der Griff liegt auf dem Bild und nicht auf der ganzen Karte — auf der
   * Karte löste er beim Markieren der Bildunterschrift aus.
   */
  /*
   * Umfragen nachladen und den Feed danach einmal neu zeichnen. Sie kommen
   * nicht mit /api/bootstrap: den Start sollen sie nicht verlangsamen, und
   * gebraucht werden sie nur hier.
   */
  if (!state.umfragen) {
    state.umfragen = {};
    umfragenHolen().then(() => {
      if (Object.keys(state.umfragen).length) renderHomeFeed();
    });
  }

  main.querySelectorAll('[data-umfrage]').forEach((b) =>
    b.addEventListener('click', async () => {
      const antwort = await api(`/api/umfragen/${b.dataset.umfrage}/stimme/${b.dataset.option}`, {});
      if (!antwort?.ok) return toast(antwort?.error || 'Die Stimme ging nicht durch');
      await umfragenHolen();

      const flaeche = $('#homeScroll');
      const stand = flaeche ? flaeche.scrollTop : 0;
      renderHomeFeed();
      const neu = $('#homeScroll');
      if (neu) neu.scrollTop = stand;
    })
  );

  main.querySelectorAll('[data-doppelklick]').forEach((flaeche) =>
    flaeche.addEventListener('dblclick', () => {
      const pid = flaeche.dataset.doppelklick;
      const beitrag = state.posts.find((x) => x.id === pid);

      // Das Herz blitzt immer auf — ohne Rückmeldung wäre nicht zu erkennen,
      // ob der zweite Klick angekommen ist.
      flaeche.classList.remove('is-geherzt');
      void flaeche.offsetWidth; // Neustart der Animation erzwingen
      flaeche.classList.add('is-geherzt');

      if (beitrag && !beitrag.liked) {
        main.querySelector(`.postbtn[data-paction="like"][data-pid="${pid}"]`)?.click();
      }
    })
  );

  main.querySelectorAll('[data-paction]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const { paction, pid } = btn.dataset;

      if (paction === 'mehr') {
        const p = state.posts.find((x) => x.id === pid);
        return openBeitragOptionen({ id: pid, userId: p?.userId, mediaUrl: p?.mediaUrl });
      }

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

/*
 * "Ist das mein eigener Beitrag?"
 *
 * Die Beitraege tragen fuer die eigene Person die Kennung 'me' (so kommen sie
 * aus /api/bootstrap), state.currentUserId ist dagegen die echte UUID aus der
 * Datenbank. Ein Vergleich der beiden war deshalb immer falsch: am eigenen
 * Beitrag standen "Folgen" und die Glocke, und ein Klick darauf lief in
 * "Sich selbst folgen geht nicht" - der 500er in der Konsole.
 */
function istEigen(userId) {
  return userId === 'me' || userId === state.currentUserId;
}

function postCard(p) {
  const u = user(p.userId);
  return `
    <article class="post" id="post-${p.id}" data-impression="${p.id}" data-impressionsquelle="feed">
      <header class="post__head">
        ${/*
            Das Attribut heisst bewusst data-story-user und nicht
            data-openStory: HTML schreibt Attributnamen klein, aus
            data-openStory wird data-openstory - und dataset.openStory liest
            data-open-story. Der Wert war deshalb immer undefined, und der
            Klick auf ein Profilbild im Feed hat nie etwas geoeffnet.
          */ ''}
        <button class="story__ring story-ring-btn" style="width:40px;height:40px;padding:2px" data-story-user="${p.userId}">
          <div class="story__inner" style="background:${farbe(u.color)};font-size:13px">${esc(u.initials)}</div>
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
          istEigen(p.userId)
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
          istEigen(p.userId)
            ? ''
            : `<button class="post__bell ${p.notify ? 'is-on' : ''}" data-paction="notify" data-pid="${p.id}" aria-label="${
                p.notify ? 'Benachrichtigungen aus' : 'Benachrichtigungen an'
              }">
                ${p.notify ? ICONS.bell : ICONS.bellOff}
              </button>`
        }
        <button class="post__mehr" data-paction="mehr" data-pid="${p.id}" aria-label="Mehr">${ICONS.dots}</button>
      </header>

      ${
        /*
         * Eine Umfrage ersetzt das Bild. Ein Beitrag hat entweder ein Motiv
         * oder eine Frage — beides übereinander wäre eine Karte, bei der man
         * nicht weiß, worauf man klicken soll.
         */
        state.umfragen?.[p.id]
          ? umfrageKarte(state.umfragen[p.id])
          : `<div class="post__media" data-doppelklick="${p.id}">
               ${medienFlaeche(p.id, ICONS.image, p.mediaUrl, p.thumbnail)}
               <span class="post__herz" aria-hidden="true">${ICONS.heart}</span>
             </div>`
      }

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
  main.innerHTML =
    `<div class="feed" id="feed">${state.videos.filter(imFeed).map(videoSlide).join('')}</div>`;
  reelsBeobachten();
  window.Impressionen?.beobachten();

  /*
   * Die drei Gesten auf der Reel-Fläche.
   *
   *   doppelt tippen        -> Like       (von Henrik gewünscht)
   *   rechte Hälfte halten  -> x2         (Handbuch)
   *   einmal tippen         -> pausieren  (Handbuch)
   *
   * Alle drei hängen an derselben Fläche, deshalb steht die Unterscheidung
   * hier und nicht in drei übereinandergelegten Schaltflächen: übereinander
   * schluckte die oberste alle Klicks, und die beiden darunter wären tot.
   */
  main.querySelectorAll('[data-reelflaeche]').forEach((flaeche) => {
    const vid = flaeche.dataset.reelflaeche;
    const video = flaeche.querySelector('video');
    const marke = flaeche.querySelector('.slide__tempo');
    let letzterKlick = 0;
    let einzeln = null;
    let halten = null;
    let schnell = false;

    flaeche.addEventListener('click', () => {
      const jetzt = Date.now();

      if (jetzt - letzterKlick < 280) {
        // Doppelklick: das Herz blitzt auf, das Like wird nie weggenommen.
        letzterKlick = 0;
        if (einzeln) clearTimeout(einzeln);
        einzeln = null;

        flaeche.classList.remove('is-geherzt');
        void flaeche.offsetWidth;
        flaeche.classList.add('is-geherzt');

        const v = state.videos.find((x) => x.id === vid);
        if (v && !v.liked) {
          main.querySelector(`.railbtn[data-vaction="like"][data-vid="${vid}"]`)?.click();
        }
        return;
      }

      // Der einzelne Klick wartet 280 ms ab: kommt in der Zeit ein zweiter,
      // war es keiner. Ohne diese Wartezeit pausierte jeder Doppelklick
      // nebenbei auch das Video.
      letzterKlick = jetzt;
      einzeln = setTimeout(() => {
        if (video) (video.paused ? video.play() : video.pause());
        einzeln = null;
      }, 280);
    });

    flaeche.addEventListener('pointerdown', (e) => {
      const rechts = e.clientX > flaeche.getBoundingClientRect().left + flaeche.clientWidth / 2;
      if (!rechts) return;
      halten = setTimeout(() => {
        schnell = true;
        if (video) video.playbackRate = 2;
        // Solange x2 läuft, muss es dastehen. Sonst wirkt das Video kaputt:
        // der Ton ist zu hoch und niemand weiß warum.
        if (marke) marke.hidden = false;
      }, 250);
    });

    const loslassen = () => {
      if (halten) clearTimeout(halten);
      halten = null;
      if (!schnell) return;
      schnell = false;
      if (video) video.playbackRate = 1;
      if (marke) marke.hidden = true;
    };

    flaeche.addEventListener('pointerup', loslassen);
    flaeche.addEventListener('pointerleave', loslassen);
    flaeche.addEventListener('pointercancel', loslassen);
  });

  main.querySelectorAll('[data-vaction]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const { vaction, vid } = btn.dataset;

      if (vaction === 'mehr') {
        const v = state.videos.find((x) => x.id === vid);
        return openBeitragOptionen({ id: vid, userId: v?.userId, mediaUrl: v?.mediaUrl, video: true });
      }

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
      if (vaction === 'notify') toast(updated.notify ? 'Benachrichtigungen an' : 'Benachrichtigungen aus');

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

/*
 * Nur das Reel laufen lassen, das gerade zu sehen ist.
 *
 * Wuerden alle gleichzeitig spielen, laedt der Browser ein Dutzend Videos auf
 * einmal — auf dem Handy ueber Mobilfunk ist das der Unterschied zwischen
 * "laeuft" und "laedt ewig". Dieselbe Regel gilt in der App
 * (VideoFeedScreen, onViewableItemsChanged).
 *
 * Der Ton faengt aus an. Das ist nicht nur Hoeflichkeit: Browser lassen ein
 * Video ohne Zutun des Nutzers nur stumm starten, mit Ton wuerde die
 * Wiedergabe abgelehnt und die Flaeche bliebe stehen.
 */
function reelsBeobachten() {
  const spieler = [...main.querySelectorAll('.slide__stage video')];
  if (!spieler.length) return;

  spieler.forEach((v) => { v.muted = tonAus; });

  /*
   * „Datensparen" aus den Einstellungen. Der Schalter stand seit Anfang an in
   * der Liste und wurde gespeichert, ohne dass ihn jemals etwas gelesen hat
   * (Audit vom 17.09.2026, Befund 1). Ist er an, startet kein Video von
   * selbst — angetippt laeuft es weiterhin, die Wahl bleibt beim Nutzer.
   * Gleiche Regel in app/components/Videoflaeche.tsx.
   */
  const vonSelbst = !schalterAn('datensparen');

  const beobachter = new IntersectionObserver(
    (eintraege) => {
      eintraege.forEach((e) => {
        const v = e.target;
        if (e.isIntersecting && e.intersectionRatio > 0.6) {
          if (vonSelbst) v.play().catch(() => {});
        } else {
          v.pause();
          v.currentTime = 0;
        }
      });
    },
    { threshold: [0, 0.6, 1] }
  );
  spieler.forEach((v) => beobachter.observe(v));

  /* Antippen haelt an und laesst weiterlaufen. */
  spieler.forEach((v) =>
    v.addEventListener('click', () => (v.paused ? v.play().catch(() => {}) : v.pause()))
  );
}

/*
 * Ton im Reel-Kanal. Einen eigenen Knopf gibt es nicht mehr — Henrik am
 * 21.09.2026: "Lautstärke-Button weg, Ton richtet sich nach der Lautstärke
 * des Handys." Stumm ist ein Reel nur, bis die Person zum ersten Mal irgendwo
 * tippt oder eine Taste drueckt: vorher liesse der Browser das Video mit Ton
 * gar nicht anlaufen. Danach bleibt der Ton fuer den ganzen Besuch an, und
 * wie laut, entscheidet das Geraet. Gleiche Regel in VideoFeedScreen.tsx.
 */
let tonAus = true;
['pointerdown', 'keydown'].forEach((art) =>
  document.addEventListener(
    art,
    () => {
      tonAus = false;
      document.querySelectorAll('.slide__stage video').forEach((v) => { v.muted = false; });
    },
    { once: true, capture: true }
  )
);

function videoSlide(v) {
  const u = user(v.userId);
  // Ob ich der Person folge: erst was ich in dieser Sitzung angetippt habe,
  // sonst was der Server mitschickt. Vorher nur das Erste - wem man schon
  // folgte, stand im Kurzformat trotzdem "Folgen".
  const folgtReel = state.gefolgt?.[u.id] ?? !!v.following;
  return `
    <section class="slide" id="slide-${v.id}" data-impression="${v.id}" data-impressionsquelle="reels">
      <div class="slide__stage" data-reelflaeche="${v.id}">${
        istVideoAdresse(v.mediaUrl)
          ? videoElement(`reel-${v.id}`, v.mediaUrl, v.thumbnail, 'loop muted')
          : medienFlaeche(v.id, ICONS.play, v.mediaUrl, v.thumbnail)
      }
        <span class="slide__herz" aria-hidden="true">${ICONS.heart}</span>
        <span class="slide__tempo" hidden>2×</span>
      </div>

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
        <button class="railbtn" data-vaction="mehr" data-vid="${v.id}" aria-label="Mehr">
          ${ICONS.dots}
        </button>
      </div>

      <div class="slide__meta">
        <div class="slide__author">
          <button class="slide__who" data-profile="${v.userId}">
            <div class="avatar avatar--36" style="background:${farbe(u.color)}">${esc(u.initials)}</div>
            <span class="slide__name">${esc(u.name)}</span>
          </button>
          ${/* Am eigenen Reel weder "Folgen" noch die Glocke - wie am Beitrag
                in Home (Punkt 62), im Kurzformat bis 24.09.2026 vergessen. */ ''}
          ${
            istEigen(v.userId)
              ? ''
              : `<button class="slide__follow ${folgtReel ? 'is-gefolgt' : ''}" data-vfollow="${u.id}">${
                  folgtReel ? 'Gefolgt' : 'Folgen'
                }</button>
                <button class="slide__bell ${v.notify ? 'is-on' : ''}" data-vaction="notify" data-vid="${v.id}" aria-label="${
                  v.notify ? 'Benachrichtigungen aus' : 'Benachrichtigungen an'
                }">${v.notify ? ICONS.bell : ICONS.bellOff}</button>`
          }
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

/* ==========================================================================
 * Push-to-Talk im Browser.
 *
 * Aufgenommen wird mit der MediaRecorder-Schnittstelle, die jeder aktuelle
 * Browser hat. Die Aufnahme geht als Datenadresse an den Server — für einen
 * eigenen Speicherplatz bräuchte es einen Upload-Weg, den die Website noch
 * nicht hat; die App legt sie dagegen in den Supabase-Speicher.
 *
 * Kürzer als 0,8 Sekunden ist ein Verdrücker und wird nicht geschickt.
 *
 * Das Gegenstück in der App: app/components/PushToTalk.tsx.
 * ========================================================================== */

const PTT_MINDESTDAUER = 800;

async function pttListeLaden(communityId) {
  const liste = $('#pttListe');
  if (!liste) return;
  try {
    const res = await fetch(`/api/communities/${communityId}/ptt`);
    if (!res.ok) return;
    const daten = await res.json();
    liste.innerHTML = (daten.ptt || [])
      .slice(0, 5)
      .map(
        (p) => `<p class="ptt__zeile">${ICONS.mic}<b>${esc(p.name)}</b><span>${p.dauer}s · ${esc(p.zeit)}</span></p>`
      )
      .join('');
  } catch (fehler) {
    console.error('Push-to-Talk laden fehlgeschlagen:', fehler);
  }
}

function pttEinhaengen(communityId) {
  const knopf = $('#pttKnopf');
  if (!knopf) return;

  pttListeLaden(communityId);

  let aufnahme = null;
  let stuecke = [];
  let beginn = 0;

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      return toast('Dieser Browser kann nicht aufnehmen');
    }
    try {
      const spur = await navigator.mediaDevices.getUserMedia({ audio: true });
      stuecke = [];
      aufnahme = new MediaRecorder(spur);
      aufnahme.addEventListener('dataavailable', (e) => stuecke.push(e.data));

      aufnahme.addEventListener('stop', async () => {
        // Das Mikrofon wieder freigeben — sonst bleibt der rote Punkt im Tab
        // stehen, obwohl längst nichts mehr aufgenommen wird.
        spur.getTracks().forEach((t) => t.stop());

        const dauerMs = Date.now() - beginn;
        if (dauerMs < PTT_MINDESTDAUER) return toast('Zu kurz — halte den Knopf gedrückt');

        const blob = new Blob(stuecke, { type: 'audio/webm' });
        const adresse = await new Promise((fertig) => {
          const leser = new FileReader();
          leser.onload = () => fertig(leser.result);
          leser.readAsDataURL(blob);
        });

        const antwort = await api(`/api/communities/${communityId}/ptt`, {
          audioUrl: adresse,
          dauer: Math.round(dauerMs / 1000),
        });
        if (!antwort?.ok) return toast(antwort?.error || 'Die Aufnahme ging nicht raus');
        toast('Push-to-Talk gesendet');
        pttListeLaden(communityId);
      });

      aufnahme.start();
      beginn = Date.now();
      knopf.classList.add('is-rec');
      knopf.querySelector('span').textContent = 'Aufnahme …';
    } catch (fehler) {
      console.error('Push-to-Talk starten fehlgeschlagen:', fehler);
      toast('Ohne Mikrofonzugriff geht das nicht');
    }
  };

  const stop = () => {
    knopf.classList.remove('is-rec');
    knopf.querySelector('span').textContent = 'Push-to-Talk';
    if (aufnahme && aufnahme.state === 'recording') aufnahme.stop();
    aufnahme = null;
  };

  knopf.addEventListener('pointerdown', start);
  knopf.addEventListener('pointerup', stop);
  knopf.addEventListener('pointerleave', stop);
  knopf.addEventListener('pointercancel', stop);
  // Ohne das öffnet sich auf dem Handy beim Halten das Systemmenü.
  knopf.addEventListener('contextmenu', (e) => e.preventDefault());
}

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

      ${/*
          Push-to-Talk. Das Handbuch beschreibt es als Nachricht an alle
          Mitglieder einer Community — gedacht für Gruppenanrufe und für
          Momente außergewöhnlich hoher Aktivität. Bis zum 01.09.2026 gab es
          dafür nur einen Schalter in den Einstellungen.

          Der Knopf steht nur bei Mitgliedern: wer nicht beigetreten ist,
          darf nichts hineinsprechen, und ein Knopf, der immer scheitert, ist
          schlimmer als keiner.

          Gedrückt halten, nicht klicken — das ist nicht nur der Name: eine
          Aufnahme, die nach dem ersten Klick weiterläuft, läuft irgendwann
          in der Hosentasche weiter.
        */ ''}
      ${
        daten.joined || eigen
          ? `<div class="ptt">
               <button class="ptt__knopf" id="pttKnopf">${ICONS.mic}<span>Push-to-Talk</span></button>
               <span class="ptt__hinweis">gedrückt halten</span>
               <div class="ptt__liste" id="pttListe"></div>
             </div>`
          : ''
      }

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

  if ($('#pttKnopf')) pttEinhaengen(daten.id);

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
      ${/* Das Plus gab es im Unterthema nicht — Handbuch-Abgleich 01.09.2026,
           "Sticker innerhalb von Community-Kanaelen". Nachgetragen 04.09. */ ''}
      <button type="button" class="composer__icon" id="commAttach" aria-label="Anhang">${ICONS.plus}</button>
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

  /*
   * Angehaengter Standort und Kontakt sind Karten zum Antippen, nicht Bilder.
   * Ohne diese beiden Zeilen saehen sie im Kanal aus wie im Chat und taeten
   * nichts — dieselbe Bindung wie in paintMessages().
   */
  liste.querySelectorAll('[data-msgkontakt]').forEach((b) =>
    b.addEventListener('click', () => openContactProfile(b.dataset.msgkontakt))
  );
  liste.querySelectorAll('[data-msgort]').forEach((b) =>
    b.addEventListener('click', () => {
      const platz = state.places.find((p) => p.name === b.dataset.msgort);
      if (platz) openExplorer('standort', platz.id);
    })
  );

  const feld = $('#commMsgInput');
  const sendKnopf = $('#commSend');
  feld.addEventListener('input', () => {
    sendKnopf.disabled = !feld.value.trim();
  });
  /*
   * Enter sendet, Umschalt+Enter macht eine neue Zeile - wie im Einzelchat.
   * Wer den Schalter "Mit Enter senden" ausmacht, dreht das um: Enter setzt
   * die Zeile, gesendet wird nur ueber den Knopf. Gleiche Regel in
   * app/screens/messenger/ChatDetailScreen.tsx.
   */
  feld.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && schalterAn('entersenden')) {
      e.preventDefault();
      $('#commForm').requestSubmit();
    }
  });

  /*
   * Der Anhang im Unterthema. Dasselbe Blatt wie im Chat, nur mit einem
   * anderen Ziel — siehe zielChat() weiter unten.
   *
   * "Standort anfragen" faellt weg: die Anfrage richtet sich an eine
   * bestimmte Person, und ein Kanal hat kein Gegenueber. Im Handbuch steht
   * sie ausdruecklich unter "im Privatchat".
   */
  $('#commAttach').addEventListener('click', () =>
    openAnhang({
      pfad: `/api/communities/${community.id}/channels/${kanal.id}/anhang`,
      ausserId: null,
      ohne: ['standortAnfragen'],
      fertig: () => renderCommunityChat(community, kanal, thema),
    })
  );

  $('#commForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = feld.value.trim();
    if (!text) return;
    feld.value = '';
    sendKnopf.disabled = true;

    /*
     * Bis zum 04.09.2026 ging das an `/api/messages/<Kanal-Id>` — die Route
     * fuer Chats. `messages.chat_id` zeigt aber auf `chats`, und die Regel
     * verlangt eine Mitgliedschaft in genau diesem Chat: die Datenbank wies
     * jede Zeile mit 42501 ab. Geschrieben wurde im Unterthema also nie
     * etwas, und weil die Seite danach neu lud, sah es nach einem
     * Anzeigefehler aus. Die richtige Route gab es die ganze Zeit.
     */
    const res = await fetch(`/api/communities/${community.id}/channels/${kanal.id}/nachricht`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const daten = await res.json().catch(() => ({}));
    if (daten && daten.ok === false) toast(daten.error || 'Die Nachricht ging nicht raus');
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
  // Anhaenge seit 04.09.2026 — derselbe Inhalt wie im Chat, aus derselben
  // Funktion. Ein Sticker steht auch hier ohne Blase (msg--sticker).
  const inhalt = anhangInhalt(m);
  const stickerKlasse = m.media === 'sticker' ? ' msg--sticker' : '';

  // Eigene Nachrichten behalten den bestehenden Aufbau: .msg IST die Blase.
  if (m.from === 'me') {
    return `<div class="msg msg--out${stickerKlasse}" data-msgid="${esc(m.id)}">${inhalt}<div class="msg__foot">${esc(m.time)}</div></div>`;
  }
  const u = user(m.from);
  return `<div class="msgzeile">
    <button class="msgzeile__avatar" data-profile="${esc(m.from)}" style="background:${farbe(u.color)}" aria-label="Profil von ${esc(u.name)}">${esc(u.initials)}</button>
    <div class="msg msg--in${stickerKlasse}" data-msgid="${esc(m.id)}">
      <button class="msg__sender" data-profile="${esc(m.from)}">${esc(u.name)}</button>
      ${inhalt}
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
      ${/* Ein Schloss neben "Öffentlich" widerspricht sich selbst. */ ''}
      <div class="item">
        <span class="item__icon">${community.visibility === 'private' ? ICONS.lock : ICONS.people}</span>
        <div class="item__body">
          <span class="item__label">Sichtbarkeit</span>
          <span class="item__sub">${community.visibility === 'private' ? 'Privat — nur auf Anfrage' : 'Öffentlich'}</span>
        </div>
      </div>
      ${/*
          Der Schalter stand hier bis zum 02.09.2026 immer auf „an" und legte
          beim Antippen nur eine CSS-Klasse um — beim naechsten Oeffnen des
          Blattes war er wieder an. Er haengt jetzt an
          community_members.is_muted, derselben Spalte, aus der die App liest.
        */ ''}
      <div class="item">
        <span class="item__icon">${ICONS.bell}</span>
        <span class="item__label">Benachrichtigungen</span>
        <button class="switch ${community.stumm ? '' : 'is-on'}" data-commtoggle="mitteilungen" aria-label="Benachrichtigungen"><span class="switch__knob"></span></button>
      </div>
      <button class="item item--danger" data-commaction="verlassen">
        <span class="item__icon">${ICONS.close}</span>
        <span class="item__label">Community verlassen</span>
      </button>
    </div>`,
    (sheet, close) => {
      sheet.querySelector('[data-commtoggle]')?.addEventListener('click', async (e) => {
        const knopf = e.currentTarget;
        // Sofort umlegen, damit es sich nicht zaeh anfuehlt — und
        // zurueckdrehen, wenn die Datenbank nein sagt.
        const warAn = knopf.classList.contains('is-on');
        knopf.classList.toggle('is-on', !warAn);

        const r = await api(`/api/communities/${community.id}/stumm`);
        if (!r?.ok) {
          knopf.classList.toggle('is-on', warAn);
          return toast(r?.error || 'Nicht gespeichert');
        }
        community.stumm = r.stumm;
        const inListe = state.communities.find((c) => c.id === community.id);
        if (inListe) inListe.stumm = r.stumm;
        knopf.classList.toggle('is-on', !r.stumm);
        toast(r.stumm ? 'Benachrichtigungen aus' : 'Benachrichtigungen an');
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
        label: 'Alter und Erziehungsberechtigte/r',
        icon: 'shield',
        /*
         * Geburtsdatum statt Name und E-Mail.
         *
         * Das Handbuch verlangt: unter 16 nur mit Zustimmung eines
         * Erziehungsberechtigten, „der einen All Media Account besitzen"
         * muss. Vorher stand hier ein Formular für Name und E-Mail, an dem
         * gar nichts hing — kein Geburtsdatum, keine Prüfung, keine
         * Verknüpfung. Ein Nutzername lässt sich in der Datenbank
         * nachschlagen, eine E-Mail-Adresse kann jeder erfinden.
         */
        eingabe: [
          { key: 'geburtsdatum', label: 'Geburtsdatum', platzhalter: 'JJJJ-MM-TT, z. B. 2012-04-19', pflicht: true },
          { key: 'guardian', label: 'Nutzername des/der Erziehungsberechtigten (nur unter 16)', platzhalter: '@nutzername' },
        ],
        aktion: 'alter',
        fertig: 'Gespeichert',
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
        eingabe: [
          { key: 'nummer', label: 'Neue Telefonnummer', platzhalter: TELEFON_REGEL, pflicht: true },
        ],
        pruefen: (w) => telefonPruefen(w.nummer),
        aktion: 'telefon',
        /*
         * Vorher stand hier „Wir haben dir einen Bestätigungscode geschickt".
         * Es ging keiner raus — ein SMS-Versand ist bei Supabase nicht
         * eingerichtet — und gespeichert wurde die Nummer auch nicht.
         */
        fertig: 'Telefonnummer gespeichert',
      },
      {
        label: 'Passwort ändern',
        icon: 'lock',
        eingabe: [
          { key: 'alt', label: 'Bisheriges Passwort', pflicht: true },
          { key: 'neu', label: 'Neues Passwort', platzhalter: PASSWORT_REGEL, pflicht: true },
          { key: 'wdh', label: 'Neues Passwort wiederholen', pflicht: true },
        ],
        pruefen: (w) =>
          passwortPruefen(w.neu) ||
          (w.neu !== w.wdh ? 'Die beiden Eingaben stimmen nicht überein' : null),
        aktion: 'passwort',
        fertig: 'Passwort geändert',
      },
      { label: 'Zwei-Faktor-Anmeldung', icon: 'shield', wahlKey: 'zweiFaktor', wahl: ['Aus', 'Per SMS', 'Über eine App'], standard: 'Aus' },
      /*
       * Artikel 15 und 20 DSGVO: jeder darf seine Daten sehen und
       * mitnehmen. Fuer eine App, die live gehen soll, ist das keine
       * Zusatzfunktion — und es fehlte, obwohl die Datenschutzerklaerung
       * daneben stand.
       */
      { label: 'Meine Daten herunterladen', icon: 'image', aktion: 'datenauskunft' },
      { label: 'Konto löschen', icon: 'block', gefahr: true, bestaetigen: 'Konto endgültig löschen?' },
    ],
  },
  {
    id: 'datenschutz',
    title: 'Datenschutz',
    items: [
      /*
       * Dieselbe Frage wie unter Messenger → "Zuletzt online", und deshalb
       * auch derselbe Bereich. Hier stand bis zum 03.09.2026 eine eigene
       * Dreier-Wahl ("Alle / Meine Kontakte / Niemand"), die nur im Browser
       * lag; nebenan standen vier Stufen mit Ausnahmeliste, die in die
       * Datenbank gingen. Zwei Orte, dieselbe Frage, verschiedene Antworten.
       */
      { label: 'Zuletzt online', icon: 'clock', sichtbar: 'onlinestatus' },
      { label: 'Profilbild sichtbar für', icon: 'image', wahlKey: 'profilbildSichtbar', wahl: ['Alle', 'Meine Kontakte', 'Niemand'], standard: 'Alle' },
      { label: 'Info sichtbar für', icon: 'info', wahlKey: 'infoSichtbar', wahl: ['Alle', 'Meine Kontakte', 'Niemand'], standard: 'Meine Kontakte' },
      { label: 'Blockierte Kontakte', icon: 'block', liste: 'blockiert' },
      { label: 'Gruppen: wer darf hinzufügen', icon: 'people', wahlKey: 'gruppenHinzufuegen', wahl: ['Alle', 'Meine Kontakte', 'Niemand'], standard: 'Meine Kontakte' },
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
      { label: 'Gruppen-Mitteilungen', icon: 'people', wahlKey: 'gruppenMitteilungen', wahl: ['Alle Nachrichten', 'Nur Erwähnungen', 'Aus'], standard: 'Alle Nachrichten' },
      { label: 'Ruhezeiten', icon: 'moon', wahlKey: 'ruhezeiten', wahl: ['Aus', '22 – 7 Uhr', '23 – 8 Uhr', '0 – 9 Uhr'], standard: 'Aus' },
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
      { label: 'Standort-Sichtbarkeit', icon: 'mapPin', sichtbar: 'standort' },
      { label: 'Story-Sichtbarkeit', icon: 'eye', sichtbar: 'story' },
      { label: 'Zuletzt online', icon: 'eye', sichtbar: 'onlinestatus' },
      { label: 'Mit Enter senden', icon: 'send', toggle: 'entersenden' },
      { label: 'Chat-Hintergrund', icon: 'image', wahlKey: 'chatHintergrund', wahl: ['Hell', 'Dunkel', 'Farbverlauf'], standard: 'Hell' },
      { label: 'Schriftgröße', icon: 'info', wahlKey: 'schriftgroesse', wahl: ['Klein', 'Mittel', 'Groß'], standard: 'Mittel' },
      { label: 'Wer darf mich zu Gruppen hinzufügen', icon: 'people', wahlKey: 'gruppenHinzufuegen', wahl: ['Alle', 'Meine Kontakte', 'Niemand'], standard: 'Meine Kontakte' },
      { label: 'Selbstlöschende Nachrichten', icon: 'clock', wahlKey: 'selbstloeschend', wahl: ['Aus', 'Nach 24 Stunden', 'Nach 7 Tagen', 'Nach 90 Tagen'], standard: 'Aus' },
      { label: 'Chat-Verlauf sichern', icon: 'bookmark', aktion: 'sicherung' },
      { label: 'Archivierte Chats', icon: 'bookmark', liste: 'archiv' },
      { label: 'Blockierte Kontakte', icon: 'shield', liste: 'blockiert' },
    ],
  },
  {
    id: 'speicher',
    title: 'Speicher',
    items: [
      { label: 'Automatischer Download', icon: 'image', wahlKey: 'autoDownload', wahl: ['Nie', 'Nur im WLAN', 'Immer'], standard: 'Nur im WLAN' },
      { label: 'Speicher verwalten', icon: 'compass', liste: 'speicher' },
      { label: 'Datensparmodus', icon: 'portrait', toggle: 'datensparen' },
      { label: 'Medienqualität', icon: 'image', wahlKey: 'medienqualitaet', wahl: ['Standard', 'Hoch'], standard: 'Standard' },
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
      { label: 'Repost-Sichtbarkeit', icon: 'repeat', sichtbar: 'repost' },
      // Die beiden ueblichen Wege, auf denen Fremde an einem vorbeikommen.
      { label: 'Wer darf kommentieren', icon: 'comment', sichtbar: 'kommentare' },
      { label: 'Wer darf mich markieren', icon: 'person', sichtbar: 'markierung' },
      { label: 'Likes-Sichtbarkeit', icon: 'heart', sichtbar: 'likes' },
      { label: 'Gelikte Beiträge', icon: 'heart', liste: 'gelikt' },
      // Die vierte Gattung aus Henriks Meldung vom 18.09.2026 — dieselbe
      // Stelle wie in der App.
      { label: 'Meine Kommentare', icon: 'comment', liste: 'kommentiert' },
      { label: 'Downloadeinstellungen', icon: 'image', sichtbar: 'download' },
      { label: 'Story-Sichtbarkeit (Videos)', icon: 'eye', sichtbar: 'story' },
      { label: 'Nutzerstatus', icon: 'person', wahlKey: 'nutzerstatus', wahl: ['Aktiv', 'Beschäftigt', 'Unsichtbar'], standard: 'Aktiv' },
      /*
       * „Nutzerstatus -> immer offline für …" aus dem Handbuch. Es ist keine
       * eigene Einstellung, sondern der Onlinestatus in der Stufe „Alle bis
       * auf …" — deshalb steht hier derselbe Bereich.
       */
      { label: 'Immer offline für …', icon: 'eye', sichtbar: 'onlinestatus' },
      { label: 'Profilbann-Verlauf', icon: 'shield', liste: 'banne' },
      { label: 'Profilbanner', icon: 'landscape', wahlKey: 'profilbanner', wahl: ['Ohne', 'Farbverlauf', 'Eigenes Bild'], standard: 'Ohne' },
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
      { label: 'Nutzerstatus', icon: 'person', wahlKey: 'nutzerstatus', wahl: ['Aktiv', 'Beschäftigt', 'Unsichtbar'], standard: 'Aktiv' },
      { label: 'Privates Profil', icon: 'lock', toggle: 'commPrivate' },
      { label: 'Nachrichten erlaubt von', icon: 'chat', sichtbar: 'dm' },
      { label: 'Push-to-Talk Benachrichtigung', icon: 'mic', sichtbar: 'ptt' },
      { label: 'Gestummte Communitys', icon: 'mute', liste: 'stummeKanaele' },
      { label: 'Gestummte Profile', icon: 'block', liste: 'stummeProfile' },
    ],
  },
];

/*
 * Der Auslieferungszustand jedes Schalters.
 *
 * Bis zum 03.09.2026 war dieses Objekt der ganze Speicher: `toggles[key] =
 * !toggles[key]` und fertig. Beim naechsten Neuladen stand alles wieder auf
 * diesen Werten — auch "Privates Profil", eine Zusage an den Nutzer, die
 * damit nichts tat. Jetzt sticht `user_settings`, und was dort fehlt, gilt
 * als der Wert hier. So braucht eine neue Einstellung keine Nachtraege fuer
 * bestehende Konten.
 */
const SCHALTER_STANDARD = {
  videoPrivate: false,
  commPrivate: false,
  bildschirmsperre: false,
  toene: true,
  vibration: true,
  vorschau: true,
  lesebestaetigung: true,
  /*
   * Stand bis zum 17.09.2026 auf `false`, waehrend Enter in beiden Chats
   * immer gesendet hat — der Schalter zeigte "aus" und meinte "an". Jetzt
   * liest ihn die Tastenregel wirklich (siehe unten), und der
   * Auslieferungswert beschreibt das gewohnte Verhalten.
   */
  entersenden: true,
  datensparen: false,
};

const schalterAn = (schluessel) => {
  const gespeichert = einstellungenLaden()[schluessel];
  if (gespeichert === undefined) return Boolean(SCHALTER_STANDARD[schluessel]);
  return gespeichert === 'an';
};

/*
 * Der Sendeton. „Toene" aus den Einstellungen war bis zum 17.09.2026 ohne
 * Wirkung, weil es ueberhaupt keinen Ton gab (Audit vom 17.09.2026, Befund
 * 1). `nachricht.wav` ist derselbe Zweiklang wie in der App
 * (app/assets/nachricht.wav) und in `web/tools/nachrichtenton.py` aus einer
 * Sinuswelle erzeugt — so gibt es keine Lizenzfrage.
 *
 * Das Audio-Objekt wird erst beim ersten Ton angelegt und dann behalten.
 * Gleiche Regel in app/lib/toene.ts.
 */
let sendeTon = null;

function nachrichtTon() {
  if (!schalterAn('toene')) return;
  try {
    if (!sendeTon) sendeTon = new Audio('/nachricht.wav');
    sendeTon.currentTime = 0;
    /* Ohne Nutzergeste lehnt der Browser ab — dann eben still. */
    void sendeTon.play().catch(() => {});
  } catch {
    /* Kein Ton ist kein Fehler, der jemanden aufhalten darf. */
  }
}

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

/**
 * Die gespeicherten Einstellungen.
 *
 * Bis zum 03.09.2026 lagen sie im localStorage — also je Browser, nicht je
 * Konto. Wer auf dem Rechner "Privates Profil" anschaltete, hatte es auf dem
 * Handy und in der App nicht. Neun Schalter lagen sogar nur in einem
 * Modul-Objekt und waren beim naechsten Neuladen wieder weg.
 *
 * Jetzt kommen sie aus `user_settings` und stehen in `state.einstellungen`.
 * Der localStorage bleibt als Rueckfall fuer den Moment vor dem ersten
 * Laden — sonst springt jeder Schalter beim Seitenaufbau einmal.
 */
function einstellungenLaden() {
  if (state.einstellungen) return state.einstellungen;
  try {
    return JSON.parse(localStorage.getItem(EINSTELLUNGEN_SPEICHER) || '{}');
  } catch {
    return {};
  }
}

/*
 * Noch einmal holen, sobald der Tab wieder nach vorn kommt.
 *
 * Ohne das wandert eine Aenderung aus der App erst beim naechsten Neuladen
 * auf die Website — genau die Luecke, um die es am 17.09.2026 ging:
 * gespeichert ist nicht dasselbe wie ueberall angekommen. Ein Echtzeit-Kanal
 * waere der saubere Weg, den gibt es im Projekt aber nirgends; der Wechsel in
 * den Vordergrund ist der Moment, in dem es zaehlt.
 *
 * Gleiche Regel in app/contexts/EinstellungenContext.tsx (AppState).
 */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (!state.einstellungen) return; /* noch nie geladen — dann macht es der Start */
  void einstellungenHolen().then(() => {
    /* Nur neu zeichnen, wenn die Einstellungsseite offen ist: sonst reisst
       ein Neuaufbau den Nutzer aus dem, was er gerade tut. */
    if (state.area === 'settings') renderSettings();
  });
});

/** Holt sie vom Server. Wird beim Aufbau der Einstellungsseite gerufen. */
async function einstellungenHolen() {
  /*
   * Am Ende steht `state.einstellungen` in JEDEM Fall — auch wenn der Server
   * nicht antwortet. Sonst dreht sich renderSettings() im Kreis: es holt,
   * wenn nichts da ist, und zeichnet danach neu.
   */
  try {
    const r = await fetch('/api/einstellungen');
    if (!r.ok) {
      state.einstellungen = state.einstellungen || {};
      return;
    }
    const d = await r.json();
    state.einstellungen = d.einstellungen || {};
    // Der Rueckfall fuer den naechsten Seitenaufbau.
    try {
      localStorage.setItem(EINSTELLUNGEN_SPEICHER, JSON.stringify(state.einstellungen));
    } catch {
      /* Speicher gesperrt — dann eben ohne Rueckfall. */
    }
  } catch (fehler) {
    console.error('Einstellungen laden fehlgeschlagen:', fehler);
    state.einstellungen = state.einstellungen || {};
  }
}

/*
 * Sichtbarkeit in den vier Stufen des Handbuchs.
 *
 *     Niemand · Niemand bis auf … · Alle bis auf … · Alle
 *
 * Bis zum 01.09.2026 stand hier überall nur „Alle / Meine Kontakte /
 * Niemand". Die beiden mittleren Stufen sind aber der eigentliche Punkt: sie
 * brauchen je eine Ausnahmeliste, und „Alle bis auf meinen Chef" ließ sich
 * vorher nicht ausdrücken.
 *
 * Das Gegenstück in der App: app/components/SichtbarkeitSheet.tsx.
 */
const SICHT_STUFEN = [
  { key: 'niemand', label: 'Niemand', hinweis: 'Niemand sieht es.' },
  { key: 'niemand_bis_auf', label: 'Niemand bis auf …', hinweis: 'Nur die Personen, die du unten einträgst.' },
  { key: 'alle_bis_auf', label: 'Alle bis auf …', hinweis: 'Alle außer den Personen, die du unten einträgst.' },
  { key: 'alle', label: 'Alle', hinweis: 'Jeder, der dich sehen darf.' },
];

/*
 * Der Standort auf der Friend-Map. Beide lesen dieselbe Sichtbarkeit wie die
 * Einstellungen; `state.standort` mit eigenen drei Stufen gibt es nicht mehr.
 */
function standortAn() {
  return sicht('standort').stufe !== 'niemand';
}

function standortText() {
  const stufe = sicht('standort').stufe;
  return {
    niemand: 'Dein Standort bleibt privat',
    niemand_bis_auf: 'Nur wen du freigibst',
    alle_bis_auf: 'Alle deine Kontakte bis auf die, die du ausnimmst',
    alle: 'Alle deine Kontakte sehen dich',
  }[stufe] || 'Alle deine Kontakte sehen dich';
}

/** Stufe und Ausnahmen zu einem Bereich — ohne Eintrag gilt „alle". */
function sicht(bereich) {
  return state.sichtbarkeit?.[bereich] || { stufe: 'alle', ausnahmen: [] };
}

/**
 * Eine Stufe sofort in die Anzeige schreiben, bevor sie gespeichert ist.
 *
 * Henrik, 07.09.2026: die Sichtbarkeits-Optionen seien „zeitverzögert/buggy".
 * Sie waren nicht kaputt, sie warteten: jede Aenderung ging erst zum Server,
 * dann wurde der ganze Bestand neu geholt, und erst danach stimmte die
 * Oberflaeche. Zwei Anfragen ueber das Netz, waehrend derer der alte Wert
 * dastand.
 *
 * Wer das hier aufruft, muss das Ergebnis des Speicherns weiterhin pruefen
 * und bei einem Fehlschlag den alten Wert zurueckschreiben — sonst zeigt die
 * Oberflaeche etwas an, das in der Datenbank nicht steht.
 */
function sichtSofort(bereich, wert) {
  if (!state.sichtbarkeit) state.sichtbarkeit = {};
  state.sichtbarkeit[bereich] = {
    stufe: wert?.stufe || 'alle',
    ausnahmen: wert?.ausnahmen ? [...wert.ausnahmen] : [],
    inVideos: wert?.inVideos,
  };
}

/** Was rechts neben dem Punkt steht. */
function sichtText(bereich) {
  const s = sicht(bereich);
  const name = SICHT_STUFEN.find((x) => x.key === s.stufe)?.label || 'Alle';
  // Bei den „bis auf"-Stufen die Zahl dazu. Ohne sie sieht eine leere
  // Ausnahmeliste genauso aus wie eine mit zwölf Namen.
  const zahl = (s.ausnahmen || []).length;
  return zahl && s.stufe !== 'alle' && s.stufe !== 'niemand' ? `${name} (${zahl})` : name;
}

/** Die eigenen Sichtbarkeitsstufen frisch holen. */
async function sichtbarkeitNeuLaden() {
  try {
    const res = await fetch('/api/sichtbarkeit');
    if (!res.ok) return;
    const daten = await res.json();
    state.sichtbarkeit = daten.sichtbarkeit || {};
  } catch (fehler) {
    console.error('Sichtbarkeit laden fehlgeschlagen:', fehler);
  }
}

/**
 * Das Blatt zu einer Sichtbarkeitseinstellung.
 *
 * Die Ausnahmeliste erscheint erst, wenn eine der beiden „bis auf"-Stufen
 * gewählt ist — eine Stufe „Alle bis auf …" ohne die Liste daneben ist eine
 * Einstellung, die nichts tut. Die Einträge bleiben aber erhalten: wer
 * zwischen den Stufen hin und her schaltet, will seine mühsam
 * zusammengesuchten Namen wiederfinden.
 */
function openSichtbarkeit(punkt) {
  const bereich = punkt.sichtbar;
  /*
   * Der Suchtext lebt im Verschluss dieser Funktion und nicht in `state`: er
   * gehoert zu diesem einen geoeffneten Blatt und soll beim naechsten Mal
   * nicht noch dastehen.
   */
  let suche = '';

  const zeichne = (sheet) => {
    const jetzt = sicht(bereich);
    const brauchtListe = jetzt.stufe === 'niemand_bis_auf' || jetzt.stufe === 'alle_bis_auf';

    /*
     * Henrik, 07.09.2026: "Liste zeigt nicht alle Messenger-Kontakte."
     *
     * Hier stand `.filter((k) => state.users[k.id])`: wer im Kontaktbuch
     * steht, aber kein geladenes Profil hat, fiel lautlos heraus — und das
     * ist ausgerechnet der Kontakt, den man ausnehmen will. Jetzt bleibt
     * jeder Kontakt drin und traegt notfalls den Namen aus dem Kontaktbuch.
     * Gegenstueck in app/components/SichtbarkeitSheet.tsx.
     */
    const personen = (state.contacts || [])
      .map((k) => ({ id: k.id, name: state.users[k.id]?.name || k.name || 'Unbenannter Kontakt' }))
      .filter((p) => !suche || p.name.toLowerCase().includes(suche.toLowerCase()))
      .sort((a, b) => {
        const ad = jetzt.ausnahmen.includes(a.id) ? 0 : 1;
        const bd = jetzt.ausnahmen.includes(b.id) ? 0 : 1;
        return ad !== bd ? ad - bd : a.name.localeCompare(b.name);
      });

    sheet.querySelector('.sheet').innerHTML =
      sheetKopf(punkt.label, true) +
      `<div class="sheet__body">
         ${SICHT_STUFEN.map(
           (st) => `<button class="item sicht__stufe${st.key === jetzt.stufe ? ' is-active' : ''}" data-stufe="${st.key}">
             <span class="item__label">
               <b>${esc(st.label)}</b>
               <small>${esc(st.hinweis)}</small>
             </span>
             <span class="sicht__punkt">${st.key === jetzt.stufe ? ICONS.check : ''}</span>
           </button>`
         ).join('')}

         ${
           /*
            * Der Zusatz zur Stufe „Jeder", Handbuch: „… Jeder -> Story auch
            * in Videos teilen". Er steht auch bei anderen Stufen da — sonst
            * wuesste niemand, dass es ihn gibt —, ist dann aber nicht
            * bedienbar. Zurueckgenommen wird er beim Stufenwechsel von der
            * Datenbank selbst (Schema 30), nicht hier.
            */
           bereich === 'story'
             ? `<button class="item sicht__stufe${jetzt.stufe !== 'alle' ? ' is-aus' : ''}" data-invideos="1"${
                 jetzt.stufe !== 'alle' ? ' disabled' : ''
               }>
                  <span class="item__label">
                    <b>Story auch in Videos teilen</b>
                    <small>${
                      jetzt.stufe === 'alle'
                        ? 'Deine Story erscheint dann auch bei Profilen, die dir folgen.'
                        : 'Nur bei „Alle" möglich.'
                    }</small>
                  </span>
                  <span class="sicht__punkt">${
                    jetzt.inVideos && jetzt.stufe === 'alle' ? ICONS.check : ''
                  }</span>
                </button>`
             : ''
         }

         ${
           brauchtListe
             ? `<div class="listhead">${
                 jetzt.stufe === 'alle_bis_auf' ? 'Diese Personen nicht' : 'Nur diese Personen'
               }${jetzt.ausnahmen.length ? `  ·  ${jetzt.ausnahmen.length}` : ''}</div>
                ${/*
                    Henrik, 07.09.2026: "Bei „Alle bis auf"/„Niemand bis auf"
                    fehlt Suchleiste." Bei einer Kontaktliste, durch die man
                    scrollen muss, ist die Ausnahmeliste ohne Suche nicht zu
                    bedienen.
                  */ ''}
                <div class="sicht__suche">
                  <input type="search" id="sichtSuche" placeholder="Kontakt suchen …" value="${esc(suche)}" />
                </div>
                ${
                  personen.length
                    ? personen
                        .map(
                          (p) => `<button class="insight__person${
                            jetzt.ausnahmen.includes(p.id) ? ' is-active' : ''
                          }" data-ausnahme="${p.id}">
                            ${avatarForUser(p.id, 36)}
                            <span class="insight__personText"><span class="insight__personName">${esc(p.name)}</span></span>
                            <span class="insight__haken">${ICONS.check}</span>
                          </button>`
                        )
                        .join('')
                    : suche
                      ? `<div class="sheet__hint">Für „${esc(suche)}" ist kein Kontakt dabei.</div>`
                      : '<div class="sheet__hint">Du hast noch keine Kontakte, die du hier eintragen könntest.</div>'
                }`
             : ''
         }
       </div>`;

    binde(sheet);
  };

  const binde = (sheet) => {
    sheet.querySelector('.sheet__x')?.addEventListener('click', () => sheet.remove());

    /*
     * Das Feld behaelt den Schreibstand ueber das Neuzeichnen hinweg — sonst
     * verliert es nach dem ersten Buchstaben den Fokus und man kann nur
     * einzelne Zeichen eingeben.
     */
    const sucheFeld = sheet.querySelector('#sichtSuche');
    if (sucheFeld) {
      sucheFeld.addEventListener('input', (e) => {
        suche = e.target.value;
        zeichne(sheet);
        const neu = sheet.querySelector('#sichtSuche');
        if (neu) {
          neu.focus();
          neu.setSelectionRange(neu.value.length, neu.value.length);
        }
      });
    }

    // Die Stufe steht sofort, das Speichern laeuft danach. Siehe sichtSofort().
    sheet.querySelectorAll('[data-stufe]').forEach((b) =>
      b.addEventListener('click', async () => {
        const vorher = sicht(bereich);
        sichtSofort(bereich, { ...vorher, stufe: b.dataset.stufe });
        zeichne(sheet);

        const antwort = await api(`/api/sichtbarkeit/${bereich}`, { stufe: b.dataset.stufe });
        if (!antwort?.ok) {
          sichtSofort(bereich, vorher);
          zeichne(sheet);
          return toast(antwort?.error || 'Das hat nicht geklappt');
        }
        await sichtbarkeitNeuLaden();
        zeichne(sheet);
      })
    );

    sheet.querySelector('[data-invideos]')?.addEventListener('click', async () => {
      const antwort = await api('/api/story-in-videos', { an: !sicht('story').inVideos });
      if (!antwort?.ok) return toast(antwort?.error || 'Das hat nicht geklappt');
      await sichtbarkeitNeuLaden();
      zeichne(sheet);
      // Die Leiste im Videos-Bereich haengt daran: sie zeigt nur Storys von
      // Leuten, die diesen Schalter an haben.
      await bootstrap();
    });

    sheet.querySelectorAll('[data-ausnahme]').forEach((b) =>
      b.addEventListener('click', async () => {
        const id = b.dataset.ausnahme;
        const vorher = sicht(bereich);
        const drauf = (vorher.ausnahmen || []).includes(id);
        sichtSofort(bereich, {
          ...vorher,
          ausnahmen: drauf
            ? (vorher.ausnahmen || []).filter((x) => x !== id)
            : [...(vorher.ausnahmen || []), id],
        });
        zeichne(sheet);

        const antwort = await api(`/api/sichtbarkeit/${bereich}/ausnahme/${id}`, {});
        if (!antwort?.ok) {
          sichtSofort(bereich, vorher);
          zeichne(sheet);
          return toast(antwort?.error || 'Das hat nicht geklappt');
        }
        await sichtbarkeitNeuLaden();
        zeichne(sheet);
      })
    );
  };

  openSheet(punkt.label, '<div class="sheet__body"></div>', (sheet) => zeichne(sheet), {
    schliessen: true,
    hoch: true,
  });
}

/*
 * Der Schluessel, unter dem die Wahl liegt.
 *
 * `wahlKey` und nicht die Beschriftung: die ist Text fuer Menschen und wird
 * umformuliert — dann waere die Einstellung verloren. Punkte ohne eigenen
 * Schluessel behalten ihr Label, damit sie beim Umbau nicht herausfallen.
 * Beide Seiten muessen denselben Schluessel benutzen, sonst zeigt die App
 * etwas anderes als die Website.
 */
const einstellungsSchluessel = (punkt) => punkt.wahlKey || punkt.label;

function einstellung(punkt) {
  const gespeichert = einstellungenLaden()[einstellungsSchluessel(punkt)];
  return gespeichert && (!punkt.wahl || punkt.wahl.includes(gespeichert)) ? gespeichert : punkt.standard || '';
}

async function einstellungSetzen(punkt, wert) {
  const schluessel = einstellungsSchluessel(punkt);
  const vorher = state.einstellungen ? state.einstellungen[schluessel] : undefined;

  // Sofort umlegen, damit es sich nicht zaeh anfuehlt.
  state.einstellungen = { ...(state.einstellungen || {}), [schluessel]: wert };

  const antwort = await api(`/api/einstellungen/${encodeURIComponent(schluessel)}`, { wert });
  if (!antwort?.ok) {
    // Zurueckdrehen. Eine Einstellung, die anders aussieht, als sie
    // gespeichert ist, ist schlimmer als eine, die sich nicht setzen laesst.
    if (vorher === undefined) delete state.einstellungen[schluessel];
    else state.einstellungen[schluessel] = vorher;
    toast(antwort?.error || 'Nicht gespeichert');
    return false;
  }
  /*
   * "Privates Profil" steht zweimal in der Liste — unter Videos
   * (videoPrivate) und unter Communitys (commPrivate). Beide schalten
   * dieselbe Spalte profiles.privat, der Server schreibt deshalb immer beide
   * Schluessel. Hier zieht die Anzeige nach, sonst stuende der zweite
   * Schalter bis zum naechsten Laden auf dem alten Wert — ein Widerspruch auf
   * demselben Bildschirm.
   */
  if (schluessel === 'videoPrivate' || schluessel === 'commPrivate') {
    const anderer = schluessel === 'videoPrivate' ? 'commPrivate' : 'videoPrivate';
    state.einstellungen[anderer] = wert;
    document
      .querySelectorAll(`[data-toggle="${anderer}"]`)
      .forEach((b) => b.classList.toggle('is-on', wert === 'an'));
  }

  try {
    localStorage.setItem(EINSTELLUNGEN_SPEICHER, JSON.stringify(state.einstellungen));
  } catch {
    /* Speicher gesperrt — dann eben ohne Rueckfall. */
  }
  return true;
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
    /*
     * `state.archiviert` kommt aus dem Bootstrap und enthaelt die Chat-
     * OBJEKTE, nicht ihre Kennungen (supabase-api.js: `archiviert: chats
     * .filter((c) => c.archiviert)`). Die Nachbarliste "Blockiert" darueber
     * bekommt tatsaechlich Kennungen — daher die Verwechslung.
     *
     * Hier stand `ids.map((id) => alle.find((c) => c.id === id))`. Ein Objekt
     * ist nie gleich einer Kennung, der Treffer blieb immer aus. Und selbst
     * mit richtigen Kennungen waere nichts gefunden worden: gesucht wurde in
     * state.chats, aus dem der Server die archivierten eine Zeile vorher
     * herausgefiltert hat. Die Liste sagte deshalb dauerhaft "Kein Chat ist
     * archiviert." — auch unmittelbar nach dem Archivieren.
     *
     * Gleiche Regel wie in app/screens/profile/SettingsScreen.tsx, wo genau
     * dieser Fehler am 01.09.2026 fuer die App behoben wurde.
     */
    return {
      leer: 'Kein Chat ist archiviert.',
      zeilen: (state.archiviert || []).map((c) => ({ text: c.name, neben: 'archiviert' })),
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
  /*
   * Der Bann-Verlauf. Das Handbuch verlangt ihn ausdrücklich „mit Grund" —
   * ohne Begründung ist eine Sperre nicht nachvollziehbar und nicht
   * anfechtbar. Er wird beim Öffnen der Einstellungen geholt (renderSettings).
   */
  if (art === 'banne') {
    return {
      leer: 'Gegen dein Profil liegt nichts vor.',
      zeilen: (state.banne || []).map((b) => ({
        text: `${b.grund} (${b.bereich})`,
        neben: b.laeuft ? `läuft seit ${b.von}` : `beendet · ${b.von}`,
      })),
    };
  }
  /*
   * Die Statistik zum eigenen Content. Vier Zahlen, die bis zum 02.09.2026
   * erfunden waren und bei jedem Konto gleich standen. „Aufrufe gesamt" statt
   * „(30 Tage)", weil `posts.views` ein Zaehlerstand ohne Verlauf ist — die
   * neuen Follower dagegen lassen sich ueber `follows.created_at` wirklich
   * eingrenzen.
   */
  /*
   * Die Statistik zum eigenen Profil.
   *
   * Henrik: "man kann dann sehen wie viele Aufrufe hat mein Profil gehabt in
   * den letzten Wochen". Das ging vorher nicht — nicht, weil es niemand
   * angezeigt haette, sondern weil nichts gemessen wurde. Seit Schema 16
   * vermerkt `profile_views` jeden fremden Profilaufruf mit Zeitpunkt.
   *
   * Aufgeteilt in drei Bloecke: eine Liste aus zwoelf gleich aussehenden
   * Zeilen liest niemand.
   */
  if (art === 'insights') {
    const st = state.statistik;
    if (!st) return { leer: 'Wird geladen …', zeilen: [] };
    const z = (n) => Number(n || 0).toLocaleString('de-DE');
    return {
      leer: '',
      zeilen: [
        { text: 'Profil', kopf: true },
        { text: 'Profilaufrufe (7 Tage)', neben: z(st.profilaufrufe7) },
        { text: 'Profilaufrufe (30 Tage)', neben: z(st.profilaufrufe30) },
        // Wie viele Menschen, nicht wie oft: zwanzig Aufrufe von einer
        // Person sind etwas anderes als zwanzig von zwanzig.
        { text: 'Verschiedene Besucher (30 Tage)', neben: z(st.besucher30) },
        { text: 'Profilaufrufe gesamt', neben: z(st.profilaufrufe) },

        { text: 'Follower', kopf: true },
        { text: 'Neue Follower (7 Tage)', neben: z(st.follower7) },
        { text: 'Neue Follower (30 Tage)', neben: z(st.follower30) },
        { text: 'Follower gesamt', neben: z(st.follower) },

        { text: 'Inhalte', kopf: true },
        { text: 'Eigene Beiträge', neben: z(st.beitraege) },
        // "gesamt" und nicht "(30 Tage)": posts.views ist ein Zaehlerstand
        // ohne Verlauf.
        { text: 'Aufrufe der Beiträge gesamt', neben: z(st.aufrufe) },
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
  /*
   * Was mir gefallen hat. Kein fuenfter Profilreiter - der Prototyp hat dort
   * vier. Gleiche Quelle und gleiche Ersatztexte wie gelikteVon() in der App.
   */
  if (art === 'gelikt') {
    if (!state.gelikt) return { leer: 'Wird geladen …', zeilen: [] };
    return {
      leer: 'Dir hat noch nichts gefallen.',
      zeilen: state.gelikt.map((b) => ({
        text: b.titel,
        neben: new Date(b.wann).toLocaleDateString('de-DE'),
      })),
    };
  }
  /*
   * Die eigenen Kommentare. `zeile` kommt fertig vom Server (aus
   * gemeinsam/kommentar.js) — hier wird nichts nachgerechnet, sonst haette
   * der Browser seine eigene Fassung der Regel.
   */
  if (art === 'kommentiert') {
    if (!state.kommentiert) return { leer: 'Wird geladen …', zeilen: [] };
    return {
      leer: 'Du hast noch nichts kommentiert.',
      zeilen: state.kommentiert.map((k) => ({
        text: k.zeile,
        neben: new Date(k.wann).toLocaleDateString('de-DE'),
      })),
    };
  }
  if (art === 'gefolgt') {
    const ids = Object.keys(state.gefolgt || {}).filter((id) => state.gefolgt[id]);
    return {
      leer: 'Du folgst noch niemandem.',
      zeilen: ids.map((id) => ({ text: user(id).name, neben: user(id).handle })),
    };
  }
  /*
   * Hier standen Gruppen*chats* — `state.chats.filter(c => c.isGroup &&
   * c.muted)`. Das ist etwas anderes als eine Community, und die App zeigte
   * an derselben Stelle wieder etwas Drittes. Beide lesen jetzt
   * community_members.is_muted.
   */
  if (art === 'stummeKanaele') {
    const stumm = state.communities.filter((c) => c.stumm);
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
  // Sichtbarkeit hat ein eigenes Blatt: vier Stufen plus Ausnahmeliste.
  if (punkt.sichtbar) return openSichtbarkeit(punkt);

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

        /*
         * Die Altersangabe geht wirklich in die Datenbank. Vorher stand hier
         * ein Formular, an dem gar nichts hing: man trug einen
         * Erziehungsberechtigten ein und es passierte nichts.
         *
         * Das Ergebnis wird nicht abgewartet, weil das Blatt sonst hängen
         * bliebe — die Meldung kommt hinterher, und bei einem Fehler
         * (unbekannter Nutzername, unglaubwürdiges Datum) nennt sie den
         * Grund.
         */
        if (punkt.aktion === 'alter') {
          (async () => {
            const antwort = await api('/api/alter', {
              geburtsdatum: (werte.geburtsdatum || '').trim(),
              guardian: (werte.guardian || '').trim() || undefined,
            });
            if (!antwort?.ok) return toast(antwort?.error || 'Die Altersangabe ging nicht durch');
            toast(
              antwort.brauchtFreigabe
                ? `${antwort.alter} Jahre — die Freigabe ist angefragt`
                : `${antwort.alter} Jahre — keine Freigabe nötig`
            );
          })();
          return null;
        }

        /*
         * Das Passwort wirklich ändern.
         *
         * Bis zum 07.09.2026 endete dieses Formular mit „Passwort geändert"
         * und schickte nichts los — beim nächsten Anmelden galt das alte
         * weiter. Der Wert darf auch nicht über einstellungSetzen laufen: das
         * legt ihn im Browser ab, und ein Passwort hat dort nichts zu suchen.
         */
        /*
         * Die Telefonnummer wirklich speichern — in `profiles.phone`, woraus
         * die Kontaktinfo im Profil liest. Der Grund eines Fehlschlags wird
         * durchgereicht: „zu kurz" und „gehört schon zu einem anderen Konto"
         * verlangen Verschiedenes vom Nutzer.
         */
        if (punkt.aktion === 'telefon') {
          (async () => {
            const antwort = await api('/api/eigene/telefon', { nummer: werte.nummer || '' });
            toast(
              antwort?.ok
                ? `Telefonnummer gespeichert: ${antwort.nummer}`
                : antwort?.error || 'Die Nummer ließ sich nicht speichern'
            );
          })();
          return null;
        }

        if (punkt.aktion === 'passwort') {
          if (!window.Anmeldung?.passwortAendern) return 'Die Anmeldung ist gerade nicht erreichbar.';
          (async () => {
            const antwort = await window.Anmeldung.passwortAendern(werte.alt, werte.neu);
            toast(antwort.ok ? 'Passwort geändert' : antwort.fehler || 'Das hat nicht geklappt');
          })();
          return null;
        }

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
                 .map((z) =>
                   /*
                    * Zwischenueberschrift statt Eintrag. Die Profilstatistik
                    * hat zwoelf Zeilen; ohne Gliederung sieht "Profilaufrufe
                    * (7 Tage)" so wichtig aus wie "Follower gesamt", obwohl
                    * das eine eine Entwicklung ist und das andere ein Stand.
                    */
                   z.kopf
                     ? `<div class="sheet__gruppe">${esc(z.text)}</div>`
                     : `<div class="item">
                     <span class="item__label">${esc(z.text)}</span>
                     <span class="item__value">${esc(z.neben || '')}</span>
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

  /*
   * Die Datenauskunft. Ueber fetch und nicht als schlichter Link: die
   * Anmeldung haengt am Zugangstoken, das der globale fetch-Aufsatz
   * anhaengt (web/public/anmeldung.js). Ein <a href> ginge ohne Token los
   * und bekaeme 401.
   */
  if (punkt.aktion === 'datenauskunft') {
    toast('Deine Daten werden zusammengestellt …');
    return (async () => {
      try {
        const r = await fetch('/api/meine-daten');
        if (!r.ok) return toast('Die Auskunft hat nicht geklappt');
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `all-media-daten-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        // Erst freigeben, wenn der Browser den Download begonnen hat.
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        toast('Auskunft heruntergeladen');
      } catch (fehler) {
        console.error('Datenauskunft fehlgeschlagen:', fehler);
        toast('Die Auskunft hat nicht geklappt');
      }
    })();
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
            <span class="avatar avatar--36" style="background:${farbe(u.color)}">${esc(u.initials)}</span>
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
              body: JSON.stringify(
                await sendeKoerper(chat.id, 'Komm zu All Media: all-media.app')
              ),
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
  /*
   * Ein einzelner Abschnitt als eigene Seite - das Ziel der Ueberschrift mit
   * Pfeil. Bis zum 24.09.2026 war "Konto →" usw. ein totes <div>; Henrik am
   * 21.09.: "Ueberall, wo eine Ueberschrift mit Pfeil steht, muss sie auf die
   * volle Uebersicht fuehren." Gleiche Seite in der App (nurAbschnitt in
   * SettingsScreen.tsx).
   */
  const nur = SETTINGS.find((sec) => sec.id === state.settingsNur) || null;
  if (state.settingsNur && !nur) state.settingsNur = null;
  /*
   * Bann-Verlauf und Sichtbarkeit nachladen. Beides steckt nicht im
   * bootstrap-Aufruf der Startseite — es wird nur hier gebraucht, und der
   * Start soll davon nicht langsamer werden.
   */
  if (!state.banne) {
    fetch('/api/banne')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        state.banne = d?.banne || [];
      })
      .catch((fehler) => console.error('Bann-Verlauf laden fehlgeschlagen:', fehler));
  }

  /*
   * Dasselbe fuer die Statistik hinter "Insights". Sie stand bis zum
   * 02.09.2026 fest im Code — 340 Follower und 1.284 Aufrufe bei jedem Konto.
   */
  /*
   * Einstellungen einmal je Sitzung holen; danach steht state.einstellungen.
   *
   * Die Abfrage auf `state.area` ist der Kern: bis zum 10.09.2026 hat die
   * spaete Antwort die Seite blind neu gezeichnet. Wer die Einstellungen
   * oeffnete und gleich weiter in den Messenger tippte, sah dort wieder die
   * Einstellungsseite — die untere Leiste stand auf Messenger, der Inhalt
   * nicht. Genau so, wie es Zeile 5836 fuer den Sichtbarkeits-Nachschlag
   * schon macht.
   */
  if (!state.einstellungen) {
    void einstellungenHolen().then(() => {
      if (state.area === 'settings') renderSettings();
    });
  }

  /*
   * Nachladen und danach neu zeichnen. Ohne das zweite `renderSettings()`
   * bliebe in der Liste „Wird geladen …" stehen, bis irgendetwas anderes
   * einen Neuaufbau ausloest — die Zahlen waeren da und trotzdem unsichtbar.
   */
  if (!state.statistik) {
    fetch('/api/statistik')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        state.statistik = d?.statistik || null;
        if (state.area === 'settings') renderSettings();
      })
      .catch((fehler) => console.error('Statistik laden fehlgeschlagen:', fehler));
  }

  if (!state.gelikt) {
    fetch('/api/gelikt')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        state.gelikt = Array.isArray(d) ? d : null;
        if (state.area === 'settings') renderSettings();
      })
      .catch((fehler) => console.error('Gelikte Beitraege laden fehlgeschlagen:', fehler));
  }

  if (!state.kommentiert) {
    fetch('/api/kommentiert')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        state.kommentiert = Array.isArray(d) ? d : null;
        if (state.area === 'settings') renderSettings();
      })
      .catch((fehler) => console.error('Eigene Kommentare laden fehlgeschlagen:', fehler));
  }

  const itemHtml = (it, sektionId) => {
    if (it.toggle) {
      const on = it.toggle === 'theme' ? state.theme === 'dark' : schalterAn(it.toggle);
      return `<div class="item">
        <span class="item__icon">${ICONS[it.icon]}</span>
        <span class="item__label">${esc(it.label)}</span>
        <button class="switch ${on ? 'is-on' : ''}" data-toggle="${it.toggle}" aria-label="${esc(it.label)}"><span class="switch__knob"></span></button>
      </div>`;
    }
    // Bei einer Auswahl steht rechts, was gerade gilt - sonst muesste man
    // jeden Punkt aufmachen, um den Stand zu sehen.
    const wert = it.wahl ? einstellung(it) : it.sichtbar ? sichtText(it.sichtbar) : '';
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
        nur
          ? `<div class="pagehead__row">
              <button class="iconbtn" id="settingsNurBack" aria-label="Zurück zu allen Einstellungen">${ICONS.back}</button>
              <h2 class="pagehead__title">${esc(nur.title)}</h2>
            </div>`
          : ''
      }
      ${
        // Nur wenn man aus einem Profil kam - wer die Einstellungen ueber die
        // untere Leiste oeffnet, hat kein "zurueck".
        !nur && state.settingsAus
          ? `<div class="pagehead__row">
              <button class="iconbtn" id="settingsBack" aria-label="Zurück zum Profil">${ICONS.back}</button>
              <h2 class="pagehead__title">Einstellungen</h2>
            </div>`
          : ''
      }
      ${(() => {
        if (nur) return '';
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
          <span class="avatar avatar--52" style="background:${farbe(aktiv.color)}">${esc(aktiv.initials)}</span>
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
      ${
        nur
          ? ''
          : `<div class="pills">
        ${SETTINGS.map((sec) => `<button class="pill" data-jump="${sec.id}">${esc(sec.title)}</button>`).join('')}
      </div>`
      }
    </div>
    <div class="scroll" id="settingsScroll">
      ${(nur ? [nur] : SETTINGS).map(
        (sec) => `${
          nur
            ? ''
            : `<button class="listhead listhead--knopf" id="sec-${sec.id}" data-settingsnur="${sec.id}" aria-label="${esc(sec.title)}, alle anzeigen">${esc(sec.title)} →</button>`
        }
          <div class="group">${sec.items.map((it) => itemHtml(it, sec.id)).join('')}</div>`
      ).join('')}
      ${nur ? '' : `<div class="group">
        <button class="item" data-setting="Über All Media">
          <span class="item__icon">${ICONS.info}</span>
          <span class="item__label">Über All Media</span>
          <span class="item__value">1.0.0</span>
        </button>
        <button class="item item--danger" data-setting="Abmelden">
          <span class="item__icon">${ICONS.logout}</span>
          <span class="item__label">Abmelden</span>
        </button>
      </div>`}
    </div>`;

  main.querySelectorAll('[data-settingsnur]').forEach((b) =>
    b.addEventListener('click', () => {
      state.settingsNur = b.dataset.settingsnur;
      renderSettings();
      $('#settingsScroll')?.scrollTo(0, 0);
    })
  );
  $('#settingsNurBack')?.addEventListener('click', () => {
    const abschnitt = state.settingsNur;
    state.settingsNur = null;
    renderSettings();
    document.getElementById('sec-' + abschnitt)?.scrollIntoView({ block: 'start' });
  });

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
        b.classList.toggle('is-on');
        /*
         * Zusaetzlich ins Konto. Der localStorage bleibt der Sofortwert fuer
         * den naechsten Seitenaufbau, aber mitwandern auf Telefon und zweites
         * Geraet kann das Design nur ueber user_settings. Der Wert ist
         * 'dark'/'light' und nicht 'an'/'aus', weil 'system' als dritte
         * Moeglichkeit vorgesehen ist (applyTheme).
         */
        void einstellungSetzen({ label: 'theme', wahlKey: 'theme' }, state.theme);
        return;
      }

      // 'an'/'aus' statt true/false: der Wert ist Text in der Datenbank, und
      // beide Seiten schreiben dasselbe.
      const neu = !schalterAn(key);
      b.classList.toggle('is-on', neu);
      void (async () => {
        const ok = await einstellungSetzen({ label: key, wahlKey: key }, neu ? 'an' : 'aus');
        if (!ok) b.classList.toggle('is-on', !neu);
      })();
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
      // "Über All Media" sagt jetzt, welcher Stand ausgeliefert wird. Bis
      // zum 11.09.2026 war die Frage "ist das wirklich live?" nur dadurch zu
      // beantworten, dass man eine gerade erst angelegte Datei abrief.
      void (async () => {
        try {
          const r = await fetch('/api/version');
          const v = await r.json();
          toast(`All Media ${v.version} — Stand ${v.commit}`);
        } catch {
          toast('All Media 1.0.0 — Stand nicht abrufbar');
        }
      })();
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
  if (!state.karte) state.karte = { aktiv: null, mapInstance: null, markers: {} };

  const percentToCoords = (x, y) => {
    const lat = 55.1 - ((y / 100) * (55.1 - 47.3));
    const lng = 5.9 + ((x / 100) * (15.0 - 5.9));
    return [lat, lng];
  };

  const stil = KARTEN_STILE.find((s) => s.key === state.karteStil) || KARTEN_STILE[0];
  const voll = state.karteVollbild;

  /*
   * Henrik, 07.09.2026: "„In deiner Nähe" soll nur Personen mit einsehbarem
   * Standort zeigen."
   *
   * Wer einsehbar ist, entscheidet die Datenbank (Regel „Pins lesen", Schema
   * 19) — was der Server liefert, ist bereits gefiltert. Zwei Eintraege kamen
   * trotzdem durch: der eigene Pin (er kommt als `me`) stand als Person in
   * der eigenen Naehe, und Nadeln ohne geladenes Profil standen namenlos da.
   * Gegenstueck in app/screens/messenger/FriendMapScreen.tsx.
   */
  const nadeln = (state.friends || []).filter((f) => f.id !== 'me' && state.users[f.id]);

  main.innerHTML = `
    <div class="scroll">
      <div id="map" class="map map--${stil.key}${voll ? ' map--voll' : ''}">
        <div id="mapFlaeche" class="map__flaeche"></div>
        <div class="map__ansicht">${stil.label}</div>
        <div class="map__werkzeuge">
          <button class="map__werkzeug" data-mapfull aria-label="${voll ? 'Vollbild verlassen' : 'Karte im Vollbild'}">${
            voll ? ICONS.einklappen : ICONS.ausklappen
          }</button>
          <button class="map__werkzeug${state.karteStilOffen ? ' is-an' : ''}" data-mapstil aria-label="Kartenansicht wählen, gerade ${stil.label}">${ICONS.ebenen}</button>
          ${/*
              Henrik, 07.09.2026: "Kartenstil-Button switcht direkt statt
              Auswahlfenster (Standard/Satellit/Gelände)." Wer von Standard
              auf Gelaende wollte, musste durch Satellit hindurch und sah
              dabei jedes Mal die Kacheln neu laden. Gegenstueck in
              app/components/KarteWeb.tsx.
            */ ''}
          ${
            state.karteStilOffen
              ? `<div class="map__stile">
                   ${KARTEN_STILE.map(
                     (s) => `<button class="map__stil${s.key === stil.key ? ' is-an' : ''}" data-stilwahl="${s.key}">
                       <span>${esc(s.label)}</span>
                       ${s.key === stil.key ? ICONS.check : ''}
                     </button>`
                   ).join('')}
                 </div>`
              : ''
          }
        </div>
      </div>

      ${/*
          Hier standen bis zum 03.09.2026 drei eigene Stufen — „Niemand /
          Alle Kontakte / Ausgewählte" — in `state.standort`, das nichts
          speicherte. Unter Einstellungen → Messenger → Standort-Sichtbarkeit
          standen zur selben Sache vier Stufen mit Ausnahmeliste, und die
          gingen in die Datenbank. Zwei Wahlen für dieselbe Frage, die
          voneinander nichts wussten.

          Jetzt ist es eine Einstellung, an zwei Orten bedienbar:
          `visibility_settings` mit Bereich `standort`.
        */ ''}
      ${voll ? '' : `
      <div class="standort">
        <div class="standort__kopf">
          <span class="standort__icon">${ICONS.mapPin}</span>
          <div class="standort__text">
            <div class="standort__titel">Deinen Standort teilen</div>
            <div class="standort__sub">${esc(standortText())}</div>
          </div>
          <label class="schalter">
            <input type="checkbox" id="standortAn" ${standortAn() ? 'checked' : ''} />
            <span></span>
          </label>
        </div>
        <button class="standort__stufe" id="standortStufe">
          <span class="standort__stufeLabel">Sichtbar für</span>
          <span class="standort__stufeWert">${esc(sichtText('standort'))}</span>
          <span class="row__chevron">${ICONS.chevron}</span>
        </button>
      </div>

      <div class="listhead">In deiner Nähe</div>
      ${
        nadeln.length
          ? ''
          : '<div class="sheet__hint">Gerade gibt niemand aus deinen Kontakten seinen Standort für dich frei.</div>'
      }
      <ul class="rows">
        ${nadeln
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

    /*
     * Dieselben Angaben wie in der App (app/components/KarteWeb.tsx): Zoomen
     * mit zwei Fingern soll der Bewegung folgen und nicht in ganze Stufen
     * einrasten. Ohne `zoomSnap: 0` springt die Karte waehrend der Geste.
     */
    const map = L.map(mapContainer, {
      zoomControl: false,
      touchZoom: true,
      bounceAtZoomLimits: false,
      zoomSnap: 0,
      zoomDelta: 0.6,
    }).setView(
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

    nadeln.forEach((f) => {
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
    // angezeigt." Die eigene Nadel haengt an der Sichtbarkeitsstufe: steht
    // sie auf "Niemand", ist die Nadel weg.
    if (standortAn()) {
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
    state.karteStilOffen = !state.karteStilOffen;
    renderFriendMap();
  });
  main.querySelectorAll('[data-stilwahl]').forEach((el) =>
    el.addEventListener('click', () => {
      const gewaehlt = KARTEN_STILE.find((s) => s.key === el.dataset.stilwahl);
      state.karteStil = gewaehlt.key;
      state.karteStilOffen = false;
      renderFriendMap();
    })
  );

  if (!voll) {
    /*
     * Der Schalter ist die schnelle Geste: aus heisst „Niemand", an holt die
     * weiteste Stufe zurueck. Er ist kein zweiter Speicher — sonst stuende
     * der Schalter auf „an" und die Stufe auf „Niemand", und beide haetten
     * recht.
     */
    /*
     * Henrik, 07.09.2026: "„Standort teilen" + alle „Sichtbar für"-Optionen
     * zeitverzögert/buggy."
     *
     * Der Weg war: speichern, den ganzen Sichtbarkeitsbestand neu holen, dann
     * die Seite neu zeichnen. Erst danach stimmte die Beschriftung unter dem
     * Schalter. Bis dahin — zwei Anfragen ueber das Netz — stand dort noch
     * der alte Text, und wer in der Zeit ein zweites Mal umlegte, sah beides
     * hin und her springen.
     *
     * Jetzt wird die Anzeige sofort auf den neuen Stand gesetzt und erst
     * danach gespeichert. Geht das Speichern schief, wird zurueckgenommen.
     */
    $('#standortAn').addEventListener('change', async (e) => {
      const an = e.target.checked;
      const vorher = sicht('standort');
      sichtSofort('standort', { stufe: an ? 'alle' : 'niemand' });
      toast(an ? 'Standort wird geteilt' : 'Standort ist aus');
      renderFriendMap();

      const r = await api('/api/sichtbarkeit/standort', { stufe: an ? 'alle' : 'niemand' });
      if (!r?.ok) {
        sichtSofort('standort', vorher);
        renderFriendMap();
        return toast(r?.error || 'Nicht gespeichert');
      }
      await sichtbarkeitNeuLaden();
      renderFriendMap();
    });

    // Dasselbe Blatt wie in den Einstellungen: vier Stufen plus Ausnahmen.
    $('#standortStufe')?.addEventListener('click', () =>
      openSichtbarkeit({ label: 'Standort sichtbar für', sichtbar: 'standort' })
    );
  }

  main.querySelectorAll('[data-zoom]').forEach((el) =>
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-friend-profil]')) return;
      const id = el.dataset.zoom;
      state.karte.aktiv = id;
      const f = nadeln.find((x) => x.id === id);
      if (f) {
        const [lat, lng] = percentToCoords(f.x, f.y);
        /*
         * Henrik, 07.09.2026: "Kontakt in „In deiner Nähe" antippen → soll
         * zur Karte hochscrollen + nah heranzoomen (Straßenebene)."
         *
         * Der Ausschnitt wird in `state` gesetzt und NICHT ueber
         * `mapInstance.setView`. Grund: gleich danach zeichnet
         * renderFriendMap() neu, baut die Karte ab und aus `state.karte.mitte`
         * wieder auf. Ein setView mit `animate: true` meldet seinen neuen
         * Stand erst beim `moveend` — also nach dem Neuaufbau. Der frisch
         * gesetzte Ausschnitt wurde damit jedes Mal vom alten ueberschrieben,
         * und der Sprung zum Kontakt passierte sichtbar gar nicht.
         *
         * Zoomstufe 16 statt 10: bei 10 sieht man das halbe Bundesland.
         */
        state.karte.mitte = [lat, lng];
        state.karte.zoom = 16;
      }
      renderFriendMap();
      const blatt = main.querySelector('.scroll');
      if (blatt) blatt.scrollTo({ top: 0, behavior: 'smooth' });
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

/* ==========================================================================
 * Insight Time — Handbuch-Abgleich 01.09.2026
 *
 * Ein *Insight* ist ein Foto oder Video, das an ausgewählte Personen geht —
 * das Snapchat-Äquivalent aus dem Handbuch. Die *Insight Time* zählt die
 * Tage in Folge, an denen sich beide Seiten gegenseitig einen geschickt
 * haben, und steht als Kamera-Emoji plus Zahl hinter dem Namen.
 *
 * Nicht zu verwechseln mit den „Insights" im Einstellungsmenü: das ist
 * Statistik zum eigenen Profil. Die Verwechslung ist der Grund, warum diese
 * Funktion so lange fehlte — das Wort stand im Code, aber in der anderen
 * Bedeutung.
 *
 * Die Gegenstücke in der App: app/components/InsightSheet.tsx und
 * app/screens/messenger/InsightViewerScreen.tsx.
 * ========================================================================== */

/** Die Insight Time zu einer Person, fertig für die Anzeige. */
function insightMarke(userId) {
  const st = state.insightStreaks?.[userId];
  if (!st || !st.tage) return '';
  // Blass, solange der Tag noch nicht vollständig ist: eine Kette, bei der
  // heute erst einer gesendet hat, reißt um Mitternacht. Sähe sie aus wie
  // eine sichere, wäre die Anzeige eine Falschaussage mit Folgen.
  const voll = st.heuteGesendet && st.heuteEmpfangen;
  return `<span class="streak${voll ? '' : ' streak--offen'}">📷 ${st.tage}</span>`;
}

/** Offene, noch nicht angesehene Insights dieser Person. */
function offeneInsights(userId) {
  return (state.insights || []).filter((i) => i.senderId === userId && !i.gesehen);
}

/**
 * Einen Insight verschicken.
 *
 * Die feste Empfängerliste ist beim Öffnen angehakt — das Handbuch nennt sie
 * ausdrücklich und daneben die Möglichkeit, manuell auszuwählen. Ohne die
 * Vorauswahl müsste man vor jedem Insight dieselben acht Namen neu antippen
 * und schickt ihn dann irgendwann gar nicht mehr.
 */
function openInsightSenden(bild) {
  const gewaehlt = new Set(state.insightZiele || []);

  // Wer eine laufende Insight Time hat, steht oben. Eine Kette, die heute
  // noch nicht bedient wurde, reißt um Mitternacht — die Person dafür in
  // einer alphabetischen Liste zu suchen wäre genau verkehrt herum.
  const personen = (state.contacts || [])
    .filter((k) => state.users[k.id])
    .map((k) => ({ id: k.id, name: state.users[k.id].name, tage: state.insightStreaks?.[k.id]?.tage || 0 }))
    .sort((a, b) => (b.tage - a.tage) || a.name.localeCompare(b.name));

  const schicht = filterSchicht(state.kameraFilter);

  const pillen = (name, punkte, aktiv) =>
    punkte
      .map(
        (p) =>
          `<button class="pille${p.wert === aktiv ? ' is-active' : ''}" data-${name}="${p.wert}">${esc(p.text)}</button>`
      )
      .join('');

  openSheet(
    'Insight senden',
    `<div class="sheet__body insight-senden">
       <div class="insight__vorschau" style="background-image:${schicht ? schicht + ', url(' + bild + ')' : 'url(' + bild + ')'}"></div>

       <p class="insight__titel">Wie lange sichtbar</p>
       <div class="pillen" id="insDauer">
         ${pillen('dauer', [{ wert: 3, text: '3 s' }, { wert: 5, text: '5 s' }, { wert: 10, text: '10 s' }, { wert: 0, text: 'Unbegrenzt' }], 5)}
       </div>

       <p class="insight__titel">Ansicht</p>
       <div class="pillen" id="insEinmal">
         ${pillen('einmal', [{ wert: 1, text: 'Einmalansicht' }, { wert: 0, text: 'Mehrfach ansehbar' }], 1)}
       </div>
       <p class="insight__hinweis" id="insHinweis">Nach dem Öffnen ist er weg — auch bei dir in der Übersicht.</p>

       <p class="insight__titel">Selbstlöschend</p>
       <div class="pillen" id="insLoeschen">
         ${pillen('loeschen', [{ wert: 0, text: 'Nie' }, { wert: 24, text: 'Nach 24 h' }, { wert: 168, text: 'Nach 7 Tagen' }], 24)}
       </div>

       <label class="insight__behalten"><input type="checkbox" id="insBehalten"> Bei mir behalten</label>

       <p class="insight__titel">An wen</p>
       ${
         personen.length
           ? personen
               .map(
                 (p) => `<button class="insight__person${gewaehlt.has(p.id) ? ' is-active' : ''}" data-person="${p.id}">
                   ${avatarForUser(p.id, 38)}
                   <span class="insight__personText">
                     <span class="insight__personName">${esc(p.name)}</span>
                     ${p.tage ? `<span class="streak">📷 ${p.tage}</span>` : ''}
                   </span>
                   <span class="insight__haken">${ICONS.check}</span>
                 </button>`
               )
               .join('')
           : '<p class="insight__hinweis">Du hast noch keine Kontakte. Insights gehen nur an Personen, die du gespeichert hast.</p>'
       }

       <button class="btn btn--breit" id="insSenden" disabled>Wähle mindestens eine Person</button>
     </div>`,
    (sheet, close) => {
      let dauer = 5;
      let einmal = 1;
      let loeschen = 24;

      const knopf = sheet.querySelector('#insSenden');
      const stand = () => {
        knopf.disabled = gewaehlt.size === 0;
        knopf.textContent = gewaehlt.size
          ? `An ${gewaehlt.size} ${gewaehlt.size === 1 ? 'Person' : 'Personen'} senden`
          : 'Wähle mindestens eine Person';
      };
      stand();

      const gruppe = (id, setzen) =>
        sheet.querySelectorAll(`#${id} .pille`).forEach((b) =>
          b.addEventListener('click', () => {
            sheet.querySelectorAll(`#${id} .pille`).forEach((x) => x.classList.toggle('is-active', x === b));
            setzen(Number(b.dataset.dauer ?? b.dataset.einmal ?? b.dataset.loeschen));
          })
        );

      gruppe('insDauer', (w) => (dauer = w));
      gruppe('insEinmal', (w) => {
        einmal = w;
        sheet.querySelector('#insHinweis').textContent = w
          ? 'Nach dem Öffnen ist er weg — auch bei dir in der Übersicht.'
          : 'Bleibt offen, bis er sich selbst löscht.';
      });
      gruppe('insLoeschen', (w) => (loeschen = w));

      sheet.querySelectorAll('[data-person]').forEach((b) =>
        b.addEventListener('click', () => {
          const id = b.dataset.person;
          if (gewaehlt.has(id)) gewaehlt.delete(id);
          else gewaehlt.add(id);
          b.classList.toggle('is-active', gewaehlt.has(id));
          stand();
        })
      );

      knopf.addEventListener('click', async () => {
        knopf.disabled = true;
        knopf.textContent = 'Wird gesendet …';

        const antwort = await api('/api/insights', {
          empfaenger: [...gewaehlt],
          mediaUrl: bild,
          mediaTyp: 'image',
          filter: state.kameraFilter,
          dauer,
          einmal: Boolean(einmal),
          loeschtNachStunden: loeschen || undefined,
          gespeichert: sheet.querySelector('#insBehalten').checked,
        });

        if (!antwort?.ok) {
          knopf.disabled = false;
          stand();
          return toast(antwort?.error || 'Der Insight ging nicht raus');
        }

        close();

        /*
         * Die Rückmeldung nennt die neue Insight Time. Ohne sie bliebe
         * unklar, ob der Tag gezählt hat — und genau darum geht es bei dieser
         * Gattung. Steht die Kette noch offen, weil die Gegenseite heute
         * nichts geschickt hat, sagt die Meldung das ebenfalls.
         */
        const gezaehlt = Object.entries(antwort.streaks || {}).filter(([, t]) => t > 0);
        if (gezaehlt.length === 1) {
          const [id, tage] = gezaehlt[0];
          toast(`Insight gesendet — 📷 ${tage} mit ${state.users[id]?.name || 'dieser Person'}`);
        } else if (gezaehlt.length > 1) {
          toast(`Insight an ${gewaehlt.size} gesendet — ${gezaehlt.length} Ketten laufen`);
        } else {
          toast('Insight gesendet — die Kette zählt, sobald zurückgeschickt wird');
        }

        await insightsNeuLaden();
        render();
      });
    },
    { hoch: true, schliessen: true }
  );
}

/** Insights, Ketten und Empfängerliste frisch holen. */
async function insightsNeuLaden() {
  try {
    const res = await fetch('/api/insights');
    if (!res.ok) return;
    const daten = await res.json();
    state.insights = daten.insights || [];
    state.insightStreaks = daten.streaks || {};
    state.insightZiele = daten.ziele || [];
  } catch (fehler) {
    console.error('Insights laden fehlgeschlagen:', fehler);
  }
}

/**
 * Die offenen Insights einer Person ansehen.
 *
 * „Gesehen" wird beim Öffnen vermerkt, nicht beim Schließen. Bei
 * Einmalansicht ist das der Unterschied zwischen „einmal" und „mindestens
 * einmal": wer den Tab schließt, während der Insight offen steht, bekäme ihn
 * sonst beim nächsten Laden noch einmal — und die Zusage wäre gebrochen.
 */
function openInsightAnsehen(userId) {
  const offene = offeneInsights(userId).slice().reverse();
  if (!offene.length) return toast('Dieser Insight ist nicht mehr da');

  let nummer = 0;
  let uhr = null;

  const flaeche = document.createElement('div');
  flaeche.className = 'insight-viewer';
  document.querySelector('.app').appendChild(flaeche);

  const zumachen = async () => {
    if (uhr) clearTimeout(uhr);
    flaeche.remove();
    await insightsNeuLaden();
    render();
  };

  const zeichnen = () => {
    const i = offene[nummer];
    if (!i) return zumachen();

    const schicht = filterSchicht(i.filter);
    const st = state.insightStreaks?.[userId];

    flaeche.innerHTML = `
      <div class="insight-viewer__balken">
        ${offene
          .map(
            (_, n) =>
              `<span class="insight-viewer__spur"><span class="insight-viewer__fuell${
                n < nummer ? ' is-voll' : n === nummer ? ' is-laeuft' : ''
              }" style="${n === nummer && i.dauer ? `animation-duration:${i.dauer}s` : ''}"></span></span>`
          )
          .join('')}
      </div>
      <div class="insight-viewer__kopf">
        <span>
          <strong>${esc(state.users[userId]?.name || 'Unbekannt')}</strong>
          <small>${esc(i.zeit)}${st?.tage ? `  ·  📷 ${st.tage}` : ''}</small>
        </span>
        <button id="insZu" aria-label="Schließen">${ICONS.close}</button>
      </div>
      <div class="insight-viewer__bild" style="background-image:${
        schicht ? schicht + ', url(' + i.mediaUrl + ')' : 'url(' + i.mediaUrl + ')'
      }"></div>
      <div class="insight-viewer__fuss">
        <span class="insight-viewer__marke">
          ${i.einmal ? 'Einmalansicht' : 'Mehrfach ansehbar'}${i.dauer ? `  ·  ${i.dauer} s` : '  ·  unbegrenzt'}
        </span>
      </div>`;

    flaeche.querySelector('#insZu').addEventListener('click', zumachen);
    flaeche.querySelector('.insight-viewer__bild').addEventListener('click', weiter);

    // Beim Öffnen vermerken, nicht beim Weiterblättern.
    api(`/api/insights/${i.id}/gesehen`, {});

    if (uhr) clearTimeout(uhr);
    if (i.dauer) uhr = setTimeout(weiter, i.dauer * 1000);
  };

  const weiter = () => {
    nummer += 1;
    if (nummer >= offene.length) return zumachen();
    zeichnen();
  };

  zeichnen();
}

/*
 * Die Kamera der Website.
 *
 * Bis zum 09.09.2026 war das eine Attrappe: die Buehne zeigte ein graues
 * Kamerasymbol, Blitz und Kameraseite warfen nur eine Meldung, und der
 * Ausloeser oeffnete die Dateiauswahl des Betriebssystems.
 *
 * Henrik am 07.09.2026: „Alle Buttons brauchen eine echte, synchrone
 * Aktion" und „Foto/Video-Aufnahme in der App selbst". Jetzt laeuft hier
 * ein echter Kamerastrom (`getUserMedia`), der Ausloeser schneidet das Bild
 * aus dem laufenden Strom (Foto) bzw. nimmt ueber den `MediaRecorder` auf
 * (Video), der Wechselknopf stellt auf die andere Kameraseite um, und der
 * Blitz schaltet die Leuchte, wo das Geraet sie hergibt.
 *
 * Dieselbe Bedienung wie in app/screens/messenger/CameraScreen.tsx.
 */

/** Der laufende Kamerastrom - genau einer, oder keiner. */
let kameraStrom = null;

/** Strom und Aufnahme beenden. Wird bei jedem render() gerufen. */
function kameraStromStoppen() {
  if (!kameraStrom) return;
  try {
    kameraStrom.getTracks().forEach((spur) => spur.stop());
  } catch {
    /* Der Strom war schon zu. */
  }
  kameraStrom = null;
}

/** Das Markup der Buehne - in beiden Kameras gleich. */
function kameraBuehne() {
  return `<div class="camera__stage" id="camStage">
      <video id="camVideo" class="camera__video" playsinline muted autoplay></video>
      <span class="camera__filterschicht" id="camFilterSchicht"></span>
      <span class="camera__sucher"><span></span><span></span><span></span><span></span></span>
      <span class="camera__rec" id="camRec" hidden><i></i>Aufnahme läuft</span>
    </div>`;
}

/**
 * Die Bedienung der Kamera: Strom oeffnen, Blitz, Seitenwechsel, Foto- und
 * Videoaufnahme. Steht einmal hier, weil es die Kamera zweimal gibt - als
 * eigene Seite und als Overlay ueber einem Chat.
 *
 * `wurzel` ist der Kasten mit dem Markup, `fertig(bild)` bekommt die
 * Aufnahme als Datenadresse.
 */
function kameraLaufwerk(wurzel, fertig) {
  const q = (auswahl) => wurzel.querySelector(auswahl);
  const video = q('#camVideo');
  const buehne = q('#camStage');
  let mode = 'photo';
  let recording = false;
  let seite = 'environment';
  let blitz = false;
  let aufnehmer = null;
  let stuecke = [];

  /** Kamerastrom oeffnen - je nach gewaehlter Seite und Betriebsart. */
  const stromOeffnen = async () => {
    kameraStromStoppen();
    try {
      kameraStrom = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: seite },
        // Ton nur beim Video: sonst fragt der Browser beim Fotografieren
        // nach dem Mikrofon, und das erklaert niemandem etwas.
        audio: mode === 'video',
      });
    } catch (fehler) {
      console.error('Kamera:', fehler.message);
      buehne.classList.add('camera__stage--leer');
      if (!q('.camera__hinweis')) {
        buehne.insertAdjacentHTML(
          'beforeend',
          `${ICONS.camera}<p class="camera__hinweis">Ohne Kamerazugriff geht die Aufnahme nicht</p>`
        );
      }
      return false;
    }
    buehne.classList.remove('camera__stage--leer');
    video.srcObject = kameraStrom;
    // Die Frontkamera wird gespiegelt gezeigt - man sieht sich sonst
    // seitenverkehrt und greift in die falsche Richtung.
    video.classList.toggle('camera__video--gespiegelt', seite === 'user');
    await video.play().catch(() => {});
    return true;
  };
  void stromOeffnen();

  /*
   * Der Blitz. Am Rechner gibt es keinen; am Handy ist es die Leuchte der
   * Rueckkamera, die ueber `torch` dauerhaft angeht. Kann das Geraet das
   * nicht, sagt die Meldung das - statt so zu tun, als waere geschaltet.
   */
  q('#camFlash').addEventListener('click', async () => {
    const spur = kameraStrom && kameraStrom.getVideoTracks()[0];
    const kann = spur && spur.getCapabilities && spur.getCapabilities().torch;
    if (!kann) return toast('Dieses Gerät hat kein schaltbares Licht');
    blitz = !blitz;
    try {
      await spur.applyConstraints({ advanced: [{ torch: blitz }] });
      q('#camFlash').classList.toggle('is-active', blitz);
      toast(blitz ? 'Licht an' : 'Licht aus');
    } catch {
      toast('Das Licht ließ sich nicht schalten');
    }
  });

  q('#camSwitch').addEventListener('click', async () => {
    if (recording) return toast('Erst die Aufnahme beenden');
    seite = seite === 'environment' ? 'user' : 'environment';
    blitz = false;
    q('#camFlash').classList.remove('is-active');
    if (await stromOeffnen()) toast(seite === 'user' ? 'Frontkamera' : 'Rückkamera');
  });

  wurzel.querySelectorAll('.camera__mode').forEach((b) =>
    b.addEventListener('click', async () => {
      if (recording) return toast('Erst die Aufnahme beenden');
      mode = b.dataset.mode;
      wurzel
        .querySelectorAll('.camera__mode')
        .forEach((x) => x.classList.toggle('is-active', x === b));
      // Der Ton kommt erst mit der Betriebsart Video dazu, also muss der
      // Strom dafuer neu geoeffnet werden.
      await stromOeffnen();
    })
  );

  /** Das laufende Bild als Datenadresse. */
  const standbild = () => {
    const flaeche = document.createElement('canvas');
    flaeche.width = video.videoWidth || 720;
    flaeche.height = video.videoHeight || 1280;
    const stift = flaeche.getContext('2d');
    if (seite === 'user') {
      // Gespiegelt gezeigt, gespiegelt gespeichert - sonst steht auf dem
      // Bild eine andere Welt als im Sucher.
      stift.translate(flaeche.width, 0);
      stift.scale(-1, 1);
    }
    stift.drawImage(video, 0, 0, flaeche.width, flaeche.height);
    return flaeche.toDataURL('image/jpeg', 0.82);
  };

  q('#camShutter').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (!kameraStrom) return toast('Ohne Kamerazugriff geht die Aufnahme nicht');

    if (mode === 'photo') return fertig(standbild());

    if (recording) {
      recording = false;
      btn.classList.remove('is-rec');
      q('#camRec').hidden = true;
      if (aufnehmer) aufnehmer.stop();
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      return toast('Dieser Browser kann keine Videos aufnehmen');
    }
    stuecke = [];
    try {
      aufnehmer = new MediaRecorder(kameraStrom);
    } catch {
      return toast('Die Videoaufnahme ließ sich nicht starten');
    }
    aufnehmer.ondataavailable = (ereignis) => {
      if (ereignis.data && ereignis.data.size) stuecke.push(ereignis.data);
    };
    aufnehmer.onstop = async () => {
      const datei = new Blob(stuecke, { type: aufnehmer.mimeType || 'video/webm' });
      // Weiterverarbeitet wird - wie bei einer Videodatei aus der Galerie -
      // das erste Standbild. Bewegt gespeichert wird spaeter beim Hochladen.
      const bild = await videoStandbild(datei).catch(() => null);
      if (!bild) return toast('Aus dieser Aufnahme ließ sich kein Bild gewinnen');
      fertig(bild);
    };
    aufnehmer.start();
    recording = true;
    btn.classList.add('is-rec');
    q('#camRec').hidden = false;
  });
}

function renderCameraPage() {
  /*
   * Der Filterschalter aus dem Figma-Entwurf.
   *
   * Henrik am 07.09.2026: oben ein Umschalter „ohne Filter / mit Filter",
   * die Filterleiste erst darunter und nur dann, wenn gefiltert wird.
   * Vorher stand die Leiste immer da - auch mit „keiner" ganz links, was
   * dieselbe Aussage doppelt traf.
   */
  const mitFilter = () => state.kameraFilter && state.kameraFilter !== 'keiner';

  main.innerHTML = `
    <div class="camera camera--page">
      <div class="camera__top">
        <span></span>
        <button id="camFlash" aria-label="Blitz">${ICONS.flash}</button>
      </div>
      ${kameraBuehne()}
      <div class="camera__schalter" id="camSchalter">
        <button data-mitfilter="0" class="${mitFilter() ? '' : 'is-active'}">Ohne Filter</button>
        <button data-mitfilter="1" class="${mitFilter() ? 'is-active' : ''}">Mit Filter</button>
      </div>
      <div class="camera__filter" id="camFilter"${mitFilter() ? '' : ' hidden'}>
        ${FILTER.filter((f) => f.key !== 'keiner')
          .map(
            (f) =>
              `<button class="camera__filterpille${
                f.key === state.kameraFilter ? ' is-active' : ''
              }" data-filter="${f.key}">${esc(f.label)}</button>`
          )
          .join('')}
      </div>
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

  /* Die Farbschicht liegt ueber dem Bild, nicht dahinter: seit hier ein
     echtes Kamerabild laeuft, waere ein Hintergrund der Buehne verdeckt. */
  const filterLegen = () => {
    const schicht = $('#camFilterSchicht');
    if (schicht) schicht.style.backgroundImage = mitFilter() ? filterSchicht(state.kameraFilter) : '';
  };
  filterLegen();

  kameraLaufwerk(main.querySelector('.camera'), (bild) => aufnahmeMenue(bild));

  $('#camSchalter')
    .querySelectorAll('[data-mitfilter]')
    .forEach((b) =>
      b.addEventListener('click', () => {
        const an = b.dataset.mitfilter === '1';
        const erste = FILTER.find((f) => f.key !== 'keiner');
        state.kameraFilter = an ? (mitFilter() ? state.kameraFilter : erste && erste.key) : 'keiner';
        $('#camSchalter')
          .querySelectorAll('[data-mitfilter]')
          .forEach((x) => x.classList.toggle('is-active', x === b));
        $('#camFilter').hidden = !an;
        main
          .querySelectorAll('[data-filter]')
          .forEach((x) => x.classList.toggle('is-active', x.dataset.filter === state.kameraFilter));
        filterLegen();
      })
    );

  /*
   * Die Filterwahl. Sie liegt im Zustand und nicht in einer Variablen dieser
   * Funktion: die Kamera wird bei jedem Wechsel neu gezeichnet, und der eben
   * gewählte Filter soll dabei stehen bleiben.
   */
  main.querySelectorAll('[data-filter]').forEach((b) =>
    b.addEventListener('click', () => {
      state.kameraFilter = b.dataset.filter;
      main
        .querySelectorAll('[data-filter]')
        .forEach((x) => x.classList.toggle('is-active', x === b));
      filterLegen();
    })
  );

  // Punkt 18: das Bildsymbol geht in die Galerie, nicht noch einmal in die
  // Kamera - dafuer ist der Ausloeser in der Mitte da.
  $('#camGallery').addEventListener('click', () => aufnahmeVerwenden('photo', true));
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
/*
 * Wer war auf diesem Geraet schon einmal angemeldet?
 *
 * Henrik am 07.09.2026: "Fruehere Accounts sollen beim Kontowechsel als
 * Ein-Klick-Option erscheinen (wie Instagram)." Bisher zeigte die Liste nur
 * die eine laufende Sitzung — war man abgemeldet, war sie leer und man musste
 * E-Mail *und* Passwort neu tippen. Gespeichert wird bewusst kein Passwort
 * und kein Token, nur Kennung, Name und E-Mail: genug fuer die Zeile und um
 * die E-Mail vorzubelegen. Dieselbe Liste fuehrt die App in
 * app/contexts/AuthContext.tsx unter demselben Schluessel.
 */
const FRUEHER_KEY = 'all-media.fruehereKonten.v1';

function fruehereKonten() {
  try {
    const liste = JSON.parse(localStorage.getItem(FRUEHER_KEY) || '[]');
    return Array.isArray(liste) ? liste : [];
  } catch {
    return [];
  }
}

function fruehereMerken(nutzer) {
  if (!nutzer?.id || !nutzer.email) return;
  const eintrag = { id: nutzer.id, email: nutzer.email, name: nutzer.name || nutzer.handle || nutzer.email };
  const neu = [eintrag, ...fruehereKonten().filter((k) => k.id !== eintrag.id)].slice(0, 8);
  try {
    localStorage.setItem(FRUEHER_KEY, JSON.stringify(neu));
  } catch {
    /* Privater Modus ohne Speicher — dann gibt es die Bequemlichkeit eben nicht. */
  }
}

/** Zwei Buchstaben fuer den Kreis links — wie beim Avatar der Kontoliste. */
function fruehereInitialen(name) {
  return (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase();
}

function fruehereVergessen(id) {
  try {
    localStorage.setItem(FRUEHER_KEY, JSON.stringify(fruehereKonten().filter((k) => k.id !== id)));
  } catch {
    /* siehe oben */
  }
}

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
    // Pflicht beim Anlegen (Henrik 7.9.) — siehe formularNeuMail().
    telefon: '',
    // Pflicht seit 22.09.2026 (Schema 52) — siehe formularNeuMail().
    geburtsdatum: '',
    eltern: '',
    // Was handle_frei zuletzt über den Wunschnamen gesagt hat.
    namensStand: { text: '', gut: true },
    kennung: '',
    hinweis: '',
    hinweisArt: '',
  };

  /* Nur die, die nicht ohnehin schon oben in der Kontoliste stehen. */
  const offeneFrueher = () =>
    fruehereKonten().filter((f) => !state.konten.some((k) => k.email && k.email === f.email));

  const liste = () => `
    <div class="sheet__body">
      ${offeneFrueher().length ? '<div class="sheet__gruppe">zuletzt verwendet</div>' : ''}
      ${state.konten
        .map(
          (k) => `<div class="row" data-konto="${k.id}">
            <span class="avatar avatar--44" style="background:${farbe(k.color)}">${esc(k.initials)}</span>
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

      ${offeneFrueher()
        .map(
          (k) => `<div class="row" data-frueher="${esc(k.email)}" data-frueher-id="${esc(k.id)}">
            <span class="avatar avatar--44" style="background:${farbe(k.id)}">${esc(fruehereInitialen(k.name))}</span>
            <div class="row__body">
              <div class="row__name">${esc(k.name)}</div>
              <div class="row__sub">${esc(k.email)}</div>
            </div>
            <button class="iconbtn" data-frueher-weg="${esc(k.id)}" aria-label="Aus der Liste nehmen">${ICONS.close}</button>
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

  /*
   * Anmelden.
   *
   * Hier stand "Benutzername, E-Mail oder Telefonnummer". Seit der
   * Sicherheitspruefung (Fund 2, siehe anmeldung.js) geht nur noch die
   * E-Mail-Adresse: der Weg ueber den Benutzernamen lief ueber eine Funktion,
   * die jedem die hinterlegte Adresse herausgab. Beschriftung und Platzhalter
   * sagen das jetzt, statt etwas anzubieten, das nicht funktioniert.
   */
  const formularAnmelden = () => `
    <div class="sheet__field">
      <label class="sheet__label" for="kontoKennung">E-Mail-Adresse</label>
      <input id="kontoKennung" placeholder="name@beispiel.de" value="${esc(zustand.kennung)}"
             type="email" autocapitalize="off" autocomplete="username" />
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
      <!-- „schon vergeben" beim Tippen (Henrik 22.09.2026), siehe namenPruefen(). -->
      <div class="sheet__fussnote ${zustand.namensStand.text && !zustand.namensStand.gut ? 'is-fehler' : ''}"
           id="kontoBenutzerStand" aria-live="polite">${esc(
             zustand.namensStand.text || window.Benutzername.REGEL_TEXT + '.'
           )}</div>
    </div>
    <div class="sheet__field">
      <label class="sheet__label" for="kontoPass">Passwort</label>
      <input id="kontoPass" type="password" placeholder="${esc(PASSWORT_REGEL)}" value="${esc(zustand.passwort)}"
             autocomplete="new-password" />
      <div class="sheet__fussnote">${esc(PASSWORT_REGEL)}.</div>
    </div>
    ${hinweis()}
    <div class="sheet__footer">
      <button class="prof__btn is-primary" id="kontoOk">weiter</button>
    </div>`;

  /* Neues Profil, Schritt 2: E-Mail und Telefonnummer. */
  const formularNeuMail = () => `
    <div class="sheet__erklaerung">
      Dein Benutzername ist <strong>@${esc(zustand.benutzername.replace(/^@+/, ''))}</strong>.
      Die E-Mail brauchen wir, um dein Konto zu bestätigen und dir bei einem
      vergessenen Passwort zu helfen. Über die Telefonnummer finden dich deine
      Kontakte.
    </div>
    <div class="sheet__field">
      <label class="sheet__label" for="kontoMail">E-Mail</label>
      <input id="kontoMail" type="email" placeholder="name@beispiel.de" value="${esc(zustand.email)}"
             autocapitalize="off" autocomplete="email" />
    </div>
    <!-- Pflichtfeld (Henrik 7.9.). Gleiches Feld in app/screens/LoginScreen.tsx. -->
    <div class="sheet__field">
      <label class="sheet__label" for="kontoTelefon">Telefonnummer</label>
      <input id="kontoTelefon" type="tel" placeholder="+49 151 2345678" value="${esc(zustand.telefon)}"
             autocapitalize="off" autocomplete="tel" />
      <div class="sheet__fussnote">${esc(window.Telefon.REGEL_TEXT)}.</div>
    </div>
    <!-- Pflichtfeld (Henrik 22.09.2026): die Altersgrenze hängt am Land der
         Nummer. Gleiche Felder in app/components/RegistrierFelder.tsx. -->
    <div class="sheet__field">
      <label class="sheet__label" for="kontoGeburt">Geburtsdatum</label>
      <input id="kontoGeburt" type="date" value="${esc(zustand.geburtsdatum)}"
             max="${new Date().toISOString().slice(0, 10)}" autocomplete="bday" />
      <div class="sheet__fussnote" id="kontoAlterHinweis" aria-live="polite"></div>
    </div>
    <div class="sheet__field" id="kontoElternFeld" hidden>
      <label class="sheet__label" for="kontoEltern">Benutzername deines Elternteils</label>
      <input id="kontoEltern" placeholder="@elternteil" value="${esc(zustand.eltern)}" autocapitalize="off" />
      <div class="sheet__fussnote">Bis dein Elternteil zustimmt, bleibt dein Konto gesperrt.</div>
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
      const t = sheet.querySelector('#kontoTelefon');
      const g = sheet.querySelector('#kontoGeburt');
      const e = sheet.querySelector('#kontoEltern');
      if (g) zustand.geburtsdatum = g.value;
      if (e) zustand.eltern = e.value;
      if (k) zustand.kennung = k.value;
      if (b) zustand.benutzername = b.value;
      if (m) zustand.email = m.value;
      if (p) zustand.passwort = p.value;
      if (t) zustand.telefon = t.value;
    };

    const anmeldenAbsenden = async () => {
      merken();
      const kennung = zustand.kennung.trim();
      if (!kennung) return meldung('Bitte E-Mail-Adresse eingeben.');
      if (!zustand.passwort) return meldung('Bitte Passwort eingeben.');

      if (!window.Anmeldung) return meldung('Die Anmeldung ist gerade nicht erreichbar.');

      const fertig = arbeitet('wird angemeldet…');
      const ergebnis = await window.Anmeldung.anmelden(kennung, zustand.passwort);
      fertig();

      if (!ergebnis.ok) return meldung(ergebnis.fehler);

      fruehereMerken(ergebnis.nutzer);
      close();
      toast(`Angemeldet als ${ergebnis.nutzer?.handle || kennung}`);
      return bootstrap();
    };

    /* Schritt 1: Benutzername pruefen, dann weiter zur E-Mail. */
    const neuWeiter = async () => {
      merken();
      const name = zustand.benutzername.trim();
      if (!name) return meldung('Bitte einen Benutzernamen eingeben.');
      // Die Regel steht in gemeinsam/passwort.js — dieselbe, die Supabase
      // durchsetzt und die die App anzeigt. Sechs Zeichen durchzulassen hiess
      // bisher, den englischen Fehler von Supabase weiterzureichen.
      const zuSchwach = passwortPruefen(zustand.passwort);
      if (zuSchwach) return meldung(zuSchwach + '.');

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

      // Die Nummer ist Pflicht — die Form prüft gemeinsam/telefon.js, die
      // Doppelvergabe die Datenbank in registrieren().
      const grundTelefon = window.Telefon.pruefe(zustand.telefon);
      if (grundTelefon) return meldung(grundTelefon + '.');

      const fertig = arbeitet('Konto wird erstellt…');
      const ergebnis = await window.Anmeldung.registrieren({
        benutzername: zustand.benutzername,
        passwort: zustand.passwort,
        email,
        telefon: zustand.telefon,
        geburtsdatum: zustand.geburtsdatum,
        eltern: zustand.eltern,
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

      fruehereMerken(ergebnis.nutzer);
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

    /*
     * Ist der Wunschname frei? Schon beim Tippen (Henrik 22.09.2026: „du musst
     * aber anzeigen, falls dieser User Name schon vergeben ist"). Erst die
     * Form, dann eine halbe Sekunde Ruhe, dann die Datenbank — handle_frei
     * zählt höchstens dreißig Fragen je Stunde (Schema 39). Gleiche Regel in
     * app/lib/registrierung.ts (useNamensStand).
     */
    let namensUhr = null;
    const namenPruefen = (feld) => {
      const zeile = sheet.querySelector('#kontoBenutzerStand');
      const setzen = (text, gut) => {
        zustand.namensStand = { text, gut };
        if (!zeile) return;
        zeile.textContent = text || window.Benutzername.REGEL_TEXT + '.';
        zeile.classList.toggle('is-fehler', Boolean(text) && !gut);
      };
      clearTimeout(namensUhr);
      const name = window.Benutzername.normal(feld.value);
      if (!name) return setzen('', true);
      const form = window.Benutzername.pruefe(name);
      if (form) return setzen(form, false);
      setzen('Wird geprüft …', true);
      namensUhr = setTimeout(async () => {
        const antwort = await window.Anmeldung?.benutzernameFrei(name);
        // Inzwischen weitergetippt: die Antwort gehört zu einem alten Namen.
        if (window.Benutzername.normal(feld.value) !== name) return;
        if (antwort?.frei) setzen(`${antwort.handle} ist frei`, true);
        else setzen(antwort?.meldung || 'Dieser Benutzername ist schon vergeben.', false);
      }, 500);
    };

    /* Unter dem Datum: was es für das Land der Nummer heißt. */
    const alterZeigen = () => {
      const datum = sheet.querySelector('#kontoGeburt')?.value || '';
      const telefon = sheet.querySelector('#kontoTelefon')?.value || '';
      const zeile = sheet.querySelector('#kontoAlterHinweis');
      const eltern = sheet.querySelector('#kontoElternFeld');
      if (!zeile || !eltern) return;
      const e = datum && !window.Alter.pruefe(datum) ? window.Alter.einordnen(datum, telefon) : null;
      zeile.textContent = e ? window.Alter.hinweis(e) : '';
      zeile.classList.toggle('is-fehler', e?.stufe === 'verboten');
      eltern.hidden = e?.stufe !== 'eltern';
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
              // Den Geraeteschluessel aus dem Speicher dieser Seite werfen.
              // Der geheime Teil bleibt in localStorage — sonst waeren beim
              // naechsten Anmelden alle alten Nachrichten unlesbar.
              window.KryptoWeb?.vergessen();
              close();
              return bootstrap();
            }
            neuZeichnen();
          })
        );
        // Ein Tipp legt die E-Mail ins Anmeldefeld — es fehlt nur das Passwort.
        sheet.querySelectorAll('[data-frueher]').forEach((el) =>
          el.addEventListener('click', (e) => {
            if (e.target.closest('[data-frueher-weg]')) return;
            zustand.kennung = el.dataset.frueher;
            zustand.passwort = '';
            zustand.hinweis = '';
            zustand.ansicht = 'anmelden';
            neuZeichnen();
          })
        );
        sheet.querySelectorAll('[data-frueher-weg]').forEach((b) =>
          b.addEventListener('click', () => {
            fruehereVergessen(b.dataset.frueherWeg);
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

      const benutzer = sheet.querySelector('#kontoBenutzer');
      benutzer?.addEventListener('input', () => namenPruefen(benutzer));
      ['#kontoGeburt', '#kontoTelefon'].forEach((id) =>
        sheet.querySelector(id)?.addEventListener('input', alterZeigen)
      );
      alterZeigen();

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
      ${/*
          Henrik am 07.09.2026: "Obere Haelfte wirkt gequetscht (Vorbild
          Instagram/WhatsApp)." Die Biografie stand in der schmalen Spalte
          neben dem Bild und brach dort in drei Zeilen um. Instagram und
          WhatsApp setzen neben das Bild nur Name und Kennung und die
          Biografie darunter ueber die volle Breite — genau so steht es
          jetzt hier und in app/screens/messenger/MessengerProfileScreen.tsx.
        */ ''}
      <div class="mprof">
        <div class="avatar avatar--88" style="background:${farbe(me.color)}">${esc(me.initials)}</div>
        <div class="mprof__text">
          ${/* Wie im Videos- und Community-Profil aus dem Konto, nicht fest
                im Markup - sonst zeigt "Profil bearbeiten" hier keine
                Wirkung. */ ''}
          <div class="mprof__name">${esc(me.name)}</div>
          ${me.handle ? `<div class="mprof__handle">${esc(me.handle)}</div>` : ''}
        </div>
      </div>
      ${profil.bio ? `<div class="mprof__bio">${esc(profil.bio)}</div>` : ''}
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
      ${/*
          Henrik am 07.09.2026: "Profilseiten-Einstellungen (nur 3) mit echter
          Einstellungsseite synchron halten." Die drei standen hier ohne Wert
          da — man sah dem Profil nicht an, was gilt, und musste jedes Mal in
          die Einstellungen. Jetzt lesen sie dieselben Quellen wie dort
          (sichtText aus /api/sichtbarkeit, schalterAn aus /api/einstellungen)
          und die Lesebestaetigung ist derselbe Schalter, nicht ein Verweis.
        */ ''}
      <div class="group">
        <button class="item" data-mact="location">
          <span class="item__label">Standort-Sichtbarkeit</span>
          <span class="item__value">${esc(sichtText('standort'))}</span>
          <span class="row__chevron">${ICONS.chevron}</span>
        </button>
        <button class="item" data-mact="story">
          <span class="item__label">Story-Sichtbarkeit</span>
          <span class="item__value">${esc(sichtText('story'))}</span>
          <span class="row__chevron">${ICONS.chevron}</span>
        </button>
        <div class="item">
          <span class="item__label">Lesebestätigung</span>
          <button class="switch ${schalterAn('lesebestaetigung') ? 'is-on' : ''}" id="mprofLesen"
                  aria-label="Lesebestätigung"><span class="switch__knob"></span></button>
        </div>
      </div>
    </div>`;

  /*
   * Die Werte stehen erst nach dem ersten Holen richtig da — dann einmal neu
   * zeichnen. Nur wenn das Holen wirklich etwas gebracht hat, sonst dreht
   * sich die Seite bei einem Serverfehler im Kreis.
   */
  if (!state.einstellungen) {
    void einstellungenHolen().then(() => {
      if (state.einstellungen && state.area === 'messenger' && state.sub.messenger === 'profile') {
        renderMessengerProfile();
      }
    });
  }
  if (!state.sichtbarkeit) {
    void sichtbarkeitNeuLaden().then(() => {
      if (state.sichtbarkeit && state.area === 'messenger' && state.sub.messenger === 'profile') {
        renderMessengerProfile();
      }
    });
  }

  // Fuehrt zur Kontoliste - hier hat Henrik den Kontowechsel gesucht.
  $('#switchProfile').addEventListener('click', openKontoWechsel);

  $('#mprofLesen')?.addEventListener('click', (e) => {
    const knopf = e.currentTarget;
    const neu = !schalterAn('lesebestaetigung');
    knopf.classList.toggle('is-on', neu);
    void (async () => {
      const ok = await einstellungSetzen(
        { label: 'lesebestaetigung', wahlKey: 'lesebestaetigung' },
        neu ? 'an' : 'aus'
      );
      if (!ok) knopf.classList.toggle('is-on', !neu);
    })();
  });
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
                  ${/*
                      Unten rechts steht die Laufzeit. Bei einem Livestream
                      gibt es keine — dort stand bis zum 03.09.2026 ebenfalls
                      "LIVE", zusaetzlich zum roten Abzeichen oben links.
                      Zweimal dasselbe Wort auf einem Bild liest sich wie ein
                      Fehler.
                    */ ''}
                  <div class="clip__thumb">${medienFlaeche(c.id, ICONS.landscape, c.mediaUrl, c.thumbnail)}${marke}${
                    art !== 'live' && c.duration ? `<span class="clip__time">${esc(c.duration)}</span>` : ''
                  }</div>
                  <div class="clip__meta">
                    <div class="avatar avatar--36" style="background:${farbe(u.color)}" data-profile="${u.id}">${esc(u.initials)}</div>
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
      <div class="exp__grid">${suchTreffer().reels.map((v) => `
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
      ${suchTreffer().clips.map((c) => `
        <button class="exp__row" data-openclip="${c.id}">
          <span class="exp__thumb">${medienFlaeche(c.id, ICONS.landscape, c.mediaUrl, c.thumbnail)}</span>
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
      <div class="exp__grid">${suchTreffer().posts.map((p) => `
        <button class="griditem" data-openpost="${p.id}">${medienFlaeche(p.id, ICONS.image, p.mediaUrl, p.thumbnail)}</button>`).join('')}</div>
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
        <button class="griditem" data-item="${i.id}" data-type="${i.userId ? (i.duration ? 'video' : 'post') : 'clip'}">${medienFlaeche(i.id, ICONS.image, i.mediaUrl, i.thumbnail)}</button>`).join('')}</div>
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
  const leute = suchTreffer().people;
  main.innerHTML = `
    ${explorerKopf('Profile')}
    <div class="scroll">
      <div class="exp__list">${leute
        .map(
          (u) => `<button class="exp__row" data-profile="${u.id}">
            <span class="avatar avatar--44" style="background:${farbe(u.color)}">${esc(u.initials)}</span>
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
      <div class="exp__list">${suchTreffer().tags
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
      <div class="exp__list">${suchTreffer().places
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
      <div class="exp__list">${suchTreffer().sounds
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
        <button class="griditem" data-item="${i.id}">${medienFlaeche(i.id, ICONS.image, i.mediaUrl, i.thumbnail)}</button>`).join('')}</div>
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
      <span class="exp__card-media">${medienFlaeche(eintrag.id, symbol, eintrag.mediaUrl, eintrag.thumbnail)}</span>
      <span class="exp__card-info">
        <span class="exp__card-kopf">
          <span class="exp__card-avatar" style="background:${farbe(u.color)}">${esc(u.initials)}</span>
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
/**
 * Reihenfolge fuer Vorschauen: erst was von Leuten kommt, denen man folgt,
 * dann was die meisten Reaktionen hat. Gleiche Rechnung in
 * app/lib/interesse.ts.
 */
const VORSCHAU = 5;
function nachInteresse(liste, beliebtheit, vonGefolgten = () => false) {
  return [...liste].sort(
    (a, b) => Number(vonGefolgten(b)) - Number(vonGefolgten(a)) || (beliebtheit(b) || 0) - (beliebtheit(a) || 0)
  );
}
const vonGefolgten = (e) => !!(state.gefolgt && state.gefolgt[e.userId]);

/**
 * Alle Treffer der Video-Suche, nach Interesse geordnet. Die Vorschau nimmt
 * davon die ersten fuenf, die Uebersichtsseiten hinter den Ueberschriften
 * alle - mit demselben Suchbegriff, damit dort steht, was die Vorschau
 * versprochen hat.
 */
function suchTreffer() {
  const q = (state.videoSearchQuery || '').trim().toLowerCase();
  const hit = (t) => !q || String(t).toLowerCase().includes(q);
  return {
    reels: nachInteresse(state.videos.filter((v) => hit(v.description) || hit(v.music || '') || hit(user(v.userId).name)), (v) => v.likes, vonGefolgten),
    clips: nachInteresse(state.clips.filter((c) => hit(c.title) || hit(user(c.userId).name)), (c) => c.views, vonGefolgten),
    posts: nachInteresse(state.posts.filter((p) => hit(p.description) || hit(p.music || '') || hit(user(p.userId).name)), (p) => p.likes, vonGefolgten),
    people: nachInteresse(
      Object.values(state.users).filter((u) => u.id !== 'me' && (hit(u.name) || hit(u.handle))),
      () => 0,
      (u) => !!(state.gefolgt && state.gefolgt[u.id])
    ),
    tags: nachInteresse(state.hashtags.filter((h) => hit(h.tag)), (h) => h.posts),
    places: nachInteresse(state.places.filter((pl) => hit(pl.name)), (pl) => pl.posts),
    sounds: nachInteresse(state.sounds.filter((so) => hit(so.title) || hit(so.artist)), (so) => so.uses),
  };
}

function renderVideoSearch() {
  const q = state.videoSearchQuery.trim().toLowerCase();
  const hit = (t) => !q || String(t).toLowerCase().includes(q);

  /*
   * Handbuch: gesucht wird auch nach Musik und Titel, nicht nur nach
   * Beschreibung und Name. Ein Reel mit dem Sound „Sommerhit" war bis zum
   * 02.09.2026 nur ueber den Sound-Abschnitt zu finden, nicht ueber die
   * Suche selbst — obwohl die Musik unter jedem Reel steht.
   *
   * Untertitel bleiben aussen vor, und zwar nicht aus Nachlaessigkeit:
   * `posts.untertitel` ist ein Ja/Nein, kein Text. Nach etwas zu suchen, das
   * nirgends gespeichert ist, ginge nicht — dafuer braeuchte es erst
   * Untertiteltexte in der Datenbank.
   */
  /*
   * Henrik am 21.09.2026: "Vorschau kuerzen: je Kategorie etwa fuenf
   * Eintraege, ausgesucht nach Interesse. Die volle Auswahl kommt erst hinter
   * der Ueberschrift mit Pfeil." Gezaehlt wird die volle Liste - sonst hiesse
   * es "Nichts gefunden", wo nur die Vorschau leer waere.
   */
  const alle = suchTreffer();
  const [reels, clips, posts, people, tags, places, sounds] = [
    alle.reels, alle.clips, alle.posts, alle.people, alle.tags, alle.places, alle.sounds,
  ].map((l) => l.slice(0, VORSCHAU));

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
          <input id="videoSearch" type="search" placeholder="Suche nach Videos, Musik, Profilen, #Hashtags" value="${esc(state.videoSearchQuery)}" autocomplete="off" />
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
                        <span class="exp__thumb">${medienFlaeche(c.id, ICONS.landscape, c.mediaUrl, c.thumbnail)}</span>
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
                        <span class="avatar avatar--44" style="background:${farbe(u.color)}">${esc(u.initials)}</span>
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
  // Chat-Anfrage und Messenger-Anfrage führen in den Chat, um den es geht.
  if (ziel.art === 'chat') return openChat(ziel.id);

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
  //
  // Die Umfrage stand am 01.09.2026 kurz zwischen Story und Livestream und
  // hat damit genau diese Nachbarschaft zerrissen. Sie gehoert hinter den
  // Livestream: eine Umfrage ist nichts Fluechtiges.
  { key: 'livestream', label: 'Livestream', icon: 'video' },
  /* Umfrage — im Handbuch bei Beiträgen, Storys und Kanälen genannt. */
  { key: 'umfrage', label: 'Umfrage', icon: 'poll' },
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
/*
 * "Kein Interesse" (Schema 55). Nur die beiden Feeds lassen den Beitrag weg;
 * auf dem Profil und in der Suche steht er weiter. Gleiche Regel in
 * VideoFeedScreen.tsx und HomeFeedScreen.tsx (sichtbareVideos/-Posts).
 */
const imFeed = (b) => !(state.keinInteresse || []).includes(b.id);

/* Die Adresse eines Beitrags. bootstrap() oeffnet sie wieder (?beitrag=). */
const beitragLink = (id) => `${location.origin}/?beitrag=${encodeURIComponent(id)}`;

const BEITRAG_MELDE_GRUENDE = [
  'Spam oder Werbung',
  'Beleidigung oder Hass',
  'Gewalt oder Gefahr',
  'Nicht jugendfreie Inhalte',
  'Falschinformation',
  'Etwas anderes',
];

/*
 * Drei-Punkte-Menue am Beitrag — Henrik am 21.09.2026: "Link kopieren,
 * herunterladen, zu Story hinzufügen, melden, kein Interesse ... Vorbild
 * TikTok. Kein 'an WhatsApp senden' oder 'Snapchat' — genau die soll All
 * Media ersetzen." Senden geht deshalb weiter nur ueber den Teilen-Knopf.
 *
 * Gegenstueck in der App: components/BeitragOptionenSheet.tsx.
 */
async function openBeitragOptionen(beitrag) {
  const eigener = istEigen(beitrag.userId);

  // Herunterladen nur, wenn die Person es zulaesst - gefragt wird vor dem
  // Zeichnen, wie bei den Storys.
  let darfSichern = eigener;
  if (!eigener && beitrag.mediaUrl && beitrag.userId) {
    try {
      const r = await fetch(`/api/download-erlaubt/${encodeURIComponent(beitrag.userId)}`);
      darfSichern = (await r.json()).erlaubt === true;
    } catch {
      darfSichern = false;
    }
  }

  const punkte = [
    { key: 'link', label: 'Link kopieren', icon: 'link' },
    ...(darfSichern && beitrag.mediaUrl ? [{ key: 'sichern', label: 'Herunterladen', icon: 'download' }] : []),
    { key: 'story', label: 'Zu Story hinzufügen', icon: 'plus' },
    ...(eigener
      ? []
      : [
          { key: 'kein', label: 'Kein Interesse', icon: 'eyeOff' },
          { key: 'melden', label: 'Melden', icon: 'flag', gefahr: true },
        ]),
  ];

  const senden = async (pfad, daten = {}) => {
    const res = await fetch(`/api/beitraege/${encodeURIComponent(beitrag.id)}/${pfad}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(daten),
    });
    const antwort = await res.json().catch(() => ({}));
    if (!res.ok || antwort.ok === false) throw new Error(antwort.error || `Status ${res.status}`);
    return antwort;
  };

  openSheet(
    'Optionen',
    `<div class="sheet__body">${punkte
      .map(
        (p) => `<button class="item ${p.gefahr ? 'item--danger' : ''}" data-beitragopt="${p.key}">
          <span class="item__icon">${ICONS[p.icon]}</span>
          <span class="item__label">${esc(p.label)}</span>
          <span class="row__chevron">${ICONS.chevron}</span>
        </button>`
      )
      .join('')}</div>`,
    (sheet, close) => {
      sheet.querySelectorAll('[data-beitragopt]').forEach((b) =>
        b.addEventListener('click', async () => {
          const was = b.dataset.beitragopt;
          close();

          if (was === 'link') {
            const adresse = beitragLink(beitrag.id);
            try {
              await navigator.clipboard.writeText(adresse);
              return toast('Link kopiert');
            } catch {
              return toast(adresse);
            }
          }

          if (was === 'sichern') {
            const a = document.createElement('a');
            a.href = beitrag.mediaUrl;
            a.download = `all-media-${beitrag.id}.${beitrag.video ? 'mp4' : 'jpg'}`;
            a.click();
            return toast('Gesichert');
          }

          if (was === 'story') {
            try {
              const antwort = await senden('story');
              if (antwort.stories) state.stories = antwort.stories;
              if (antwort.storiesVideos) state.storiesVideos = antwort.storiesVideos;
              return toast('Zu deiner Story hinzugefügt');
            } catch (fehler) {
              return toast(`Zur Story hinzufügen fehlgeschlagen: ${fehler.message}`);
            }
          }

          if (was === 'kein') {
            try {
              await senden('kein-interesse');
            } catch (fehler) {
              return toast(`Kein Interesse fehlgeschlagen: ${fehler.message}`);
            }
            state.keinInteresse = [...(state.keinInteresse || []), beitrag.id];
            // Aus dem Feed nehmen, ohne neu zu zeichnen - sonst springt die
            // Liste an den Anfang.
            document.getElementById(`post-${beitrag.id}`)?.remove();
            document.getElementById(`slide-${beitrag.id}`)?.remove();
            return toast('Du siehst diesen Beitrag nicht mehr im Feed');
          }

          // Melden: erst der Grund, dann an die Datenbank.
          openSheet(
            'Warum meldest du das?',
            `<div class="sheet__body">${BEITRAG_MELDE_GRUENDE.map(
              (g) => `<button class="item" data-grund="${esc(g)}">
                <span class="item__label">${esc(g)}</span>
                <span class="row__chevron">${ICONS.chevron}</span>
              </button>`
            ).join('')}</div>`,
            (blatt, zu) => {
              blatt.querySelectorAll('[data-grund]').forEach((g) =>
                g.addEventListener('click', async () => {
                  zu();
                  try {
                    await senden('melden', { grund: g.dataset.grund });
                    toast('Danke, wir sehen uns das an');
                  } catch (fehler) {
                    toast(`Das Melden fehlgeschlagen: ${fehler.message}`);
                  }
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

/*
 * Ein geteilter Link (?beitrag=<id>) oeffnet den Beitrag dort, wo er
 * hingehoert: Bild im Home-Feed, Reel im Hochformat, Video im Querformat.
 * Danach verschwindet der Parameter, sonst oeffnete jedes Neuladen ihn wieder.
 */
function geteiltenBeitragOeffnen() {
  const id = new URLSearchParams(location.search).get('beitrag');
  if (!id) return;
  history.replaceState(null, '', location.pathname + location.hash);
  if (state.clips?.some((c) => c.id === id)) return openClip(id);
  if (state.videos?.some((v) => v.id === id)) {
    state.area = 'videos';
    return springeZu('portrait', `slide-${id}`);
  }
  if (state.posts?.some((p) => p.id === id)) {
    state.area = 'videos';
    return springeZu('home', `post-${id}`);
  }
  toast('Diesen Beitrag gibt es nicht mehr');
}

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
          <span class="avatar avatar--36" style="background:${farbe(u.color)}">${esc(u.initials)}</span>
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
 *
 * ZIEL STATT CHAT (04.09.2026)
 *
 * Dasselbe Plus steht seit heute auch im Unterthema einer Community. Beide
 * schicken denselben Koerper an eine andere Adresse und zeichnen danach eine
 * andere Liste neu. Statt den ganzen Block ein zweites Mal hinzuschreiben —
 * und die zweite Abschrift beim naechsten Anhang zu vergessen — bekommen die
 * Funktionen ein "Ziel":
 *
 *   pfad      wohin gesendet wird
 *   ausserId  wer in der Kontaktauswahl NICHT auftaucht (im Chat die
 *             Gegenseite, im Kanal niemand)
 *   ohne      Anhang-Arten, die es hier nicht gibt
 *   fertig    was mit der angelegten Nachricht geschieht
 */
function zielChat(chat) {
  return {
    pfad: `/api/messages/${chat.id}/anhang`,
    ausserId: chat.userId,
    ohne: [],
    fertig: (nachricht) => {
      state.messages.push(nachricht);
      paintMessages(chat);
    },
  };
}

function openAnhang(ziel, chat) {
  if (chat && chatGesperrt(chat)) {
    return toast(
      chat.dmGesperrt
        ? `${chat.name} empfängt keine Nachrichten`
        : chat.requestState === 'declined'
          ? 'Die Anfrage wurde abgelehnt'
          : 'Warte, bis die Anfrage angenommen wurde'
    );
  }

  const punkte = [
    { key: 'kamera', label: 'Foto aufnehmen', icon: 'camera' },
    { key: 'galerie', label: 'Aus der Galerie', icon: 'image' },
    /*
     * Datei, Gif, Sticker und Standortanfrage kamen am 01.09.2026 dazu. Alle
     * vier stehen im Handbuch ("Dateien/Dokumente", "Gifs", "Sticker",
     * "Standortanfrage"); im Anhang-Menü gab es sie nicht.
     */
    { key: 'datei', label: 'Datei senden', icon: 'document' },
    { key: 'gif', label: 'Gif senden', icon: 'film' },
    { key: 'sticker', label: 'Sticker', icon: 'sticker' },
    { key: 'standort', label: 'Standort senden', icon: 'mapPin' },
    { key: 'standortAnfragen', label: 'Standort anfragen', icon: 'standortAnfrage' },
    { key: 'kontakt', label: 'Kontakt senden', icon: 'person' },
  ];

  openSheet(
    'Anhang',
    punkte
      .filter((p) => !(ziel.ohne || []).includes(p.key))
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
          anhangSenden(ziel, b.dataset.anhang, chat);
        })
      );
    }
  );
}

/** Anhang wirklich verschicken und anzeigen. */
async function anhangSenden(ziel, art, chat) {
  const senden = async (koerper) => {
    const res = await fetch(ziel.pfad, {
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
    ziel.fertig(nachricht);
    return toast('Foto gesendet');
  }

  /*
   * Eine Datei. Der Browser kann sie direkt auswählen; die App braucht dafür
   * expo-document-picker. Beide schicken dasselbe an den Server: Name und
   * Größe, damit im Chat mehr steht als ein graues Kästchen.
   */
  if (art === 'datei') {
    const feld = document.createElement('input');
    feld.type = 'file';
    const datei = await new Promise((fertig) => {
      feld.addEventListener('change', () => fertig(feld.files?.[0] || null));
      feld.click();
    });
    if (!datei) return;

    const nachricht = await senden({ art: 'datei', name: datei.name, groesse: datei.size });
    if (!nachricht) return;
    ziel.fertig(nachricht);
    return toast('Datei gesendet');
  }

  /*
   * Ein Gif kommt aus der eigenen Auswahl. Eine Suche bei einem Gif-Dienst
   * bräuchte einen fremden Zugang und würde jede Suchanfrage dorthin
   * schicken — für eine App, die mit Ende-zu-Ende wirbt, der falsche Weg.
   */
  if (art === 'gif') {
    const datei = await dateiWaehlen('photo', true);
    if (!datei) return;

    let bild;
    try {
      bild = await bildVerkleinern(datei);
    } catch {
      return toast('Gif konnte nicht gelesen werden');
    }

    const nachricht = await senden({ art: 'gif' });
    if (!nachricht) return;
    eigenesMediumSichern(nachricht.id, bild);
    ziel.fertig(nachricht);
    return toast('Gif gesendet');
  }

  if (art === 'sticker') {
    return openSheet(
      'Sticker',
      `<div class="sheet__body sticker-raster">
         ${STICKER.map((z) => `<button class="sticker-raster__z" data-sticker="${z}">${z}</button>`).join('')}
       </div>`,
      (sheet, close) => {
        sheet.querySelectorAll('[data-sticker]').forEach((b) =>
          b.addEventListener('click', async () => {
            close();
            const nachricht = await senden({ art: 'sticker', zeichen: b.dataset.sticker });
            if (!nachricht) return;
            ziel.fertig(nachricht);
          })
        );
      },
      { schliessen: true, hoch: true }
    );
  }

  /*
   * Den Standort der Gegenseite anfragen. Das Handbuch nennt es ausdrücklich
   * ("Live-Standort Anfrage (im Privatchat)"); bis zum 01.09.2026 gab es nur
   * die Freigabe, also die eine Richtung.
   */
  if (art === 'standortAnfragen') {
    if (!chat?.userId) return toast('In einer Gruppe geht das nicht');
    const antwort = await api(`/api/chats/${chat.id}/standortanfrage`, { zielId: chat.userId });
    if (!antwort?.ok) return toast(antwort?.error || 'Die Anfrage ging nicht raus');
    return toast(`Standort bei ${chat.name} angefragt`);
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
            ziel.fertig(nachricht);
            toast('Standort gesendet');
          })
        );
      },
      { schliessen: true, hoch: true }
    );
  }

  // Kontakt: nur Personen, die man auch wirklich kennt.
  const auswahl = state.contacts.filter((c) => state.users[c.id] && c.id !== ziel.ausserId);
  if (!auswahl.length) return toast('Du hast noch keinen Kontakt zum Weitergeben');

  openSheet(
    'Kontakt senden',
    `<div class="sheet__body">${auswahl
      .map((c) => {
        const u = user(c.id);
        return `<button class="item" data-kontakt="${c.id}">
          <span class="avatar avatar--36" style="background:${farbe(u.color)}">${esc(u.initials)}</span>
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
          ziel.fertig(nachricht);
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
async function openStoryAnsichten(story, danach) {
  /*
   * Wer die Story gesehen hat, steht in public.story_views.
   *
   * Bis zum 09.09.2026 stand hier eine Rechnung statt einer Abfrage: die
   * ersten n eigenen Kontakte, n aus der Aufnahmezeit. Die Namen waren
   * erfunden und die Zahl daneben auch — sie stieg mit dem Alter der Story,
   * nicht mit den Zuschauern.
   */
  let seher = [];
  try {
    const r = await fetch(`/api/stories/${encodeURIComponent(story.id)}/ansichten`);
    const daten = await r.json().catch(() => ({}));
    if (daten.ok) seher = daten.seher || [];
  } catch (fehler) {
    console.error('Story-Ansichten fehlgeschlagen:', fehler);
  }

  openSheet(
    `${seher.length} ${seher.length === 1 ? 'Ansicht' : 'Ansichten'}`,
    `<div class="sheet__body">
       ${
         seher.length
           ? seher
               .map((v) => {
                 // Bekannte Person: Name und Farbe aus dem geladenen Bestand,
                 // sonst das, was der Server mitgeschickt hat.
                 const u = state.users[v.id] || v;
                 return `<button class="item" data-seher="${esc(v.id)}">
                   <span class="avatar avatar--36" style="background:${farbe(u.color)}">${esc(u.initials || '')}</span>
                   <span class="item__label">${esc(u.name || 'Unbekannt')}</span>
                   <span class="item__value">${esc(u.handle || '')}</span>
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

async function openStoryOptionen(story, danach) {
  const eigene = !!story.own;

  /*
   * "Auf dem Geraet sichern" stand nur bei der eigenen Story — und damit war
   * die Einstellung "Downloadeinstellungen" eine Wahl ohne Gegenstand: es
   * gab keinen Weg, einen fremden Inhalt zu sichern, also auch nichts zu
   * erlauben oder zu verbieten.
   *
   * Jetzt gibt es den Punkt auch bei fremden Storys — aber nur, wenn die
   * Person es zulaesst. Gefragt wird vor dem Zeichnen des Blattes: ein
   * Knopf, der beim Antippen "darfst du nicht" sagt, ist die schlechtere
   * Antwort als einer, der gar nicht erst dasteht.
   */
  let darfSichern = eigene;
  if (!eigene && story.mediaUri && story.userId) {
    try {
      const r = await fetch(`/api/download-erlaubt/${encodeURIComponent(story.userId)}`);
      darfSichern = (await r.json()).erlaubt === true;
    } catch {
      darfSichern = false;
    }
  }

  const punkte = eigene
    ? [
        { key: 'sichtbar', label: 'Wer darf sie sehen', icon: 'eye' },
        { key: 'sichern', label: 'Auf dem Gerät sichern', icon: 'bookmark' },
        { key: 'loeschen', label: 'Story löschen', icon: 'trash', gefahr: true },
      ]
    : [
        { key: 'link', label: 'Link kopieren', icon: 'bookmark' },
        ...(darfSichern ? [{ key: 'sichern', label: 'Auf dem Gerät sichern', icon: 'bookmark' }] : []),
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
            closeOverlay();
            await storyLoeschen(story.id);
            return;
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
            // Dieselben vier Stufen wie in den Einstellungen. Hier stand bis
            // zum 01.09.2026 eine eigene Dreier-Wahl — zwei Orte, an denen
            // dasselbe eingestellt wird, mit unterschiedlichen Antworten.
            return openEinstellung({ label: 'Story-Sichtbarkeit', icon: 'eye', sichtbar: 'story' });
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
  // Bei Live gibt es keine Geschwindigkeit — gesendet wird in Echtzeit.
  const mitTempo = clip.art !== 'live';

  openSheet(
    'Video-Einstellungen',
    `<div class="sheet__body">
       ${
         mitTempo
           ? `<button class="item" data-vopt="tempo">
                <span class="item__icon">${ICONS.clock}</span>
                <span class="item__label">Wiedergabegeschwindigkeit</span>
                <span class="item__value">${esc(tempoText(state.video.tempo))}</span>
                <span class="row__chevron">${ICONS.chevron}</span>
              </button>`
           : ''
       }
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
              // Auf das laufende Video anwenden. Vorher wurde die Wahl nur
              // gespeichert und angezeigt — am Video aenderte sich nichts.
              const laeuft = document.querySelector('#clipVideo');
              if (laeuft) laeuft.playbackRate = state.video.tempo;
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

/*
 * Spenden an eine Person, waehrend eines Streams. Feste Stufen als schneller
 * Weg, dahinter ein eigener Betrag — Henrik am 21.09.2026: „Spenden: eigener
 * Betrag muss wählbar sein." Gleiche Grenzen wie in der App
 * (ClipPlayerScreen, betragInCent): unter 50 Cent lohnt keine Buchung, ueber
 * 1.000 € ist es fast sicher ein Tippfehler.
 */
function openSpende(empfaengerId, postId) {
  const name = user(empfaengerId).name;
  const buchen = async (cent) => {
    const antwort = await api(`/api/spenden/${empfaengerId}`, { betragCent: cent, postId });
    if (!antwort?.ok) return toast(antwort?.error || 'Die Spende ging nicht durch');
    toast(`${(cent / 100).toFixed(2).replace('.', ',')} € an ${name} gespendet`);
  };
  openSheet(
    `An ${name} spenden`,
    `<div class="sheet__body">
       ${[100, 300, 500, 1000]
         .map(
           (cent) => `<button class="item" data-spendecent="${cent}">
             <span class="item__icon">${ICONS.heart}</span>
             <span class="item__label">${(cent / 100).toFixed(2).replace('.', ',')} €</span>
           </button>`
         )
         .join('')}
       <button class="item" data-spendecent="eigen">
         <span class="item__icon">${ICONS.edit || ICONS.plus}</span>
         <span class="item__label">Eigener Betrag …</span>
       </button>
     </div>`,
    (blatt, zu) => {
      blatt.querySelectorAll('[data-spendecent]').forEach((b) =>
        b.addEventListener('click', () => {
          zu();
          if (b.dataset.spendecent !== 'eigen') return buchen(Number(b.dataset.spendecent));
          openFormular(
            `An ${name} spenden`,
            [{ key: 'betrag', label: 'Betrag in Euro', platzhalter: 'z. B. 2,50', pflicht: true }],
            async (werte) => {
              const zahl = Number(String(werte.betrag).replace(/\s|€/g, '').replace(',', '.'));
              if (!Number.isFinite(zahl) || zahl < 0.5 || zahl > 1000) {
                return 'Bitte einen Betrag zwischen 0,50 € und 1.000 € eingeben';
              }
              await buchen(Math.round(zahl * 100));
              return null;
            },
            'Spenden'
          );
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
  /*
   * Bei Live darf man zurueck, um Verpasstes nachzuholen, aber nie ueber die
   * Stelle hinaus nach vorn, die schon gesendet ist. Gleiche Regel in
   * app/screens/videos/ClipPlayerScreen.tsx (liveKante).
   */
  let liveKante = 0;
  let liveOffen = false;
  let liveUhr = null;
  const istLive = () => clip.art === 'live';

  const zeit = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  overlay.hidden = false;

  const paint = () => {
    const u = user(clip.userId);
    /*
     * Aehnlich heisst: gemeinsame Hashtags zuerst, dann dieselbe Person, dann
     * die meistgesehenen. Vorher waren es schlicht die ersten vier der Liste.
     */
    const naehe = (c) =>
      (c.tags || []).filter((t) => (clip.tags || []).includes(t)).length * 2 + (c.userId === clip.userId ? 1 : 0);
    const aehnlich = state.clips
      .filter((c) => c.id !== clip.id)
      .sort((a, b) => naehe(b) - naehe(a) || (b.views || 0) - (a.views || 0))
      .slice(0, 4);
    /*
     * Kapitel nur, soweit sie im Video liegen — die Testvideos sind eine
     * Minute lang, ihre Kapitel reichten bis Minute 11. Bei Live gibt es
     * keine: dort steht noch nicht fest, was kommt.
     */
    const kapitel = istLive() ? [] : (clip.kapitel || []).filter((k) => !gesamt || k.bei < gesamt);

    overlay.innerHTML = `
      <div class="page">
        <div class="page__bar">
          <button class="seitenbtn" id="clipBack" aria-label="Zurück">${ICONS.back}</button>
        </div>
        <div class="scroll">
          <div class="player">
            <div class="player__stage" id="clipStage">
              ${
                istVideoAdresse(clip.mediaUrl)
                  ? videoElement('clipVideo', clip.mediaUrl, clip.thumbnail)
                  : medienFlaeche(clip.id, ICONS.play, clip.mediaUrl, clip.thumbnail)
              }
              <button class="player__play" id="clipPlay" aria-label="Abspielen">${ICONS.play}</button>
              ${istLive() ? '<button class="player__live" id="clipLiveKante" aria-label="Zur Live-Stelle">LIVE</button>' : ''}
            </div>
            <div class="player__leiste">
              <span class="player__zeit" id="clipZeit">${zeit(bei)}</span>
              <span class="player__balkenfeld" id="clipBalken"><span class="player__balken"><i id="clipFortschritt" style="width:0%"></i></span></span>
              <span class="player__zeit">${istLive() ? 'LIVE' : esc(clip.duration)}</span>
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
            kapitel.length
              ? `<div class="kapitel">
                   <div class="kapitel__kopf">Kapitel</div>
                   ${kapitel
                     .map(
                       (k, i) => `<button class="kapitel__zeile" data-kapitel="${k.bei}">
                         <span class="kapitel__zeit">${zeit(k.bei)}</span>
                         <span class="kapitel__titel">${esc(k.titel)}</span>
                         <span class="kapitel__dauer">${
                           kapitel[i + 1] ? zeit(kapitel[i + 1].bei - k.bei) : zeit(gesamt - k.bei)
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
            ${/*
                Das Drei-Punkte-Menue steht neben dem Titel, nicht in der
                Aktionsreihe: dort sind es laut Prototyp genau fuenf Knoepfe.
              */ ''}
            <button class="player__mehr" data-clipact="mehr" aria-label="Mehr">${ICONS.dots}</button>
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

          ${
            /*
             * Live-Kommentare und Spenden fuer Zuschauer. Die App zeigt beides
             * seit dem 01.09.2026, die Website bis zum 21.09.2026 nur dem, der
             * selbst sendet. Zusammengeklappt die drei neuesten Zeilen, zum
             * Schreiben aufgeklappt groesser — Henrik am 21.09.2026.
             */
            istLive()
              ? `<div class="livebox ${liveOffen ? 'is-offen' : ''}" id="liveBox">
                   <div class="livebox__kopf">
                     <button class="livebox__titel" id="liveKlappe">Live-Kommentare ${liveOffen ? '▾' : '▴'}</button>
                     <button class="livebox__spende" id="liveSpende">♥ Spenden</button>
                   </div>
                   <div class="livebox__zeilen" id="liveZeilen"><p class="live__leer">Noch hat niemand etwas geschrieben.</p></div>
                   ${
                     liveOffen
                       ? `<input class="livebox__feld" id="liveFeld" placeholder="Etwas sagen …" enterkeyhint="send" />`
                       : `<button class="livebox__schreiben" id="liveSchreiben">Kommentieren …</button>`
                   }
                 </div>`
              : ''
          }

          <div class="player__text">${esc(clip.description || '')}</div>

          ${
            clip.tags?.length
              ? `<div class="chips">${clip.tags.map((t) => `<button class="chip" data-cliptag="${esc(t)}">${esc(t)}</button>`).join('')}</div>`
              : ''
          }

          <button class="exp__head exp__head--knopf" id="clipAehnlich">Ähnliche Videos →</button>
          <div class="expclips">
            ${aehnlich
              .map((c) => {
                const au = user(c.userId);
                return `<article class="clip clip--klein" data-anderesclip="${c.id}">
                  <div class="clip__thumb">${medienFlaeche(c.id, ICONS.landscape, c.mediaUrl, c.thumbnail)}<span class="clip__time">${esc(c.duration)}</span></div>
                  <div class="clip__meta">
                    <div class="avatar avatar--36" style="background:${farbe(au.color)}">${esc(au.initials)}</div>
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
    clearInterval(liveUhr);
    // Ohne das Anhalten laeuft der Ton weiter, waehrend das Fenster schon zu
    // ist — innerHTML='' allein raeumt das Element nicht zuverlaessig ab.
    const medium = overlay.querySelector('#clipVideo');
    if (medium) medium.pause();
    overlay.hidden = true;
    overlay.innerHTML = '';
  };

  const binden = () => {
    overlay.querySelector('#clipBack').addEventListener('click', schliessen);

    const play = overlay.querySelector('#clipPlay');
    const stage = overlay.querySelector('#clipStage');
    /*
     * Das echte Videoelement — es gibt es nur, wenn zum Beitrag eine
     * Videodatei hinterlegt ist. Sonst bleibt es beim Zaehler von vorher: es
     * ist nichts abzuspielen, aber die Leiste soll sich bewegen.
     */
    const medium = overlay.querySelector('#clipVideo');

    const knopfStand = (laeuft) => {
      play.innerHTML = laeuft ? ICONS.pause : ICONS.play;
      play.classList.toggle('is-aus', laeuft);
    };

    const leisteSetzen = () => {
      liveKante = Math.max(liveKante, bei);
      const zeitFeld = overlay.querySelector('#clipZeit');
      if (zeitFeld) zeitFeld.textContent = zeit(bei);
      const balken = overlay.querySelector('#clipFortschritt');
      if (balken) balken.style.width = `${gesamt ? (bei / gesamt) * 100 : 0}%`;
    };

    if (medium) {
      /*
       * Die Laufzeit aus der Datei schlaegt die aus dem Beitrag. Im Beitrag
       * steht ein Text, den irgendwer eingetragen hat; die Datei weiss es.
       */
      medium.addEventListener('loadedmetadata', () => {
        if (medium.duration && isFinite(medium.duration)) {
          gesamt = Math.round(medium.duration);
          leisteSetzen();
          // Kapitel hinter dem Ende der Datei fallen weg.
          overlay.querySelectorAll('[data-kapitel]').forEach((k) => {
            if (Number(k.dataset.kapitel) >= gesamt) k.remove();
          });
        }
      });
      medium.addEventListener('timeupdate', () => {
        bei = Math.floor(medium.currentTime);
        leisteSetzen();
      });
      medium.addEventListener('play', () => knopfStand(true));
      medium.addEventListener('pause', () => knopfStand(false));
      medium.addEventListener('ended', () => knopfStand(false));
      // Live laeuft in Echtzeit — schneller als gesendet geht nicht.
      medium.playbackRate = istLive() ? 1 : state.video.tempo || 1;
    }

    const umschalten = () => {
      if (medium) {
        if (medium.paused) medium.play().catch(() => {});
        else medium.pause();
        return;
      }
      if (uhr) {
        clearInterval(uhr);
        uhr = null;
        knopfStand(false);
        return;
      }
      knopfStand(true);
      uhr = setInterval(() => {
        const zeitFeld = overlay.querySelector('#clipZeit');
        if (!zeitFeld) return clearInterval(uhr);
        bei = Math.min(gesamt, bei + 1);
        leisteSetzen();
        if (bei >= gesamt) {
          clearInterval(uhr);
          uhr = null;
          knopfStand(false);
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

    /*
     * Henrik am 21.09.2026: Vollbild heisst Handy quer. Wo der Browser die
     * Ausrichtung sperren kann (Android), dreht er selbst. Wo nicht (iPhone),
     * dreht sich der Player per CSS um 90 Grad — `player--quer`. Am
     * Querformat-Bildschirm eines Rechners bleibt es beim normalen Vollbild.
     */
    const hochkant = () => window.innerHeight > window.innerWidth;
    const selbstDrehen = () => spieler.classList.add('player--voll', 'player--quer');

    const vollbildUmschalten = async () => {
      if (vollbildAn()) {
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
        screen.orientation?.unlock?.();
        spieler.classList.remove('player--voll', 'player--quer');
        vollbildKnopf.innerHTML = ICONS.ausklappen;
        vollbildKnopf.setAttribute('aria-label', 'Vollbild');
        return;
      }

      if (spieler.requestFullscreen) {
        try {
          await spieler.requestFullscreen();
          if (hochkant()) {
            try {
              await screen.orientation.lock('landscape');
            } catch {
              await document.exitFullscreen().catch(() => {});
              selbstDrehen();
            }
          }
        } catch {
          if (hochkant()) selbstDrehen();
          else spieler.classList.add('player--voll');
        }
      } else if (hochkant()) {
        selbstDrehen();
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
        // Bis hierher wurde nur die Anzeige verstellt. Jetzt springt auch das
        // Video — das war ja der Sinn einer Kapitelmarke.
        if (medium) medium.currentTime = bei;
        leisteSetzen();
        overlay.querySelectorAll('[data-kapitel]').forEach((x) => x.classList.remove('is-aktiv'));
        b.classList.add('is-aktiv');
      })
    );

    /*
     * Im Balken an eine Stelle springen — tippen oder ziehen. Henrik am
     * 21.09.2026: „Rote Timeline: Vor- und Zurückspulen funktioniert nicht."
     * Bis dahin reagierte sie nur auf einen Mausklick. Bei Live endet der
     * Weg nach vorn an der Stelle, die schon gesendet ist.
     */
    const springen = (sekunde) => {
      const grenze = istLive() ? liveKante : gesamt;
      bei = Math.max(0, Math.min(grenze, Math.round(sekunde)));
      if (medium) medium.currentTime = bei;
      leisteSetzen();
    };
    const balkenFeld = overlay.querySelector('#clipBalken');
    const balkenStelle = (e) => {
      const kasten = balkenFeld.getBoundingClientRect();
      springen(gesamt * Math.min(1, Math.max(0, (e.clientX - kasten.left) / kasten.width)));
    };
    balkenFeld.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      balkenFeld.setPointerCapture?.(e.pointerId);
      balkenStelle(e);
      const ziehen = (m) => balkenStelle(m);
      const los = () => {
        balkenFeld.removeEventListener('pointermove', ziehen);
        balkenFeld.removeEventListener('pointerup', los);
        balkenFeld.removeEventListener('pointercancel', los);
      };
      balkenFeld.addEventListener('pointermove', ziehen);
      balkenFeld.addEventListener('pointerup', los);
      balkenFeld.addEventListener('pointercancel', los);
    });

    overlay.querySelector('#clipLiveKante')?.addEventListener('click', (e) => {
      e.stopPropagation();
      springen(liveKante);
    });

    overlay.querySelector('#clipAehnlich')?.addEventListener('click', () => {
      schliessen();
      // Die Querformat-Uebersicht der Suche - /api/explorer kennt nur Tags, Orte, Sounds.
      state.area = 'videos';
      state.sub.videos = 'search';
      state.explorerView = 'clips';
      render();
    });

    /* Live-Kommentare: alle vier Sekunden nachladen, wie in der App. */
    if (istLive()) {
      const holen = async () => {
        const zeilen = overlay.querySelector('#liveZeilen');
        if (!zeilen) return clearInterval(liveUhr);
        try {
          const res = await fetch(`/api/stream/${clip.id}/kommentare`);
          if (!res.ok) return;
          const liste = (await res.json()).kommentare || [];
          zeilen.innerHTML = liste.length
            ? liste
                .slice(liveOffen ? -30 : -3)
                .map((k) => `<p class="live__kommentar"><b>${esc(k.name)}</b> ${esc(k.text)}</p>`)
                .join('')
            : '<p class="live__leer">Noch hat niemand etwas geschrieben.</p>';
          if (liveOffen) zeilen.scrollTop = zeilen.scrollHeight;
        } catch (fehler) {
          console.error('Live-Kommentare laden fehlgeschlagen:', fehler);
        }
      };
      clearInterval(liveUhr);
      holen();
      liveUhr = setInterval(holen, 4000);

      const aufklappen = (auf) => {
        liveOffen = auf;
        const stand = medium ? medium.currentTime : null;
        const lief = medium && !medium.paused;
        paint();
        // paint baut das Video neu - Stelle und Wiedergabe mitnehmen.
        const neu = overlay.querySelector('#clipVideo');
        if (neu && stand !== null) {
          neu.currentTime = stand;
          if (lief) neu.play().catch(() => {});
        }
        if (auf) overlay.querySelector('#liveFeld')?.focus();
      };
      overlay.querySelector('#liveKlappe')?.addEventListener('click', () => aufklappen(!liveOffen));
      overlay.querySelector('#liveSchreiben')?.addEventListener('click', () => aufklappen(true));
      overlay.querySelector('#liveZeilen')?.addEventListener('click', () => !liveOffen && aufklappen(true));

      const feld = overlay.querySelector('#liveFeld');
      feld?.addEventListener('keydown', async (e) => {
        if (e.key !== 'Enter') return;
        const text = feld.value.trim();
        if (!text) return;
        feld.value = '';
        const antwort = await api(`/api/stream/${clip.id}/kommentare`, { text });
        if (!antwort?.ok) return toast(antwort?.error || 'Der Kommentar ging nicht durch');
        holen();
      });

      overlay.querySelector('#liveSpende')?.addEventListener('click', () => openSpende(clip.userId, clip.id));
    }

    overlay.querySelectorAll('[data-clipact]').forEach((b) =>
      b.addEventListener('click', async () => {
        const was = b.dataset.clipact;

        if (was === 'mehr') {
          return openBeitragOptionen({ id: clip.id, userId: clip.userId, mediaUrl: clip.mediaUrl, video: true });
        }

        // Bei Live fuehrt der Knopf in die Live-Kommentare.
        if (was === 'comment' && istLive()) {
          if (liveOffen) return overlay.querySelector('#liveFeld')?.focus();
          return overlay.querySelector('#liveSchreiben')?.click();
        }
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
                          : medienFlaeche(p.id, ICONS.image, p.mediaUrl, p.thumbnail)
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

/** "53.5413° N, 9.9891° O" in Zahlen - wie koordinatenLesen in der App. */
function koordinatenLesen(text) {
  const t = String(text || '').match(/(-?\d+(?:\.\d+)?)\s*°?\s*([NS])?\s*,\s*(-?\d+(?:\.\d+)?)\s*°?\s*([OEW])?/i);
  if (!t) return null;
  const lat = Number(t[1]) * (/s/i.test(t[2] || '') ? -1 : 1);
  const lng = Number(t[3]) * (/w/i.test(t[4] || '') ? -1 : 1);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/*
 * Henrik am 21.09.2026: "Hashtag-Detailseite: Ueberschrift nicht anklickbar,
 * Liste nicht aufklappbar." Jeder Abschnitt zeigt jetzt eine Vorschau, und
 * seine Ueberschrift oeffnet dieselbe Seite nur mit diesem Abschnitt,
 * vollstaendig (`nur`). Die App macht es in ExplorerScreen genauso.
 */
/**
 * Die grosse Karte zu einem Ort, mit allen Orten darauf. Ein Tipp auf einen
 * anderen Ort oeffnet dessen Seite.
 */
function openOrtKarte(kopf, hier) {
  openSheet(
    'Standorte',
    `<div class="ortkarte" id="ortKarte"></div>`,
    (blatt, zu) => {
      const stil = KARTEN_STILE[0];
      const karte = L.map(blatt.querySelector('#ortKarte'), { zoomControl: true, zoomSnap: 0 }).setView([hier.lat, hier.lng], 6);
      L.tileLayer(stil.url, { attribution: stil.quelle, maxZoom: stil.maxZoom }).addTo(karte);
      (kopf.orte || []).forEach((o) => {
        const k = koordinatenLesen(o.koordinaten);
        if (!k) return;
        const aktiv = o.id === kopf.id;
        L.circleMarker([k.lat, k.lng], {
          radius: aktiv ? 12 : 8, fillColor: aktiv ? '#ff3b30' : '#007AFF', color: '#fff', weight: 2.5, fillOpacity: 1,
          className: `map__pin${aktiv ? ' is-aktiv' : ''}`,
        })
          .bindTooltip(esc(o.name))
          .on('click', () => {
            if (aktiv) return;
            zu();
            openExplorer('standort', o.id);
          })
          .addTo(karte);
      });
      // Das Blatt faehrt erst ein - danach die Groesse neu messen.
      setTimeout(() => karte.invalidateSize(), 300);
    },
    { schliessen: true }
  );
}

const EXP_VORSCHAU = { reels: VORSCHAU, clips: 3, beitraege: 6 };
const EXP_NAME = { reels: 'Reels', clips: 'Querformat', beitraege: 'Beiträge' };

async function openExplorer(art, wert, nur = null) {
  const res = await fetch(`/api/explorer/${art}/${encodeURIComponent(wert)}`);
  const daten = await res.json();
  if (!daten.ok) return toast(daten.error);

  const { kopf } = daten;
  const auswahl = (name, liste, wert) => {
    if (nur && nur !== name) return [];
    const sortiert = nachInteresse(liste, wert, vonGefolgten);
    return nur ? sortiert : sortiert.slice(0, EXP_VORSCHAU[name]);
  };
  const reels = auswahl('reels', daten.reels, (v) => v.likes);
  const clips = auswahl('clips', daten.clips, (c) => c.views);
  const beitraege = auswahl('beitraege', daten.beitraege, (p) => p.likes);

  const abschnitt = (name, inhalt) =>
    !inhalt
      ? ''
      : nur
        ? inhalt
        : `<button class="exp__head exp__head--knopf" data-expnur="${name}">${EXP_NAME[name]} →</button>${inhalt}`;

  const reelsReihe = reels.length
    ? `<div class="expreels">${reels
        .map(
          (v) => `<button class="expreel" data-openvideo="${v.id}">
            ${medienFlaeche(v.id, ICONS.play, v.mediaUrl, v.thumbnail)}
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
            <div class="clip__thumb">${medienFlaeche(c.id, ICONS.landscape, c.mediaUrl, c.thumbnail)}<span class="clip__time">${esc(c.duration)}</span></div>
            <div class="clip__meta">
              <div class="avatar avatar--36" style="background:${farbe(u.color)}">${esc(u.initials)}</div>
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
        .map((p) => `<button class="griditem" data-openpost="${p.id}">${medienFlaeche(p.id, ICONS.image, p.mediaUrl, p.thumbnail)}</button>`)
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
      ${/*
          Henrik am 21.09.2026: "Standorte brauchen eine funktionierende Karte
          mit Sprung in eine Kartenansicht - wie bei der Friend-Map." Vorher
          ein gezeichnetes Raster mit einer Nadel an einer Prozentstelle.
        */ ''}
      ${koordinatenLesen(kopf.koordinaten)
        ? `<div class="minikarte minikarte--echt">
             <div class="minikarte__flaeche" id="expKarte"></div>
             <button class="minikarte__voll" id="expKarteVoll" aria-label="Karte groß anzeigen">${ICONS.ausklappen}</button>
           </div>`
        : ''}
      <button class="exp__link" id="expFotos">Alle Fotos ansehen →</button>`,

    sound: () => `<div class="soundcover">${
        kopf.cover ? `<img src="${esc(kopf.cover)}" alt="Songbild ${esc(kopf.titel)}">` : ICONS.music
      }</div>
      <div class="exp__titel exp__titel--mitte">${esc(kopf.titel)}</div>
      <div class="exp__interpret">${esc(kopf.produzent)}</div>
      ${kopf.songwriter ? `<div class="exp__zahl exp__zahl--mitte">Songwriter: ${esc(kopf.songwriter)}</div>` : ''}
      <div class="exp__zahl exp__zahl--mitte">${compactNumber(kopf.anzahl)} Beiträge</div>
      ${kopf.audio ? `<audio id="soundTon" src="${esc(kopf.audio)}" preload="metadata"></audio>` : ''}
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
      ${/*
          Henrik am 21.09.2026: nur die Zeile, die gerade gesungen wird. Die
          naechste steht blass darunter. Gefuellt wird beides beim Abspielen.
        */ ''}
      ${
        kopf.lyrics?.some((z) => z.trim())
          ? `<div class="lyrics lyrics--jetzt">
               <div class="lyrics__kopf">Liedtext</div>
               <div class="lyrics__jetzt" id="lyricsJetzt" aria-live="polite"></div>
               <div class="lyrics__danach" id="lyricsDanach"></div>
             </div>`
          : `<div class="lyrics lyrics--ohne">Zu diesem Sound gibt es keinen Liedtext.</div>`
      }`,
  }[kopf.art]();

  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="page">
      <div class="page__bar">
        <button class="seitenbtn" id="expBack" aria-label="Zurück">${ICONS.back}</button>
        ${nur ? `<div class="page__title">${esc(kopf.titel)} · ${EXP_NAME[nur]}</div>` : ''}
      </div>
      <div class="scroll">
        ${nur ? '' : `<div class="exp__kopf exp__kopf--${kopf.art}">${kopfHtml}</div>`}
        ${
          reels.length || clips.length || beitraege.length
            ? abschnitt('reels', reelsReihe) + abschnitt('clips', clipListe) + abschnitt('beitraege', beitragRaster)
            : `<div class="empty">${ICONS.search}
                 <div class="empty__title">Noch nichts hier</div>
                 <div class="empty__text">Zu ${esc(kopf.titel)} gibt es bisher keine Beiträge.</div>
               </div>`
        }
      </div>
    </div>`;

  const soundTon = overlay.querySelector('#soundTon');
  overlay.querySelector('#expBack').addEventListener('click', () => {
    soundTon?.pause();
    // Aus einem aufgeklappten Abschnitt eine Ebene zurueck, nicht ganz raus.
    if (nur) return openExplorer(art, wert);
    overlay.hidden = true;
    overlay.innerHTML = '';
  });
  overlay.querySelectorAll('[data-expnur]').forEach((b) =>
    b.addEventListener('click', () => openExplorer(art, wert, b.dataset.expnur))
  );

  // Die Karte am Ort - dieselben Kacheln wie die Friend-Map.
  const hier = koordinatenLesen(kopf.koordinaten);
  const kartenFlaeche = overlay.querySelector('#expKarte');
  if (hier && kartenFlaeche && window.L) {
    const stil = KARTEN_STILE[0];
    const karte = L.map(kartenFlaeche, { zoomControl: false, attributionControl: false }).setView([hier.lat, hier.lng], 14);
    L.tileLayer(stil.url, { maxZoom: stil.maxZoom }).addTo(karte);
    L.circleMarker([hier.lat, hier.lng], {
      radius: 10, fillColor: '#ff3b30', color: '#fff', weight: 2.5, fillOpacity: 1, className: 'map__pin is-aktiv',
    }).addTo(karte);
    overlay.querySelector('#expKarteVoll')?.addEventListener('click', () => openOrtKarte(kopf, hier));
  }

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

  /*
   * Wellenform und Liedzeile laufen mit, solange abgespielt wird. Mit
   * Hoerprobe (Schema 54) gibt das <audio> den Takt vor, sonst wie bisher
   * eine Uhr. Die Zeilen verteilen sich gleichmaessig ueber die Laenge -
   * Zeitstempel je Zeile gibt es im Liedtext nicht.
   */
  const play = overlay.querySelector('#soundPlay');
  if (play) {
    const [min, sek] = String(kopf.dauer).split(':').map(Number);
    const dauer = min * 60 + sek || 180;
    const zeilen = (kopf.lyrics || []).filter((z) => z.trim());
    let bei = 0;
    let uhr = null;
    const zeit = (x) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;

    const zeichnen = () => {
      const gesamt = soundTon && soundTon.duration > 0 ? soundTon.duration : dauer;
      const jetzt = soundTon ? soundTon.currentTime : bei;
      const zeitFeld = overlay.querySelector('#welleZeit');
      if (!zeitFeld) return;
      zeitFeld.textContent = `${zeit(jetzt)} / ${soundTon ? zeit(gesamt) : kopf.dauer}`;
      const balken = overlay.querySelectorAll('#welleBalken i');
      const bis = Math.round((jetzt / gesamt) * balken.length);
      balken.forEach((b, i) => b.classList.toggle('is-gespielt', i < bis));
      if (zeilen.length) {
        const nr = Math.min(zeilen.length - 1, Math.floor((jetzt / gesamt) * zeilen.length));
        overlay.querySelector('#lyricsJetzt').textContent = zeilen[nr];
        overlay.querySelector('#lyricsDanach').textContent = zeilen[nr + 1] || '';
      }
    };
    zeichnen();

    if (soundTon) {
      soundTon.addEventListener('timeupdate', zeichnen);
      soundTon.addEventListener('loadedmetadata', zeichnen);
      soundTon.addEventListener('play', () => (play.innerHTML = ICONS.pause));
      soundTon.addEventListener('pause', () => (play.innerHTML = ICONS.play));
      soundTon.addEventListener('ended', () => (play.innerHTML = ICONS.play));
      play.addEventListener('click', () => {
        if (!soundTon.paused) return soundTon.pause();
        if (soundTon.ended) soundTon.currentTime = 0;
        soundTon.play().catch(() => toast('Abspielen ging nicht'));
      });
    } else {
      play.addEventListener('click', () => {
        if (uhr) {
          clearInterval(uhr);
          uhr = null;
          play.innerHTML = ICONS.play;
          return;
        }
        play.innerHTML = ICONS.pause;
        uhr = setInterval(() => {
          if (!overlay.querySelector('#welleZeit')) return clearInterval(uhr);
          bei = (bei + 1) % (dauer + 1);
          zeichnen();
        }, 1000);
      });
    }
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
/**
 * Über welchen der beiden Bereiche diese Person erreicht wird.
 *
 * Bis zum 18.09.2026 entschied das allein der Bereich, in dem man gerade
 * stand. Wer einen Beitrag aus den Videos an jemanden schickte, mit dem er
 * nur in einer Community zu tun hat, bekam dadurch einen zweiten, leeren
 * Chat in der anderen Liste.
 *
 * Der Prototyp-Frame „Nutzer B + Beitrag teilen" zeigt es anders: jede Person
 * im Raster trägt ihr eigenes Abzeichen. Also entscheidet die Person, nicht
 * der Bildschirm. Gleiche Regel in app/App.tsx (bereichFuer).
 *
 * Seit dem 24.09.2026 zählt der Bereich gar nicht mehr (Feedback 21.09.,
 * Kasten 3): der Rückfall auf 'messenger' außerhalb der Communitys hat jeden,
 * der aus Videos teilte, in fremde Messenger-Listen geschrieben. In den
 * Messenger kommt nur, wer Kontakt ist — per Nummer oder über eine
 * angenommene Messenger-Anfrage. Alle anderen lernt man unter Communitys
 * kennen. Dieselbe Regel steht in Schema 57.
 */
function bereichFuer(uid) {
  if ((state.chats || []).some((c) => !c.isGroup && c.userId === uid)) return 'messenger';
  if ((state.contacts || []).some((c) => c.id === uid)) return 'messenger';
  return 'community';
}

function openTeilen(art, id) {
  const kontakte = state.contacts.map((c) => c.id).filter((cid) => state.users[cid]);
  const uebrige = Object.keys(state.users).filter((uid) => uid !== 'me' && !kontakte.includes(uid));
  const kachel = (uid) => {
    const u = user(uid);
    const bereich = bereichFuer(uid);
    return `<li>
      <button class="teilen__kachel" data-teilen="${uid}" data-bereich="${bereich}">
        <span class="teilen__bild">
          <span class="avatar avatar--52" style="background:${farbe(u.color)}">${esc(u.initials)}</span>
          <span class="teilen__marke teilen__marke--${bereich}">${
            bereich === 'community' ? ICONS.people : ICONS.chat
          }</span>
        </span>
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

          /*
           * Der Bereich steht schon an der Kachel — dieselbe Angabe, die das
           * Abzeichen darauf zeichnet. Sonst könnten Anzeige und Wirkung
           * auseinanderlaufen: das Symbol sagt Messenger, geschrieben wird in
           * die Community.
           */
          const bereich = b.dataset.bereich || 'messenger';

          const res = await fetch('/api/teilen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ art, id, empfaenger: [b.dataset.teilen], bereich }),
          });
          const daten = await res.json();
          if (!daten.ok) return toast(daten.error);

          // In die Liste, in die wirklich geschrieben wurde — der Server sagt,
          // welche das war.
          if (daten.bereich === 'community') state.communityChats = daten.chats;
          else state.chats = daten.chats;
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
function medienFlaeche(id, symbol, adresse, standbild) {
  /*
   * Vierter Fall, seit es echte Videos gibt: in `adresse` steht bei einem
   * Reel oder Clip jetzt eine .mp4. Die in ein <img> zu stecken ergibt ein
   * kaputtes Bild — dafuer gibt es das Standbild aus der Datenbank
   * (thumbnail_url). Fehlt auch das, bleibt die Farbflaeche.
   */
  const bild = eigeneMedien()[id] || (istVideoAdresse(adresse) ? standbild : adresse) || standbild;
  if (bild && !istVideoAdresse(bild)) return `<img class="eigenbild" src="${esc(bild)}" alt="">`;
  return `<span class="motiv motiv--${motivVon(id)}">${symbol}</span>`;
}

/** Adressen, die abgespielt und nicht angezeigt werden wollen. */
function istVideoAdresse(adresse) {
  return !!adresse && /\.(mp4|mov|m4v|webm)(\?.*)?$/i.test(adresse);
}

/*
 * Ein echtes Videoelement. `controls` bleibt aus: die App hat ihre eigene
 * Leiste, zwei uebereinander sehen nach Fehler aus. `playsinline` ist auf dem
 * iPhone Pflicht — ohne das reisst Safari jedes Video ins Vollbild, sobald
 * man auf Wiedergabe drueckt.
 */
function videoElement(kennung, adresse, standbild, zusatz = '') {
  return `<video id="${kennung}" class="medienvideo" src="${esc(adresse)}"` +
    (standbild ? ` poster="${esc(standbild)}"` : '') +
    ` playsinline preload="metadata" ${zusatz}></video>`;
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
/**
 * Aus der Wahl im Formular ein Datum machen — oder null für sofort.
 *
 * Liegt „Heute Abend" schon hinter uns, wird daraus der nächste Abend. Ohne
 * diese Prüfung wäre der geplante Zeitpunkt in der Vergangenheit und der
 * Beitrag erschiene sofort — das Gegenteil dessen, was gewählt wurde.
 * Gleiche Regel wie in app/App.tsx.
 */
function geplantAb(wahl) {
  if (!wahl || wahl === 'Sofort') return null;
  const wann = new Date();

  if (wahl === 'In einer Stunde') {
    wann.setHours(wann.getHours() + 1);
    return wann.toISOString();
  }
  if (wahl === 'Heute Abend') {
    wann.setHours(19, 0, 0, 0);
    if (wann <= new Date()) wann.setDate(wann.getDate() + 1);
    return wann.toISOString();
  }
  // Morgen früh
  wann.setDate(wann.getDate() + 1);
  wann.setHours(8, 0, 0, 0);
  return wann.toISOString();
}

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

  /*
   * Umfragen. Das Handbuch nennt sie an drei Stellen — bei Beiträgen, bei
   * Storys und in Community-Kanälen —, in App und Website gab es sie bis zum
   * 01.09.2026 an keiner.
   *
   * Eine Umfrage ist hier ein Beitrag ohne Bild, an dem eine Umfrage hängt.
   * Das ist bewusst so: sonst bräuchte sie einen eigenen Platz im Feed, eine
   * eigene Kachel im Profil und eine eigene Zeile in der Suche.
   */
  if (was === 'umfrage') {
    return openFormular(
      'Neue Umfrage',
      [
        { key: 'frage', label: 'Deine Frage', typ: 'mehrzeilig', pflicht: true },
        { key: 'a1', label: 'Antwort 1', pflicht: true },
        { key: 'a2', label: 'Antwort 2', pflicht: true },
        { key: 'a3', label: 'Antwort 3 (freiwillig)' },
        { key: 'a4', label: 'Antwort 4 (freiwillig)' },
        {
          key: 'ende',
          label: 'Läuft',
          typ: 'auswahl',
          auswahl: ['Ohne Ende', '24 Stunden', '3 Tage', '7 Tage'],
          wert: 'Ohne Ende',
        },
      ],
      async ({ frage, a1, a2, a3, a4, ende }) => {
        const stunden = { 'Ohne Ende': 0, '24 Stunden': 24, '3 Tage': 72, '7 Tage': 168 }[ende] || 0;

        const beitrag = await api('/api/eigene/beitrag', { beschreibung: frage, ort: '' });
        if (!beitrag?.ok) return beitrag?.error || 'Der Beitrag ging nicht durch';

        const id = beitrag.beitrag?.id;
        const umfrage = await api(`/api/umfragen/post/${id}`, {
          frage,
          antworten: [a1, a2, a3, a4].filter(Boolean),
          endetNachStunden: stunden || undefined,
        });
        if (!umfrage?.ok) return umfrage?.error || 'Die Umfrage ging nicht durch';

        state.area = 'videos';
        state.sub.videos = 'home';
        await bootstrap();
        toast('Umfrage veröffentlicht');
      },
      'Veröffentlichen'
    );
  }

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
      /*
       * „Später posten" aus dem Handbuch: ein vorab eingestellter Beitrag
       * wird zum geplanten Zeitpunkt hochgeladen. In der Datenbank ist das
       * `posts.publish_at`; ein Beitrag mit einem Zeitpunkt in der Zukunft
       * ist angelegt, aber noch nicht sichtbar.
       */
      {
        key: 'zeitpunkt',
        label: 'Veröffentlichen',
        typ: 'auswahl',
        auswahl: ['Sofort', 'In einer Stunde', 'Heute Abend', 'Morgen früh'],
        wert: 'Sofort',
      },
    ],
    async (werte) => {
      const spaeter = geplantAb(werte.zeitpunkt);
      const ziel = istBild ? '/api/eigene/beitrag' : '/api/eigene/video';
      const res = await fetch(ziel, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...werte, geplantAb: spaeter, format: quer ? 'quer' : 'hoch' }),
      });
      const daten = await res.json();
      if (!daten.ok) return daten.error;

      /*
       * Geplante Beiträge kommen nicht in den Feed. Sie dort schon zu zeigen
       * wäre die naheliegende Abkürzung und genau falsch: man sähe einen
       * Beitrag, den außer einem selbst niemand hat.
       */
      if (spaeter) {
        toast(`Geplant für ${(werte.zeitpunkt || 'später').toLowerCase()}`);
        return;
      }

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
      ${/*
          Die Live-Kommentarspalte aus dem Handbuch. Sie steht über der
          Leiste und nicht in einem Blatt: während einer Sendung ist sie das
          Gegenüber, und etwas, das man erst aufklappen muss, liest niemand.

          Damit Kommentare und Spenden irgendwo hingehören können, wird der
          Stream beim Start als Beitrag angelegt und nicht erst am Ende.
        */ ''}
      <div class="live__spalte" id="liveSpalte">
        <p class="live__leer">Kommentarspalte wird geöffnet …</p>
      </div>
      <div class="live__eingabe">
        <input id="liveText" placeholder="Etwas sagen …" disabled>
        <button id="liveSenden" disabled aria-label="Senden">${ICONS.send}</button>
      </div>
      <div class="live__leiste">
        <div class="live__zuschauer" id="liveZuschauer">0 Zuschauer</div>
        <div class="live__spenden" id="liveSpenden" hidden></div>
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

  /*
   * Der Beitrag zum laufenden Stream. Erst mit ihm gibt es etwas, worauf
   * sich Kommentare und Spenden beziehen können; vorher gab es während der
   * Sendung nichts dergleichen, obwohl der Spendencode in den Einstellungen
   * genau dafür da ist.
   *
   * Scheitert das Anlegen, läuft der Stream trotzdem — nur ohne Spalte. Das
   * ist schlechter, aber kein Grund, gar nicht erst zu senden.
   */
  let streamId = null;
  let spaltenUhr = null;

  api('/api/stream/start', {})
    .then((antwort) => {
      if (!antwort?.ok || !antwort.id) {
        const leer = overlay.querySelector('.live__leer');
        if (leer) leer.textContent = 'Die Kommentarspalte konnte nicht geöffnet werden.';
        return;
      }
      streamId = antwort.id;

      const feld = overlay.querySelector('#liveText');
      const knopf = overlay.querySelector('#liveSenden');
      if (feld) feld.disabled = false;
      if (knopf) knopf.disabled = false;

      /*
       * Alle vier Sekunden nachladen. Ein Live-Abo wäre schöner, bräuchte
       * aber eine eigene Verbindung, die beim Verlassen sauber zugehen muss
       * — bei einer Kommentarspalte fällt der Unterschied nicht auf.
       */
      const holen = async () => {
        const spalte = overlay.querySelector('#liveSpalte');
        if (!spalte) return clearInterval(spaltenUhr);
        try {
          const res = await fetch(`/api/stream/${streamId}/kommentare`);
          if (!res.ok) return;
          const daten = await res.json();
          const zeilen = daten.kommentare || [];
          spalte.innerHTML = zeilen.length
            ? zeilen
                .slice(-30)
                .map(
                  (k) => `<p class="live__kommentar"><b>${esc(k.name)}</b> ${esc(k.text)}</p>`
                )
                .join('')
            : '<p class="live__leer">Noch keine Kommentare.</p>';
          spalte.scrollTop = spalte.scrollHeight;
        } catch (fehler) {
          console.error('Streamkommentare laden fehlgeschlagen:', fehler);
        }
      };

      holen();
      spaltenUhr = setInterval(holen, 4000);

      const senden = async () => {
        const text = feld.value.trim();
        if (!text) return;
        feld.value = '';
        const antwortK = await api(`/api/stream/${streamId}/kommentare`, { text });
        if (!antwortK?.ok) return toast(antwortK?.error || 'Der Kommentar ging nicht durch');
        holen();
      };

      knopf?.addEventListener('click', senden);
      feld?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') senden();
      });
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
    if (spaltenUhr) clearInterval(spaltenUhr);
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
    if (spaltenUhr) clearInterval(spaltenUhr);
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
/*
 * Was an Sammlungen schon geladen ist, nach Profil abgelegt.
 *
 * Die Reihe wird mitten im Zusammenbauen einer Seite als Zeichenkette
 * erzeugt und kann nicht warten. Sie zeichnet deshalb erst aus dem, was da
 * ist, und `ladeSammlungen` ersetzt sie, sobald die Antwort eintrifft.
 */
const SAMMLUNGEN = new Map();

/*
 * Zaehler gegen verspaetete Antworten.
 *
 * `ladeSammlungen` schickt seine Abfrage los und traegt das Ergebnis ein,
 * wenn es eintrifft. Wird in der Zwischenzeit eine Sammlung geloescht, kaeme
 * die ALTE Liste danach an, legte sich in den Zwischenspeicher und malte den
 * geloeschten Kreis zurueck — Datenbank sauber, Bildschirm falsch, und zwar
 * bleibend, bis jemand die Seite neu laedt.
 *
 * Vorsorge, kein beobachteter Fehler: der Lauf vom 20.09.2026 hat dieses
 * Rennen nie gewonnen. Es ist nur nicht ausgeschlossen, und der Preis dafuer
 * sind drei Zeilen. Wer etwas an den Sammlungen aendert, zaehlt hoch; eine
 * Antwort von vorher wird dann weggeworfen.
 */
let sammlungenLauf = 0;

function sammlungenReihe(userId, playlists, highlights) {
  /*
   * Die Namenslisten aus `profiles` sind nur noch die Rueckfalltuer. Kommt
   * die Abfrage nicht durch, steht die Reihe trotzdem da — ohne Bild und
   * ohne `id`, und ein Klick sagt dann, dass es gerade nicht geht. Frueher
   * war das der Normalfall: es gab nur Namen.
   */
  const geladen = SAMMLUNGEN.get(String(userId));
  const eintraege = geladen || [
    ...(playlists || []).map((name) => ({ art: 'playlist', name, id: '', bild: null })),
    ...(highlights || []).map((name) => ({ art: 'highlight', name, id: '', bild: null })),
  ];
  /*
   * Auch leer bleibt die Huelle stehen — sonst haette `ladeSammlungen`
   * nachher keine Stelle, an die es die echten Kreise haengen koennte, und
   * ein Profil mit Sammlungen, aber ohne alte Namen, bliebe fuer immer ohne
   * Reihe. `hidden` haelt sie solange aus dem Bild.
   */
  if (!eintraege.length) {
    return `<div class="highlights" data-sammlungen-von="${esc(userId)}" hidden></div>`;
  }

  return `<div class="highlights" data-sammlungen-von="${esc(userId)}">${eintraege
    .map(({ art, name, id, bild }) => {
      const symbol = art === 'playlist' ? ICONS.play : ICONS.image;
      return `<button class="highlight" data-sammlung="${art}" data-sammlung-name="${esc(name)}" data-sammlung-user="${esc(userId)}" data-sammlung-id="${esc(id || '')}">
        <span class="highlight__ring is-${art}">${medienFlaeche(art.slice(0, 2) + '-' + name, symbol, null, bild || null)}</span>
        <span class="highlight__label">${esc(name)}</span>
      </button>`;
    })
    .join('')}</div>`;
}

/*
 * Die echten Sammlungen nachladen und die Reihe austauschen.
 *
 * Getauscht wird nur, wenn die Reihe noch steht und noch zu demselben Profil
 * gehoert — sonst schriebe eine spaet eintreffende Antwort ihre Kreise in ein
 * inzwischen anderes Profil.
 */
async function ladeSammlungen(userId, wurzel = main) {
  const lauf = sammlungenLauf;
  const frage = userId === 'me' ? '' : `&user=${encodeURIComponent(userId)}`;
  let liste;
  try {
    const [pl, hl] = await Promise.all([
      fetch(`/api/sammlungen?art=playlist${frage}`).then((r) => r.json()),
      fetch(`/api/sammlungen?art=highlight${frage}`).then((r) => r.json()),
    ]);
    if (!Array.isArray(pl) || !Array.isArray(hl)) return;
    liste = [...pl, ...hl];
  } catch {
    return; // Die Rueckfalltuer steht schon auf dem Bildschirm.
  }

  // Inzwischen wurde etwas geloescht - diese Antwort ist von vorher.
  if (lauf !== sammlungenLauf) return;

  SAMMLUNGEN.set(String(userId), liste);

  const reihe = wurzel.querySelector(`[data-sammlungen-von="${CSS.escape(String(userId))}"]`);
  if (!reihe) return;
  reihe.outerHTML = sammlungenReihe(userId, [], []);
  bindSammlungen(wurzel);
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
        id: b.dataset.sammlungId || '',
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
 * BIS ZUM 20.09.2026 STAND HIER EINE ERFUNDENE LISTE:
 *
 *     const liste = quelle.filter((_, i) => i % 2 === (name.length % 2));
 *
 * Jede zweite Kachel aus dem allgemeinen Bestand, ausgewaehlt nach der
 * Laenge des Namens. Der Kommentar daneben gab das offen zu ("es gibt im
 * Prototyp keine echte Zuordnung"), aber auf dem Bildschirm war davon
 * nichts zu sehen: die Seite zeigte fremde Beitraege als Inhalt einer
 * eigenen Playlist. Seit Schema 46 gibt es die Zuordnung, und hier steht
 * jetzt, was wirklich darin liegt — im Zweifel nichts.
 */
async function renderSammlung() {
  const { art, name, userId, id } = state.sammlung;
  const istPlaylist = art === 'playlist';

  let liste = [];
  if (id) {
    try {
      const daten = await fetch(`/api/sammlung/${encodeURIComponent(id)}`).then((r) => r.json());
      if (Array.isArray(daten)) liste = daten;
    } catch {
      toast('Die Sammlung ließ sich nicht laden');
    }
  }

  main.innerHTML = `
    <div class="pagehead">
      <div class="pagehead__row">
        <button class="iconbtn" id="sammlungBack" aria-label="Zurück zum Profil">${ICONS.back}</button>
        <h2 class="pagehead__title">${esc(name)}</h2>
        ${
          // Loeschen nur im EIGENEN Profil und nur, wenn die Sammlung eine
          // echte Zeile ist. Ohne id stammt der Kreis aus der alten
          // Namensliste — da gaebe es nichts zu loeschen.
          userId === 'me' && id
            ? `<button class="iconbtn" id="sammlungLoeschen" aria-label="${esc(name)} löschen">${ICONS.trash}</button>`
            : ''
        }
      </div>
      <div class="pagehead__sub">${istPlaylist ? 'Playlist' : 'Highlight'} · ${liste.length} ${
        liste.length === 1 ? 'Beitrag' : 'Beiträge'
      }</div>
    </div>
    <div class="scroll">
      ${
        liste.length
          ? `<div class="exp__grid">${liste
              .map(({ art: gattung, eintrag: e }) => {
                // Wohin die Kachel fuehrt, entscheidet der Eintrag, nicht die
                // Gattung der Sammlung: in einer Playlist liegen Beitraege,
                // Videos und Clips nebeneinander.
                const ziel =
                  gattung === 'story' ? 'openstory' : gattung === 'post' ? 'openpost' : 'openvideo';
                const symbol = gattung === 'post' ? ICONS.image : ICONS.portrait;
                return `<button class="griditem" data-${ziel}="${esc(e.id)}">${medienFlaeche(
                  e.id,
                  symbol,
                  e.mediaUrl,
                  e.thumbnail
                )}</button>`;
              })
              .join('')}</div>`
          : `<div class="empty">${istPlaylist ? ICONS.play : ICONS.image}
              <div class="empty__title">Noch nichts drin</div>
              <div class="empty__text">${
                id
                  ? istPlaylist
                    ? 'Über das Drei-Punkte-Menü an einem eigenen Beitrag legst du ihn hier hinein.'
                    : 'Über das Drei-Punkte-Menü an einer eigenen Story legst du sie hier hinein.'
                  : 'Diese Sammlung lässt sich gerade nicht öffnen — bitte die Seite neu laden.'
              }</div>
            </div>`
      }
    </div>`;

  $('#sammlungBack').addEventListener('click', () => {
    const zurueck = state.sammlung.userId;
    state.sammlung = null;
    if (zurueck === 'me') render();
    else openProfile(zurueck);
  });

  $('#sammlungLoeschen')?.addEventListener('click', async () => {
    /*
     * Die Rueckfrage sagt ausdruecklich, was NICHT passiert. Sonst klickt
     * niemand sie weg, der seine Beitraege behalten will — und wer sie
     * wegklickt, hat womoeglich etwas anderes erwartet.
     */
    const ja = await bestaetigen(
      `„${name}" löschen?`,
      istPlaylist
        ? 'Die Playlist verschwindet. Die Beiträge darin bleiben erhalten — nur die Zuordnung geht weg.'
        : 'Das Highlight verschwindet. Die Storys darin bleiben erhalten — nur die Zuordnung geht weg.',
      'Löschen'
    );
    if (!ja) return;

    const antwort = await fetch(
      `/api/eigene/sammlung/${art}/${encodeURIComponent(name)}`,
      { method: 'DELETE' }
    )
      .then((r) => r.json())
      .catch(() => ({ ok: false, error: 'Das Löschen kam nicht durch' }));

    if (!antwort.ok) return toast(antwort.error || 'Das ließ sich nicht löschen');

    /*
     * Den Zwischenspeicher leeren, sonst baut sammlungenReihe() den
     * geloeschten Kreis aus dem alten Stand wieder auf — und er liesse sich
     * sogar noch anklicken.
     */
    sammlungenLauf += 1;
    SAMMLUNGEN.delete('me');
    SAMMLUNGEN.delete(String(state.currentUserId || ''));

    // Die Namenslisten muessen nicht von Hand nachgezogen werden: das eigene
    // Profil holt sich `me` bei jedem Aufbau frisch vom Server.
    state.sammlung = null;
    toast(`„${name}" ist gelöscht`);
    render();
  });
  main.querySelectorAll('[data-openvideo]').forEach((b) =>
    b.addEventListener('click', () => openVideo(b.dataset.openvideo))
  );
  main.querySelectorAll('[data-openpost]').forEach((b) =>
    b.addEventListener('click', () => openPost(b.dataset.openpost))
  );
  main.querySelectorAll('[data-openstory]').forEach((b) =>
    b.addEventListener('click', () => openStory(b.dataset.openstory))
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

  // Derselbe Weg fuer "Markiert". Der Reiter war bei jedem leer, weil es
  // Markierungen gar nicht gab.
  const meineMarkierungen = tab === 'tagged' ? await (await fetch('/api/markierungen')).json() : [];

  // Und die gespeicherten. Der Reiter stand seit jeher in PROFILE_TABS und
  // hatte nie eine Quelle — er zeigte immer „Noch nichts hier", auch bei
  // gefuellter Merkliste. Gleiche Regel in VideoProfileScreen.tsx.
  const meineGespeicherten = tab === 'saved' ? await (await fetch('/api/gespeichert')).json() : [];

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
                }">${medienFlaeche(g.id, g.kind === 'video' ? ICONS.play : ICONS.image, g.mediaUrl, g.thumbnail)}</button>`
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
          : tab === 'tagged' && meineMarkierungen.length
          ? `<div class="prof__grid">${meineMarkierungen
              .map(
                (m) => `<div class="griditem" title="${esc(m.eintrag.description || '')}">
                  ${medienFlaeche(m.eintrag.id, m.art === 'post' ? ICONS.image : ICONS.play, m.eintrag.mediaUrl, m.eintrag.thumbnail)}
                  <span class="griditem__badge">${ICONS.person}</span>
                </div>`
              )
              .join('')}</div>`
          : tab === 'saved' && meineGespeicherten.length
          ? /*
             * Kein Abzeichen auf der Kachel: hier ist ohnehin alles
             * gespeichert. Bei Repost und Markierung sagt das Zeichen, warum
             * ein fremder Beitrag im eigenen Profil steht — hier waere es
             * Rauschen.
             */
            `<div class="prof__grid">${meineGespeicherten
              .map(
                (g) => `<button class="griditem" data-openpost="${esc(g.eintrag.id)}" title="${esc(g.eintrag.description || '')}">
                  ${medienFlaeche(g.eintrag.id, g.art === 'post' ? ICONS.image : ICONS.play, g.eintrag.mediaUrl, g.eintrag.thumbnail)}
                </button>`
              )
              .join('')}</div>`
          : `<div class="empty">${ICONS[PROFILE_TABS.find((t) => t.id === tab).icon]}
              <div class="empty__title">${
                tab === 'repost'
                  ? 'Noch nichts repostet'
                  : tab === 'tagged'
                    ? 'Keine Markierungen'
                    : tab === 'saved'
                      ? 'Noch nichts gespeichert'
                      : 'Noch nichts hier'
              }</div>
              <div class="empty__text">${
                tab === 'repost'
                  ? 'Tippe im Feed auf den Repost-Knopf, dann erscheint es hier.'
                  : tab === 'tagged'
                    ? 'Wer dich mit @ in einer Beschreibung nennt, markiert dich — dann steht der Beitrag hier.'
                    : tab === 'saved'
                      ? 'Tippe unter einem Beitrag auf das Lesezeichen, dann liegt er hier.'
                      : 'Dieser Bereich füllt sich, sobald du ihn benutzt.'
              }</div>
            </div>`
      }
    </div>`;

  $('#switchProfile').addEventListener('click', openKontoWechsel);
  $('#profilBearbeiten')?.addEventListener('click', () => openProfilBearbeiten(renderVideoProfile));
  bindSammlungen();
  void ladeSammlungen("me");
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
  const alle = vorschauenOeffnen(state.communityChats || []);

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
  /*
   * "Erstellt" heisst: von mir angelegt. Hier stand bis zum 02.09.2026
   * `visibility === 'private' && joined` — dieselbe falsche Weiche wie in der
   * App. `c.eigen` kommt aus `communities.created_by`.
   */
  const created = state.communities.filter((c) => c.eigen);
  const joined = state.communities.filter((c) => c.joined && !c.eigen);

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
  /*
   * "Erstellt" heisst: von mir angelegt. Hier stand bis zum 02.09.2026
   * `visibility === 'private' && joined` — dieselbe falsche Weiche wie in der
   * App. `c.eigen` kommt aus `communities.created_by`.
   */
  const created = state.communities.filter((c) => c.eigen);
  const joined = state.communities.filter((c) => c.joined && !c.eigen);
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
          const verlauf = await nachrichtenHolen(chatId);
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
/*
 * Die drei Zustände einer Chat-Anfrage.
 *
 * Bis zum 03.09.2026 gab es nur einen: „Deine Anfrage läuft noch", mit einem
 * Knopf „Annahme simulieren" daneben — im Chat des Absenders. Wer
 * angeschrieben wurde, sah davon nichts und hatte keine Wahl. Dieselben drei
 * Fälle zeichnet die App in ChatDetailScreen.
 */
function anfrageLeiste(chat) {
  /*
   * Der vierte Fall, und der einzige, der nichts mit einer Anfrage zu tun
   * hat: die Person empfängt gar keine Nachrichten (Sichtbarkeitsbereich
   * `dm`, Schema 22). Er steht zuerst, weil er die anderen überholt — über
   * eine Anfrage entscheidet niemand mehr, dem man nicht schreiben darf.
   */
  if (chat.dmGesperrt) {
    return `<div class="anfrage">
      <div class="anfrage__text">
        ${esc(chat.name)} empfängt keine Nachrichten. Was hier steht, bleibt
        lesbar — schreiben kannst du nicht mehr.
      </div>
    </div>`;
  }
  if (chat.requestState === 'pending') {
    return `<div class="anfrage">
      <div class="anfrage__text">
        Deine Anfrage läuft noch. Weitere Nachrichten sind möglich,
        sobald ${esc(chat.name)} sie angenommen hat.
      </div>
    </div>`;
  }
  if (chat.requestState === 'declined') {
    return `<div class="anfrage">
      <div class="anfrage__text">
        ${esc(chat.name)} hat deine Anfrage abgelehnt. In diesem Chat kannst du
        nicht mehr schreiben.
      </div>
    </div>`;
  }
  if (chat.requestState === 'incoming') {
    return `<div class="anfrage">
      <div class="anfrage__text">
        ${esc(chat.name)} möchte dir schreiben. Bis du entscheidest, bleibt es
        bei dieser einen Nachricht.
      </div>
      <div class="anfrage__knoepfe">
        <button class="anfrage__btn" data-anfrage="ja">Annehmen</button>
        <button class="anfrage__btn anfrage__btn--aus" data-anfrage="nein">Ablehnen</button>
      </div>
    </div>`;
  }
  return '';
}

/*
 * Die Messenger-Anfrage aus einem Community-Chat (Feedback 21.09., Kasten 3).
 *
 * Fragen lässt sich erst, wenn beide hier geschrieben haben — „nach etwas
 * Austausch". Dieselbe Bedingung prüft Schema 57; hier steht sie nur, damit
 * kein Knopf erscheint, der dann abgewiesen wird. Gleiche Leiste in
 * app/screens/messenger/ChatDetailScreen.tsx.
 */
function messengerLeiste(chat) {
  if (chat.dmGesperrt || chat.isGroup || !chat.userId) return '';
  const zustand = chat.messengerAnfrage || 'keine';
  const imCommunityChat = (state.communityChats || []).some((c) => c.id === chat.id);

  if (zustand === 'keine') {
    const ausgetauscht =
      (state.messages || []).some((m) => m.from === 'me') &&
      (state.messages || []).some((m) => m.from === chat.userId);
    if (!imCommunityChat || bereichFuer(chat.userId) !== 'community' || !ausgetauscht) return '';
    return `<div class="anfrage">
      <div class="anfrage__text">
        Ihr schreibt euch unter Communitys. Möchtest du ${esc(chat.name)} fragen,
        ob ihr in den Messenger wechselt?
      </div>
      <div class="anfrage__knoepfe">
        <button class="anfrage__btn" data-messenger="fragen">Messenger-Anfrage senden</button>
      </div>
    </div>`;
  }
  if (zustand === 'gesendet') {
    return `<div class="anfrage">
      <div class="anfrage__text">
        Deine Messenger-Anfrage an ${esc(chat.name)} läuft. Bis zur Antwort
        schreibt ihr hier weiter.
      </div>
    </div>`;
  }
  if (zustand === 'eingegangen') {
    return `<div class="anfrage">
      <div class="anfrage__text">
        ${esc(chat.name)} möchte mit dir in den Messenger wechseln. Lehnst du ab,
        bleibt alles hier unter Communitys.
      </div>
      <div class="anfrage__knoepfe">
        <button class="anfrage__btn" data-messenger="ja">Annehmen</button>
        <button class="anfrage__btn anfrage__btn--aus" data-messenger="nein">Ablehnen</button>
      </div>
    </div>`;
  }
  if (zustand === 'abgelehnt') {
    return `<div class="anfrage">
      <div class="anfrage__text">
        ${esc(chat.name)} bleibt lieber hier unter Communitys. Schreiben könnt
        ihr weiter wie bisher.
      </div>
    </div>`;
  }
  return `<div class="anfrage">
    <div class="anfrage__text">Ihr seid jetzt auch im Messenger verbunden.</div>
    <div class="anfrage__knoepfe">
      <button class="anfrage__btn" data-messenger="oeffnen">Zum Messenger</button>
    </div>
  </div>`;
}

/*
 * Fragen und antworten. Bis zum 24.09.2026 legte „Über Messenger chatten
 * anfragen" den Messenger-Chat sofort an — die andere Person fand den
 * Fragenden in ihrem Messenger, bevor sie etwas entschieden hatte. Jetzt
 * bleibt bis zur Antwort alles im Community-Chat. Gleicher Ablauf in
 * app/App.tsx (messengerAnfragen, messengerAntworten).
 */
async function messengerAnfragen(chat) {
  const res = await fetch(`/api/chats/${chat.id}/messenger-anfrage`, { method: 'POST' })
    .then((r) => r.json())
    .catch(() => ({ ok: false, error: 'Das hat gerade nicht geklappt' }));
  if (!res.ok) return toast(res.error || 'Das hat gerade nicht geklappt');
  await bootstrap();
  toast(`Messenger-Anfrage an ${chat.name} gesendet`);
  if ($('#messages')) openChat(chat.id);
}

async function messengerAntworten(chat, annehmen) {
  const res = await fetch(`/api/chats/${chat.id}/messenger-antwort`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ annehmen }),
  })
    .then((r) => r.json())
    .catch(() => ({ ok: false, error: 'Das hat gerade nicht geklappt' }));
  if (!res.ok) return toast(res.error || 'Das hat gerade nicht geklappt');
  await bootstrap();
  toast(annehmen ? `${chat.name} ist jetzt in deinem Messenger` : 'Ihr schreibt weiter unter Communitys');
  openChat(chat.id);
}

/** Aus dem Community-Chat zum Messenger-Chat derselben Person. */
function zumMessenger(userId) {
  const chat = (state.chats || []).find((c) => !c.isGroup && c.userId === userId);
  if (chat) {
    state.area = 'messenger';
    return openChat(chat.id);
  }
  toast('Der Messenger-Chat ist noch nicht geladen');
}

/*
 * Eine EINGEGANGENE Anfrage sperrt das Feld nicht: zurückschreiben ist
 * erlaubt und nimmt sie damit an. Gesperrt ist nur, wer wartet oder
 * abgelehnt wurde.
 */
function chatGesperrt(chat) {
  return (
    chat.requestState === 'pending' ||
    chat.requestState === 'declined' ||
    chat.dmGesperrt === true
  );
}

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

  /*
   * Der Anfragezustand aus dem letzten Laden kann alt sein: hat das
   * Gegenueber inzwischen geantwortet, sperrte das Eingabefeld sonst weiter
   * (24.09.2026). Gleiches in der App (ladeChatZustand).
   */
  const [verlauf, zustand] = await Promise.all([
    nachrichtenHolen(chatId),
    chat.isGroup
      ? null
      : fetch(`/api/chats/${chatId}/zustand`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
  ]);
  state.messages = verlauf;
  if (zustand?.ok) {
    chat.requestState = zustand.requestState;
    chat.messengerAnfrage = zustand.messengerAnfrage;
  }

  if (chat.unread) {
    chat.unread = 0;
    fetch(`/api/chats/${chatId}/read`, { method: 'POST' });
  }

  /*
   * "Nachrichten senden deaktivieren" — Sichtbarkeitsbereich `dm`.
   *
   * Ein Chat, der schon steht, bleibt in der Liste; die Einstellung kann
   * jederzeit nachträglich gesetzt werden. Ohne diese Frage stünde ein
   * offenes Eingabefeld da, und erst das Senden liefe in eine Ablehnung aus
   * der Datenbank. Gleicher Aufbau in der App (ChatDetailScreen).
   *
   * In Gruppen und Kanälen gilt die Einstellung nicht — dasselbe wie in
   * `darf_schreiben()`.
   */
  chat.dmGesperrt = false;
  if (chat.userId && !chat.isGroup) {
    try {
      const r = await fetch(`/api/dm-erlaubt/${encodeURIComponent(chat.userId)}`);
      chat.dmGesperrt = (await r.json()).erlaubt === false;
    } catch {
      /* Im Zweifel offen lassen: die Datenbank weist ohnehin ab. */
    }
  }

  overlay.hidden = false;
  overlay.innerHTML = `
    <header class="chathead">
      <button class="chathead__back" id="chatBack" aria-label="Zurück">${ICONS.back}</button>
      ${avatarOf(chat, 36)}
      <div class="chathead__body" ${chat.userId ? `data-profile="${chat.userId}"` : ''} style="${chat.userId ? 'cursor:pointer' : ''}">
        <div class="chathead__name">${esc(chat.name)}</div>
        <div class="chathead__status ${chat.isGroup ? 'is-off' : ''}" id="chatStatus">${
          chat.isGroup ? `${((chat.members || []).length + 1).toLocaleString('de-DE')} Mitglieder` : ''
        }</div>
      </div>
      <div class="chathead__actions">
        <button data-call="video" aria-label="Videoanruf">${ICONS.video}</button>
        <button data-call="audio" aria-label="Anruf">${ICONS.phone}</button>
      </div>
    </header>
    <div class="messages" id="messages"></div>
    ${anfrageLeiste(chat)}
    ${messengerLeiste(chat)}
    <form class="composer" id="composer">
      <button type="button" class="composer__icon" id="attach" aria-label="Anhang">${ICONS.plus}</button>
      <div class="composer__field">
        <textarea id="msgInput" rows="1" placeholder="${
          chat.dmGesperrt
            ? 'Empfängt keine Nachrichten'
            : chat.requestState === 'pending'
              ? 'Warten auf Annahme …'
              : chat.requestState === 'declined'
                ? 'Anfrage abgelehnt'
                : 'Nachricht'
        }" autocomplete="off" ${chatGesperrt(chat) ? 'disabled' : ''}></textarea>
        <button type="button" class="composer__icon" id="camBtn" aria-label="Kamera">${ICONS.camera}</button>
      </div>
      <button type="submit" class="composer__send" id="sendBtn" aria-label="Senden" disabled>${ICONS.send}</button>
    </form>`;

  paintMessages(chat);

  // "Online" stand hier bis zum 03.09.2026 fest im Markup. Jetzt wird der
  // wirkliche Stand nachgetragen — und bleibt leer, wenn die Person ihn
  // verbirgt.
  if (!chat.isGroup) praesenzEintragen(chat.userId, $('#chatStatus'));

  $('#chatBack').addEventListener('click', closeChat);
  const profileBtn = overlay.querySelector('[data-profile]');
  if (profileBtn) {
    profileBtn.addEventListener('click', () => {
      state.openChatSettingsId = chat.id;
      render();
    });
  }
  /*
   * Annehmen und Ablehnen — beides nur für die angeschriebene Person, und
   * beides über dieselbe Route. Vorher stand hier ein Knopf „Annahme
   * simulieren" im Chat des ABSENDERS.
   */
  overlay.querySelectorAll('[data-messenger]').forEach((b) =>
    b.addEventListener('click', () => {
      const was = b.dataset.messenger;
      if (was === 'fragen') return messengerAnfragen(chat);
      if (was === 'oeffnen') return zumMessenger(chat.userId);
      return messengerAntworten(chat, was === 'ja');
    })
  );
  overlay.querySelectorAll('[data-anfrage]').forEach((b) =>
    b.addEventListener('click', async () => {
      const annehmen = b.dataset.anfrage === 'ja';
      const res = await fetch(`/api/chats/${chat.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ annehmen }),
      });
      const result = await res.json();
      if (!result.ok) return toast(result.error);

      const neu = annehmen ? 'accepted' : 'declined';
      chat.requestState = neu;
      const inState = state.chats.find((c) => c.id === chat.id);
      if (inState) inState.requestState = neu;
      if (annehmen) {
        const kontakt = state.contacts.find((c) => c.id === chat.userId);
        if (kontakt) { kontakt.status = 'friend'; kontakt.about = 'Kontakt'; }
      }

      toast(annehmen ? 'Anfrage angenommen' : 'Anfrage abgelehnt');
      openChat(chat.id);
    })
  );
  overlay.querySelectorAll('[data-call]').forEach((b) =>
    b.addEventListener('click', () =>
      openCall(chat.userId || chat, b.dataset.call === 'video' ? 'video' : 'audio')
    )
  );
  $('#attach').addEventListener('click', () => openAnhang(zielChat(chat), chat));
  // Aus dem Chat heraus steht das Ziel fest: die Aufnahme geht hierher.
  $('#camBtn').addEventListener('click', () => openCamera(chat));

  const input = $('#msgInput');
  const sendBtn = $('#sendBtn');
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 108) + 'px';
    sendBtn.disabled = !input.value.trim();
  });
  // Nur wenn "Mit Enter senden" an ist — siehe SCHALTER_STANDARD.
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && schalterAn('entersenden')) {
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

/*
 * Die Trennzeile ueber dem Verlauf sagte immer "Heute" — auch wenn darunter
 * jede Nachricht "Gestern" trug. Sie nimmt jetzt die Zeitangabe der ersten
 * Nachricht: eine Uhrzeit (14:32) heisst heute, alles andere steht selbst da
 * ("Gestern", "Mo", "12.08."). Gleiche Regel in der App, siehe
 * app/screens/messenger/ChatDetailScreen.tsx.
 */
function tagTrenner(nachrichten) {
  const erste = nachrichten[0];
  if (!erste || !erste.time) return 'Heute';
  return /^\d{1,2}:\d{2}$/.test(erste.time.trim()) ? 'Heute' : erste.time;
}

function paintMessages(chat) {
  const box = $('#messages');
  box.innerHTML =
    `<div class="daydivider">${esc(tagTrenner(state.messages))}</div>` +
    state.messages.map((m) => messageBubble(m, chat)).join('');
  box.scrollTop = box.scrollHeight;

  // Angehaengter Kontakt fuehrt zu seinem Profil, ein Standort zu der
  // Standort-Seite - sonst waeren beide Karten nur Bilder.
  // Lange druecken markiert eine Nachricht mit einem Stern - so fuellt sich
  // "Mit Stern markiert" in der Kontaktinfo wirklich.
  box.querySelectorAll('[data-msgid]').forEach((el) => {
    let halten;
    /*
     * Bis zum 01.09.2026 setzte langes Drücken nur einen Stern. Jetzt steht
     * dahinter das ganze Menü aus dem Handbuch — der Stern ist einer von
     * sechs Punkten.
     */
    const start = () => {
      halten = setTimeout(() => {
        const m = state.messages.find((x) => x.id === el.dataset.msgid);
        if (m) openNachrichtMenue(m, chat);
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

  // Anhang antippen → Vollformat (Henrik 7.9.).
  box.querySelectorAll('[data-voll]').forEach((b) =>
    b.addEventListener('click', () => oeffneVollformat(b.dataset.voll))
  );
}

/*
 * Das Vollformat (Henrik 07.09.2026: „antippen → Vollformat").
 *
 * Bewusst kein neuer Bildschirm, sondern eine Schicht darueber: der Chat
 * bleibt stehen, Schliessen fuehrt an dieselbe Stelle im Verlauf zurueck.
 * Ein Video bekommt hier `controls` — anders als in der Blase, wo es nur
 * Standbild ist. Gleiches Verhalten in der App (`vollbild` in
 * app/screens/messenger/ChatDetailScreen.tsx).
 */
function oeffneVollformat(adresse) {
  if (!adresse) return;
  const schicht = document.createElement('div');
  schicht.className = 'vollformat';
  schicht.innerHTML =
    (istVideoAdresse(adresse)
      ? `<video src="${esc(adresse)}" controls autoplay playsinline loop></video>`
      : `<img src="${esc(adresse)}" alt="">`) +
    `<button class="vollformat__zu" aria-label="Schließen">${ICONS.close}</button>`;

  const zu = () => {
    document.removeEventListener('keydown', taste);
    schicht.remove();
  };
  const taste = (e) => {
    if (e.key === 'Escape') zu();
  };
  // Auch der Grund neben dem Bild schliesst — sonst sucht man den Knopf.
  schicht.addEventListener('click', (e) => {
    if (e.target === schicht || e.target.closest('.vollformat__zu')) zu();
  });
  document.addEventListener('keydown', taste);
  document.body.appendChild(schicht);
}

/**
 * Der Inhalt einer Blase: Anhang, sonst Text.
 *
 * Bis zum 04.09.2026 stand das ausschliesslich in messageBubble(). Seit die
 * Unterthemen dieselben Anhaenge annehmen (Schema 25), braucht die Blase im
 * Kanal genau dasselbe — und eine zweite Abschrift haette bedeutet, dass ein
 * Sticker im Chat ohne Rahmen steht und im Kanal in einer Blase.
 *
 * Die Reihenfolge ist nicht beliebig: der Text ist der letzte Ausweg. Bei
 * einem Sticker IST der Text das Zeichen, bei einer Datei der Dateiname —
 * stuende er zusaetzlich da, saehe man ihn doppelt.
 */
function anhangInhalt(m) {
  // Ein selbst geschicktes Foto liegt im Browser, nicht auf dem Server.
  const eigenesBild = eigeneMedien()[m.id];
  /*
   * Henrik 07.09.2026: „Medien im Chat nur als Icon statt Vorschau in echter
   * Groesse; antippen → Vollformat."
   *
   * Bild UND Video werden hier gleich behandelt: beide stehen in der Groesse
   * da, in der sie geschickt wurden, und beide oeffnen beim Klick das
   * Vollformat (`oeffneVollformat`). Ein Video zeigt vorher sein Standbild
   * mit einem Wiedergabezeichen darauf — es soll nicht schon in der Blase
   * loslaufen. Gleiche Regel in der App (renderMessage in
   * app/screens/messenger/ChatDetailScreen.tsx).
   */
  const anhang = eigenesBild || (m.media !== 'audio' && m.media !== 'file' ? m.mediaUrl : '');
  const media = anhang
    ? istVideoAdresse(anhang)
      ? `<button class="msg__anhang" data-voll="${esc(anhang)}">
           <video class="msg__bild" src="${esc(anhang)}" muted playsinline preload="metadata"></video>
           <span class="msg__anhangPlay">${ICONS.play}</span>
         </button>`
      : `<button class="msg__anhang" data-voll="${esc(anhang)}">
           <img class="msg__bild" src="${esc(anhang)}" alt="Anhang">
         </button>`
    : m.media === 'image'
    ? `<div class="msg__media">${ICONS.image} Foto</div>`
    : m.media === 'video'
    ? `<div class="msg__media">${ICONS.video} Video</div>`
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
         <span class="avatar avatar--44" style="background:${farbe(user(m.kontakt.id).color)}">${esc(user(m.kontakt.id).initials)}</span>
         <span class="msg__kontaktText">
           <strong>${esc(m.kontakt.name)}</strong>
           <span>${esc(m.kontakt.handle)}</span>
         </span>
       </button>`
    : '';

  const datei = m.datei
    ? `<div class="msg__datei">
         <span class="msg__dateiSymbol">${ICONS.document}</span>
         <span class="msg__dateiText">
           <strong>${esc(m.datei.name)}</strong>
           <span>${groesseText(m.datei.groesse)}</span>
         </span>
       </div>`
    : '';

  const sticker = m.media === 'sticker' ? `<span class="msg__sticker">${esc(m.text)}</span>` : '';
  // Ein Gif mit Adresse ist ein Anhang wie jeder andere und steht oben schon
  // als Vorschau; ohne Adresse bleibt es bei der Zeile.
  const gif = m.media === 'gif' && !anhang ? `<div class="msg__media">${ICONS.film} Gif</div>` : '';

  return sticker || datei || gif || standort || kontakt || media || esc(m.text);
}

function messageBubble(m, chat) {
  const out = m.from === 'me';

  /*
   * Henrik 07.09.2026: „Anrufe sollen als Chatnachricht protokolliert werden
   * (wie WhatsApp)."
   *
   * Der Eintrag ist keine Blase, sondern eine Zeile in der Mitte. Eine
   * Sprechblase wuerde behaupten, jemand haette etwas geschrieben — der Anruf
   * hat aber keinen Text. Gleiche Darstellung in der App (renderMessage in
   * app/screens/messenger/ChatDetailScreen.tsx).
   */
  if (m.anruf) {
    const verpasst = m.anruf.status !== 'beendet';
    const ausgang =
      verpasst
        ? m.anruf.status === 'abgelehnt'
          ? ' · abgelehnt'
          : ' · verpasst'
        : ` · ${dauerText(m.anruf.dauer)}`;
    return `<div class="msg__anruf${verpasst ? ' msg__anruf--verpasst' : ''}">
              ${m.anruf.art === 'video' ? ICONS.video : ICONS.phone}
              <span>${out ? 'Ausgehender ' : ''}${
      m.anruf.art === 'video' ? 'Videoanruf' : 'Anruf'
    }${ausgang} · ${esc(m.time || '')}</span>
            </div>`;
  }

  /*
   * Die Nachrichten-Werkzeuge aus dem Handbuch (01.09.2026).
   *
   * Antwort und Zitat sehen verschieden aus, weil sie verschiedenes sind:
   * die Antwort zeigt nur den Bezug (schmaler Balken, eine Zeile), das Zitat
   * nimmt den Text mit und bleibt lesbar, auch wenn das Original
   * zurückgenommen wird.
   */
  const antwortAuf = m.antwortAuf
    ? `<div class="msg__bezug">
         <span class="msg__bezugBalken"></span>
         <span class="msg__bezugText">
           <b>${esc(m.antwortAuf.autor)}</b>
           <span>${esc(m.antwortAuf.text || 'Zurückgenommen')}</span>
         </span>
       </div>`
    : '';

  const zitat = m.zitat
    ? `<div class="msg__zitat">
         <b>${esc(m.zitat.autor)} schrieb:</b>
         <span>„${esc(m.zitat.text)}"</span>
       </div>`
    : '';

  // Ohne diese Zeile sähe eine weitergeleitete Nachricht aus wie eine selbst
  // geschriebene.
  const weiter = m.weitergeleitetVon
    ? `<div class="msg__weiter">${ICONS.weiterleiten} Weitergeleitet von ${esc(m.weitergeleitetVon)}</div>`
    : '';

  // Reaktionen hängen unten an der Blase, nicht darin — sonst wären sie Teil
  // des Textes.
  const zaehler = {};
  for (const r of m.reaktionen || []) zaehler[r.emoji] = (zaehler[r.emoji] || 0) + 1;
  const reaktionen = Object.keys(zaehler).length
    ? `<div class="msg__reaktionen">${Object.entries(zaehler)
        .map(([e, n]) => `<span class="msg__reaktion">${e}${n > 1 ? `<b>${n}</b>` : ''}</span>`)
        .join('')}</div>`
    : '';

  /*
   * Zurückgenommen: die Zeile bleibt stehen. Sie verschwinden zu lassen wäre
   * bequemer, aber dann verlören Antworten und Zitate ihren Bezug — und die
   * Gegenseite fragte sich, ob sie sich das Gelesene eingebildet hat.
   */
  /*
   * Der Bezug auf eine Story — ein Herz darauf oder eine Antwort (Henrik
   * 18.09., Schema 41). Vorher stand hier nur `m.replyToStory`, eine Zeile
   * Text, die der Server nie gesetzt hat: toter Zweig.
   *
   * Die Vorschau steht ueber dem Text und nicht an seiner Stelle. Sonst
   * verschwaende bei einer Story-Antwort genau das, was geschrieben wurde,
   * und beim Herz das Emoji. Gleiche Regel in ChatDetailScreen.tsx.
   */
  const storyBezug = m.story
    ? `<div class="msg__story">
         ${
           m.story.mediaUri && !istVideoAdresse(m.story.mediaUri)
             ? `<img class="msg__bild" src="${esc(m.story.mediaUri)}" alt="">`
             : m.story.mediaUri
             ? `<video class="msg__bild" src="${esc(
                 m.story.mediaUri
               )}" muted playsinline preload="metadata"></video>`
             : `<span class="msg__geteiltBild">${ICONS.image}</span>`
         }
         <span class="msg__storyMarke">Story</span>
       </div>`
    : '';

  const inhalt = m.zurueckgenommen
    ? '<span class="msg__zurueck">Diese Nachricht wurde zurückgenommen</span>'
    : m.geteilt
    ? /*
       * Ein geteilter Beitrag (Henrik 7.9.). Vorher: eine Zeile mit einem
       * grauen 42px-Kaestchen davor, nicht zu oeffnen — ein weitergeleitetes
       * Video war im Chat also nur sein Titel. Jetzt steht der Beitrag selbst
       * da und geht beim Klick ins Vollformat. Gleiche Regel in der App.
       */
      `<button class="msg__geteilt" ${
        m.geteilt.bild ? `data-voll="${esc(m.geteilt.bild)}"` : ''
      }>
         ${
           m.geteilt.bild && !istVideoAdresse(m.geteilt.bild)
             ? `<img class="msg__bild" src="${esc(m.geteilt.bild)}" alt="">`
             : m.geteilt.bild
             ? `<span class="msg__anhang"><video class="msg__bild" src="${esc(
                 m.geteilt.bild
               )}" muted playsinline preload="metadata"></video><span class="msg__anhangPlay">${
                 ICONS.play
               }</span></span>`
             : `<span class="msg__geteiltBild">${
                 m.geteilt.art === 'video' ? ICONS.play : ICONS.image
               }</span>`
         }
         <span class="msg__geteiltZeile">
           ${m.geteilt.art === 'video' ? ICONS.play : ICONS.image}
           <span class="msg__geteiltText">
             <strong>${esc(m.geteilt.autor)}</strong>
             <span>${esc(m.geteilt.titel)}</span>
           </span>
         </span>
       </button>`
    : anhangInhalt(m);

  return `
    <div class="msg msg--${out ? 'out' : 'in'}${m.media === 'sticker' ? ' msg--sticker' : ''}" data-msgid="${esc(m.id)}">
      ${!out && chat.isGroup ? `<div class="msg__sender">${esc(user(m.from).name)}</div>` : ''}
      ${weiter}${antwortAuf}${zitat}
      ${storyBezug}${inhalt}
      <div class="msg__foot">${m.stern ? `<span class="msg__stern">${ICONS.star}</span>` : ''}${
        m.bearbeitet && !m.zurueckgenommen ? 'bearbeitet · ' : ''
      }${esc(m.time)}${out ? (m.read ? ICONS.checkDouble : ICONS.check) : ''}</div>
      ${reaktionen}
    </div>`;
}

/**
 * Dateigröße in etwas, das man lesen kann.
 *
 * Null Bytes heißt nicht „leere Datei", sondern „die Größe kam nicht mit".
 * Dann lieber nichts behaupten als „0 B" hinschreiben.
 */
function groesseText(bytes) {
  if (!bytes) return 'Datei';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}


/* ==========================================================================
 * Was man mit einer einzelnen Nachricht machen kann.
 *
 * Das Handbuch listet unter „Nachrichten/Chats → Features": bearbeiten,
 * antworten, zitieren, weiterleiten, Gifs, Sprachnachricht-Geschwindigkeit
 * und Kontakte teilen. Bis zum 01.09.2026 konnte der Chat davon keinen
 * einzigen — langes Drücken setzte einen Stern, und das war alles.
 *
 * Das Gegenstück in der App: app/components/NachrichtSheet.tsx.
 * ========================================================================== */

/** Worauf sich die nächste Nachricht bezieht, bzw. welche bearbeitet wird. */
let msgBezug = null;
let msgBearbeitet = null;

function openNachrichtMenue(m, chat) {
  const eigene = m.from === 'me';
  const meine = (m.reaktionen || []).find((r) => r.userId === 'me')?.emoji || null;

  const punkte = [
    { key: 'antworten', label: 'Antworten', icon: 'antwort' },
    { key: 'zitieren', label: 'Zitieren', icon: 'zitat' },
    { key: 'weiterleiten', label: 'Weiterleiten', icon: 'weiterleiten' },
    ...(eigene ? [{ key: 'bearbeiten', label: 'Bearbeiten', icon: 'bearbeiten' }] : []),
    { key: 'markieren', label: m.stern ? 'Markierung entfernen' : 'Mit Stern markieren', icon: 'star' },
    ...(eigene ? [{ key: 'zuruecknehmen', label: 'Zurücknehmen', icon: 'trash', gefahr: true }] : []),
  ];

  openSheet(
    'Nachricht',
    `<div class="sheet__body">
       <div class="msgmenue__emojis">
         ${REAKTIONEN.map(
           (e) => `<button class="msgmenue__emoji${meine === e ? ' is-active' : ''}" data-reaktion="${e}">${e}</button>`
         ).join('')}
       </div>
       ${punkte
         .map(
           (p) => `<button class="item${p.gefahr ? ' item--danger' : ''}" data-msgaktion="${p.key}">
             <span class="item__icon">${ICONS[p.icon]}</span>
             <span class="item__label">${esc(p.label)}</span>
           </button>`
         )
         .join('')}
     </div>`,
    (sheet, close) => {
      sheet.querySelectorAll('[data-reaktion]').forEach((b) =>
        b.addEventListener('click', async () => {
          close();
          const antwort = await api(`/api/messages/${chat.id}/${m.id}/reaktion`, {
            emoji: b.dataset.reaktion,
          });
          if (!antwort?.ok) return toast(antwort?.error || 'Die Reaktion ging nicht durch');

          // Eine Person hat je Nachricht genau eine Reaktion: die alte wird
          // ersetzt, dasselbe Emoji noch einmal nimmt sie weg.
          const ohneMich = (m.reaktionen || []).filter((r) => r.userId !== 'me');
          m.reaktionen = antwort.emoji ? [...ohneMich, { userId: 'me', emoji: antwort.emoji }] : ohneMich;
          paintMessages(chat);
        })
      );

      sheet.querySelectorAll('[data-msgaktion]').forEach((b) =>
        b.addEventListener('click', async () => {
          const was = b.dataset.msgaktion;
          close();

          if (was === 'antworten' || was === 'zitieren') {
            msgBezug = { art: was === 'zitieren' ? 'zitat' : 'antwort', nachricht: m };
            msgBearbeitet = null;
            return zeigeBezugLeiste(chat);
          }

          if (was === 'bearbeiten') {
            msgBearbeitet = m;
            msgBezug = null;
            const feld = $('#msgInput');
            if (feld) {
              feld.value = m.text;
              feld.focus();
              $('#sendBtn').disabled = false;
            }
            return zeigeBezugLeiste(chat);
          }

          if (was === 'weiterleiten') return openWeiterleiten(m, chat);

          if (was === 'markieren') {
            const res = await fetch(`/api/messages/${chat.id}/${m.id}/stern`, { method: 'POST' });
            const daten = await res.json();
            if (!daten.ok) return toast(daten.error);
            m.stern = daten.stern;
            paintMessages(chat);
            return toast(daten.stern ? 'Nachricht markiert' : 'Markierung entfernt');
          }

          if (was === 'zuruecknehmen') {
            const antwort = await api(`/api/messages/${chat.id}/${m.id}/zuruecknehmen`, {});
            if (!antwort?.ok) return toast(antwort?.error || 'Das hat nicht geklappt');
            m.zurueckgenommen = true;
            m.text = '';
            paintMessages(chat);
          }
        })
      );
    },
    { schliessen: true }
  );
}

/**
 * Die Zeile über der Eingabe: worauf sich die nächste Nachricht bezieht.
 *
 * Ohne sie tippt man in eine Eingabe, die sich unsichtbar anders verhält als
 * sonst — der Sendeknopf überschreibt plötzlich statt zu senden.
 */
function zeigeBezugLeiste(chat) {
  const alt = document.querySelector('.msgbezug');
  if (alt) alt.remove();
  if (!msgBezug && !msgBearbeitet) return;

  const quelle = msgBearbeitet || msgBezug.nachricht;
  const titel = msgBearbeitet
    ? 'Nachricht bearbeiten'
    : msgBezug.art === 'zitat'
    ? 'Zitieren'
    : 'Antworten';

  const leiste = document.createElement('div');
  leiste.className = 'msgbezug';
  leiste.innerHTML = `
    <span class="msgbezug__balken"></span>
    <span class="msgbezug__text"><b>${esc(titel)}</b><span>${esc(quelle.text || 'Anhang')}</span></span>
    <button class="msgbezug__zu" aria-label="Abbrechen">${ICONS.close}</button>`;

  const composer = document.querySelector('.composer');
  if (composer) composer.parentNode.insertBefore(leiste, composer);

  leiste.querySelector('.msgbezug__zu').addEventListener('click', () => {
    if (msgBearbeitet) {
      const feld = $('#msgInput');
      if (feld) feld.value = '';
    }
    msgBezug = null;
    msgBearbeitet = null;
    leiste.remove();
  });
}

/**
 * Eine Nachricht in andere Chats weiterleiten.
 *
 * Gewählt werden Chats, nicht Personen: eine Gruppe ist ein gültiges Ziel,
 * und an sie ließe sich über eine Personenliste gar nicht weiterleiten.
 * Mehrere auf einmal, weil Weiterleiten fast immer heißt: dasselbe an zwei
 * oder drei Stellen.
 */
function openWeiterleiten(m, chat) {
  const ziele = state.chats.filter((c) => c.id !== chat.id);
  if (!ziele.length) return toast('Es gibt keinen anderen Chat, in den das gehen könnte');

  const gewaehlt = new Set();

  openSheet(
    'Weiterleiten',
    `<div class="sheet__body">
       ${ziele
         .map(
           (c) => `<button class="insight__person" data-ziel="${c.id}">
             ${avatarOf(c, 38)}
             <span class="insight__personText"><span class="insight__personName">${esc(c.name)}</span></span>
             <span class="insight__haken">${ICONS.check}</span>
           </button>`
         )
         .join('')}
       <button class="btn btn--breit" id="wlSenden" disabled>Wähle mindestens einen Chat</button>
     </div>`,
    (sheet, close) => {
      const knopf = sheet.querySelector('#wlSenden');
      const stand = () => {
        knopf.disabled = gewaehlt.size === 0;
        knopf.textContent = gewaehlt.size
          ? `An ${gewaehlt.size} ${gewaehlt.size === 1 ? 'Chat' : 'Chats'} weiterleiten`
          : 'Wähle mindestens einen Chat';
      };

      sheet.querySelectorAll('[data-ziel]').forEach((b) =>
        b.addEventListener('click', () => {
          const id = b.dataset.ziel;
          if (gewaehlt.has(id)) gewaehlt.delete(id);
          else gewaehlt.add(id);
          b.classList.toggle('is-active', gewaehlt.has(id));
          stand();
        })
      );

      knopf.addEventListener('click', async () => {
        const antwort = await api(`/api/messages/${chat.id}/${m.id}/weiterleiten`, {
          chatIds: [...gewaehlt],
        });
        close();
        if (!antwort?.ok) return toast(antwort?.error || 'Das Weiterleiten hat nicht geklappt');
        toast(`An ${antwort.anzahl} ${antwort.anzahl === 1 ? 'Chat' : 'Chats'} weitergeleitet`);
      });
    },
    { hoch: true, schliessen: true }
  );
}

async function sendMessage(chat) {
  const input = $('#msgInput');
  const text = input.value.trim();
  if (!text) return;

  nachrichtTon();

  input.value = '';
  input.style.height = 'auto';
  $('#sendBtn').disabled = true;

  /*
   * Bearbeiten läuft über denselben Knopf wie Senden.
   *
   * Ein eigener „Speichern"-Knopf wäre ein zweiter Zustand der Eingabezeile,
   * den man erst begreifen muss. Solange oben „Nachricht bearbeiten" steht,
   * überschreibt der Sendeknopf — das ist die naheliegende Erwartung.
   */
  if (msgBearbeitet) {
    const alt = msgBearbeitet;
    msgBearbeitet = null;
    document.querySelector('.msgbezug')?.remove();

    const antwort = await api(`/api/messages/${chat.id}/${alt.id}/bearbeiten`, { text });
    if (!antwort?.ok) return toast(antwort?.error || 'Das Bearbeiten hat nicht geklappt');

    const m = state.messages.find((x) => x.id === alt.id);
    if (m) {
      m.text = text;
      m.bearbeitet = true;
    }
    paintMessages(chat);
    return;
  }

  const bezug = msgBezug;
  msgBezug = null;
  document.querySelector('.msgbezug')?.remove();

  const res = await fetch(`/api/messages/${chat.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(
      await sendeKoerper(chat.id, text, {
        antwortAuf: bezug?.art === 'antwort' ? bezug.nachricht.id : null,
        zitatVon: bezug?.art === 'zitat' ? bezug.nachricht.id : null,
      })
    ),
  });
  const msg = await res.json();

  /*
   * Der Server schickt bei einer verschluesselten Nachricht keinen Text
   * zurueck — er hat ihn nie gehabt. Ohne diese Zeile erschiene die eigene
   * Nachricht als leere Blase und waere erst nach dem naechsten Laden da.
   */
  if (Number(msg.krypto) > 0) msg.text = text;

  // Bezug gleich mitzeichnen, statt auf das nächste Laden zu warten — sonst
  // erschiene die eigene Antwort einen Moment lang ohne ihren Anlass.
  if (bezug) {
    const kopf = {
      id: bezug.nachricht.id,
      text: bezug.nachricht.text,
      autor: bezug.nachricht.from === 'me' ? 'Du' : user(bezug.nachricht.from).name,
    };
    if (bezug.art === 'antwort') msg.antwortAuf = kopf;
    else msg.zitat = kopf;
  }

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
  // `zeit` ist der Anlagezeitpunkt aus der Datenbank. Bis zum 09.09.2026
  // stand hier `aufgenommen` — ein Feld, das nur die im Browser gespeicherte
  // eigene Story hatte; fuer alle anderen Storys stand dauerhaft "vor 2 Std."
  const wann = s.aufgenommen || (s.zeit ? Date.parse(s.zeit) : NaN);
  if (!wann || Number.isNaN(wann)) return s.time || 'vor 2 Std.';
  const min = Math.floor((Date.now() - wann) / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  return `vor ${Math.floor(min / 60)} Std.`;
}

let storyTimer;
const STORY_DURATION = 6000;
const STORY_STEP = 60;

function openStory(storyId) {
  // Die eigene Story ist nur dabei, wenn wirklich etwas aufgenommen wurde.
  const list = alleStorys().filter((s) => !s.own || s.mediaUri);
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
        <div class="avatar avatar--36" style="background:${farbe(u.color)}" data-profile="${u.id}">${esc(u.initials)}</div>
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
    $('#storyDelete').addEventListener('click', async () => {
      stop();
      closeOverlay();
      await storyLoeschen(s.id);
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
function openCamera(zielChat = null, { zielStory = false } = {}) {
  overlay.hidden = false;
  overlay.innerHTML = `
    <div class="camera">
      <div class="camera__top">
        <button id="camClose" aria-label="Schließen">${ICONS.close}</button>
        <button id="camFlash" aria-label="Blitz">${ICONS.flash}</button>
      </div>
      ${kameraBuehne()}
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

  /** Aufnahme fertig: entweder ans genannte Ziel oder zur Wahl. */
  const aufnahmeFertig = async (bild) => {
    // Kam die Kamera vom Plus an der eigenen Story, steht das Ziel fest.
    if (zielStory) {
      closeOverlay();
      return alsStorySetzen(bild);
    }
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

  // Blitz, Kameraseite, Betriebsart und Ausloeser kommen aus demselben
  // Laufwerk wie auf der Kameraseite - eine Bedienung, zwei Orte.
  kameraLaufwerk(overlay.querySelector('.camera'), (bild) => aufnahmeFertig(bild));
  // Aus der Galerie statt aus der Kamera - dieselbe Aufnahme, nur ohne
  // capture-Kennzeichen, damit das Handy den Bildordner oeffnet.
  $('#camGallery').addEventListener('click', async () => {
    const bild = await aufnahmeHolen('photo', true);
    if (!bild) return;
    aufnahmeFertig(bild);
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
