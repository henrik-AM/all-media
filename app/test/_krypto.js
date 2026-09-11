/**
 * Ende-zu-Ende-Verschlüsselung — rechnet sie richtig, und hält die Datenbank
 * ihren Teil?
 *
 * WARUM ES DAS GIBT
 *
 * Punkt 11 des Handbuch-Abgleichs vom 01.09.2026. Bis zum 07.09.2026 stand in
 * der App und auf der Website „Ende-zu-Ende-verschlüsselt" — verschlüsselt war
 * nichts. Seit Schema 31 ist es eingelöst, und damit wird es prüfbar.
 *
 * Zwei Teile, und der zweite ist der wichtigere:
 *
 *   1. DIE RECHNUNG (gemeinsam/krypto.js, ohne Netz). Geht ein Text hin und
 *      zurück, steht er nirgends im Paket, scheitert ein falscher Schlüssel,
 *      fällt eine Fälschung auf.
 *
 *   2. DIE DATENBANK (zwei echte Konten). Eine Verschlüsselung, an der die
 *      Regeln vorbeischreiben lassen, ist keine. Geprüft wird deshalb nicht,
 *      dass der gute Fall geht — sondern dass die schlechten nicht gehen:
 *      Chiffre ohne Kennzeichen, Kennzeichen ohne Chiffre, Klartext neben
 *      der Chiffre, und das Kuvert eines Fremden.
 *
 * VERBOTENES SCHREIBEN MELDET NICHT IMMER EINEN FEHLER
 *
 * Unter RLS schreibt ein abgewiesenes INSERT einfach nichts, ohne zu klagen.
 * Nach jedem abgewiesenen Versuch wird deshalb nachgesehen, ob wirklich
 * nichts dasteht. Eine Prüfsumme aus einer stillen Ablehnung wäre wertlos.
 *
 * Start:  node test/_krypto.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const Krypto = require('../../gemeinsam/krypto');

// Node hat einen Zufall, tweetnacl findet ihn hier nur nicht von selbst —
// dieselbe Handreichung wie in app/lib/krypto.ts, dort mit expo-crypto.
Krypto.zufallsquelleSetzen((x, n) => {
  const bytes = crypto.randomBytes(n);
  for (let i = 0; i < n; i++) x[i] = bytes[i];
});

const UMGEBUNG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
  ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  : '';
const wert = (name) => (UMGEBUNG.match(new RegExp('^' + name + '=(.*)$', 'm')) || [])[1] || '';

const URL = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
const KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');

const EIGNER = { email: 'test@all-media.app', passwort: 'AllMedia2026!' };
const GEGENUEBER = {
  email: process.env.AM_TEST_MAIL || 'all.media.prueflauf@web.de',
  passwort: process.env.AM_TEST_PASS || 'PruefLauf2026!',
};

let fehler = 0;
let gelaufen = 0;
const pruefe = (name, wahr, zusatz = '') => {
  gelaufen++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

async function anmelden(zugang) {
  const client = createClient(URL, KEY);
  const { data, error } = await client.auth.signInWithPassword({
    email: zugang.email,
    password: zugang.passwort,
  });
  if (error) throw new Error(`${zugang.email}: ${error.message}`);
  return { client, id: data.user.id };
}

/* ------------------------------------------------------------------ *
 * Teil 1 — die Rechnung
 * ------------------------------------------------------------------ */

