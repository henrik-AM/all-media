#!/usr/bin/env node
/**
 * Kasten AF 1 (Allgemeines Feedback 21.10.2026): „Chats werden zwischen echten
 * Nutzern nicht richtig synchronisiert." — ohne Netz, ohne Supabase.
 *
 * Misst, wie lange eine Änderung beim Gegenüber braucht, mit einem
 * nachgestellten Supabase-Client (Realtime-Kanal zum Auslösen):
 *
 *   1. Neue Nachricht kommt in unter einer Sekunde an (vorher: bis 4 s Takt).
 *   2. Eine Reaktion ändert den Stand (vorher: gar nicht — sie kam erst mit
 *      der nächsten Nachricht).
 *   3. Klingeln kurz nacheinander → ein Nachsehen; nach Wiederverbinden wird
 *      einmal nachgeholt (Funkloch).
 *   4. Ohne Klingel (kein Client, Attrappe, Dienst weg) bleibt der 4-s-Takt.
 *   5. App und Website hören dieselben Themen (Quelltext).
 *
 * Vorher rot, nachher grün:
 *   WURZEL=<Checkout vor Kasten AF 1> node test/_chatklingel_einheit.js   → rot
 *   node test/_chatklingel_einheit.js                                      → grün
 * (vorher: Stand 86814b5~1 = Sammelzweig d1ab934)
 *
 * Was das NICHT zeigt: dass Supabase wirklich klingelt — das zeigen
 * _probe100.js (Auslöser, Rechte) und nach der Entsperrung der Zwei-Konten-Lauf.
 */

const fs = require('fs');
const path = require('path');

const WURZEL = process.env.WURZEL ? path.resolve(process.env.WURZEL) : path.join(__dirname, '..', '..');
const ChatAbgleich = require(path.join(WURZEL, 'gemeinsam', 'chatabgleich.js'));

let fehler = 0;
let anzahl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  anzahl++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz !== '' ? '  — ' + zusatz : ''));
};
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

/** Nachgestellter supabase-js-Client: nur channel/on/subscribe/removeChannel. */
function attrappenClient() {
  const kanaele = [];
  return {
    kanaele,
    channel(thema, optionen) {
      const k = {
        thema,
        privat: Boolean(optionen?.config?.private),
        horcher: [],
        statusFn: null,
        weg: false,
        on(art, filter, fn) {
          this.horcher.push({ art, event: filter?.event, fn });
          return this;
        },
        subscribe(fn) {
          this.statusFn = fn;
          setTimeout(() => !this.weg && fn('SUBSCRIBED'), 5);
          return this;
        },
        klingeln() {
          if (this.weg) return;
          for (const h of this.horcher) if (h.art === 'broadcast' && h.event === 'klingel') h.fn({ payload: {} });
        },
        status(s) {
          if (!this.weg && this.statusFn) this.statusFn(s);
        },
      };
      kanaele.push(k);
      return k;
    },
    removeChannel(k) {
      k.weg = true;
    },
  };
}

/**
 * Ein offener Chat wie in App und Website: Takt (4 s) plus — falls vorhanden —
 * Klingel. Gibt zurück, wann das Nachsehen eine geänderte DB gesehen hat.
 */
function offenerChat(client, db) {
  const hatKlingel = typeof ChatAbgleich.klingelHoeren === 'function';
  let klingelDa = false;
  let letzte = 0;
  let gesehen = db.version;
  const ereignisse = [];
  const nachsehen = (geklingelt) => {
    if (!geklingelt && hatKlingel && !ChatAbgleich.faellig('chat', klingelDa, letzte, Date.now())) return;
    letzte = Date.now();
    ereignisse.push({ t: Date.now(), geklingelt: Boolean(geklingelt) });
    if (db.version !== gesehen) {
      gesehen = db.version;
      db.angekommen = Date.now();
    }
  };
  const uhr = setInterval(() => nachsehen(false), ChatAbgleich.INTERVALL_CHAT_MS);
  const aus = hatKlingel
    ? ChatAbgleich.klingelHoeren(client, 'chat:x', () => nachsehen(true), (v) => (klingelDa = v))
    : () => {};
  return {
    ereignisse,
    stopp() {
      clearInterval(uhr);
      aus();
    },
  };
}

