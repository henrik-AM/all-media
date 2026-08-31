/**
 * Kennungen für die Prüfläufe.
 *
 * WARUM ES DAS GIBT
 *
 * Die Prüfläufe klickten auf feste Kennungen aus den Beispieldaten:
 * [data-chat="c2"], [data-profile="u1"], [data-pid="p1"]. Solange die
 * Beispieldaten im Quelltext des Servers standen, war "c2" für immer Bob
 * Müller.
 *
 * Seit dem 31.08.2026 stehen die Inhalte in der Datenbank. Chats, Beiträge
 * und Storys bekommen ihre Kennung dort beim Anlegen — für jedes Konto eine
 * andere. "c2" gibt es nicht mehr, und jeder Klick darauf lief in einen
 * Zeitfehler nach 30 Sekunden.
 *
 * Zwei Arten von Kennungen, zwei Wege:
 *
 *   Menschen  haben feste Kennungen. Anna, Bob und die anderen werden von
 *             SUPABASE_SCHEMA_6_inhalte.sql mit fest eingetragener Kennung
 *             angelegt — die stehen hier als Tabelle.
 *
 *   Alles andere  wird zur Laufzeit gesucht, an dem, was auf dem Bildschirm
 *             steht: der Chat mit "Bob Müller", die Story von "Anna", der
 *             Beitrag über den Hafen. Das ist ohnehin näher an dem, was ein
 *             Mensch tut.
 */

/** Anna, Bob und die anderen — feste Kennungen aus Schema 6. */
const PERSONEN = {
  u1: '11111111-a11e-4d1a-8000-000000000001', // Anna Schmidt
  u2: '11111111-a11e-4d1a-8000-000000000002', // Bob Müller
  u3: '11111111-a11e-4d1a-8000-000000000003', // Clara Weber
  u4: '11111111-a11e-4d1a-8000-000000000004', // David König
  u5: '11111111-a11e-4d1a-8000-000000000005', // Elif Yilmaz
  u6: '11111111-a11e-4d1a-8000-000000000006', // Finn Bauer
  u7: '11111111-a11e-4d1a-8000-000000000007', // Greta Hoffmann
  u8: '11111111-a11e-4d1a-8000-000000000008', // Hakan Demir
  u9: '11111111-a11e-4d1a-8000-000000000009', // Ida Nowak
};

/** Die Kennung einer Person. person('u1') === Anna Schmidt. */
const person = (schluessel) => {
  const id = PERSONEN[schluessel];
  if (!id) throw new Error(`Unbekannte Person: ${schluessel}`);
  return id;
};

/**
 * Sucht ein Element, dessen Text den Teil enthält, und gibt den Wert seines
 * data-Merkmals zurück.
 *
 * Wirft mit einer lesbaren Meldung, wenn nichts passt — ein Prüflauf soll
 * sagen "Chat 'Bob Müller' nicht gefunden" und nicht dreissig Sekunden lang
 * auf einen Wähler warten, den es nicht gibt.
 */
async function kennungNachText(page, merkmal, textteil) {
  const wert = await page.$$eval(
    `[${merkmal}]`,
    (knoten, [name, teil]) => {
      const treffer = knoten.find((n) => (n.textContent || '').includes(teil));
      return treffer ? treffer.getAttribute(name) : null;
    },
    [merkmal, textteil]
  ).catch(() => null);

  if (!wert) {
    const vorhanden = await page.$$eval(`[${merkmal}]`, (n) => n.map((x) => (x.textContent || '').trim().slice(0, 40)));
    throw new Error(`${merkmal} mit Text "${textteil}" nicht gefunden. Da steht: ${JSON.stringify(vorhanden)}`);
  }
  return wert;
}

/** Kennung eines Chats, gesucht am angezeigten Namen. */
const chat = (page, name) => kennungNachText(page, 'data-chat', name);

