/**
 * Die All-Media-Website.
 *
 * Statische Seite aus ../public und die dazugehörige API. Dieselbe Datei
 * bedient die Fassung in der Cloud bei Render und den lokalen Server auf
 * Henriks Mac — beide teilen sich diesen Code, damit es keine zwei Stände
 * gibt.
 *
 * WAS SICH GEÄNDERT HAT
 *
 * Bis zum 31.08.2026 standen hier rund fünfhundert Zeilen Beispieldaten:
 * Anna, Bob, Clara, ihre Chats, Beiträge und Communitys. Jeder Endpunkt hat
 * darin herumgeschrieben und das Ergebnis zurückgegeben — nebenbei ging
 * derselbe Vorgang noch an Supabase, aber was der Browser sah, kam aus dem
 * Arbeitsspeicher. Zwei Folgen davon:
 *
 *   1. Nach jedem Neustart war alles wieder auf Anfang.
 *   2. Die App (Expo) las aus ihrer eigenen Kopie derselben Beispieldaten.
 *      Beide Fassungen konnten gar nicht denselben Stand haben.
 *
 * Jetzt ist die Datenbank die einzige Quelle. Es gibt keine Beispieldaten
 * mehr, auf die zurückgefallen werden könnte: was hier nicht aus Supabase
 * kommt, kommt nicht. Die Inhalte selbst stehen als echte Zeilen in der
 * Datenbank (SUPABASE_SCHEMA_6_inhalte.sql).
 *
 * Ohne Anmeldung ist nichts sichtbar. Das ist keine Härte, sondern die Regel
 * der Datenbank: Row Level Security lässt anonyme Zugriffe nicht zu. Die
 * Oberfläche zeigt in dem Fall die Anmeldung.
 */

const express = require('express');
const path = require('path');
const supabaseApi = require('./supabase-api');
const syncHandlers = require('./sync-handlers');
const { clientFuer, tokenAus, isConfigured, supabaseUrl, supabaseKey } = require('./supabase');

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

/*
 * Anmeldung.
 *
 * Die Oberfläche reicht ihr Zugangstoken im Kopf "Authorization: Bearer ..."
 * mit; hier wird daraus ein Datenbank-Client im Namen dieses Nutzers. Ohne
 * Anmeldung bleibt req.db null.
 */
app.use('/api', async (req, _res, next) => {
  req.db = null;
  req.nutzerId = null;

  const token = tokenAus(req);
  if (!token) return next();

  const client = clientFuer(token);
  if (!client) return next();

  try {
    const { data, error } = await client.auth.getUser();
    if (!error && data?.user) {
      req.db = client;
      req.nutzerId = data.user.id;
    }
  } catch {
    // Abgelaufenes oder falsches Token: weiter als nicht angemeldet.
  }
  next();
});

// ============================================================================
// Hilfsmittel
// ============================================================================

/**
 * Umschlag für jeden Endpunkt, der die Datenbank braucht.
 *
 * Nimmt drei Dinge ab, die sonst zweiundfünfzig Mal dastünden: die Prüfung
 * auf Anmeldung, das try/catch und das Protokollieren. Ein Fehler in der
 * Datenbank wird zu einer Antwort mit Grund — nicht zu einer stillen leeren
 * Liste. Genau dieses Verschlucken hat monatelang verborgen, dass gar nichts
 * ankam.
 */
function route(fn) {
  return async (req, res) => {
    if (!req.db || !req.nutzerId) {
      return res.status(401).json({ ok: false, angemeldet: false, error: 'Bitte anmelden' });
    }
    try {
      const ergebnis = await fn(req, res);
      if (!res.headersSent && ergebnis !== undefined) res.json(ergebnis);
    } catch (fehler) {
      console.error(`${req.method} ${req.path} fehlgeschlagen:`, fehler.message);
      if (!res.headersSent) res.status(500).json({ ok: false, error: fehler.message });
    }
  };
}

/** Aus dem Ergebnis eines Schreib-Handlers wird eine Antwort. */
function antwort(ergebnis, zusatz = {}) {
  if (!ergebnis) return { ok: false, error: 'Nicht angemeldet' };
  if (ergebnis.ok === false) return { ok: false, error: ergebnis.fehler || 'Hat nicht geklappt' };
  return { ok: true, ...ergebnis, ...zusatz };
}

/** Einen einzelnen Beitrag frisch aus der Datenbank holen. */
async function beitrag(req, id) {
  const alle = await supabaseApi.ladeBeitraege(req.db, req.nutzerId, { limit: 500 });
  return alle.find((b) => b.id === id) || null;
}

// ============================================================================
// Zustand und Zugangsdaten
// ============================================================================

/*
 * Zustand des Backends. Zeigt in einem Blick, ob die Website wirklich mit der
 * Datenbank spricht. Ohne diesen Endpunkt sieht "es läuft" genauso aus wie
 * "es kommt nichts an" — genau das hat lange verschleiert, dass nichts ankam.
 */
app.get('/api/zustand', async (req, res) => {
  const ergebnis = {
    zeit: new Date().toISOString(),
    supabase: {
      konfiguriert: isConfigured(),
      url: supabaseUrl,
      quelle: process.env.SUPABASE_URL ? 'Umgebungsvariable' : 'Standardwert im Code',
    },
    anmeldung: { angemeldet: Boolean(req.nutzerId), nutzerId: req.nutzerId },
    // Es gibt keine zweite Möglichkeit mehr. Ohne Anmeldung ist die Antwort
    // leer, nicht ersatzweise gefüllt.
    daten: req.nutzerId ? 'Supabase' : 'keine (nicht angemeldet)',
    beispieldaten: false,
  };

  if (isConfigured() && req.db) {
    try {
      const { count, error } = await req.db
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      ergebnis.supabase.erreichbar = !error;
      ergebnis.supabase.profile = error ? null : count;
      if (error) ergebnis.supabase.fehler = error.message;

      const { count: beitraege } = await req.db
        .from('posts')
        .select('*', { count: 'exact', head: true });
      ergebnis.supabase.beitraege = beitraege ?? null;
    } catch (fehler) {
      ergebnis.supabase.erreichbar = false;
      ergebnis.supabase.fehler = fehler.message;
    }
  } else if (isConfigured()) {
    ergebnis.supabase.erreichbar = null;
    ergebnis.supabase.hinweis =
      'Ohne Anmeldung nicht prüfbar: die Regeln der Datenbank lassen anonyme Zugriffe nicht zu.';
  }

  res.json(ergebnis);
});