function rechnungPruefen() {
  console.log('\nDie Rechnung');

  const a = Krypto.schluesselpaarErzeugen();
  const b = Krypto.schluesselpaarErzeugen();
  const c = Krypto.schluesselpaarErzeugen();

  const TEXT = 'Grüße aus Köln 🌧️ — Straße, Maß, 30 °C';
  const paket = Krypto.verschluesseln(TEXT, a.geheim, [
    { id: 'a', oeffentlich: a.oeffentlich },
    { id: 'b', oeffentlich: b.oeffentlich },
  ]);

  pruefe('Version steht am Paket', Number(paket.version) === Krypto.VERSION);
  pruefe('Ein Kuvert je Gerät', paket.kuverts.length === 2);

  /*
   * Die Prüfung, auf die es ankommt: nichts vom Klartext darf im Paket
   * stehen. Gesucht wird nicht nach dem ganzen Satz — der stünde nie so da —
   * sondern nach jedem Wortstück, das lang genug ist, um verräterisch zu sein.
   */
  const alles = JSON.stringify(paket);
  const stuecke = TEXT.split(/\s+/).filter((w) => w.length >= 4);
  pruefe(
    'Kein Klartextstück im Paket',
    stuecke.every((w) => !alles.includes(w)),
    stuecke.filter((w) => alles.includes(w)).join(', ')
  );

  pruefe(
    'Der Absender öffnet seine eigene Nachricht',
    Krypto.entschluesseln(paket, paket.kuverts[0], a.geheim) === TEXT
  );
  pruefe(
    'Das Gegenüber öffnet sie ebenfalls — mit Umlauten und Emoji',
    Krypto.entschluesseln(paket, paket.kuverts[1], b.geheim) === TEXT
  );
  pruefe(
    'Ein fremder Schlüssel öffnet nichts',
    Krypto.entschluesseln(paket, paket.kuverts[1], c.geheim) === null
  );
  pruefe(
    'Das falsche Kuvert öffnet nichts',
    Krypto.entschluesseln(paket, paket.kuverts[0], b.geheim) === null
  );

  // Eine veränderte Chiffre muss auffallen, nicht Unsinn ergeben. Genau
  // dafür ist Poly1305 da; ohne diese Prüfung wüsste niemand, ob es wirkt.
  const gefaelscht = Object.assign({}, paket, {
    chiffre: Krypto.zuBase64(
      (() => {
        const b2 = Krypto.ausBase64(paket.chiffre);
        b2[0] = b2[0] ^ 1;
        return b2;
      })()
    ),
  });
  pruefe(
    'Eine geänderte Chiffre fällt auf',
    Krypto.entschluesseln(gefaelscht, paket.kuverts[1], b.geheim) === null
  );

  const alteVersion = Object.assign({}, paket, { version: 99 });
  pruefe(
    'Ein unbekanntes Format wird nicht geraten',
    Krypto.entschluesseln(alteVersion, paket.kuverts[1], b.geheim) === null
  );

  const fa = Krypto.fingerabdruck(a.oeffentlich);
  pruefe('Fingerabdruck ist gleich bleibend', fa === Krypto.fingerabdruck(a.oeffentlich));
  pruefe('Fingerabdruck unterscheidet zwei Schlüssel', fa !== Krypto.fingerabdruck(b.oeffentlich));
  pruefe('Fingerabdruck ist vorlesbar', /^([0-9A-F]{4} ){7}[0-9A-F]{4}$/.test(fa), fa);

  return { a, b };
}

/* ------------------------------------------------------------------ *
 * Teil 2 — die Datenbank
 * ------------------------------------------------------------------ */

