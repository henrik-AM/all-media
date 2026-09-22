/**
 * All Media — Lesezugriffe auf Supabase
 *
 * Das ist die einzige Stelle, an der die Website Inhalte herholt. Es gibt
 * keine Beispieldaten mehr, aus denen sie ersatzweise lesen könnte: was hier
 * nicht ankommt, steht auch nicht in der Datenbank.
 *
 * Die App hat ihre eigene Fassung in app/lib/daten.ts. Beide fragen dasselbe
 * ab und formen es gleich um — app/test/gleichstand.mjs vergleicht das
 * Ergebnis beider Seiten gegeneinander und schlägt an, wenn sie auseinander
 * laufen.
 *
 * Die Spaltennamen folgen SUPABASE_SCHEMA.sql bis SUPABASE_SCHEMA_6. Sie frei
 * zu erfinden führt dazu, dass jede Abfrage still fehlschlägt — genau das war
 * der Grund, warum die Anbindung monatelang nur so aussah, als liefe sie.
 */

// ============================================================================
// Umformung: Datenbankzeile → Form, die die Oberfläche erwartet
// ============================================================================

/*
 * Die Spaltenlisten stehen in ../../gemeinsam/spalten.js — einmal fuer
 * Website und App. Vorher standen sie hier und in app/lib/daten.ts doppelt;
 * genau dabei sind `is_locked` und `notifications_off` hier verloren
 * gegangen. Warum `phone` nicht dabei ist, steht in der gemeinsamen Datei.
 */
const {
  PROFIL_SPALTEN,
  BEITRAG_SPALTEN,
  CHATMITGLIED_SPALTEN,
  NACHRICHT_SPALTEN,
} = require('../../gemeinsam/spalten');

/*
 * Die Reihenfolge des Feeds — ebenfalls einmal fuer Website und App. Die
 * Punkte rechnet `feed_rang()` (Schema 51), aus Punkten eine Reihenfolge zu
 * machen steht in ../../gemeinsam/rang.js.
 */
const { neulingsliste, ordnenJeArt, punktekarte } = require('../../gemeinsam/rang');

/*
 * "spende" und "live" stehen als JSON in einer Textspalte — so schreibt es
 * sync-handlers.js. Beim Lesen muss daraus wieder ein Objekt werden, sonst
 * greift die Oberflaeche auf spende.titel eines Strings zu und zeigt nichts.
 *
 * Ein kaputter Eintrag darf nicht die ganze Seite mitnehmen: dann lieber
 * nichts als ein Absturz beim Aufbau des Profils.
 */
function jsonOderNull(wert) {
  if (!wert) return null;
  if (typeof wert === 'object') return wert;
  try {
    return JSON.parse(wert);
  } catch {
    return null;
  }
}

function profilZuNutzer(zeile) {
  if (!zeile) return null;
  return {
    id: zeile.id,
    name: zeile.name,
    handle: zeile.handle,
    initials: zeile.initials || '',
    color: zeile.color || '',
    // phone wird nachtraeglich aus meine_kontaktnummern() ergaenzt (Fund 1).
    phone: zeile.phone || '',
    privat: Boolean(zeile.privat),
    about: zeile.about || '',
    bio: zeile.bio || '',
    link: zeile.link || '',
    status: zeile.status || 'offline',
    highlights: zeile.highlights || [],
    playlists: zeile.playlists || [],
    spende: jsonOderNull(zeile.spende),
    live: jsonOderNull(zeile.live),
  };
}

/**
 * Aus "vor wie langer Zeit" wird der Text, den der Prototyp zeigt.
 * Gespeichert ist immer der Zeitpunkt — sonst stünde in einem halben Jahr
 * noch "vor 2 Tagen" an einem uralten Beitrag.
 */
function zeitText(zeitpunkt) {
  if (!zeitpunkt) return '';
  const minuten = Math.max(0, Math.floor((Date.now() - new Date(zeitpunkt).getTime()) / 60000));
  if (minuten < 1) return 'gerade eben';
  if (minuten < 60) return `vor ${minuten} min`;
  const stunden = Math.floor(minuten / 60);
  if (stunden < 24) return `vor ${stunden} h`;
  const tage = Math.floor(stunden / 24);
  if (tage === 1) return 'vor 1 Tag';
  if (tage < 7) return `vor ${tage} Tagen`;
  const wochen = Math.floor(tage / 7);
  if (wochen < 5) return `vor ${wochen} W`;
  return `vor ${Math.floor(tage / 30)} M`;
}