/*
 * Die Zugangsdaten, mit denen sich die Oberfläche selbst bei Supabase
 * anmeldet. Der Schlüssel ist der öffentliche „publishable"-Schlüssel; er
 * steckt genauso im App-Bundle. Geschützt wird die Datenbank durch ihre
 * Regeln, nicht durch Geheimhaltung dieses Schlüssels.
 */
app.get('/api/konfiguration', (_req, res) => {
  res.json({ supabaseUrl, supabaseKey, konfiguriert: isConfigured() });
});

/*
 * Das eigene Konto auf den Startzustand zurücksetzen.
 *
 * Für die Prüfläufe: sie sollen wiederholbar sein und keine Testgruppen oder
 * Testkommentare hinterlassen. Vorher stellte dieser Endpunkt die Beispiel-
 * daten im Arbeitsspeicher wieder her — die gibt es nicht mehr, also räumt
 * jetzt die Datenbank auf.
 *
 * Angefasst wird ausschließlich das eigene Konto. Ein Prüflauf kann damit
 * nichts anfassen, was jemand anderem gehört.
 */
app.post('/api/reset', route(async (req) => {
  const { data, error } = await req.db.rpc('zuruecksetzen', { ziel: req.nutzerId });
  if (error) throw error;
  return { ok: data?.ok !== false, ...(data || {}) };
}));

// ============================================================================
// Startdaten
// ============================================================================

/*
 * Alles, was die Oberfläche beim Start braucht.
 *
 * Nicht angemeldet ist kein Fehler: die Antwort sagt es und die Oberfläche
 * zeigt die Anmeldung. Deshalb 200 und nicht 401 — sonst protokollierte der
 * Browser bei jedem ersten Aufruf einen Ladefehler.
 */
app.get('/api/bootstrap', async (req, res) => {
  if (!req.db || !req.nutzerId) {
    return res.json({ angemeldet: false, quelle: 'keine', hinweis: 'Bitte anmelden' });
  }
  try {
    const daten = await supabaseApi.bootstrapData(req.db, req.nutzerId);
    res.json({ angemeldet: true, ...daten });
  } catch (fehler) {
    console.error('Startdaten fehlgeschlagen:', fehler.message);
    res.status(500).json({ angemeldet: true, error: fehler.message });
  }
});

// ============================================================================
// Chats
// ============================================================================

/*
 * Diese Route ist bewusst eng gefasst. `:was` würde sonst auch /accept, /read
 * und alles andere unter /api/chats/... abfangen — Express nimmt die erste
 * passende Route. Unbekanntes geht deshalb mit next() weiter.
 */
const CHAT_AKTIONEN = ['archiv', 'stumm', 'gelesen', 'loeschen', 'sperren', 'mitteilungen', 'blockieren', 'favorit'];

app.post('/api/chats/:chatId/:was', (req, res, next) => {
  if (!CHAT_AKTIONEN.includes(req.params.was)) return next();
  return route(async () => {
    const { chatId, was } = req.params;

    const { data: chat } = await req.db.from('chats').select('id, name').eq('id', chatId).maybeSingle();
    if (!chat) return { ok: false, error: 'Diesen Chat gibt es nicht' };

    if (was === 'loeschen') {
      const e = await syncHandlers.handleLeaveChat(req.db, req.nutzerId, chatId);
      return antwort(e, { meldung: `„${chat.name}" gelöscht` });
    }

    if (was === 'blockieren') {
      // Blockiert wird die Person, nicht der Chat. Ein Zweierchat hat genau
      // eine andere Person; in einer Gruppe ergibt der Knopf keinen Sinn.
      const { data: andere } = await req.db
        .from('chat_members')
        .select('user_id')
        .eq('chat_id', chatId)
        .neq('user_id', req.nutzerId);
      const ziel = (andere || [])[0]?.user_id;
      if (!ziel) return { ok: false, error: 'In einer Gruppe geht das nicht' };

      const e = await syncHandlers.handleBlockUser(req.db, req.nutzerId, ziel);
      return antwort(e, {
        blocked: e?.blockiert,
        meldung: e?.blockiert ? `„${chat.name}" blockiert` : `„${chat.name}" nicht mehr blockiert`,
      });
    }

    if (was === 'favorit') {
      return antwort(await syncHandlers.handleMarkChatFavorite(req.db, req.nutzerId, chatId));
    }

    const e = await syncHandlers.handleChatAction(req.db, req.nutzerId, chatId, was);
    const meldungen = {
      archiv: [`„${chat.name}" archiviert`, `„${chat.name}" ist wieder in der Liste`],
      stumm: [`„${chat.name}" stummgeschaltet`, `„${chat.name}" ist nicht mehr stumm`],
      gelesen: ['Als gelesen markiert', 'Als ungelesen markiert'],
      sperren: [`„${chat.name}" ist gesperrt`, `„${chat.name}" ist wieder offen`],
      mitteilungen: [`Keine Mitteilungen mehr aus „${chat.name}"`, `Mitteilungen aus „${chat.name}" wieder an`],
    };
    const an = Boolean(e?.wert);
    return antwort(e, {
      archiviert: was === 'archiv' ? an : undefined,
      muted: was === 'stumm' ? an : undefined,
      unread: was === 'gelesen' ? (an ? 0 : 1) : undefined,
      gesperrt: was === 'sperren' ? an : undefined,
      aus: was === 'mitteilungen' ? an : undefined,
      meldung: (meldungen[was] || [])[an ? 0 : 1],
    });
  })(req, res);
});

app.post('/api/chats/:chatId/melden', route(async (req) => {
  const grund = String(req.body?.grund || '').trim();
  if (!grund) return { ok: false, error: 'Bitte einen Grund angeben' };

  const { data: andere } = await req.db
    .from('chat_members')
    .select('user_id')
    .eq('chat_id', req.params.chatId)
    .neq('user_id', req.nutzerId);
  const ziel = (andere || [])[0]?.user_id;
  if (!ziel) return { ok: false, error: 'Diesen Chat gibt es nicht' };

  await syncHandlers.handleReportContent(req.db, req.nutzerId, ziel, grund, 'user');
  return { ok: true, grund, meldung: 'Danke, die Meldung ist bei uns angekommen' };
}));

