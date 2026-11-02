#!/usr/bin/env node
/**
 * Kasten RS 1 (24.10.2026): die Rechtstexte auf der Website im Prüfbrowser.
 *
 *   A  ohne Anmeldung: /recht/impressum, /impressum (Weiterleitung),
 *      Willkommensseite mit Links, Registrierung mit Häkchen
 *   B  mit Attrappe (test/_attrappe.js): Einstellungen → Impressum und
 *      Datenschutzerklärung öffnen das Blatt mit dem ganzen Text
 *
 * Die Attrappe belegt nur Aufbau und Bedienung, nicht das Speichern der
 * Zustimmung bei Supabase (gesperrt seit 10.10.2026).
 *
 * Start:  PORT=3200 node ../web/server/lokal.js   (aus dem Worktree)
 *         BASE=http://localhost:3200 BILDER=/pfad node test/rs1-rechtstexte.js
 */
const path = require('path');
const { attrappe, bestand } = require('./_attrappe');
const R = require('../../gemeinsam/rechtstexte');

const BASE = process.env.BASE || 'http://localhost:3000';
let fehler = 0;
let anzahl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  anzahl++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};
const bild = async (seite, name) => {
  if (!process.env.BILDER) return;
  await seite.waitForTimeout(900);
  await seite.screenshot({ path: path.join(process.env.BILDER, `rs1-${name}.png`) });
};

