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

const PROFIL_SPALTEN =
  'id, name, handle, initials, color, phone, privat, about, bio, link, status,' +
  ' highlights, playlists, spende, live, followers_basis, following_basis, beitraege_basis';

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
  const [{ data, error }, { data: zahlen }] = await Promise.all([
    client.from('profiles').select(PROFIL_SPALTEN).limit(500),
    client.from('profile_zahlen').select('id, followers, following, beitraege'),
  ]);
  if (error) throw error;

  const zahlenNach = new Map((zahlen || []).map((z) => [z.id, z]));
  const nutzer = {};
  for (const zeile of data || []) {
    const u = profilZuNutzer(zeile);
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
    .select('contact_id, status, profiles!contacts_contact_id_fkey(name, about)')
    .eq('user_id', nutzerId);
  if (error) throw error;

  return (data || []).map((k) => ({
    id: k.contact_id,
    name: k.profiles?.name || '',
    status: k.status,
    about: k.profiles?.about || '',
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
  const vor30Tagen = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const [{ data: zahlen }, { data: beitraege, error: fehlerBeitraege }, { count: neue }] =
    await Promise.all([
      client.from('profile_zahlen').select('followers, beitraege').eq('id', nutzerId).maybeSingle(),
      client.from('posts').select('views').eq('user_id', nutzerId),
      client
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('followee_id', nutzerId)
        .gte('created_at', vor30Tagen),
    ]);
  if (fehlerBeitraege) throw fehlerBeitraege;

  return {
    beitraege: Number(zahlen?.beitraege || 0),
    follower: Number(zahlen?.followers || 0),
    aufrufe: (beitraege || []).reduce((summe, b) => summe + Number(b.views || 0), 0),
    neueFollower: Number(neue || 0),
  };
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

async function ladeKartenpunkte(client) {
  if (!client) return [];
  const { data, error } = await client
    .from('friend_pins')
    .select('user_id, x, y, place, updated_at');
  if (error) throw error;
  return (data || []).map((p) => ({
    id: p.user_id,
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
async function ladeChats(client, nutzerId, bereich = 'messenger') {
  if (!client) return null;

  const { data, error } = await client
    .from('chat_members')
    .select(
      'chat_id, is_archived, is_muted, is_read, is_favorite, geleert_bis,' +
        ' chats(id, name, is_group, bereich, created_at, updated_at)'
    )
    .eq('user_id', nutzerId);
  if (error) throw error;

  const zeilen = (data || []).filter((z) => z.chats && (z.chats.bereich || 'messenger') === bereich);
  if (zeilen.length === 0) return [];

  const ids = zeilen.map((z) => z.chat_id);

  // Letzte Nachricht und Mitglieder je Chat — in zwei Abfragen statt in
  // zweien pro Chat. Bei zwölf Chats ist das der Unterschied zwischen zwei
  // und fünfundzwanzig Rundreisen zur Datenbank.
  const [{ data: nachrichten, error: fN }, { data: mitglieder, error: fM }, { data: kontakte, error: fK }] =
    await Promise.all([
      client
        .from('messages')
        .select('id, chat_id, text, sender_id, media_type, created_at')
        .in('chat_id', ids)
        .order('created_at', { ascending: false })
        .limit(500),
      client.from('chat_members').select('chat_id, user_id').in('chat_id', ids),
      /*
       * Wer eine Kontaktanfrage gestellt hat, darf bis zur Annahme nur die
       * eine Nachricht schicken, die er der Anfrage beigelegt hat. Die
       * Oberflaeche sperrt das Eingabefeld dafuer an "requestState".
       *
       * Das kam bis zum 31.08.2026 aus den Beispieldaten und fiel beim Umzug
       * in die Datenbank weg — auf beiden Seiten, Website wie App. Der Zustand
       * steht aber laengst in der Datenbank: contacts.status ist 'pending',
       * solange die Anfrage laeuft.
       */
      client.from('contacts').select('contact_id, status').eq('user_id', nutzerId),
    ]);
  if (fN) throw fN;
  if (fM) throw fM;
  if (fK) throw fK;

  const offeneAnfrage = new Set(
    (kontakte || []).filter((k) => k.status === 'pending').map((k) => k.contact_id)
  );

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

  return zeilen
    .map((z) => {
      const vorschau = letzte.get(z.chat_id) || null;
      const alle = mitgliederNach.get(z.chat_id) || [];
      const andere = alle.filter((u) => u !== nutzerId);
      // Bei einem Zweiergespräch ist das Gegenüber die eine andere Person.
      const gegenueber = z.chats.is_group ? null : andere[0] || null;
      return {
        id: z.chats.id,
        name: z.chats.name,
        userId: gegenueber,
        requestState: gegenueber && offeneAnfrage.has(gegenueber) ? 'pending' : 'accepted',
        members: z.chats.is_group ? andere : undefined,
        isGroup: Boolean(z.chats.is_group),
        bereich: z.chats.bereich || 'messenger',
        archiviert: Boolean(z.is_archived),
        muted: Boolean(z.is_muted),
        unread: z.is_read ? 0 : 1,
        favorit: Boolean(z.is_favorite),
        preview: vorschau ? vorschau.text : '',
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
      'id, chat_id, sender_id, text, media_url, media_type, created_at, read_at,' +
      ' reply_to, quote_of, forwarded_from, edited_at, deleted_at, file_name, file_size,' +
      ' shared_post_id, posts(id, kind, title, description, profiles!posts_user_id_fkey(name)),' +
      ' place_id, places(id, name, adresse, koordinaten, x, y),' +
      ' contact_user_id, profiles!messages_contact_user_id_fkey(id, name, handle)'
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
      .select('id, text, sender_id')
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

  const bezug = new Map();
  for (const b of bezugZeilen) {
    bezug.set(b.id, {
      id: b.id,
      text: b.text || '',
      autor: b.sender_id === nutzerId ? 'Du' : namen.get(b.sender_id) || '',
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
  }));
}

// ============================================================================
// Storys
// ============================================================================

async function ladeStorys(client, nutzerId) {
  if (!client) return null;

  const { data, error } = await client
    .from('stories')
    .select('id, user_id, media_url, media_type, caption, created_at, profiles!stories_user_id_fkey(name)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  const storys = data || [];
  if (storys.length === 0) return [];

  const [{ data: gesehen, error: fG }, { data: gemocht, error: fL }] = await Promise.all([
    client.from('story_views').select('story_id').eq('user_id', nutzerId),
    client.from('story_likes').select('story_id').eq('user_id', nutzerId),
  ]);
  if (fG) throw fG;
  if (fL) throw fL;

  const gesehenIds = new Set((gesehen || []).map((g) => g.story_id));
  const gemochtIds = new Set((gemocht || []).map((g) => g.story_id));

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
  }));

  return storyleisteOrdnen(liste);
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

const BEITRAG_SPALTEN =
  'id, user_id, kind, format, title, description, location, music, media_url,' +
  ' thumbnail_url, duration, tags, views, zuschauer, untertitel, kapitel,' +
  ' likes_basis, shares_basis, comments_basis, created_at,' +
  ' post_likes(count), comments(count), shares(count)';

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

  // "Folge ich der Person?" gehoert an den Beitrag. Vorher las die Oberflaeche
  // p.following und p.notify - beide Felder hat der Server nie geschickt. Der
  // Knopf stand darum immer auf "Folgen", auch bei laengst gefolgten Personen,
  // und ein Klick nahm das Folgen in Wahrheit zurueck.
  const folgen = (await ladeFolgen(client, nutzerId)) || new Set();

  return beitraege.map((b) => ({
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
  const { data, error } = await client
    .from('community_channel_messages')
    .select('id, channel_id, sender_id, text, created_at')
    .eq('channel_id', kanalId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;

  return (data || []).map((m) => ({
    id: m.id,
    from: m.sender_id === nutzerId ? 'me' : m.sender_id,
    text: m.text,
    time: chatZeit(m.created_at),
    zeitpunkt: m.created_at,
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
    ladeKartenpunkte(client),
    ladeFolgen(client, nutzerId),
    ladeBlockiert(client, nutzerId),
    ladeStummgeschaltet(client, nutzerId),
    ladeInsights(client, nutzerId),
    ladeInsightStreaks(client, nutzerId),
    ladeInsightZiele(client, nutzerId),
    ladeSichtbarkeit(client, nutzerId),
  ]);

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
    stories: storys,
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
  const [{ data: stufen }, { data: ausnahmen }] = await Promise.all([
    client.from('visibility_settings').select('bereich, stufe').eq('user_id', nutzerId),
    client.from('visibility_exceptions').select('bereich, target_id').eq('user_id', nutzerId),
  ]);

  const raus = {};
  for (const st of stufen || []) raus[st.bereich] = { stufe: st.stufe, ausnahmen: [] };
  for (const a of ausnahmen || []) {
    if (!raus[a.bereich]) raus[a.bereich] = { stufe: 'alle', ausnahmen: [] };
    raus[a.bereich].ausnahmen.push(a.target_id);
  }
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
  ladeBlockiert,
  ladeStummgeschaltet,
  ladeKartenpunkte,
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