app.post('/api/chats/:chatId/leeren', route(async (req) => {
  const e = await syncHandlers.handleClearChat(req.db, req.nutzerId, req.params.chatId);
  return antwort(e, { chats: await supabaseApi.ladeChats(req.db, req.nutzerId) });
}));

app.post('/api/chats/:chatId/read', route(async (req) =>
  antwort(await syncHandlers.handleChatAction(req.db, req.nutzerId, req.params.chatId, 'gelesen', true))
));

app.post('/api/chats/:chatId/accept', route(async (req) => {
  const { data: andere } = await req.db
    .from('chat_members')
    .select('user_id')
    .eq('chat_id', req.params.chatId)
    .neq('user_id', req.nutzerId);
  const ziel = (andere || [])[0]?.user_id;
  if (!ziel) return { ok: false, error: 'Chat nicht gefunden' };

  const e = await syncHandlers.handleAcceptRequest(req.db, req.nutzerId, ziel);
  return antwort(e, { chatId: req.params.chatId });
}));

app.get('/api/messages/:chatId', route(async (req) =>
  supabaseApi.ladeNachrichten(req.db, req.params.chatId, req.nutzerId)
));

app.post('/api/messages/:chatId', route(async (req) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return { ok: false, error: 'Text erforderlich' };

  const sperre = await chatGesperrt(req, req.params.chatId);
  if (sperre) return { ok: false, error: sperre };

  const e = await syncHandlers.handleSendMessage(req.db, req.nutzerId, req.params.chatId, text);
  if (!e || e.ok === false) return antwort(e);

  return {
    id: e.nachricht.id,
    from: 'me',
    text,
    time: supabaseApi.chatZeit(e.nachricht.created_at),
    zeitpunkt: e.nachricht.created_at,
  };
}));

/**
 * Darf in diesem Chat geschrieben werden?
 *
 * Zwei Gründe sprechen dagegen: die Kontaktanfrage läuft noch (bei einem
 * privaten Profil), oder die Person ist blockiert. Beides steht in der
 * Datenbank, nicht im Browser — eine Regel, die nur im Markup steht, ist
 * keine.
 */