(async () => {
  console.log('1. Neue Nachricht kommt sofort an');
  {
    const client = attrappenClient();
    const db = { version: 0, angekommen: 0 };
    const chat = offenerChat(client, db);
    await warte(400); // verbunden, erstes Nachsehen vorbei
    const gesendet = Date.now();
    db.version++;
    client.kanaele[0]?.klingeln(); // die Datenbank klingelt (Schema 100)
    await warte(1000);
    const dauer = db.angekommen ? db.angekommen - gesendet : null;
    pruefe('beim Gegenüber in unter 1 s', dauer !== null && dauer < 1000, dauer === null ? 'nach 1 s noch nicht da' : dauer + ' ms');
    pruefe('privater Kanal chat:<id>', client.kanaele[0]?.privat === true && client.kanaele[0]?.thema === 'chat:x');
    chat.stopp();
    pruefe('Abmelden entfernt den Kanal', client.kanaele.length > 0 && client.kanaele.every((k) => k.weg));
  }

  console.log('\n2. Reaktion ändert den Stand');
  {
    const zeilen = [{ id: 'm1', created_at: 't1' }, { id: 'm2', created_at: 't2' }];
    const ohne = ChatAbgleich.stand(zeilen, []);
    const mit = ChatAbgleich.stand(zeilen, [{ message_id: 'm2', user_id: 'u', emoji: '👍' }]);
    const anders = ChatAbgleich.stand(zeilen, [{ message_id: 'm2', user_id: 'u', emoji: '❤️' }]);
    pruefe('Reaktion dazu → anderer Stand', ohne !== mit);
    pruefe('Reaktion gewechselt → anderer Stand', mit !== anders);
    pruefe(
      'Reihenfolge der Reaktionen egal',
      ChatAbgleich.stand(zeilen, [{ message_id: 'm1', user_id: 'a', emoji: '👍' }, { message_id: 'm2', user_id: 'b', emoji: '👍' }]) ===
        ChatAbgleich.stand(zeilen, [{ message_id: 'm2', user_id: 'b', emoji: '👍' }, { message_id: 'm1', user_id: 'a', emoji: '👍' }])
    );
  }

  console.log('\n3. Bündeln und Wiederverbinden');
  {
    if (typeof ChatAbgleich.klingelHoeren !== 'function') {
      pruefe('klingelHoeren vorhanden', false, 'fehlt');
    } else {
      const client = attrappenClient();
      let n = 0;
      const aus = ChatAbgleich.klingelHoeren(client, 'chat:y', () => n++);
      await warte(400);
      const nachVerbinden = n;
      const k = client.kanaele[0];
      for (let i = 0; i < 5; i++) k.klingeln();
      await warte(ChatAbgleich.KLINGEL_BUENDELN_MS + 150);
      pruefe('nach dem Verbinden einmal nachgesehen', nachVerbinden === 1, String(nachVerbinden));
      pruefe('fünf Klingeln → ein Nachsehen', n - nachVerbinden === 1, String(n - nachVerbinden));
      k.status('CHANNEL_ERROR'); // Funkloch
      k.status('SUBSCRIBED'); // wieder da
      await warte(ChatAbgleich.KLINGEL_BUENDELN_MS + 150);
      pruefe('nach Wiederverbinden nachgeholt', n - nachVerbinden === 2, String(n - nachVerbinden));
      aus();
      k.klingeln();
      await warte(ChatAbgleich.KLINGEL_BUENDELN_MS + 150);
      pruefe('nach Abmelden still', n - nachVerbinden === 2);
    }
  }

  console.log('\n4. Ohne Klingel bleibt der Takt');
  {
    const f = ChatAbgleich.faellig;
    if (typeof f !== 'function') {
      pruefe('faellig vorhanden', false, 'fehlt');
    } else {
      const jetzt = 1_000_000;
      pruefe('ohne Klingel immer fällig', f('chat', false, jetzt - 10, jetzt));
      pruefe('mit Klingel nach 4 s nicht fällig', !f('chat', true, jetzt - 4000, jetzt));
      pruefe('mit Klingel nach 30 s fällig', f('chat', true, jetzt - ChatAbgleich.INTERVALL_CHAT_MIT_KLINGEL_MS, jetzt));
      pruefe('Liste mit Klingel nach 60 s fällig', f('liste', true, jetzt - ChatAbgleich.INTERVALL_LISTE_MIT_KLINGEL_MS, jetzt));
      let zustand = null;
      const aus = ChatAbgleich.klingelHoeren(null, 'chat:z', () => {}, (v) => (zustand = v));
      pruefe('kein Client → Klingel aus, kein Fehler', zustand === false && typeof aus === 'function');
    }
  }

  console.log('\n5. App und Website gleichauf');
  {
    const lies = (d) => fs.readFileSync(path.join(WURZEL, d), 'utf8');
    const detail = lies('app/screens/messenger/ChatDetailScreen.tsx');
    const daten = lies('app/contexts/DatenContext.tsx');
    const web = lies('web/public/app.js');
    pruefe('App: offener Chat hört chat:/kanal:', /klingelHoeren\([\s\S]{0,200}klingelThema\(istKanal \? 'kanal' : 'chat'/.test(detail));
    pruefe('App: Chatliste hört nutzer:', /klingelHoeren\([\s\S]{0,200}klingelThema\('nutzer'/.test(daten));
    pruefe('Website: offener Chat hört chat:', /klingelHoeren\([\s\S]{0,200}klingelThema\('chat'/.test(web));
    pruefe('Website: Chatliste hört nutzer:', /klingelHoeren\([\s\S]{0,200}klingelThema\('nutzer'/.test(web));
    pruefe('Website: Unterthema hört kanal:', /klingelThema\('kanal'/.test(web));
    pruefe('Website: Zurück in den Tab / online → nachholen', /addEventListener\('visibilitychange', chatsNachholen\)/.test(web) && /addEventListener\('online', chatsNachholen\)/.test(web));
    pruefe('Stand mit Reaktionen: App', /from\('message_reactions'\)[\s\S]{0,450}ChatAbgleich\.stand\(zeilen, /.test(lies('app/lib/daten.ts')));
    pruefe('Stand mit Reaktionen: Website-Server', /from\('message_reactions'\)[\s\S]{0,450}ChatAbgleich\.stand\(zeilen, /.test(lies('web/server/supabase-api.js')));
    pruefe('keine postgres_changes (Schema 95 bleibt)', !/postgres_changes/.test(detail + daten + web));
  }

  console.log(`\n${anzahl - fehler}/${anzahl} bestanden`);
  process.exit(fehler ? 1 : 0);
})();