/** Uhrzeit für die Chatliste: heute "14:32", gestern "Gestern", davor "Mo". */
function chatZeit(zeitpunkt) {
  if (!zeitpunkt) return '';
  const d = new Date(zeitpunkt);
  const jetzt = new Date();
  const tageZurueck = Math.floor((jetzt - d) / 86400000);
  if (d.toDateString() === jetzt.toDateString()) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  if (tageZurueck < 2) return 'Gestern';
  if (tageZurueck < 7) return ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'][d.getDay()];
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

// ============================================================================
// Menschen
// ============================================================================

async function ladeNutzer(client, nutzerId) {
  if (!client) return null;
  /*
   * Sicherheitspruefung 04.09.2026 (Fund 1): die Nummern kommen nicht mehr
   * aus der Profilliste, sondern aus zwei eigenen Aufrufen — die eigene aus
   * `mein_profil()`, die der Kontakte aus `meine_kontaktnummern()`. Letztere
   * gibt nur heraus, wo sich beide Seiten als Kontakt fuehren.
   */
  const [{ data, error }, { data: zahlen }, { data: ich }, { data: nummern }] = await Promise.all([
    client.from('profiles').select(PROFIL_SPALTEN).limit(500),
    client.from('profile_zahlen').select('id, followers, following, beitraege'),
    client.rpc('mein_profil'),
    client.rpc('meine_kontaktnummern'),
  ]);
  if (error) throw error;

  const nummerVon = (id) =>
    (id === nutzerId ? ich?.phone : (nummern || {})[id]) || '';

  const zahlenNach = new Map((zahlen || []).map((z) => [z.id, z]));
  const nutzer = {};
  for (const zeile of data || []) {
    const u = profilZuNutzer(zeile);
    u.phone = nummerVon(zeile.id);
    const z = zahlenNach.get(zeile.id);
    u.followers = Number(z?.followers ?? zeile.followers_basis ?? 0);
    u.following = Number(z?.following ?? zeile.following_basis ?? 0);
    u.posts = Number(z?.beitraege ?? zeile.beitraege_basis ?? 0);
    // "me" ist die Kennung, unter der die Oberfläche das eigene Profil sucht.
    nutzer[zeile.id === nutzerId ? 'me' : zeile.id] = { ...u, id: zeile.id === nutzerId ? 'me' : zeile.id };
  }
  return nutzer;
}

async function ladeProfil(client, profilId) {
  if (!client) return null;
  const { data, error } = await client
    .from('profiles')
    .select(PROFIL_SPALTEN)
    .eq('id', profilId)
    .maybeSingle();
  if (error) throw error;
  return profilZuNutzer(data);
}

async function ladeKontakte(client, nutzerId) {
  if (!client) return null;
  const { data, error } = await client
    .from('contacts')
    .select('contact_id, status, spitzname, notiz, profiles!contacts_contact_id_fkey(name, about)')
    .eq('user_id', nutzerId);
  if (error) throw error;

  // Henrik 7.9.: „Kontaktinfo-Änderungen (z.B. Name) speichern/synchronisieren nicht."
  // Der selbst vergebene Name liegt seit Schema 33 in contacts.spitzname und geht dem
  // Profilnamen vor. Gleiche Regel in app/lib/daten.ts (ladeKontakte).
  return (data || []).map((k) => ({
    id: k.contact_id,
    name: k.spitzname || k.profiles?.name || '',
    status: k.status,
    about: k.profiles?.about || '',
    notiz: k.notiz || '',
  }));
}

/** Wem folge ich? Ergibt die Karte, aus der die Oberfläche "Folge ich" liest. */
async function ladeFolgen(client, nutzerId) {
  if (!client) return null;
  const { data, error } = await client
    .from('follows')
    .select('followee_id')
    .eq('follower_id', nutzerId);
  if (error) throw error;
  return new Set((data || []).map((f) => f.followee_id));
}

/**
 * Wer folgt dieser Person — und wem folgt sie?
 *
 * Gegenstueck zu ladeFolgeListe() in app/lib/daten.ts. Die Oberflaeche las
 * bis zum 02.09.2026 `state.users.followers` — eine Eigenschaft, die nie
 * jemand gesetzt hat. Die Liste war deshalb immer leer, waehrend die Zahl
 * darueber aus `profile_zahlen` kam und stimmte.
 */
async function ladeFolgeListe(client, nutzerId, userId, art) {
  if (!client) return [];
  const ziel = userId === 'me' ? nutzerId : userId;
  const [gesucht, gegeben] =
    art === 'follower' ? ['follower_id', 'followee_id'] : ['followee_id', 'follower_id'];

  const { data, error } = await client.from('follows').select(gesucht).eq(gegeben, ziel);
  if (error) throw error;
  return (data || []).map((f) => (f[gesucht] === nutzerId ? 'me' : f[gesucht]));
}

/**
 * Die „Insights" aus den Einstellungen — Statistik zum eigenen Content.
 *
 * Gegenstueck zu ladeStatistik() in app/lib/daten.ts. Bis zum 02.09.2026
 * standen die vier Zahlen auf beiden Seiten fest im Code (340 / 1.284 / 46)
 * und waren bei jedem Konto gleich.
 *
 * `posts.views` ist ein Zaehlerstand ohne Verlauf — deshalb „Aufrufe gesamt"
 * statt „Aufrufe (30 Tage)". Die neuen Follower dagegen lassen sich ueber
 * `follows.created_at` wirklich auf dreissig Tage eingrenzen.
 */
async function ladeStatistik(client, nutzerId) {
  if (!client) return null;
  const { data, error } = await client
    .from('profil_statistik')
    .select('*')
    .eq('id', nutzerId)
    .maybeSingle();
  if (error) throw error;

  const z = (wert) => Number(wert || 0);
  return {
    beitraege: z(data?.beitraege),
    follower: z(data?.follower),
    aufrufe: z(data?.aufrufe_beitraege),
    follower30: z(data?.follower_30),
    follower7: z(data?.follower_7),
    profilaufrufe: z(data?.profilaufrufe),
    profilaufrufe30: z(data?.profilaufrufe_30),
    profilaufrufe7: z(data?.profilaufrufe_7),
    besucher30: z(data?.besucher_30),
  };
}

/**
 * Schalter und Auswahlen aus den Einstellungen.
 *
 * Gegenstueck zu ladeEinstellungen() in app/lib/daten.ts. Bis zum 03.09.2026
 * lagen sie hier in einem Modul-Objekt (`const toggles = {…}`) und damit nur
 * bis zum naechsten Neuladen der Seite.
 */
async function ladeEinstellungen(client, nutzerId) {
  if (!client) return {};
  const { data, error } = await client
    .from('user_settings')
    .select('schluessel, wert')
    .eq('user_id', nutzerId);
  if (error) throw error;

  const raus = {};
  for (const zeile of data || []) raus[zeile.schluessel] = zeile.wert;
  return raus;
}

async function ladeBlockiert(client, nutzerId) {
  if (!client) return [];
  const { data, error } = await client
    .from('blocks')
    .select('blocked_user_id')
    .eq('user_id', nutzerId);
  if (error) throw error;
  return (data || []).map((b) => b.blocked_user_id);
}

async function ladeStummgeschaltet(client, nutzerId) {
  if (!client) return [];
  const { data, error } = await client
    .from('mutes')
    .select('muted_user_id')
    .eq('user_id', nutzerId);
  if (error) throw error;
  return (data || []).map((m) => m.muted_user_id);
}

/**
 * Die Nadeln auf der Karte.
 *
 * Gegenstueck zu ladeKartenpunkte() in app/lib/daten.ts. Der eigene Pin kam
 * mit der echten Kennung, waehrend die Oberflaeche das eigene Profil unter
 * `me` fuehrt — er fand deshalb kein Profil und hiess „Unbekannt".
 */
async function ladeKartenpunkte(client, nutzerId) {
  if (!client) return [];
  const { data, error } = await client
    .from('friend_pins')
    .select('user_id, x, y, place, updated_at');
  if (error) throw error;
  return (data || []).map((p) => ({
    id: nutzerId && p.user_id === nutzerId ? 'me' : p.user_id,
    x: Number(p.x),
    y: Number(p.y),
    place: p.place || '',
    when: zeitText(p.updated_at),
  }));
}

// ============================================================================
// Chats
// ============================================================================

/**
 * Chats des Nutzers samt seiner persönlichen Einstellungen (archiviert,
 * stumm, gelesen, Favorit) und der letzten Nachricht als Vorschau.
 *
 * `bereich` trennt Messenger von Community-Chat. Henriks Unterscheidung:
 * Messenger geht über Telefonnummer/Kontakt, der Community-Chat kommt ohne aus.
 */
/**
 * Der Anfragezustand aus der Sicht des Lesenden.
 *
 * Dieselbe Umrechnung steht in app/lib/daten.ts als `anfrageZustand`. Wer
 * eine ändert, ändert beide — sonst sperrt die eine Oberfläche das
 * Eingabefeld und die andere nicht.
 */
function anfrageZustand(chat, nutzerId) {
  const zustand = chat.anfrage_zustand || 'offen';
  if (zustand === 'wartet') return chat.anfrage_von === nutzerId ? 'pending' : 'incoming';
  if (zustand === 'abgelehnt' && chat.anfrage_von === nutzerId) return 'declined';
  return 'accepted';
}

async function ladeChats(client, nutzerId, bereich = 'messenger') {
  if (!client) return null;

  const { data, error } = await client
    .from('chat_members')
    .select(CHATMITGLIED_SPALTEN)
    .eq('user_id', nutzerId);
  if (error) throw error;

  const zeilen = (data || []).filter((z) => z.chats && (z.chats.bereich || 'messenger') === bereich);
  if (zeilen.length === 0) return [];

  const ids = zeilen.map((z) => z.chat_id);

  /*
   * Letzte Nachricht und Mitglieder je Chat — in zwei Abfragen statt in
   * zweien pro Chat. Bei zwölf Chats ist das der Unterschied zwischen zwei
   * und fünfundzwanzig Rundreisen zur Datenbank.
   *
   * Henrik, 07.09.2026: "Kontaktsortierung falsch (älterer Chat über
   * neuerem)" und "Chat-Vorschautext nicht synchron mit letzter echter
   * Nachricht."
   *
   * Hier stand eine Abfrage auf messages mit .limit(500) — über alle Chats
   * zusammen, nicht je Chat. Ein vielbeschriebener Chat füllte die Grenze
   * allein; jeder ältere bekam gar keine Zeile und fiel damit auf
   * chats.updated_at als Sortierschlüssel zurück, ohne Vorschautext. Genau
   * der ältere Chat über dem neueren. Ausführlich in
   * SUPABASE_SCHEMA_32_letzte_nachricht.sql.
   *
   * Gleiche Regel in app/lib/daten.ts (ladeChats).
   */
  const [{ data: nachrichten, error: fN }, { data: mitglieder, error: fM }, { data: kontakte, error: fK }] =
    await Promise.all([
      client.rpc('letzte_nachrichten', { chat_ids: ids }),
      client.from('chat_members').select('chat_id, user_id').in('chat_id', ids),
      client.from('contacts').select('contact_id, status, spitzname').eq('user_id', nutzerId),
    ]);
  if (fN) throw fN;
  if (fM) throw fM;
  if (fK) throw fK;

  // Der Anfragezustand steht seit dem 03.09.2026 am Chat. Aus den Kontakten
  // kommt nur noch der selbst vergebene Name (Schema 33, Henrik 7.9.).
  const spitznamen = new Map((kontakte || []).filter((k) => k.spitzname).map((k) => [k.contact_id, k.spitzname]));

  // Wer einen Chat geleert hat, sieht in der Liste auch keine Vorschau mehr
  // von vorher. Siehe handleClearChat().
  const strichNach = new Map(zeilen.map((z) => [z.chat_id, z.geleert_bis || null]));

  const letzte = new Map();
  for (const n of nachrichten || []) {
    const strich = strichNach.get(n.chat_id);
    if (strich && new Date(n.created_at) <= new Date(strich)) continue;
    if (!letzte.has(n.chat_id)) letzte.set(n.chat_id, n);
  }
  const mitgliederNach = new Map();
  for (const m of mitglieder || []) {
    if (!mitgliederNach.has(m.chat_id)) mitgliederNach.set(m.chat_id, []);
    mitgliederNach.get(m.chat_id).push(m.user_id);
  }

  /*
   * Ein Zweiergespräch heißt wie das Gegenüber — und zwar auf beiden Seiten.
   *
   * chats.name wird beim Anlegen einmal festgeschrieben (chatMit in
   * sync-handlers.js). Das geht nur für den auf, der den Chat angefangen hat:
   * der andere sähe seinen eigenen Namen. Älteren Chats fehlt der Name ganz.
   * Deshalb kommt er zur Anzeigezeit aus dem Profil.
   *
   * Gleiche Regel in app/lib/daten.ts (ladeChats). Wer eine ändert, ändert
   * beide — sonst heißt derselbe Chat in App und Website verschieden.
   */
  const gegenueberIds = [
    ...new Set(
      zeilen
        .filter((z) => !z.chats.is_group)
        .map((z) => (mitgliederNach.get(z.chat_id) || []).find((u) => u !== nutzerId))
        .filter(Boolean)
    ),
  ];
  const namen = new Map();
  if (gegenueberIds.length) {
    const { data: profile } = await client.from('profiles').select('id, name').in('id', gegenueberIds);
    for (const p of profile || []) namen.set(p.id, p.name);
  }

  /*
   * Die Kuverts zu den Vorschauen — eine Abfrage, nicht eine je Chat.
   *
   * Gefiltert wird nicht nach dem eigenen Schluessel: die Regel „Eigene
   * Kuverts lesen" aus Schema 31 gibt ohnehin nur die eigenen heraus.
   */
  const vorschauKuverts = new Map();
  const vorschauIds = [...letzte.values()]
    .filter((n) => Number(n.krypto) > 0)
    .map((n) => n.id);
  if (vorschauIds.length) {
    const { data: kZeilen } = await client
      .from('message_keys')
      .select('message_id, nonce, chiffre')
      .in('message_id', vorschauIds);
    for (const k of kZeilen || []) {
      vorschauKuverts.set(k.message_id, { nonce: k.nonce, chiffre: k.chiffre });
    }
  }

  return zeilen
    .map((z) => {
      const vorschau = letzte.get(z.chat_id) || null;
      const alle = mitgliederNach.get(z.chat_id) || [];
      const andere = alle.filter((u) => u !== nutzerId);
      // Bei einem Zweiergespräch ist das Gegenüber die eine andere Person.
      const gegenueber = z.chats.is_group ? null : andere[0] || null;
      return {
        id: z.chats.id,
        name: z.chats.is_group
          ? z.chats.name || 'Gruppe'
          : (gegenueber && (spitznamen.get(gegenueber) || namen.get(gegenueber))) || z.chats.name || 'Chat',
        userId: gegenueber,
        requestState: anfrageZustand(z.chats, nutzerId),
        members: z.chats.is_group ? andere : undefined,
        isGroup: Boolean(z.chats.is_group),
        bereich: z.chats.bereich || 'messenger',
        archiviert: Boolean(z.is_archived),
        muted: Boolean(z.is_muted),
        unread: z.is_read ? 0 : 1,
        favorit: Boolean(z.is_favorite),
        /*
         * is_locked und notifications_off wurden seit jeher geladen
         * (CHATMITGLIED_SPALTEN) und hier weggeworfen — genau das beschreibt
         * der Kommentar am Kopf dieser Datei. Der Browser bekam die Sperre
         * deshalb nie zu sehen, obwohl die App sie schreibt. Gleiche Regel in
         * app/lib/daten.ts (ladeChats).
         */
        gesperrt: Boolean(z.is_locked),
        mitteilungenAus: Boolean(z.notifications_off),
        // Ein Anruf steht als Eintrag im Chat (Henrik 7.9., Schema 35) und hat
        // keinen Text — die Vorschau benennt ihn. Gleiche Regel in
        // app/lib/daten.ts (ladeChats).
        preview: vorschau
          ? vorschau.anruf_art
            ? vorschau.anruf_art === 'video'
              ? 'Videoanruf'
              : 'Anruf'
            : vorschau.text
          : '',
        /*
         * Die Vorschau einer verschluesselten Nachricht ist hier leer — der
         * Server kann sie nicht oeffnen. Er reicht das Noetige durch, und der
         * Browser setzt den Text ein (`vorschauenOeffnen` in public/app.js).
         *
         * Ohne das staende in der Chatliste bei jedem verschluesselten Chat
         * eine leere Zeile: der Chat selbst waere lesbar, die Uebersicht
         * darueber nicht. So zeigt sich eine Verschluesselung zuerst als
         * kaputte Oberflaeche.
         */
        previewKrypto: vorschau
          ? {
              krypto: Number(vorschau.krypto || 0),
              chiffre: vorschau.chiffre || null,
              kryptoNonce: vorschau.krypto_nonce || null,
              absenderSchluessel: vorschau.absender_schluessel || null,
              kuvert: vorschauKuverts.get(vorschau.id) || null,
            }
          : undefined,
        mediaPreview: vorschau?.media_type || undefined,
        time: chatZeit(vorschau ? vorschau.created_at : z.chats.updated_at),
        zeitpunkt: vorschau ? vorschau.created_at : z.chats.updated_at,
      };
    })
    .sort((a, b) => new Date(b.zeitpunkt || 0) - new Date(a.zeitpunkt || 0));
}

async function ladeNachrichten(client, chatId, nutzerId) {
  if (!client) return null;

  /*
   * Wer den Chat geleert hat, sieht nichts von vorher.
   *
   * Gelöscht wird dabei nur, was einem selbst gehört; für den Rest steht ein
   * Zeitstrich in chat_members.geleert_bis. Siehe handleClearChat().
   */
  const { data: mitgliedschaft } = await client
    .from('chat_members')
    .select('geleert_bis')
    .eq('chat_id', chatId)
    .eq('user_id', nutzerId)
    .maybeSingle();
  const strich = mitgliedschaft?.geleert_bis || null;

  let abfrage = client
    .from('messages')
    .select(
      NACHRICHT_SPALTEN
    )
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (strich) abfrage = abfrage.gt('created_at', strich);

  const { data, error } = await abfrage;
  if (error) throw error;

  const zeilen = data || [];

  /*
   * Bezug, Reaktionen und Namen in einem Zug nachladen — gleiche Regel wie in
   * app/lib/daten.ts. Je Nachricht eine eigene Abfrage waeren bei einem Chat
   * mit vielen Antworten hunderte, und das Oeffnen dauerte Sekunden.
   */
  const bezugIds = [...new Set(zeilen.flatMap((n) => [n.reply_to, n.quote_of]).filter(Boolean))];
  let bezugZeilen = [];
  if (bezugIds.length) {
    const { data: gefunden } = await client
      .from('messages')
      // Die vier Kryptospalten muessen mit: eine verschluesselte Nachricht,
      // auf die geantwortet wird, haette sonst einen leeren Text — und im
      // Antwortbezug staende eine leere Zeile statt des Zitierten.
      .select('id, text, sender_id, krypto, chiffre, krypto_nonce, absender_schluessel')
      .in('id', bezugIds);
    bezugZeilen = gefunden || [];
  }

  const reaktionen = new Map();
  if (zeilen.length) {
    const { data: reakZeilen } = await client
      .from('message_reactions')
      .select('message_id, user_id, emoji')
      .in('message_id', zeilen.map((n) => n.id));
    for (const r of reakZeilen || []) {
      const liste = reaktionen.get(r.message_id) || [];
      liste.push({ userId: r.user_id === nutzerId ? 'me' : r.user_id, emoji: r.emoji });
      reaktionen.set(r.message_id, liste);
    }
  }

  const weiterIds = zeilen.map((n) => n.forwarded_from).filter(Boolean);
  const namenIds = [...new Set([...weiterIds, ...bezugZeilen.map((b) => b.sender_id)])];
  const namen = new Map();
  if (namenIds.length) {
    const { data: profile } = await client.from('profiles').select('id, name').in('id', namenIds);
    for (const p of profile || []) namen.set(p.id, p.name);
  }

  /*
   * Die Kuverts fuer dieses Konto — in einer Abfrage, nicht je Nachricht.
   *
   * Gefiltert wird hier absichtlich nicht nach dem eigenen Schluessel: die
   * Regel „Eigene Kuverts lesen" aus Schema 31 gibt ohnehin nur die eigenen
   * heraus. Ein Filter im Code daneben waere eine zweite Wahrheit ueber
   * dieselbe Sache — und wenn sie auseinanderlaufen, gewinnt die falsche.
   *
   * Geoeffnet wird hier nichts. Dieser Server steht bei Render und hat den
   * geheimen Schluessel nicht; das Oeffnen macht der Browser in
   * public/krypto.js.
   */
  const kuverts = new Map();
  const verschlossenIds = [...zeilen, ...bezugZeilen]
    .filter((n) => Number(n.krypto) > 0)
    .map((n) => n.id);
  if (verschlossenIds.length) {
    const { data: kZeilen } = await client
      .from('message_keys')
      .select('message_id, nonce, chiffre')
      .in('message_id', verschlossenIds);
    for (const k of kZeilen || []) {
      kuverts.set(k.message_id, { nonce: k.nonce, chiffre: k.chiffre });
    }
  }

  const bezug = new Map();
  for (const b of bezugZeilen) {
    bezug.set(b.id, {
      id: b.id,
      text: b.text || '',
      autor: b.sender_id === nutzerId ? 'Du' : namen.get(b.sender_id) || '',
      krypto: Number(b.krypto || 0),
      chiffre: b.chiffre || null,
      kryptoNonce: b.krypto_nonce || null,
      absenderSchluessel: b.absender_schluessel || null,
      kuvert: kuverts.get(b.id) || null,
    });
  }

  return zeilen.map((n) => ({
    id: n.id,
    chatId: n.chat_id,
    // Die Oberfläche erkennt eigene Nachrichten an der Kennung "me".
    from: n.sender_id === nutzerId ? 'me' : n.sender_id,
    senderId: n.sender_id,
    text: n.text,
    media: n.media_type || undefined,
    mediaUrl: n.media_url,
    time: chatZeit(n.created_at),
    zeitpunkt: n.created_at,
    read: Boolean(n.read_at),
    /*
     * Die Karte im Chat: Vorschau, Autor, Titel — im Prototyp oeffnet sie den
     * geteilten Beitrag. Bis zum 01.09.2026 stand dort nur der Satz "Beitrag
     * geteilt": die Nachricht wusste gar nicht, was geteilt worden war.
     */
    geteilt: n.posts
      ? {
          id: n.posts.id,
          art: n.posts.kind === 'post' ? 'post' : 'video',
          // Das Bild des Beitrags (Henrik 7.9.) — ohne das war die Karte ein
          // graues Kaestchen und liess sich nicht oeffnen. Gleiche Regel in
          // app/lib/daten.ts.
          bild: n.posts.thumbnail_url || n.posts.media_url || undefined,
          autor: n.posts.profiles?.name || '',
          titel: n.posts.title || n.posts.description || '',
        }
      : undefined,
    // Angehaengter Standort: Karte mit Nadel, Adresse und Koordinaten.
    standort: n.places
      ? {
          id: n.places.id,
          name: n.places.name,
          adresse: n.places.adresse || '',
          koordinaten: n.places.koordinaten || '',
          x: Number(n.places.x ?? 50),
          y: Number(n.places.y ?? 50),
        }
      : undefined,
    // Angehaengter Kontakt: Karte mit Avatar, die sein Profil oeffnet.
    kontakt: n.profiles
      ? { id: n.profiles.id, name: n.profiles.name, handle: n.profiles.handle }
      : undefined,
    /*
     * Die Story, auf die sich die Nachricht bezieht (Henrik 18.09., Schema
     * 41) — ein Herz oder eine Antwort darauf. `stories` ist null, sobald die
     * Story nach 24 Stunden weg ist; dann bleibt die Nachricht lesbar und die
     * Vorschau fehlt. Gleiche Regel in app/lib/daten.ts.
     */
    story: n.stories
      ? {
          id: n.stories.id,
          userId: n.stories.user_id === nutzerId ? 'me' : n.stories.user_id,
          mediaUri: n.stories.media_url || undefined,
        }
      : undefined,
    /*
     * Die Nachrichten-Werkzeuge aus dem Handbuch (01.09.2026). Antwort und
     * Zitat sind getrennt: eine Antwort zeigt nur den Bezug, ein Zitat nimmt
     * den Text mit. Auf einer Spalte liessen sie sich nicht unterscheiden.
     */
    antwortAuf: n.reply_to ? bezug.get(n.reply_to) : undefined,
    zitat: n.quote_of ? bezug.get(n.quote_of) : undefined,
    weitergeleitetVon: n.forwarded_from ? namen.get(n.forwarded_from) : undefined,
    bearbeitet: Boolean(n.edited_at),
    zurueckgenommen: Boolean(n.deleted_at),
    reaktionen: reaktionen.get(n.id),
    datei: n.file_name ? { name: n.file_name, groesse: Number(n.file_size || 0) } : undefined,
    // Der Anrufeintrag (Henrik 7.9., Schema 35). Gleiche Regel in
    // app/lib/daten.ts (ladeNachrichten).
    anruf: n.anruf_art
      ? {
          art: n.anruf_art,
          status: n.anruf_status || 'beendet',
          dauer: Number(n.anruf_dauer || 0),
        }
      : undefined,
    /*
     * Verschluesselung (Schema 31). `text` ist bei krypto > 0 leer — den
     * Klartext setzt der Browser ein, nachdem er das Kuvert geoeffnet hat.
     * Alle vier Felder gehoeren zusammen; fehlt eins, geht nichts auf.
     */
    krypto: Number(n.krypto || 0),
    chiffre: n.chiffre || null,
    kryptoNonce: n.krypto_nonce || null,
    absenderSchluessel: n.absender_schluessel || null,
    kuvert: kuverts.get(n.id) || null,
  }));
}

// ============================================================================
// Storys
// ============================================================================

/**
 * Storys — getrennt nach den beiden Bereichen, in denen sie erscheinen.
 *
 * Gleichlautend mit app/lib/daten.ts, ladeStorys(). Das Handbuch trennt:
 * im Messenger stehen die Storys der Kontakte, im Videos-Bereich die der
 * gefolgten Profile — und dorthin kommt eine Story nur, wenn ihr Urheber
 * den Zusatz „Jeder -> Story auch in Videos teilen" angeschaltet hat
 * (Schema 30). Bis zum 07.09.2026 gab es hier eine einzige Liste, die
 * beide Bereiche zeigten.
 *
 * Der Filter ist eine Anzeigeregel, keine Zugriffsregel: wer die Stufe
 * „Alle" gewählt hat, gibt seine Story ohnehin frei. Entschieden wird
 * allein, ob sie zusätzlich ungefragt im Videos-Feed auftaucht.
 */
async function ladeStorys(client, nutzerId) {
  if (!client) return null;

  const { data, error } = await client
    .from('stories')
    .select(
      'id, user_id, media_url, media_type, caption, created_at, in_videos, profiles!stories_user_id_fkey(name)'
    )
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  const storys = data || [];

  const [
    { data: gesehen, error: fG },
    { data: gemocht, error: fL },
    { data: kontakte, error: fK },
    { data: gefolgt, error: fF },
  ] = await Promise.all([
    client.from('story_views').select('story_id').eq('user_id', nutzerId),
    client.from('story_likes').select('story_id').eq('user_id', nutzerId),
    client.from('contacts').select('contact_id').eq('user_id', nutzerId).eq('status', 'friend'),
    client.from('follows').select('followee_id').eq('follower_id', nutzerId),
  ]);
  if (fG) throw fG;
  if (fL) throw fL;
  if (fK) throw fK;
  if (fF) throw fF;

  const gesehenIds = new Set((gesehen || []).map((g) => g.story_id));
  const gemochtIds = new Set((gemocht || []).map((g) => g.story_id));
  const kontaktIds = new Set((kontakte || []).map((k) => k.contact_id));
  const gefolgtIds = new Set((gefolgt || []).map((f) => f.followee_id));

  const liste = storys.map((s) => ({
    id: s.id,
    userId: s.user_id === nutzerId ? 'me' : s.user_id,
    /*
     * Die eigene Story heisst "Deine Story", nicht wie man selbst heisst.
     *
     * So steht es im Prototypen, und so stand es auch in den Beispieldaten.
     * Beim Umzug in die Datenbank ging es verloren: der Name kam ab da aus
     * dem Profil, und auf der eigenen Kachel stand ploetzlich der eigene
     * Vorname.
     */
    name: s.user_id === nutzerId ? 'Deine Story' : (s.profiles?.name || '').split(' ')[0],
    own: s.user_id === nutzerId,
    mediaUrl: s.media_url,
    // Die Oberflaeche kennt das Feld unter dem Namen "mediaUri" — dort kommt
    // sonst nur ein selbst aufgenommenes Bild aus dem Browserspeicher an.
    mediaUri: s.media_url,
    mediaType: s.media_type,
    caption: s.caption || '',
    zeit: s.created_at,
    viewed: gesehenIds.has(s.id),
    liked: gemochtIds.has(s.id),
    _urheber: s.user_id,
    /*
     * Henrik am 07.09.2026: „Storys nicht mehr bereichsuebergreifend
     * (Messenger/Videos strikt getrennt); beim Posten fragen ob
     * uebergreifend teilen."
     *
     * Hier stand `profiles.story_in_videos` — die Dauereinstellung, also
     * eine Entscheidung fuer alles, was jemand je postet. Gefragt wird
     * jetzt je Story, und die Antwort steht an der Story selbst (Schema
     * 36). Der Schalter am Profil bleibt: er entscheidet, ob ueberhaupt
     * gefragt wird, und ist die Vorbelegung. Gleiche Regel in
     * app/lib/daten.ts.
     */
    _inVideos: Boolean(s.in_videos),
  }));

  const ohneHilfsfelder = (s) => {
    const kopie = { ...s };
    delete kopie._urheber;
    delete kopie._inVideos;
    return kopie;
  };

  const eigene = liste.filter((s) => s.own);
  const fremde = liste.filter((s) => !s.own);

  /*
   * Die eigene Story hing bis zum 09.09.2026 unbesehen in BEIDEN Leisten.
   * Die Trennung aus Schema 30 galt nur fuer fremde Storys — und die eine
   * Story, die man beim Testen sicher zu Gesicht bekommt, ist die eigene.
   * Fuer Henrik war die Trennung deshalb nicht gebaut.
   *
   * Die Plus-Kachel bleibt davon unberuehrt: `storyleisteOrdnen` haengt sie
   * an, wenn keine eigene Story dasteht, und sie ist der Weg zur Kamera.
   */
  return {
    messenger: storyleisteOrdnen([
      ...eigene.map(ohneHilfsfelder),
      ...fremde.filter((s) => kontaktIds.has(s._urheber)).map(ohneHilfsfelder),
    ]),
    videos: storyleisteOrdnen([
      ...eigene.filter((s) => s._inVideos).map(ohneHilfsfelder),
      ...fremde.filter((s) => gefolgtIds.has(s._urheber) && s._inVideos).map(ohneHilfsfelder),
    ]),
  };
}

/*
 * Die Storyleiste beginnt links immer mit der eigenen Kachel — so im
 * Prototypen, und zwar auch dann, wenn man noch nichts aufgenommen hat: dann
 * traegt sie ein Plus und oeffnet die Kamera.
 *
 * Ohne diese Kachel gab es keinen Weg mehr zur Kamera ueber die Storyleiste,
 * sobald die eigene Story abgelaufen war. Storys leben 24 Stunden.
 */
function storyleisteOrdnen(liste) {
  const eigene = liste.filter((s) => s.own);
  const fremde = liste.filter((s) => !s.own);

  if (eigene.length === 0) {
    eigene.push({
      id: 'eigene',
      userId: 'me',
      name: 'Deine Story',
      own: true,
      mediaUrl: null,
      mediaUri: null,
      mediaType: 'image',
      caption: '',
      zeit: null,
      viewed: false,
      liked: false,
    });
  }

  return [...eigene, ...fremde];
}

// ============================================================================
// Beiträge, Videos, Clips
// ============================================================================

/**
 * Ein Video ist kein eigener Tabelleneintrag, sondern ein Beitrag mit
 * kind = 'reel' (Hochformat) oder 'clip' (Querformat).
 *
 * Likes und Kommentare werden gezählt, nicht gespeichert — auf einem Sockel,
 * der die Zahl aus den Beispielinhalten trägt. Ein neu angelegter Beitrag hat
 * Sockel 0, dort ist jede Zahl vollständig echt.
 */
async function ladeBeitraege(client, nutzerId, { arten = null, limit = 200 } = {}) {
  if (!client) return null;

  let abfrage = client
    .from('posts')
    .select(BEITRAG_SPALTEN)
    // Geplante Beiträge ("später posten") bleiben draußen, bis ihr Zeitpunkt
    // erreicht ist. Gleiche Regel wie in app/lib/daten.ts.
    .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (arten && arten.length > 0) abfrage = abfrage.in('kind', arten);

  const { data, error } = await abfrage;
  if (error) throw error;

  const beitraege = data || [];
  const ids = beitraege.map((b) => b.id);

  // Eigener Zustand je Beitrag: gefällt mir, gespeichert, geteilt, Glocke.
  const [{ data: likes }, { data: gespeichert }, { data: geteilt }, { data: glocke }] =
    ids.length === 0
      ? [{ data: [] }, { data: [] }, { data: [] }, { data: [] }]
      : await Promise.all([
          client.from('post_likes').select('post_id').eq('user_id', nutzerId).in('post_id', ids),
          client.from('saves').select('post_id').eq('user_id', nutzerId).in('post_id', ids),
          client.from('reposts').select('post_id').eq('user_id', nutzerId).in('post_id', ids),
          client.from('post_notify').select('post_id').eq('user_id', nutzerId).in('post_id', ids),
        ]);

  const gemocht = new Set((likes || []).map((l) => l.post_id));
  const gemerkt = new Set((gespeichert || []).map((s) => s.post_id));
  const repostet = new Set((geteilt || []).map((r) => r.post_id));
  const gemeldet = new Set((glocke || []).map((n) => n.post_id));

  /*
   * "Gefaellt Anna und 14 weiteren Personen" — der Name stand nie da. Die
   * Zeile fiel immer auf "15 Likes" zurueck, weil niemand den Namen
   * mitgeschickt hat.
   *
   * Er kommt aus einer Datenbankfunktion und nicht aus einer Abfrage auf
   * post_likes, weil er der Likes-Sichtbarkeit des Likenden unterliegt: wer
   * seine Likes verbirgt, taucht hier nicht auf. Die *Zahl* bleibt davon
   * unberuehrt — sie ist eine Tatsache ueber den Beitrag.
   */
  const likerNamen = new Map();
  if (ids.length > 0) {
    const { data: namen } = await client.rpc('liker_namen', {
      beitraege: ids,
      wer: nutzerId,
    });
    for (const z of namen || []) if (z.name) likerNamen.set(z.post_id, z.name);
  }

  // "Folge ich der Person?" gehoert an den Beitrag. Vorher las die Oberflaeche
  // p.following und p.notify - beide Felder hat der Server nie geschickt. Der
  // Knopf stand darum immer auf "Folgen", auch bei laengst gefolgten Personen,
  // und ein Klick nahm das Folgen in Wahrheit zurueck.
  const folgen = (await ladeFolgen(client, nutzerId)) || new Set();

  /*
   * Und jetzt die Reihenfolge.
   *
   * Bis zum 21.09.2026 gab diese Funktion die Beiträge in zeitlicher
   * Reihenfolge zurück und jeder sah dasselbe. `feed_rang()` bewertet die
   * eben geholten Kandidaten (Schema 51), `ordnen()` macht daraus die
   * Liste — Wort für Wort dieselbe Rechnung wie in app/lib/daten.ts, weil
   * es dieselbe Datei ist.
   *
   * Geht das Ranking schief, bleibt es bei der zeitlichen Reihenfolge. Ein
   * Feed ohne Algorithmus ist genau das, was All Media bis gestern hatte —
   * kein Zustand, der jemandem einen Fehler anzeigen müsste.
   */
  let geordnet = beitraege;
  if (ids.length > 0) {
    try {
      const { data: rang, error: rangFehler } = await client.rpc('feed_rang', {
        beitraege: ids,
        herkunft: 'feed',
      });
      if (rangFehler) throw rangFehler;
      // Aufgefächert wird je Art: Fotos, Reels und Clips landen auf drei
      // Bildschirmen, ein Clip darf die Reihenfolge der Fotos nicht
      // verschieben. `ordnenJeArt` liest den Verfasser aus `userId` oder
      // `user_id` — hier sind es noch die rohen Zeilen, also `user_id`.
      geordnet = ordnenJeArt(beitraege, punktekarte(rang), (b) => b.kind, {
        // Jeder vierte Platz gehört einem Beitrag, der noch keine Chance
        // hatte — sonst kommt ein frisch gestellter Beitrag nie nach oben.
        neulinge: neulingsliste(rang),
      });
    } catch (e) {
      console.warn('[supabase] Feed-Ranking nicht verfügbar, bleibe bei created_at:', e.message);
    }
  }

  return geordnet.map((b) => ({
    id: b.id,
    userId: b.user_id === nutzerId ? 'me' : b.user_id,
    kind: b.kind,
    art: b.format || 'standard',
    title: b.title || '',
    description: b.description || '',
    location: b.location || '',
    music: b.music || '',
    mediaUrl: b.media_url,
    thumbnail: b.thumbnail_url,
    duration: b.duration || '',
    tags: b.tags || [],
    views: Number(b.views || 0),
    zuschauer: b.zuschauer ?? undefined,
    untertitel: Boolean(b.untertitel),
    kapitel: b.kapitel || [],
    age: zeitText(b.created_at),
    zeitpunkt: b.created_at,
    likes: Number(b.likes_basis || 0) + (b.post_likes?.[0]?.count ?? 0),
    comments: Number(b.comments_basis || 0) + (b.comments?.[0]?.count ?? 0),
    // Weiterleitungen werden gezaehlt wie Likes und Kommentare. Vorher stand
    // hier nur der Sockel — jedes Teilen verpuffte, die Zahl blieb stehen.
    shares: Number(b.shares_basis || 0) + (b.shares?.[0]?.count ?? 0),
    liked: gemocht.has(b.id),
    likedBy: likerNamen.get(b.id) || '',
    saved: gemerkt.has(b.id),
    reposted: repostet.has(b.id),
    following: b.user_id !== nutzerId && folgen.has(b.user_id),
    notify: gemeldet.has(b.id),
  }));
}

async function ladeKommentare(client, nutzerId, beitragId) {
  if (!client) return null;
  const { data, error } = await client
    .from('comments')
    .select('id, post_id, user_id, text, created_at, comment_likes(count)')
    .eq('post_id', beitragId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;

  const ids = (data || []).map((k) => k.id);
  const { data: eigene } =
    ids.length === 0
      ? { data: [] }
      : await client.from('comment_likes').select('comment_id').eq('user_id', nutzerId).in('comment_id', ids);
  const gemocht = new Set((eigene || []).map((l) => l.comment_id));

  return (data || []).map((k) => ({
    id: k.id,
    postId: k.post_id,
    userId: k.user_id === nutzerId ? 'me' : k.user_id,
    text: k.text,
    time: chatZeit(k.created_at),
    zeitpunkt: k.created_at,
    likes: k.comment_likes?.[0]?.count ?? 0,
    liked: gemocht.has(k.id),
  }));
}

// ============================================================================
// Communitys
// ============================================================================

async function ladeCommunities(client, nutzerId) {
  if (!client) return null;
  const { data, error } = await client
    .from('communities')
    .select(
      'id, name, topic, bio, link, visibility, created_by, mitglieder_basis, created_at,' +
        ' community_members(count), community_channels(id, slug, name, topics, position)'
    )
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;

  const { data: meine } = await client
    .from('community_members')
    .select('community_id, is_muted')
    .eq('user_id', nutzerId);
  const beigetreten = new Set((meine || []).map((m) => m.community_id));
  // Stumm ist eine Eigenschaft der Mitgliedschaft, nicht der Community.
  const stumme = new Set((meine || []).filter((m) => m.is_muted).map((m) => m.community_id));

  return (data || []).map((c) => ({
    id: c.id,
    name: c.name,
    topic: c.topic || '',
    bio: c.bio || '',
    link: c.link || '',
    visibility: c.visibility,
    members: Number(c.mitglieder_basis || 0) + (c.community_members?.[0]?.count ?? 0),
    // Eine selbst angelegte Community kann man nicht verlassen — sie stünde
    // sonst ohne Besitzer da.
    eigen: c.created_by === nutzerId,
    joined: beigetreten.has(c.id),
    stumm: stumme.has(c.id),
    unread: 0,
    channels: (c.community_channels || [])
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .map((k) => ({ id: k.id, slug: k.slug, name: k.name, topics: k.topics || [] })),
  }));
}

async function ladeKanalNachrichten(client, nutzerId, kanalId) {
  if (!client) return null;
  /*
   * Die Anhang-Spalten kamen am 04.09.2026 dazu (Schema 25). Standort und
   * Kontakt werden ueber die SPALTE eingebettet (`places!place_id`), nicht
   * ueber den Namen des Fremdschluessels: `profiles` haengt an dieser Tabelle
   * zweimal (sender_id und contact_user_id), und ohne die Angabe kann
   * PostgREST den Weg nicht waehlen — die Abfrage schluege mit „more than one
   * relationship was found" fehl, und der Kanal saehe leer aus.
   */
  const { data, error } = await client
    .from('community_channel_messages')
    .select(
      'id, channel_id, sender_id, text, created_at,' +
        ' media_url, media_type, file_name, file_size,' +
        ' place_id, places!place_id(id, name, adresse, koordinaten, x, y),' +
        ' contact_user_id, profiles!contact_user_id(id, name, handle)'
    )
    .eq('channel_id', kanalId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;

  // Dieselben Feldnamen wie in ladeNachrichten — die Blase im Kanal wird aus
  // denselben Bausteinen gebaut wie die im Chat.
  return (data || []).map((m) => ({
    id: m.id,
    from: m.sender_id === nutzerId ? 'me' : m.sender_id,
    text: m.text || '',
    media: m.media_type || undefined,
    mediaUrl: m.media_url || undefined,
    time: chatZeit(m.created_at),
    zeitpunkt: m.created_at,
    standort: m.places
      ? {
          id: m.places.id,
          name: m.places.name,
          adresse: m.places.adresse || '',
          koordinaten: m.places.koordinaten || '',
          x: Number(m.places.x ?? 50),
          y: Number(m.places.y ?? 50),
        }
      : undefined,
    kontakt: m.profiles
      ? { id: m.profiles.id, name: m.profiles.name, handle: m.profiles.handle }
      : undefined,
    datei: m.file_name ? { name: m.file_name, groesse: Number(m.file_size || 0) } : undefined,
  }));
}

// ============================================================================
// Suche: Hashtags, Sounds, Standorte
// ============================================================================

async function ladeHashtags(client) {
  if (!client) return [];
  const { data, error } = await client
    .from('hashtags_mit_anzahl')
    .select('tag, beitraege')
    .order('beitraege', { ascending: false });
  if (error) throw error;
  return (data || []).map((h) => ({ tag: h.tag, posts: Number(h.beitraege) }));
}

async function ladeSounds(client) {
  if (!client) return [];
  const { data, error } = await client
    .from('sounds')
    .select('id, title, artist, uses, dauer, lyrics')
    .order('uses', { ascending: false });
  if (error) throw error;
  return (data || []).map((s) => ({
    id: s.id,
    title: s.title,
    artist: s.artist,
    uses: Number(s.uses || 0),
    dauer: s.dauer || '',
    // null heißt: instrumental. Die Seite sagt das dann auch, statt
    // "Instrumental" als Liedzeile auszugeben.
    lyrics: s.lyrics,
  }));
}

async function ladeStandorte(client) {
  if (!client) return [];
  const { data, error } = await client
    .from('places')
    .select('id, name, ort, adresse, koordinaten, x, y, beitraege_basis');
  if (error) throw error;
  return (data || []).map((p) => ({
    id: p.id,
    name: p.name,
    ort: p.ort || '',
    adresse: p.adresse || '',
    koordinaten: p.koordinaten || '',
    x: Number(p.x),
    y: Number(p.y),
    posts: Number(p.beitraege_basis || 0),
  }));
}

// ============================================================================
// Mitteilungen
// ============================================================================

async function ladeBenachrichtigungen(client, nutzerId, bereich = null) {
  if (!client) return null;
  let abfrage = client
    .from('notifications')
    .select('id, actor_id, art, bereich, target_type, target_id, text, read_at, created_at')
    .eq('user_id', nutzerId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (bereich) abfrage = abfrage.eq('bereich', bereich);

  const { data, error } = await abfrage;
  if (error) throw error;

  return (data || []).map((b) => ({
    id: b.id,
    userId: b.actor_id,
    art: b.art,
    bereich: b.bereich,
    ziel: { art: b.target_type, id: b.target_id },
    text: b.text || '',
    zeit: zeitText(b.created_at),
    gelesen: Boolean(b.read_at),
  }));
}

// ============================================================================
// Startdaten
// ============================================================================

/**
 * Lädt alles, was die Oberfläche beim Start braucht.
 *
 * Gibt null zurück, wenn niemand angemeldet ist. Das ist kein Fehler, sondern
 * die Regel der Datenbank: ohne Anmeldung ist dort nichts sichtbar. Die
 * Oberfläche zeigt in dem Fall die Anmeldung, nicht etwa Beispieldaten.
 */
async function bootstrapData(client, nutzerId) {
  if (!client || !nutzerId) return null;

  const [
    nutzer,
    kontakte,
    chats,
    communityChats,
    storys,
    beitraege,
    communities,
    benachrichtigungen,
    hashtags,
    sounds,
    standorte,
    kartenpunkte,
    folgen,
    blockiert,
    stumm,
    insights,
    insightStreaks,
    insightZiele,
    sichtbarkeit,
  ] = await Promise.all([
    ladeNutzer(client, nutzerId),
    ladeKontakte(client, nutzerId),
    ladeChats(client, nutzerId, 'messenger'),
    ladeChats(client, nutzerId, 'community'),
    ladeStorys(client, nutzerId),
    ladeBeitraege(client, nutzerId, { limit: 200 }),
    ladeCommunities(client, nutzerId),
    ladeBenachrichtigungen(client, nutzerId),
    ladeHashtags(client),
    ladeSounds(client),
    ladeStandorte(client),
    ladeKartenpunkte(client, nutzerId),
    ladeFolgen(client, nutzerId),
    ladeBlockiert(client, nutzerId),
    ladeStummgeschaltet(client, nutzerId),
    ladeInsights(client, nutzerId),
    ladeInsightStreaks(client, nutzerId),
    ladeInsightZiele(client, nutzerId),
    ladeSichtbarkeit(client, nutzerId),
  ]);

  // Der selbst vergebene Kontaktname gilt überall, wo diese Person auftaucht —
  // Chatkopf, Listen, Profil. Gleiche Regel in app/lib/daten.ts (alleDaten).
  for (const k of kontakte || []) {
    const eintrag = nutzer[k.id];
    if (eintrag && k.name && eintrag.name !== k.name) eintrag.name = k.name;
  }

  // "Folge ich dieser Person?" für jede bekannte Person.
  const gefolgt = {};
  for (const id of Object.keys(nutzer)) {
    gefolgt[id] = id === 'me' ? false : folgen.has(id);
  }

  const eigenes = nutzer.me || {};

  return {
    users: nutzer,
    contacts: kontakte,
    chats: chats.filter((c) => !c.archiviert),
    archiviert: chats.filter((c) => c.archiviert),
    communityChats,
    stories: storys.messenger,
    storiesVideos: storys.videos,
    posts: beitraege.filter((b) => b.kind === 'post'),
    videos: beitraege.filter((b) => b.kind === 'reel'),
    clips: beitraege.filter((b) => b.kind === 'clip'),
    communities,
    hashtags,
    sounds,
    places: standorte,
    friends: kartenpunkte,
    gefolgt,
    blockiert,
    stummgeschaltet: stumm,
    /*
     * Insight Time und was dazugehört (Handbuch-Abgleich 01.09.2026).
     * Nicht zu verwechseln mit den „Insights" im Einstellungsmenü — das ist
     * Statistik zum eigenen Profil.
     */
    insights,
    insightStreaks,
    insightZiele,
    sichtbarkeit,
    privateProfile: Object.values(nutzer).filter((u) => u.privat).map((u) => u.id),
    ungelesen: {
      videos: benachrichtigungen.filter((b) => b.bereich === 'videos' && !b.gelesen).length,
      communities: benachrichtigungen.filter((b) => b.bereich === 'communities' && !b.gelesen).length,
    },
    eigenesProfil: {
      bio: eigenes.bio || '',
      link: eigenes.link || '',
      highlights: eigenes.highlights || [],
      playlists: eigenes.playlists || [],
      // Spendenaktion und laufender Livestream gehoeren dazu — ohne sie
      // zeigte das eigene Profil beides nie an, obwohl es in der Datenbank
      // stand.
      spende: eigenes.spende || null,
      live: eigenes.live || null,
    },
    currentUserId: nutzerId,
    quelle: 'supabase',
    timestamp: new Date().toISOString(),
  };
}


// ============================================================================
// Was das Handbuch verlangt — nachgetragen am 01.09.2026
//
// Die Gegenstücke in der App stehen in app/lib/daten.ts.
// ============================================================================

/**
 * Die eigenen Insight Times: Tage in Folge, je Person.
 *
 * `heuteGesendet` und `heuteEmpfangen` kommen mit, damit die Chatliste die
 * Zahl grau zeigen kann, solange der Tag noch nicht vollständig ist — sonst
 * sähe eine Kette, die gleich reißt, aus wie eine sichere.
 */
async function ladeInsightStreaks(client, nutzerId) {
  const { data, error } = await client
    .from('insight_streaks')
    .select('user_a, user_b, tage, letzter_tag, a_gesendet, b_gesendet')
    .or(`user_a.eq.${nutzerId},user_b.eq.${nutzerId}`);
  if (error) throw error;

  const heute = new Date().toISOString().slice(0, 10);
  const gestern = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const raus = {};

  for (const z of data || []) {
    const ichBinA = z.user_a === nutzerId;
    const partner = ichBinA ? z.user_b : z.user_a;
    const meins = ichBinA ? z.a_gesendet : z.b_gesendet;
    const seins = ichBinA ? z.b_gesendet : z.a_gesendet;

    // Liegt der letzte vollständige Tag vor gestern, ist die Kette gerissen —
    // auch wenn in der Zeile noch eine Zahl steht. Zurückgesetzt wird sie
    // erst beim nächsten Senden.
    const lebt = z.letzter_tag === heute || z.letzter_tag === gestern;

    raus[partner] = {
      userId: partner,
      tage: lebt ? z.tage || 0 : 0,
      heuteGesendet: meins === heute,
      heuteEmpfangen: seins === heute,
    };
  }
  return raus;
}

/** Die feste Empfängerliste für Insights. */
async function ladeInsightZiele(client, nutzerId) {
  const { data, error } = await client
    .from('insight_targets')
    .select('target_id')
    .eq('user_id', nutzerId);
  if (error) throw error;
  return (data || []).map((z) => z.target_id);
}

/**
 * Empfangene Insights, die noch offen sind.
 *
 * Abgelaufene und bei Einmalansicht schon geöffnete bleiben draußen — sie
 * wären nur eine Zeile, die beim Antippen nichts zeigt.
 */
async function ladeInsights(client, nutzerId) {
  const { data, error } = await client
    .from('insight_recipients')
    .select(
      'insight_id, gesehen_at,' +
      ' insights(id, sender_id, media_url, media_type, filter, dauer, einmal, gespeichert, ablauf_at, created_at)'
    )
    .eq('user_id', nutzerId)
    .limit(200);
  if (error) throw error;

  const jetzt = Date.now();
  return (data || [])
    .filter((z) => z.insights)
    .filter((z) => !z.insights.ablauf_at || new Date(z.insights.ablauf_at).getTime() > jetzt)
    .filter((z) => !(z.insights.einmal && z.gesehen_at))
    .map((z) => ({
      id: z.insights.id,
      senderId: z.insights.sender_id === nutzerId ? 'me' : z.insights.sender_id,
      mediaUrl: z.insights.media_url,
      mediaTyp: z.insights.media_type,
      filter: z.insights.filter || '',
      dauer: z.insights.dauer || 0,
      einmal: z.insights.einmal,
      gespeichert: z.insights.gespeichert,
      zeit: zeitText(z.insights.created_at),
      gesehen: Boolean(z.gesehen_at),
    }));
}

/** Umfragen zu Beiträgen, Storys oder Kanälen — mit Stimmen und eigener Wahl. */
async function ladeUmfragen(client, nutzerId, art, traegerIds) {
  if (!traegerIds || !traegerIds.length) return {};

  const { data, error } = await client
    .from('polls')
    /*
     * "!poll_id" ist noetig, nicht Zierde. poll_votes zeigt auf polls UND auf
     * poll_options; PostgREST liest daraus einen zweiten, indirekten Weg
     * zwischen den beiden Tabellen und weigert sich dann mit "more than one
     * relationship was found". Der Hinweis nennt die Spalte, ueber die
     * verbunden werden soll — die Spalte und nicht den Namen des Fremd-
     * schluessels, denn ein umbenannter Constraint waere hier ein stiller
     * Ausfall aller Umfragen.
     */
    .select('id, traeger_id, frage, mehrfach, ende_at, poll_options!poll_id(id, text, position)')
    .eq('traeger_art', art)
    .in('traeger_id', traegerIds);
  if (error) throw error;

  const umfragen = data || [];
  if (!umfragen.length) return {};

  const { data: stimmen } = await client
    .from('poll_votes')
    .select('poll_id, option_id, user_id')
    .in('poll_id', umfragen.map((u) => u.id));

  const proOption = new Map();
  const eigene = new Set();
  for (const st of stimmen || []) {
    proOption.set(st.option_id, (proOption.get(st.option_id) || 0) + 1);
    if (st.user_id === nutzerId) eigene.add(st.option_id);
  }

  const raus = {};
  for (const u of umfragen) {
    const antworten = (u.poll_options || [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((o) => ({
        id: o.id,
        text: o.text,
        stimmen: proOption.get(o.id) || 0,
        gewaehlt: eigene.has(o.id),
      }));

    raus[u.traeger_id] = {
      id: u.id,
      frage: u.frage,
      mehrfach: u.mehrfach,
      endeAt: u.ende_at,
      beendet: Boolean(u.ende_at && new Date(u.ende_at) < new Date()),
      antworten,
      gesamt: antworten.reduce((sum, a) => sum + a.stimmen, 0),
    };
  }
  return raus;
}

/**
 * Die eigenen Sichtbarkeitsstufen samt Ausnahmelisten.
 *
 * Fehlt ein Bereich, gilt „alle" — so verhalten sich Bestandskonten wie
 * vorher, statt nach dem Einspielen plötzlich alles zu verbergen.
 */
async function ladeSichtbarkeit(client, nutzerId) {
  const [{ data: stufen }, { data: ausnahmen }, { data: eigenes }] = await Promise.all([
    client.from('visibility_settings').select('bereich, stufe').eq('user_id', nutzerId),
    client.from('visibility_exceptions').select('bereich, target_id').eq('user_id', nutzerId),
    // Der Zusatz „Story auch in Videos teilen" steht auf dem Profil, nicht in
    // `visibility_settings` — fremde Geraete muessen ihn lesen koennen
    // (Schema 30). Fachlich gehoert er trotzdem hierher.
    client.from('profiles').select('story_in_videos').eq('id', nutzerId).maybeSingle(),
  ]);

  const raus = {};
  for (const st of stufen || []) raus[st.bereich] = { stufe: st.stufe, ausnahmen: [] };
  for (const a of ausnahmen || []) {
    if (!raus[a.bereich]) raus[a.bereich] = { stufe: 'alle', ausnahmen: [] };
    raus[a.bereich].ausnahmen.push(a.target_id);
  }

  if (!raus.story) raus.story = { stufe: 'alle', ausnahmen: [] };
  raus.story.inVideos = Boolean(eigenes && eigenes.story_in_videos);

  return raus;
}

/** Der eigene Bann-Verlauf — mit Grund, wie das Handbuch es verlangt. */
async function ladeBanne(client, nutzerId) {
  const { data, error } = await client
    .from('profile_bans')
    .select('id, bereich, grund, ausloeser, von_at, bis_at, aufgehoben')
    .eq('user_id', nutzerId)
    .order('von_at', { ascending: false });
  if (error) throw error;

  const jetzt = Date.now();
  return (data || []).map((b) => ({
    id: b.id,
    bereich: b.bereich,
    grund: b.grund,
    ausloeser: b.ausloeser || '',
    von: zeitText(b.von_at),
    bis: b.bis_at ? zeitText(b.bis_at) : null,
    laeuft: !b.aufgehoben && (!b.bis_at || new Date(b.bis_at).getTime() > jetzt),
  }));
}

/** Die Live-Kommentarspalte zu einem Stream. */
async function ladeStreamKommentare(client, postId) {
  const { data, error } = await client
    .from('stream_comments')
    .select('id, user_id, text, created_at, profiles(id, name)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;

  return (data || []).map((k) => ({
    id: k.id,
    userId: k.user_id,
    name: k.profiles?.name || '',
    text: k.text,
    zeit: chatZeit(k.created_at),
  }));
}

/** Push-to-Talk-Nachrichten einer Community, neueste zuerst. */
async function ladePtt(client, communityId) {
  const { data, error } = await client
    .from('ptt_messages')
    .select('id, sender_id, audio_url, dauer, created_at, channel_id, profiles(id, name)')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  return (data || []).map((p) => ({
    id: p.id,
    userId: p.sender_id,
    name: p.profiles?.name || '',
    audioUrl: p.audio_url,
    dauer: p.dauer || 0,
    kanalId: p.channel_id,
    zeit: chatZeit(p.created_at),
  }));
}

/** Standortanfragen in einem Chat. */
async function ladeStandortanfragen(client, chatId) {
  const { data, error } = await client
    .from('location_requests')
    .select('id, sender_id, ziel_id, zustand, bis_at, created_at')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;

  return (data || []).map((a) => ({
    id: a.id,
    senderId: a.sender_id,
    zielId: a.ziel_id,
    zustand: a.zustand,
    bis: a.bis_at,
    zeit: chatZeit(a.created_at),
  }));
}

module.exports = {
  profilZuNutzer,
  zeitText,
  chatZeit,
  ladeNutzer,
  ladeProfil,
  ladeKontakte,
  ladeFolgen,
  ladeFolgeListe,
  ladeStatistik,
  ladeEinstellungen,
  ladeBlockiert,
  ladeStummgeschaltet,
  ladeKartenpunkte,
  anfrageZustand,
  ladeChats,
  ladeNachrichten,
  ladeStorys,
  ladeBeitraege,
  ladeKommentare,
  ladeCommunities,
  ladeKanalNachrichten,
  ladeHashtags,
  ladeSounds,
  ladeStandorte,
  ladeBenachrichtigungen,
  bootstrapData,

  // Handbuch-Abgleich 01.09.2026
  ladeInsights,
  ladeInsightStreaks,
  ladeInsightZiele,
  ladeUmfragen,
  ladeSichtbarkeit,
  ladeBanne,
  ladeStreamKommentare,
  ladePtt,
  ladeStandortanfragen,
};