async function chatGesperrt(req, chatId) {
  const { data: andere } = await req.db
    .from('chat_members')
    .select('user_id')
    .eq('chat_id', chatId)
    .neq('user_id', req.nutzerId);
  const ziel = (andere || [])[0]?.user_id;
  if (!ziel) return null;

  const [{ data: kontakt }, { count: blockiert }] = await Promise.all([
    req.db
      .from('contacts')
      .select('status')
      .eq('user_id', req.nutzerId)
      .eq('contact_id', ziel)
      .maybeSingle(),
    req.db
      .from('blocks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.nutzerId)
      .eq('blocked_user_id', ziel),
  ]);

  if (blockiert > 0) return 'Diese Person ist blockiert';
  if (kontakt?.status === 'pending') return 'Warte, bis die Anfrage angenommen wurde';
  return null;
}

app.post('/api/messages/:chatId/anhang', route(async (req) => {
  const art = req.body?.art;
  const sperre = await chatGesperrt(req, req.params.chatId);
  if (sperre) return { ok: false, error: sperre };

  let text;
  let medien = {};

  if (art === 'foto') {
    text = 'Foto';
    medien = { typ: 'image' };
  } else if (art === 'standort') {
    const standorte = await supabaseApi.ladeStandorte(req.db);
    const platz = standorte.find((p) => p.id === req.body?.id) || standorte[0];
    if (!platz) return { ok: false, error: 'Diesen Standort gibt es nicht' };
    text = `Standort: ${platz.name}`;
    medien = { standortId: platz.id };
  } else if (art === 'kontakt') {
    const person = await supabaseApi.ladeProfil(req.db, req.body?.id);
    if (!person) return { ok: false, error: 'Diese Person gibt es nicht' };
    text = `Kontakt: ${person.name}`;
    medien = { kontaktId: person.id };
  } else {
    return { ok: false, error: 'Unbekannter Anhang' };
  }

  const e = await syncHandlers.handleSendMessage(req.db, req.nutzerId, req.params.chatId, text, medien);
  if (!e || e.ok === false) return antwort(e);

  /*
   * Der Chat wird sofort neu gezeichnet, ohne die Nachrichten noch einmal zu
   * holen. Die Karte muss deshalb schon hier fertig sein — sonst steht bis
   * zum naechsten Laden nur der Satz da.
   */
  const frisch = await supabaseApi.ladeNachrichten(req.db, req.params.chatId, req.nutzerId);
  const angelegt = (frisch || []).find((m) => m.id === e.nachricht.id);

  return {
    ok: true,
    message: angelegt || {
      id: e.nachricht.id,
      from: 'me',
      text,
      media: medien.typ,
      time: supabaseApi.chatZeit(e.nachricht.created_at),
    },
  };
}));

app.post('/api/messages/:chatId/:messageId/stern', route(async (req) => {
  const e = await syncHandlers.handleStarMessage(req.db, req.nutzerId, req.params.messageId);
  return antwort(e, { id: req.params.messageId });
}));

/** Alles, was in diesem Chat an Medien und Markiertem liegt. */
app.get('/api/chats/:chatId/medien', route(async (req) => {
  const alle = await supabaseApi.ladeNachrichten(req.db, req.params.chatId, req.nutzerId);
  const { data: sterne } = await req.db
    .from('message_stars')
    .select('message_id')
    .eq('user_id', req.nutzerId);
  const markiert = new Set((sterne || []).map((s) => s.message_id));

  return {
    medien: alle.filter((m) => m.media),
    markiert: alle.filter((m) => markiert.has(m.id)),
    gesamt: alle.length,
  };
}));

app.post('/api/groups', route(async (req) => {
  const name = String(req.body?.name || '').trim();
  const mitglieder = Array.isArray(req.body?.memberIds) ? req.body.memberIds : [];
  if (!name) return { ok: false, error: 'Name erforderlich' };
  if (mitglieder.length === 0) return { ok: false, error: 'Mindestens ein Mitglied erforderlich' };

  const e = await syncHandlers.handleCreateGroup(req.db, req.nutzerId, name, mitglieder, req.body?.bereich);
  if (!e || e.ok === false) return antwort(e);

  const info = String(req.body?.info || '').trim();
  if (info) await syncHandlers.handleSendMessage(req.db, req.nutzerId, e.chat.id, info);

  return {
    id: e.chat.id,
    name: e.chat.name,
    isGroup: true,
    members: mitglieder,
    preview: info || 'Gruppe erstellt',
    time: supabaseApi.chatZeit(e.chat.created_at),
    unread: 0,
    muted: false,
  };
}));

// ============================================================================
// Kontakte
// ============================================================================

app.post('/api/personen/suche', route(async (req) => {
  const e = await syncHandlers.handleFindPerson(req.db, req.nutzerId, req.body?.eingabe || '');
  return { person: e?.person || null };
}));

/*
 * "Nicht gefunden" und "schon vorhanden" sind hier normale Ergebnisse einer
 * Suche, keine Fehler der Anfrage. Deshalb 200 mit ok-Feld statt 404/409 —
 * sonst protokolliert der Browser bei jeder Fehleingabe einen Ladefehler.
 */
app.post('/api/contacts', route(async (req) => {
  const eingabe = String(req.body?.handle || '').trim();
  if (!eingabe) return { ok: false, error: 'Bitte Benutzername oder Telefonnummer eingeben' };

  const gefunden = await syncHandlers.handleFindPerson(req.db, req.nutzerId, eingabe);
  const person = gefunden?.person;
  if (!person) {
    return {
      ok: false,
      error: syncHandlers.istNummer(eingabe)
        ? 'Zu dieser Nummer gibt es noch kein Konto'
        : 'Niemand mit diesem Benutzernamen gefunden',
    };
  }

  const privat = Boolean(person.privat);
  const e = await syncHandlers.handleAddContact(
    req.db, req.nutzerId, person.id, privat, String(req.body?.nachricht || '')
  );
  if (e?.fehler === 'schon-vorhanden') {
    return { ok: false, error: `${person.name} ist bereits in deinen Kontakten` };
  }
  if (!e || e.ok === false) return antwort(e);

  return {
    ok: true,
    privat,
    contact: {
      id: person.id,
      name: person.name,
      status: e.status,
      about: privat ? 'Anfrage gesendet' : 'Kontakt',
      phone: person.phone,
    },
    /*
     * Der Chat wird gleich geoeffnet, ohne dass die Seite die Chatliste neu
     * holt. "requestState" muss deshalb schon hier stehen — sonst bleibt das
     * Eingabefeld offen, obwohl die Anfrage noch laeuft, und der Nutzer kann
     * jemandem schreiben, der ihn noch gar nicht angenommen hat.
     */
    chat: {
      id: e.chatId,
      userId: person.id,
      name: person.name,
      isGroup: false,
      requestState: e.status === 'pending' ? 'pending' : 'accepted',
    },
  };
}));

app.post('/api/kontakte/:userId/favorit', route(async (req) => {
  const e = await syncHandlers.handleContactFavorite(req.db, req.nutzerId, req.params.userId);
  return antwort(e, { contacts: await supabaseApi.ladeKontakte(req.db, req.nutzerId) });
}));

// ============================================================================
// Profile
// ============================================================================

app.get('/api/profile/:userId', route(async (req, res) => {
  const id = req.params.userId === 'me' ? req.nutzerId : req.params.userId;
  const profil = await supabaseApi.ladeProfil(req.db, id);
  if (!profil) return res.status(404).json({ error: 'Nicht gefunden' });

  const [{ data: zahlen }, { count: folgeIch }, beitraege, { count: istStumm }, { count: istBlockiert }] =
    await Promise.all([
      req.db.from('profile_zahlen').select('*').eq('id', id).maybeSingle(),
      req.db
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', req.nutzerId)
        .eq('followee_id', id),
      supabaseApi.ladeBeitraege(req.db, req.nutzerId, { limit: 200 }),
      /*
       * Stumm und blockiert gehoeren auf die Profilseite: dort steht der Satz
       * "… ist stummgeschaltet", und der Nachricht-Knopf ist gesperrt.
       *
       * Beides fehlte in dieser Antwort. Das Umschalten funktionierte, die
       * Datenbank merkte es sich — nur sah man davon nichts, weil die
       * Profilseite gar nicht danach fragte.
       */
      req.db
        .from('mutes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.nutzerId)
        .eq('muted_user_id', id),
      req.db
        .from('blocks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.nutzerId)
        .eq('blocked_user_id', id),
    ]);

  const eigene = beitraege.filter((b) => b.userId === id || (id === req.nutzerId && b.userId === 'me'));

  res.json({
    ...profil,
    userId: id,
    followers: Number(zahlen?.followers || 0),
    following: Number(zahlen?.following || 0),
    posts: Number(zahlen?.beitraege || 0),
    isFollowing: folgeIch > 0,
    following_me: folgeIch > 0,
    muted: istStumm > 0,
    blocked: istBlockiert > 0,
    // Das Raster zeigt, was diese Person veröffentlicht hat — nicht mehr eine
    // erfundene Kachelfolge.
    grid: eigene.map((b) => ({
      id: b.id,
      kind: b.kind === 'post' ? 'image' : 'video',
      eigen: id === req.nutzerId,
      // Ohne die Adresse zeigt jede Kachel die Ersatzflaeche, auch wenn ein
      // Bild da ist. Bei einem Video steht in mediaUrl eine .mp4 — dann
      // braucht die Kachel das Standbild dazu.
      mediaUrl: b.mediaUrl,
      thumbnail: b.thumbnail,
    })),
  });
}));

app.post('/api/profile/:userId/:was', (req, res, next) => {
  if (!['stumm', 'block', 'melden'].includes(req.params.was)) return next();
  return route(async () => {
    const { userId, was } = req.params;

    if (was === 'stumm') {
      const e = await syncHandlers.handleMuteUser(req.db, req.nutzerId, userId);
      return antwort(e, { muted: e?.stumm });
    }
    if (was === 'melden') {
      const grund = String(req.body?.grund || '').trim();
      if (!grund) return { ok: false, error: 'Bitte einen Grund auswählen' };
      const e = await syncHandlers.handleReportContent(req.db, req.nutzerId, userId, grund, 'user');
      return antwort(e, { gemeldet: grund });
    }

    const e = await syncHandlers.handleBlockUser(req.db, req.nutzerId, userId);
    // Blockieren hat Folgen: die Person fliegt aus den Kontakten. Sonst wäre
    // der Knopf nur ein Hinweis mit anderem Text.
    if (e?.blockiert) {
      await req.db.from('contacts').delete().eq('user_id', req.nutzerId).eq('contact_id', userId);
      await req.db.from('follows').delete().eq('follower_id', req.nutzerId).eq('followee_id', userId);
    }
    return antwort(e, {
      blocked: e?.blockiert,
      contacts: await supabaseApi.ladeKontakte(req.db, req.nutzerId),
    });
  })(req, res);
});

const folgen = route(async (req) => {
  const e = await syncHandlers.handleFollowUser(req.db, req.nutzerId, req.params.userId);
  if (!e || e.ok === false) return antwort(e);

  const { data: zahlen } = await req.db
    .from('profile_zahlen')
    .select('followers')
    .eq('id', req.params.userId)
    .maybeSingle();

  return {
    ok: true,
    following: e.folgt,
    following_me: e.folgt,
    followers: Number(zahlen?.followers || 0),
  };
});

app.post('/api/autoren/:userId/follow', folgen);
app.post('/api/profile/:userId/follow', folgen);

// ============================================================================
// Eigenes Profil und eigene Inhalte
// ============================================================================

app.post('/api/eigene/profil', route(async (req) => {
  const { name, bio, link, color } = req.body || {};
  const aenderungen = {};

  if (name !== undefined) {
    const sauber = String(name).trim();
    if (!sauber) return { ok: false, error: 'Der Name darf nicht leer sein' };
    if (sauber.length > 40) return { ok: false, error: 'Der Name ist zu lang (höchstens 40 Zeichen)' };
    aenderungen.name = sauber;
    // Kürzel aus den Anfangsbuchstaben, höchstens zwei.
    aenderungen.initials = sauber.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  }

  if (bio !== undefined) {
    const sauber = String(bio).trim();
    if (sauber.length > 150) return { ok: false, error: 'Die Info ist zu lang (höchstens 150 Zeichen)' };
    aenderungen.bio = sauber;
  }

  if (link !== undefined) aenderungen.link = String(link).trim();

  /*
   * Erlaubt ist eine einzelne Farbe oder ein Zwei-Ton-Verlauf. Der Wert landet
   * ungefiltert in einem style-Attribut, deshalb wird er hier eng geprüft und
   * nicht nur auf Länge.
   */
  const istFarbe = /^#[0-9a-fA-F]{6}$/.test(String(color));
  const istVerlauf = /^linear-gradient\(135deg,#[0-9a-fA-F]{6},#[0-9a-fA-F]{6}\)$/.test(String(color));
  if (color !== undefined && (istFarbe || istVerlauf)) aenderungen.color = color;

  if (Object.keys(aenderungen).length === 0) return { ok: false, error: 'Nichts zu ändern' };

  const e = await syncHandlers.handleUpdateProfile(req.db, req.nutzerId, aenderungen);
  if (!e || e.ok === false) return antwort(e);

  const profil = await supabaseApi.ladeProfil(req.db, req.nutzerId);
  return { ok: true, profil };
}));

app.post('/api/eigene/highlight', route(async (req) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return { ok: false, error: 'Bitte einen Namen eingeben' };
  return antwort(await syncHandlers.handleProfilListe(req.db, req.nutzerId, 'highlights', name));
}));

app.post('/api/eigene/playlist', route(async (req) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return { ok: false, error: 'Bitte einen Namen eingeben' };
  return antwort(await syncHandlers.handleProfilListe(req.db, req.nutzerId, 'playlists', name));
}));

app.post('/api/eigene/spende', route(async (req) => {
  const titel = String(req.body?.titel || '').trim();
  if (!titel) return { ok: false, error: 'Bitte einen Titel eingeben' };

  /*
   * Das Ziel ist freiwillig — nicht jede Sammlung läuft auf einen Betrag zu,
   * manche laufen einfach. Freiwillig heißt aber nicht beliebig: Text oder
   * eine negative Zahl werden weiterhin abgelehnt.
   */
  const roh = String(req.body?.ziel ?? '').trim();
  let ziel = 0;
  if (roh) {
    ziel = Number(roh.replace(',', '.'));
    if (!Number.isFinite(ziel) || ziel <= 0) {
      return { ok: false, error: 'Das Spendenziel muss eine Zahl über null sein' };
    }
  }

  const spende = { titel, ziel, gesammelt: 0, text: String(req.body?.text || '').trim() };
  return antwort(await syncHandlers.handleSpende(req.db, req.nutzerId, spende));
}));

const musikAus = (body) => String(body?.music || '').trim() || 'Originalton';

app.post('/api/eigene/beitrag', route(async (req) => {
  const beschreibung = String(req.body?.beschreibung || '').trim();
  if (!beschreibung) return { ok: false, error: 'Bitte eine Beschreibung eingeben' };

  const e = await syncHandlers.handleCreatePost(req.db, req.nutzerId, {
    art: 'post',
    beschreibung,
    ort: String(req.body?.ort || '').trim(),
    musik: musikAus(req.body),
  });
  if (!e || e.ok === false) return antwort(e);
  return { ok: true, beitrag: await beitrag(req, e.beitrag.id) };
}));

app.post('/api/eigene/video', route(async (req) => {
  const beschreibung = String(req.body?.beschreibung || '').trim();
  if (!beschreibung) return { ok: false, error: 'Bitte eine Beschreibung eingeben' };
  const quer = req.body?.format === 'quer';

  const e = await syncHandlers.handleCreatePost(req.db, req.nutzerId, {
    // Querformat ist 'clip', Hochformat 'reel'. Eine eigene Tabelle für
    // Videos gibt es nicht.
    art: quer ? 'clip' : 'reel',
    titel: quer ? beschreibung : '',
    beschreibung,
    ort: String(req.body?.ort || '').trim(),
    musik: musikAus(req.body),
    dauer: quer ? String(req.body?.dauer || '00:15') : null,
  });
  if (!e || e.ok === false) return antwort(e);

  const frisch = await beitrag(req, e.beitrag.id);
  return quer ? { ok: true, clip: frisch } : { ok: true, video: frisch };
}));

app.post('/api/eigene/livestream', route(async (req) => {
  if (req.body?.aktion === 'start') {
    const e = await syncHandlers.handleLivestream(req.db, req.nutzerId, {
      seit: Date.now(),
      zuschauer: 0,
    });
    return antwort(e, { live: true });
  }

  const { data: profil } = await req.db.from('profiles').select('live').eq('id', req.nutzerId).maybeSingle();
  const lief = profil?.live;
  await syncHandlers.handleLivestream(req.db, req.nutzerId, null);
  if (!lief) return { ok: true, live: false };

  // Die Aufzeichnung ist ein normales Video, kein laufender Stream — sie
  // gehört unter "Standard", nicht unter "Live".
  const sekunden = Math.max(1, Math.round((Date.now() - lief.seit) / 1000));
  const e = await syncHandlers.handleCreatePost(req.db, req.nutzerId, {
    art: 'clip',
    titel: String(req.body?.titel || '').trim() || 'Livestream-Aufzeichnung',
    dauer: `${String(Math.floor(sekunden / 60)).padStart(2, '0')}:${String(sekunden % 60).padStart(2, '0')}`,
  });
  if (!e || e.ok === false) return antwort(e);

  return { ok: true, live: false, clip: await beitrag(req, e.beitrag.id) };
}));

app.post('/api/eigene/:id/loeschen', route(async (req) => {
  const eigener = await beitrag(req, req.params.id);
  if (!eigener) return { ok: false, error: 'Das gibt es nicht mehr' };
  if (eigener.userId !== 'me') return { ok: false, error: 'Das ist nicht dein Beitrag' };

  const e = await syncHandlers.handleDeleteContent(req.db, req.nutzerId, req.params.id, 'post');
  return antwort(e, { meldung: 'Gelöscht' });
}));

app.post('/api/eigene/:id/sammlung', route(async (req) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return { ok: false, error: 'Bitte eine Sammlung wählen' };

  const eigener = await beitrag(req, req.params.id);
  if (!eigener) return { ok: false, error: 'Das gibt es nicht mehr' };

  /*
   * Bis zum 01.09.2026 gab dieser Endpunkt "Sammlungen sind noch nicht
   * angelegt" zurueck — ehrlich, aber eben auch: die Funktion gab es nicht.
   * Jetzt steht die Zuordnung in public.sammlung_beitraege.
   */
  const { data: schon } = await req.db
    .from('sammlung_beitraege')
    .select('post_id')
    .eq('user_id', req.nutzerId)
    .eq('sammlung', name)
    .eq('post_id', req.params.id)
    .maybeSingle();

  if (schon) return { ok: false, error: `„${name}" enthält das schon` };

  const { error } = await req.db
    .from('sammlung_beitraege')
    .insert({ user_id: req.nutzerId, sammlung: name, post_id: req.params.id });
  if (error) throw error;

  return { ok: true, meldung: `Zu „${name}" hinzugefügt` };
}));

// ============================================================================
// Beiträge, Videos, Clips
// ============================================================================

/*
 * Ein Endpunkt für alle drei. Vorher gab es /posts, /videos und /clips mit je
 * eigener Fassung derselben Aktionen — bei /videos fehlte "save" in Supabase,
 * bei /clips fehlte alles. Jetzt laufen alle drei durch dieselbe Stelle und
 * können gar nicht mehr auseinander liegen.
 */
async function inhaltsAktion(req) {
  const { id, action } = req.params;
  const vorher = await beitrag(req, id);
  if (!vorher) return { fehlt: true };

  const handler = {
    like: () => syncHandlers.handleLikeContent(req.db, req.nutzerId, id),
    save: () => syncHandlers.handleSaveContent(req.db, req.nutzerId, id),
    repost: () => syncHandlers.handleRepostContent(req.db, req.nutzerId, id),
    notify: () => syncHandlers.handleNotifyPost(req.db, req.nutzerId, id),
    share: () => syncHandlers.handleShareContent(req.db, req.nutzerId, id, req.body?.empfaenger || []),
    follow: async () => {
      const autor = vorher.userId === 'me' ? req.nutzerId : vorher.userId;
      return syncHandlers.handleFollowUser(req.db, req.nutzerId, autor);
    },
  }[action];

  if (!handler) return { unbekannt: true };
  const e = await handler();
  if (e && e.ok === false) return { fehler: e.fehler };

  const nachher = await beitrag(req, id);
  // Bei "notify" und "follow" ändert sich am Beitrag selbst nichts — der
  // Zustand kommt aus dem Handler.
  if (action === 'notify') return { ...nachher, notify: e?.notify };
  if (action === 'follow') return { ...nachher, following: e?.folgt };
  return nachher;
}

for (const pfad of ['/api/posts/:id/:action', '/api/videos/:id/:action', '/api/clips/:id/:action']) {
  app.post(pfad, route(async (req, res) => {
    const ergebnis = await inhaltsAktion(req);
    if (ergebnis?.fehlt) return res.status(404).json({ error: 'Nicht gefunden' });
    if (ergebnis?.unbekannt) return res.status(400).json({ error: 'Unbekannte Aktion' });
    if (ergebnis?.fehler) return res.status(500).json({ error: ergebnis.fehler });
    res.json(ergebnis);
  }));
}

app.post('/api/teilen', route(async (req) => {
  const empfaenger = Array.isArray(req.body?.empfaenger) ? req.body.empfaenger : [];
  if (empfaenger.length === 0) return { ok: false, error: 'Bitte mindestens eine Person auswählen' };

  const eintrag = await beitrag(req, req.body?.id);
  if (!eintrag) return { ok: false, error: 'Diesen Beitrag gibt es nicht mehr' };

  const vorschau = eintrag.kind === 'post' ? 'Beitrag geteilt' : 'Video geteilt';
  const e = await syncHandlers.handleShareToChats(req.db, req.nutzerId, eintrag.id, empfaenger, vorschau);
  return antwort(e, { chats: await supabaseApi.ladeChats(req.db, req.nutzerId) });
}));

app.get('/api/reposts', route(async (req) => {
  const { data, error } = await req.db.from('reposts').select('post_id').eq('user_id', req.nutzerId);
  if (error) throw error;

  const ids = new Set((data || []).map((r) => r.post_id));
  const alle = await supabaseApi.ladeBeitraege(req.db, req.nutzerId, { limit: 500 });
  return alle
    .filter((b) => ids.has(b.id))
    .map((b) => ({ art: b.kind === 'post' ? 'post' : b.kind === 'clip' ? 'clip' : 'video', eintrag: b }));
}));

// ============================================================================
// Kommentare
// ============================================================================

app.get('/api/comments/:targetId', route(async (req) =>
  supabaseApi.ladeKommentare(req.db, req.nutzerId, req.params.targetId)
));

app.post('/api/comments/:targetId', route(async (req) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return { ok: false, error: 'Text erforderlich' };

  const e = await syncHandlers.handleCreateComment(req.db, req.nutzerId, req.params.targetId, text);
  if (!e || e.ok === false) return antwort(e);

  return {
    id: e.kommentar.id,
    userId: 'me',
    text,
    time: supabaseApi.chatZeit(e.kommentar.created_at),
    likes: 0,
    liked: false,
  };
}));