/** Wähler für einen Chat: await waehlerChat(page, 'Bob Müller'). */
const waehlerChat = async (page, name) => `[data-chat="${await chat(page, name)}"]`;

/** Kennung einer Story, gesucht am Namen darunter ("Deine Story", "Anna"). */
const story = (page, name) => kennungNachText(page, 'data-story', name);

const waehlerStory = async (page, name) => `[data-story="${await story(page, name)}"]`;

/**
 * Kennung eines Beitrags, gesucht an einem Stück seiner Beschreibung.
 *
 * Die Knöpfe unter einem Beitrag tragen data-pid, aber nicht den Text —
 * deshalb wird hier über den umgebenden Beitrag gesucht.
 */
async function beitrag(page, textteil) {
  const wert = await page.$$eval(
    '.post',
    (knoten, teil) => {
      const treffer = knoten.find((n) => (n.textContent || '').includes(teil));
      if (!treffer) return null;
      const knopf = treffer.querySelector('[data-pid]');
      return knopf ? knopf.getAttribute('data-pid') : null;
    },
    textteil
  ).catch(() => null);

  if (!wert) throw new Error(`Beitrag mit Text "${textteil}" nicht gefunden.`);
  return wert;
}

/** Der erste Beitrag im Feed — wenn es nur darum geht, irgendeinen zu haben. */
async function ersterBeitrag(page) {
  const wert = await page.$eval('[data-pid]', (n) => n.getAttribute('data-pid')).catch(() => null);
  if (!wert) throw new Error('Kein Beitrag im Feed.');
  return wert;
}

/**
 * Wartet, bis eine Bedingung im Browser wahr ist — hoechstens `grenze` ms.
 *
 * Warum: Solange die Beispieldaten im Arbeitsspeicher des Servers lagen, war
 * jede Antwort sofort da, und ein `waitForTimeout(400)` reichte immer. Jetzt
 * geht jeder Klick ueber das Netz in die Datenbank und zurueck. Feste
 * Wartezeiten werden dadurch zur Wette — mal reichen sie, mal nicht, und der
 * Prueflauf meldet Fehler, die keine sind.
 *
 * Gibt zurueck, ob die Bedingung eingetreten ist. Der Prueflauf soll das
 * selbst bewerten, nicht hier abbrechen.
 */
async function bisWahr(page, bedingung, grenze = 8000) {
  const ende = Date.now() + grenze;
  for (;;) {
    if (await page.evaluate(bedingung).catch(() => false)) return true;
    if (Date.now() > ende) return false;
    await page.waitForTimeout(120);
  }
}

/**
 * Die Kennung eines Querformat-Videos, gesucht an einem Stueck seines Titels.
 *
 * "q1", "q4", "q6" waren die festen Kennungen aus den Beispieldaten. Jetzt
 * stehen die Videos in der Datenbank; welches an welcher Stelle liegt, haengt
 * an ihrem Alter. Ein Prueflauf, der ein Video mit Kapiteln braucht, muss
 * deshalb genau dieses suchen — nicht das dritte von oben.
 */
async function clip(page, textteil) {
  const wert = await page.$$eval(
    '[data-clip]',
    (knoten, teil) => {
      const treffer = knoten.find((n) => (n.textContent || '').includes(teil));
      return treffer ? treffer.getAttribute('data-clip') : null;
    },
    textteil
  ).catch(() => null);

  if (!wert) {
    const da = await page.$$eval('[data-clip]', (n) => n.map((x) => (x.textContent || '').trim().slice(0, 50)));
    throw new Error(`Kein Querformat-Video mit "${textteil}". Da steht: ${JSON.stringify(da)}`);
  }
  return wert;
}

const waehlerClip = async (page, titel) => `[data-clip="${await clip(page, titel)}"]`;

module.exports = {
  bisWahr,
  clip,
  waehlerClip,
  PERSONEN, person,
  kennungNachText,
  chat, waehlerChat,
  story, waehlerStory,
  beitrag, ersterBeitrag,
};