(async () => {
  const { chromium } = require('playwright-core');
  const browser = await chromium.launch();
  try {
    console.log('\nA. Ohne Anmeldung');
    const a = await browser.newPage({ viewport: { width: 420, height: 860 } });
    let r = await a.goto(`${BASE}/recht/impressum`);
    pruefe('/recht/impressum antwortet 200', r.status() === 200);
    pruefe('Impressum zeigt § 5 DDG', (await a.textContent('body')).includes('Angaben nach § 5 DDG'));
    await bild(a, 'a-impressum');
    r = await a.goto(`${BASE}/impressum`);
    pruefe('/impressum leitet auf /recht/impressum', a.url().endsWith('/recht/impressum') && r.status() === 200);
    await a.goto(`${BASE}/recht/datenschutz`);
    const ds = await a.textContent('body');
    pruefe('Datenschutz nennt Supabase, Render, Karten', ['Supabase', 'Render', 'OpenStreetMap'].every((w) => ds.includes(w)));
    await bild(a, 'a-datenschutz');
    r = await a.goto(`${BASE}/recht/gibtsnicht`);
    pruefe('unbekanntes Dokument → 404', r.status() === 404);

    // Willkommensseite: ein frischer Browser hat keine Sitzung.
    await a.goto(BASE);
    await a.waitForSelector('#startAnmelden', { timeout: 15000 });
    pruefe('Willkommensseite: Link Impressum', (await a.$('.startfehler__recht a[href="/recht/impressum"]')) !== null);
    pruefe('Willkommensseite: Link Datenschutz', (await a.$('.startfehler__recht a[href="/recht/datenschutz"]')) !== null);
    await bild(a, 'a-willkommen');

    await a.click('#startAnmelden');
    await a.click('[data-konto-neu="neu"]');
    await a.fill('#kontoBenutzer', 'rechtstest');
    await a.fill('#kontoPass', 'Ein-langes-Pruefpasswort-2026!');
    // Schritt 2 erreichen, ohne Supabase: die Namensprüfung wird übersprungen.
    await a.evaluate(() => {
      window.Anmeldung = Object.assign({}, window.Anmeldung, { benutzernameFrei: async () => ({ frei: true, handle: '@rechtstest' }) });
    });
    await a.click('#kontoOk');
    await a.waitForSelector('#kontoZustimmung', { timeout: 10000 });
    pruefe('Registrierung: Häkchen da und nicht vorbelegt', (await a.isChecked('#kontoZustimmung')) === false);
    const links = await a.$$eval('.sheet__zustimmung a', (n) => n.map((x) => x.getAttribute('href')));
    pruefe('Registrierung: Links auf die drei Texte', ['/recht/nutzungsbedingungen', '/recht/community_richtlinien', '/recht/datenschutz'].every((h) => links.includes(h)), links.join(' '));
    await bild(a, 'a-registrierung');

    /*
     * Ohne Häkchen: registrieren() lehnt ab, bevor etwas angelegt wird.
     * Supabase ist gesperrt; die beiden Vorprüfungen (handle_frei,
     * nummer_frei) antworten deshalb hier „frei", und signUp würde laut
     * scheitern — so ist die Ablehnung wirklich die des Häkchens und nicht
     * die einer Vorprüfung (am 24.10. war sie es zuerst).
     */
    let signUpGerufen = false;
    await a.route('**/rest/v1/rpc/handle_frei', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"frei":true,"handle":"@rechtstest"}' }));
    await a.route('**/rest/v1/rpc/nummer_frei', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"frei":true}' }));
    await a.route('**/auth/v1/signup**', (route) => { signUpGerufen = true; route.fulfill({ status: 500, body: '{}' }); });
    const konto = { benutzername: 'rechtstest', passwort: 'Ein-langes-Pruefpasswort-2026!', email: 'a@b.de', telefon: '+49 151 2345678', geburtsdatum: '2000-01-01' };
    const ohne = await a.evaluate((k) => window.Anmeldung.registrieren({ ...k, zustimmung: false }), konto);
    pruefe('Website lehnt ohne Zustimmung ab — mit dem Zustimmungstext', ohne.ok === false && ohne.fehler === R.ZUSTIMMUNG_FEHLT, ohne.fehler);
    pruefe('… und ruft signUp nicht auf', !signUpGerufen);
    const mit = await a.evaluate((k) => window.Anmeldung.registrieren({ ...k, zustimmung: true }), konto);
    pruefe('Gegenprobe: mit Zustimmung geht es bis signUp', signUpGerufen && mit.fehler !== R.ZUSTIMMUNG_FEHLT, mit.fehler);
    await a.close();

    console.log('\nB. Einstellungen (Attrappe)');
    const b = await browser.newPage({ viewport: { width: 420, height: 860 } });
    /*
     * Statistik, Gelikt und Kommentiert brauchen ihre echte Form: mit `{}`
     * lädt renderSettings() sie endlos nach (gefunden 24.10.2026, über
     * 20 000 Aufrufe in Sekunden — derselbe Kreis droht, wenn der Server
     * dort mit einem Fehler antwortet).
     */
    await attrappe(b, bestand(), { '/api/statistik': { statistik: {} }, '/api/gelikt': [], '/api/kommentiert': [] });
    await b.goto(BASE);
    await b.click('[data-area="settings"]');
    await b.waitForSelector('[data-setting="Impressum"]', { timeout: 15000 });
    for (const id of R.REIHENFOLGE) {
      const d = R.dokument(id);
      const label = id === 'kurz_erklaert' ? 'Die Regeln kurz erklärt' : id === 'eltern_info' ? 'Für Eltern' : d.titel;
      pruefe(`Eintrag „${label}"`, (await b.$(`[data-setting="${label}"]`)) !== null);
    }
    // Die Einstellungen zeichnen sich nach dem Laden noch einmal neu — erst
    // klicken, wenn der Eintrag zum letzten Mal gezeichnet ist.
    const tippen = async (label) => {
      await b.waitForTimeout(1500);
      await b.evaluate((l) => document.querySelector(`[data-setting="${l}"]`).click(), label);
    };
    await tippen('Impressum');
    await b.waitForTimeout(700);
    const blatt = (id) => b.evaluate((i) => {
      const n = document.querySelectorAll(`[data-testid="rechtstext-${i}"]`);
      return { anzahl: n.length, text: n.length ? n[n.length - 1].textContent : '' };
    }, id);
    let offen = await blatt('impressum');
    pruefe('Blatt Impressum öffnet genau einmal', offen.anzahl === 1, `${offen.anzahl} Blätter`);
    pruefe('Blatt Impressum zeigt den ganzen Text', offen.text.includes('Kontaktstellen nach Art. 11 und 12 DSA'));
    await bild(b, 'b-impressum-blatt');
    await b.keyboard.press('Escape');
    await tippen('Datenschutzerklärung');
    await b.waitForTimeout(700);
    offen = await blatt('datenschutz');
    pruefe('Blatt Datenschutz öffnet genau einmal', offen.anzahl === 1, `${offen.anzahl} Blätter`);
    const t = offen.text;
    pruefe('Blatt Datenschutz zeigt alle Abschnitte', R.dokument('datenschutz').abschnitte.every((x) => t.includes(x.titel)));
    await bild(b, 'b-datenschutz-blatt');
    // L11 (Richtlinie 8.1): was nicht wirkt, sagt das — kein erfundenes Gerät, keine Wahl ohne Wirkung.
    await b.keyboard.press('Escape');
    await tippen('Zwei-Faktor-Anmeldung');
    await b.waitForTimeout(700);
    const zf = await b.evaluate(() => [...document.querySelectorAll('.sheet__text')].map((e) => e.textContent).pop() || '');
    pruefe('Zwei-Faktor: „Noch nicht verfügbar“ statt einer Wahl', zf.startsWith('Noch nicht verfügbar'), zf.slice(0, 60));
    await bild(b, 'b-zweifaktor');
    await b.keyboard.press('Escape');
    await tippen('Geräteverknüpfung');
    await b.waitForTimeout(700);
    const geraete = await b.evaluate(() => document.body.innerText);
    pruefe('Geräte: kein erfundenes Gerät, Verknüpfen „noch nicht verfügbar“',
      !geraete.includes('All Media Web') && !geraete.includes('Gerät verknüpfen') && /Weitere Geräte verknüpfen\s*noch nicht verfügbar/.test(geraete));
    await bild(b, 'b-geraete');
    // L4, RS 2: Konto löschen ist ein echtes Blatt. Geprüft wird nur der Weg ohne Netz:
    // Die Attrappe hat keine Supabase-Sitzung, das Blatt muss das sagen und darf nichts
    // anfragen. Ein Passwort ginge sonst als Anmeldeversuch an Supabase.
    await b.keyboard.press('Escape');
    await tippen('Konto löschen');
    await b.waitForSelector('[data-konto-loeschen]', { timeout: 5000 }).catch(() => {});
    const loesch = await b.evaluate(() => {
      const n = document.querySelector('[data-konto-loeschen]');
      return n ? { text: n.textContent, feld: !!n.querySelector('#loeschPasswort[type="password"]'), daten: !!n.querySelector('#loeschDaten') } : null;
    });
    pruefe('Konto löschen: Blatt mit Hinweis, Passwortfeld und „Meine Daten herunterladen“',
      !!loesch && loesch.text.includes('sofort und endgültig gelöscht') && loesch.feld && loesch.daten);
    const anSupabase = [];
    b.on('request', (r) => { if (/supabase\.co/.test(r.url())) anSupabase.push(new URL(r.url()).pathname); });
    await b.click('#loeschJa');
    await b.waitForTimeout(300);
    pruefe('Konto löschen ohne Sitzung: keine Anfrage an Supabase', anSupabase.length === 0, anSupabase.join(', '));
    const loeschFehler = await b.$eval('#loeschFehler', (e) => (e.hidden ? '' : e.textContent)).catch(() => '');
    pruefe('Konto löschen ohne Sitzung: Hinweis im Blatt, nichts angefragt', loeschFehler === 'Bitte melde dich erneut an', loeschFehler);
    pruefe('Konto löschen: kein „Löschauftrag vorgemerkt“ mehr', !(await b.evaluate(() => document.body.innerText.includes('vorgemerkt'))));
    await bild(b, 'b-konto-loeschen');
    await b.close();
  } finally {
    await browser.close();
  }
  console.log(`\n${anzahl - fehler}/${anzahl} bestanden.`);
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