app.post('/api/comments/:targetId/:commentId/like', route(async (req) => {
  const e = await syncHandlers.handleLikeComment(req.db, req.nutzerId, req.params.commentId);
  if (!e || e.ok === false) return antwort(e);

  const alle = await supabaseApi.ladeKommentare(req.db, req.nutzerId, req.params.targetId);
  return alle.find((k) => k.id === req.params.commentId) || { ok: true };
}));

// ============================================================================
// Storys
// ============================================================================

app.post('/api/stories/:id/like', route(async (req) => {
  const e = await syncHandlers.handleLikeStory(req.db, req.nutzerId, req.params.id);
  if (!e || e.ok === false) return antwort(e);
  const alle = await supabaseApi.ladeStorys(req.db, req.nutzerId);
  return alle.find((s) => s.id === req.params.id) || { ok: true };
}));

app.post('/api/stories/:id/seen', route(async (req) =>
  antwort(await syncHandlers.handleViewStory(req.db, req.nutzerId, req.params.id))
));

app.post('/api/stories/:id/reply', route(async (req) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return { ok: false, error: 'Bitte etwas schreiben' };

  const e = await syncHandlers.handleStoryReply(req.db, req.nutzerId, req.params.id, text);
  if (!e || e.ok === false) return antwort(e);

  return {
    ok: true,
    chatId: e.chatId,
    message: {
      id: e.nachricht.id,
      from: 'me',
      text,
      time: supabaseApi.chatZeit(e.nachricht.created_at),
    },
  };
}));