(async () => {
  if (!URL || !KEY) {
    console.error('FEHLER  SUPABASE_URL/SUPABASE_ANON_KEY fehlen.');
    process.exit(1);
  }

  rechnungPruefen();

  console.log('\nDie Datenbank');

  const eigner = await anmelden(EIGNER);
  const gegen = await anmelden(GEGENUEBER);

  const wegRaeumen = [];

  try {
    // --- Schlüssel beider Seiten anmelden ---------------------------------
    const paarE = Krypto.schluesselpaarErzeugen();
    const paarG = Krypto.schluesselpaarErzeugen();

    const anlegen = async (seite, paar, geraet) => {
      const { data, error } = await seite.client
        .from('krypto_schluessel')
        .upsert(
          { user_id: seite.id, geraet, art: 'app', oeffentlich: paar.oeffentlich },
          { onConflict: 'user_id,geraet' }
        )
        .select('id')
        .single();
      if (error) throw error;
      wegRaeumen.push(async () => {
        await seite.client.from('krypto_schluessel').delete().eq('id', data.id);
      });
      return data.id;
    };

    const schluesselE = await anlegen(eigner, paarE, 'prueflauf-krypto-e');
    const schluesselG = await anlegen(gegen, paarG, 'prueflauf-krypto-g');
    pruefe('Beide Geräte haben einen Schlüssel', Boolean(schluesselE && schluesselG));

    // Ein Schlüssel gehört seinem Konto — fremde darf niemand eintragen.
    const { error: fremdFehler } = await eigner.client
      .from('krypto_schluessel')
      .insert({ user_id: gegen.id, geraet: 'geklaut', art: 'app', oeffentlich: paarE.oeffentlich });
    const { data: geklaut } = await gegen.client
      .from('krypto_schluessel')
      .select('id')
      .eq('user_id', gegen.id)
      .eq('geraet', 'geklaut');
    pruefe(
      'Niemand meldet ein Gerät für ein fremdes Konto an',
      Boolean(fremdFehler) && (geklaut || []).length === 0
    );

    // --- Ein Chat zu zweit ------------------------------------------------
    const { data: chat, error: chatFehler } = await eigner.client
      .from('chats')
      .insert({ name: 'Prüflauf Krypto', is_group: false, bereich: 'messenger', created_by: eigner.id })
      .select('id')
      .single();
    if (chatFehler) throw chatFehler;
    wegRaeumen.push(async () => {
      await eigner.client.from('chat_members').delete().eq('chat_id', chat.id);
      await eigner.client.from('chats').delete().eq('id', chat.id);
    });
    for (const seite of [eigner, gegen]) {
      const { error } = await eigner.client
        .from('chat_members')
        .insert({ chat_id: chat.id, user_id: seite.id });
      if (error) throw error;
    }

    // Der öffentliche Schlüssel des Gegenübers ist erst sichtbar, weil man
    // einen Chat teilt. Ohne das wäre er für jeden abrufbar, der die
    // Kontokennung kennt — und damit eine Liste aller Nutzer.
    const { data: seiner } = await eigner.client
      .from('krypto_schluessel')
      .select('id, oeffentlich')
      .eq('user_id', gegen.id)
      .eq('geraet', 'prueflauf-krypto-g');
    pruefe(
      'Der Schlüssel des Gegenübers ist im gemeinsamen Chat sichtbar',
      (seiner || []).length === 1 && seiner[0].oeffentlich === paarG.oeffentlich
    );

    // --- Die gute Nachricht ----------------------------------------------
    const KLARTEXT = 'Nur für dich: Treffpunkt um 19 Uhr am Südbahnhof.';
    const paket = Krypto.verschluesseln(KLARTEXT, paarE.geheim, [
      { id: schluesselE, oeffentlich: paarE.oeffentlich },
      { id: schluesselG, oeffentlich: paarG.oeffentlich },
    ]);

    const { data: nachricht, error: nachrichtFehler } = await eigner.client
      .from('messages')
      .insert({
        chat_id: chat.id,
        sender_id: eigner.id,
        text: '',
        krypto: paket.version,
        chiffre: paket.chiffre,
        krypto_nonce: paket.nonce,
        absender_schluessel: paket.absender,
      })
      .select('id')
      .single();
    if (nachrichtFehler) throw nachrichtFehler;
    wegRaeumen.push(async () => {
      await eigner.client.from('message_keys').delete().eq('message_id', nachricht.id);
      await eigner.client.from('messages').delete().eq('id', nachricht.id);
    });

    const { error: kuvertFehler } = await eigner.client.from('message_keys').insert(
      paket.kuverts.map((k) => ({
        message_id: nachricht.id,
        schluessel_id: k.schluesselId,
        nonce: k.nonce,
        chiffre: k.chiffre,
      }))
    );
    pruefe('Verschlüsselte Nachricht samt Kuverts geschrieben', !kuvertFehler,
      kuvertFehler ? kuvertFehler.message : '');

    // --- Und das Gegenüber macht sie auf ----------------------------------
    const { data: gelesen } = await gegen.client
      .from('messages')
      .select('text, krypto, chiffre, krypto_nonce, absender_schluessel')
      .eq('id', nachricht.id)
      .maybeSingle();
    pruefe('Der Server hält keinen Klartext', !gelesen?.text);

    const { data: meineKuverts } = await gegen.client
      .from('message_keys')
      .select('schluessel_id, nonce, chiffre')
      .eq('message_id', nachricht.id);
    pruefe(
      'Das Gegenüber sieht genau sein eigenes Kuvert',
      (meineKuverts || []).length === 1 && meineKuverts[0].schluessel_id === schluesselG,
      `${(meineKuverts || []).length} Kuvert(e)`
    );

    pruefe(
      'Und öffnet damit den ursprünglichen Text',
      Krypto.entschluesseln(
        {
          version: gelesen?.krypto,
          chiffre: gelesen?.chiffre,
          nonce: gelesen?.krypto_nonce,
          absender: gelesen?.absender_schluessel,
        },
        (meineKuverts || [])[0],
        paarG.geheim
      ) === KLARTEXT
    );

    // --- Die schlechten Fälle --------------------------------------------
    /*
     * Drei Formen, die es nicht geben darf, weil sie alle dasselbe Ergebnis
     * hätten: eine Nachricht, die als verschlüsselt gilt und trotzdem
     * mitlesbar ist. Die Bedingung `messages_krypto_stimmig` aus Schema 31
     * soll sie abweisen — hier steht, ob sie es tut.
     */
    const abweisen = async (name, zeile) => {
      const { data, error } = await eigner.client
        .from('messages')
        .insert(Object.assign({ chat_id: chat.id, sender_id: eigner.id }, zeile))
        .select('id');
      if (data && data.length) {
        // Doch durchgekommen — sofort wieder weg, sonst steht Müll im Chat.
        await eigner.client.from('messages').delete().eq('id', data[0].id);
      }
      pruefe(name, Boolean(error) && !(data || []).length);
    };

    await abweisen('Kennzeichen ohne Chiffre wird abgewiesen', {
      text: '',
      krypto: 1,
      chiffre: null,
      krypto_nonce: null,
      absender_schluessel: null,
    });
    await abweisen('Klartext neben der Chiffre wird abgewiesen', {
      text: 'steht doch lesbar da',
      krypto: 1,
      chiffre: paket.chiffre,
      krypto_nonce: paket.nonce,
      absender_schluessel: paket.absender,
    });
    await abweisen('Chiffre ohne Kennzeichen wird abgewiesen', {
      text: 'hallo',
      krypto: 0,
      chiffre: paket.chiffre,
      krypto_nonce: paket.nonce,
      absender_schluessel: paket.absender,
    });

    // Ein Kuvert an ein fremdes Gerät zu einer fremden Nachricht: das Gegenüber
    // ist nicht der Absender dieser Nachricht und darf ihr nichts beilegen.
    const { error: fremdKuvert } = await gegen.client.from('message_keys').insert({
      message_id: nachricht.id,
      schluessel_id: schluesselG,
      nonce: paket.kuverts[0].nonce,
      chiffre: paket.kuverts[0].chiffre,
    });
    const { data: nachKuverts } = await gegen.client
      .from('message_keys')
      .select('schluessel_id')
      .eq('message_id', nachricht.id);
    pruefe(
      'Nur der Absender legt Kuverts zu seiner Nachricht',
      Boolean(fremdKuvert) && (nachKuverts || []).length === 1
    );
  } finally {
    for (const schritt of wegRaeumen.reverse()) {
      try {
        await schritt();
      } catch (e) {
        console.log('  HINWEIS  Aufräumen: ' + (e?.message ?? e));
      }
    }

    /*
     * Gegenprobe zum Aufräumen. Bliebe ein Prüfschlüssel stehen, zeigte das
     * Kontaktprofil beim nächsten Blick „Ende-zu-Ende" für ein Gerät, das es
     * nicht mehr gibt — und niemand brächte das mit diesem Lauf in Verbindung.
     */
    const { data: reste } = await eigner.client
      .from('krypto_schluessel')
      .select('id')
      .like('geraet', 'prueflauf-krypto-%');
    if ((reste || []).length) {
      console.log(`  HINWEIS  ${reste.length} Prüfschlüssel stehen noch in der Datenbank.`);
      fehler++;
    }
  }

  console.log(`\n${gelaufen - fehler} von ${gelaufen} Pruefungen bestanden.`);
  console.log(
    fehler === 0
      ? 'Was verschlüsselt heißt, ist auch verschlüsselt.'
      : `${fehler} Prüfung(en) fehlgeschlagen.`
  );
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error('FEHLER  ' + (e?.message ?? e));
  process.exit(1);
});