// ============================================================================
// Communitys
// ============================================================================

app.get('/api/communities', route(async (req) => {
  const alle = await supabaseApi.ladeCommunities(req.db, req.nutzerId);
  const filter = req.query.filter || 'joined';
  return alle.filter((c) => (filter === 'discover' ? !c.joined : c.joined));
}));

app.get('/api/communities/:id', route(async (req, res) => {
  const alle = await supabaseApi.ladeCommunities(req.db, req.nutzerId);
  const community = alle.find((c) => c.id === req.params.id);
  if (!community) return res.status(404).json({ error: 'Nicht gefunden' });
  res.json(community);
}));

app.post('/api/communities', route(async (req) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return { ok: false, error: 'Bitte einen Namen eingeben' };

  const { count } = await req.db
    .from('communities')
    .select('*', { count: 'exact', head: true })
    .ilike('name', name);
  if (count > 0) return { ok: false, error: 'Diesen Kanal gibt es schon' };

  const privat = req.body?.sichtbarkeit !== 'public';
  const e = await syncHandlers.handleCreateCommunity(
    req.db, req.nutzerId, name, String(req.body?.thema || '').trim(), privat
  );
  if (!e || e.ok === false) return antwort(e);

  // Eine Community ohne Kanal hat keine Seite, auf der etwas stehen könnte.
  await syncHandlers.handleCreateChannel(req.db, req.nutzerId, e.community.id, 'Allgemein');

  const alle = await supabaseApi.ladeCommunities(req.db, req.nutzerId);
  return { ok: true, community: alle.find((c) => c.id === e.community.id) };
}));

app.post('/api/communities/:id/join', route(async (req, res) => {
  const alle = await supabaseApi.ladeCommunities(req.db, req.nutzerId);
  const community = alle.find((c) => c.id === req.params.id);
  if (!community) return res.status(404).json({ error: 'Nicht gefunden' });

  /*
   * Aus der eigenen Community kann man nicht austreten. Die Oberfläche zeigt
   * dort keinen Knopf — der Server sagt trotzdem nein, denn eine Regel, die
   * nur im Markup steht, ist keine.
   */
  if (community.eigen) {
    return res.status(409).json({ error: 'Die eigene Community lässt sich nicht verlassen' });
  }

  await syncHandlers.handleJoinCommunity(req.db, req.nutzerId, req.params.id);
  const frisch = await supabaseApi.ladeCommunities(req.db, req.nutzerId);
  res.json(frisch.find((c) => c.id === req.params.id));
}));

app.post('/api/communities/:id/channels', route(async (req) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return { ok: false, error: 'Bitte einen Namen eingeben' };
  const e = await syncHandlers.handleCreateChannel(req.db, req.nutzerId, req.params.id, name);
  if (!e || e.ok === false) return antwort(e);
  return { ok: true, id: e.kanal.id, name: e.kanal.name };
}));

app.get('/api/communities/:id/channels/:chId', route(async (req, res) => {
  const alle = await supabaseApi.ladeCommunities(req.db, req.nutzerId);
  const community = alle.find((c) => c.id === req.params.id);
  const kanal = community?.channels.find((k) => k.id === req.params.chId || k.slug === req.params.chId);
  if (!community || !kanal) return res.status(404).json({ error: 'Nicht gefunden' });

  res.json({
    community: community.name,
    channel: kanal.name,
    topics: kanal.topics,
    messages: await supabaseApi.ladeKanalNachrichten(req.db, req.nutzerId, kanal.id),
  });
}));

app.post('/api/communities/:id/channels/:chId/nachricht', route(async (req) => {
  const text = String(req.body?.text || '').trim();
  if (!text) return { ok: false, error: 'Text erforderlich' };
  const e = await syncHandlers.handleSendChannelMessage(req.db, req.nutzerId, req.params.chId, text);
  if (!e || e.ok === false) return antwort(e);
  return {
    ok: true,
    message: {
      id: e.nachricht.id,
      from: 'me',
      text,
      time: supabaseApi.chatZeit(e.nachricht.created_at),
    },
  };
}));

// ============================================================================
// Mitteilungen
// ============================================================================

/**
 * Der Satz entsteht erst hier, gespeichert ist nur, was passiert ist. Sonst
 * müsste bei jeder Textänderung der ganze Bestand mitwandern.
 */
function mitteilungText(m, namen, communityNamen) {
  const name = namen.get(m.userId) || 'Jemand';
  const community = communityNamen.get(m.ziel?.id) || 'einer Community';
  return {
    like: `${name} gefällt dein ${m.ziel?.art === 'video' ? 'Video' : 'Beitrag'}.`,
    follow: `${name} folgt dir jetzt.`,
    comment: `${name} hat deinen Beitrag kommentiert.`,
    repost: `${name} hat dein Video repostet.`,
    mention: `${name} hat dich in einem Kommentar erwähnt.`,
    story: `${name} hat auf deine Story geantwortet.`,
    kanal: `${name} hat einen neuen Kanal in „${community}" erstellt.`,
    beitritt: `${name} ist „${community}" beigetreten.`,
    nachricht: `Neue Nachrichten in „${community}".`,
    einladung: `${name} hat dich zu „${community}" eingeladen.`,
    share: `${name} hat etwas mit dir geteilt.`,
    message: `${name} hat dir geschrieben.`,
    system: m.text || 'Es gibt Neuigkeiten.',
  }[m.art] || m.text || '';
}

app.get('/api/mitteilungen/:bereich', route(async (req) => {
  const [eintraege, nutzer, communities] = await Promise.all([
    supabaseApi.ladeBenachrichtigungen(req.db, req.nutzerId, req.params.bereich),
    supabaseApi.ladeNutzer(req.db, req.nutzerId),
    supabaseApi.ladeCommunities(req.db, req.nutzerId),
  ]);

  const namen = new Map(Object.values(nutzer).map((u) => [u.id, u.name]));
  const communityNamen = new Map(communities.map((c) => [c.id, c.name]));

  const fertig = eintraege.map((m) => ({ ...m, text: m.text || mitteilungText(m, namen, communityNamen) }));
  return { eintraege: fertig, ungelesen: fertig.filter((m) => !m.gelesen).length };
}));

app.post('/api/mitteilungen/:id/gelesen', route(async (req) => {
  const e = await syncHandlers.handleMarkNotificationRead(req.db, req.nutzerId, req.params.id);
  if (!e || e.ok === false) return antwort(e);

  const { count } = await req.db
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', req.nutzerId)
    .is('read_at', null);
  return { ok: true, ungelesen: count ?? 0 };
}));

app.post('/api/mitteilungen/:bereich/alle-gelesen', route(async (req) =>
  antwort(
    await syncHandlers.handleMarkAllNotificationsRead(req.db, req.nutzerId, req.params.bereich),
    { ungelesen: 0 }
  )
));

// ============================================================================
// Explorer: was hinter einem Hashtag, Standort oder Sound steckt
// ============================================================================

app.get('/api/explorer/:art/:wert', route(async (req) => {
  const { art } = req.params;
  const wert = decodeURIComponent(req.params.wert);
  const beitraege = await supabaseApi.ladeBeitraege(req.db, req.nutzerId, { limit: 500 });

  let passt;
  let kopf;

  if (art === 'hashtag') {
    const tag = wert.startsWith('#') ? wert : `#${wert}`;
    const alle = await supabaseApi.ladeHashtags(req.db);
    passt = (e) => (e.tags || []).includes(tag);
    kopf = { art, titel: tag, anzahl: alle.find((h) => h.tag === tag)?.posts || 0 };
  } else if (art === 'standort') {
    /*
     * Auch nach `ort` suchen, nicht nur nach Kennung und Name: an einem
     * Beitrag steht "Hamburg", der Standort heißt aber "Hamburger Hafen" und
     * trägt "Hamburg" nur im Feld `ort`.
     */
    const standorte = await supabaseApi.ladeStandorte(req.db);
    const platz =
      standorte.find((p) => p.id === wert || p.name === wert) || standorte.find((p) => p.ort === wert);
    if (!platz) return { ok: false, error: 'Diesen Standort gibt es nicht' };
    passt = (e) => e.location === platz.ort;
    kopf = {
      art, id: platz.id, titel: platz.name, anzahl: platz.posts,
      adresse: platz.adresse, koordinaten: platz.koordinaten, x: platz.x, y: platz.y,
    };
  } else if (art === 'sound') {
    /*
     * An einem Beitrag steht "Golden Hour – Lys", der Sound heißt aber nur
     * "Golden Hour" — der Teil hinter dem Gedankenstrich ist der Interpret.
     * "Originalton" ist kein Eintrag und fällt bewusst in die Fehlermeldung:
     * dahinter steckt keine Seite.
     */
    const titelTeil = wert.split(/\s+[–—-]\s+/)[0].trim();
    const sounds = await supabaseApi.ladeSounds(req.db);
    const sound =
      sounds.find((s) => s.id === wert || s.title === wert) || sounds.find((s) => s.title === titelTeil);
    if (!sound) {
      return {
        ok: false,
        error: wert === 'Originalton' ? 'Originalton hat keine eigene Seite' : 'Diesen Sound gibt es nicht',
      };
    }
    passt = (e) => typeof e.music === 'string' && e.music.startsWith(sound.title);
    kopf = {
      art, titel: sound.title, produzent: sound.artist,
      anzahl: sound.uses, dauer: sound.dauer, lyrics: sound.lyrics,
    };
  } else {
    return { ok: false, error: 'Unbekannter Bereich' };
  }

  return {
    ok: true,
    kopf,
    reels: beitraege.filter((b) => b.kind === 'reel' && passt(b)),
    clips: beitraege.filter((b) => b.kind === 'clip' && passt(b)),
    beitraege: beitraege.filter((b) => b.kind === 'post' && passt(b)),
  };
}));

module.exports = app;
