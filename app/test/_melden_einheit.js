/**
 * Melden und Moderation — die gemeinsamen Regeln, ohne Netz (Kasten RS 3).
 *
 * WAS DIESER LAUF ZEIGT
 *
 *   1. gemeinsam/meldung.js: Kategorien mit genau den Schlüsseln aus
 *      Schema 102 (reports_kategorie_check), Prüfung der Eingabe GLEICH wie
 *      inhalt_melden() (gelesen aus der SQL-Datei, nicht abgeschrieben),
 *      Sätze für jeden `grund`, Hinweise bei Kindesmissbrauch/Selbst-
 *      verletzung, Entscheidungsprüfung wie meldung_entscheiden().
 *   2. gemeinsam/krypto.js: meldebeleg/belegPruefen mit ECHTER
 *      Verschlüsselung — der Beleg öffnet genau diese Nachricht, keine
 *      andere; ein veränderter Text oder ein fremder Schlüssel fällt durch;
 *      der Gerätschlüssel steht nirgends im Beleg.
 *
 * Start:  node test/_melden_einheit.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Meldung = require('../../gemeinsam/meldung');
const Krypto = require('../../gemeinsam/krypto');

Krypto.zufallsquelleSetzen((x, n) => {
  const bytes = crypto.randomBytes(n);
  for (let i = 0; i < n; i++) x[i] = bytes[i];
});

let gut = 0;
let schlecht = 0;
function pruefe(name, ok, info) {
  if (ok) gut++;
  else schlecht++;
  console.log((ok ? '  OK    ' : '  FEHL  ') + name + (!ok && info ? '  (' + info + ')' : ''));
}

const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'SUPABASE_SCHEMA_102_melden_moderation.sql'), 'utf8');
const ausCheck = (name) => {
  const m = sql.match(new RegExp(`add constraint ${name}\\s+check \\(([\\s\\S]*?)\\);`));
  return m ? [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) : [];
};

console.log('\n1  meldung.js gegen Schema 102');
const sqlKategorien = ausCheck('reports_kategorie_check').filter((k) => k !== 'problem');
pruefe('Kategorien = reports_kategorie_check (ohne problem)', JSON.stringify([...Meldung.KATEGORIE_KEYS].sort()) === JSON.stringify([...sqlKategorien].sort()), sqlKategorien.join(','));
const sqlArten = ausCheck('reports_target_type_check');
pruefe('Arten = reports_target_type_check', JSON.stringify([...Meldung.ARTEN].sort()) === JSON.stringify([...sqlArten].sort()), sqlArten.join(','));
const sqlMassnahmen = ausCheck('reports_massnahme_check');
pruefe('Maßnahmen = reports_massnahme_check', JSON.stringify(Meldung.MASSNAHMEN.map((m) => m.key).sort()) === JSON.stringify([...sqlMassnahmen].sort()), sqlMassnahmen.join(','));
pruefe('jede Kategorie: Name, Erklärung, Grundlage gesetz|regeln', Meldung.KATEGORIEN.every((k) => k.name && k.erklaerung && ['gesetz', 'regeln'].includes(k.grundlage)));
pruefe('jede Kategorie hat eine Vorlage für Moderatoren', Meldung.KATEGORIEN.every((k) => Meldung.VORLAGEN[k.key]));
pruefe('Alte Arten = Schema 2 (post, comment, story, user, message)', Meldung.ALTE_ARTEN.join(',') === 'post,comment,story,user,message');

// Jeder grund, den die SQL-Funktionen zurückgeben, hat einen Satz.
const gruende = [...new Set([...sql.matchAll(/'grund', '([a-z_]+)'/g)].map((m) => m[1]))];
const ohneSatz = gruende.filter((g) => !Meldung.GRUND[g]);
pruefe(`jeder grund aus Schema 102 hat einen Satz (${gruende.length})`, gruende.length >= 15 && ohneSatz.length === 0, ohneSatz.join(','));
pruefe('unbekannter grund → nie leer', Meldung.grundText('gibtsnicht').length > 10);

const basis = { art: 'post', ziel: '00000000-0000-0000-0000-000000000001', kategorie: 'hass', begruendung: 'Das ist Hetze gegen X', gutglaeubig: true };
pruefe('gültige Meldung geht durch', Meldung.pruefen(basis) === null);
pruefe('unbekannte Art → art', Meldung.pruefen({ ...basis, art: 'video' }) === 'art');
pruefe('fehlende Kategorie → kategorie', Meldung.pruefen({ ...basis, kategorie: null }) === 'kategorie');
pruefe('unbekannte Kategorie → kategorie', Meldung.pruefen({ ...basis, kategorie: 'problem' }) === 'kategorie');
pruefe('9 Zeichen → begruendung', Meldung.pruefen({ ...basis, begruendung: '123456789' }) === 'begruendung');
pruefe('10 Zeichen gehen durch', Meldung.pruefen({ ...basis, begruendung: '1234567890' }) === null);
pruefe('Leerzeichen zählen nicht (btrim)', Meldung.pruefen({ ...basis, begruendung: '   12345678   ' }) === 'begruendung');
pruefe('Emoji zählt ein Zeichen wie Postgres length()', Meldung.zeichen('😀😀😀😀😀') === 5 && Meldung.pruefen({ ...basis, begruendung: '😀😀😀😀😀😀😀😀😀' }) === 'begruendung');
pruefe('Kindesmissbrauch ohne Begründung geht durch', Meldung.pruefen({ ...basis, kategorie: 'kindesmissbrauch', begruendung: '' }) === null);
pruefe('Häkchen fehlt → gutglaeubig', Meldung.pruefen({ ...basis, gutglaeubig: false }) === 'gutglaeubig');
pruefe('Häkchen muss true sein, nicht „ja"', Meldung.pruefen({ ...basis, gutglaeubig: 'ja' }) === 'gutglaeubig');
pruefe('ohne Ziel → ziel', Meldung.pruefen({ ...basis, ziel: null }) === 'ziel');
pruefe('Problem: ohne Kategorie, ohne Häkchen, ohne Ziel', Meldung.pruefen({ art: 'problem', begruendung: 'Die App stürzt ab' }) === null);
pruefe('Problem: Begründung trotzdem Pflicht', Meldung.pruefen({ art: 'problem', begruendung: 'kurz' }) === 'begruendung');
// Reihenfolge wie in SQL: begruendung vor gutglaeubig vor ziel.
pruefe('Reihenfolge wie SQL (begruendung vor gutglaeubig)', Meldung.pruefen({ ...basis, begruendung: '', gutglaeubig: false, ziel: null }) === 'begruendung');
pruefe('Zähler: „Noch 4 Zeichen"', Meldung.zaehlerText('123456', 'hass') === 'Noch 4 Zeichen');
pruefe('Zähler bei Kindesmissbrauch: nichts beschreiben', /nicht/.test(Meldung.zaehlerText('', 'kindesmissbrauch')));

console.log('\n   Hinweise und Texte');
const km = Meldung.hinweisFuer('kindesmissbrauch');
pruefe('Kindesmissbrauch: nicht beschreiben', km.punkte.some((p) => /nicht/.test(p) && /[Bb]eschreib/.test(p)));
pruefe('Kindesmissbrauch: nicht weiterleiten, nicht speichern', km.punkte.some((p) => /weiter/.test(p) && /speicher/.test(p)));
pruefe('Kindesmissbrauch: Internet-Beschwerdestelle', km.link === 'https://www.internet-beschwerdestelle.de' && km.punkte.join(' ').includes('internet-beschwerdestelle.de'));
pruefe('Kindesmissbrauch: 110', km.punkte.join(' ').includes('110'));
const sv = Meldung.hinweisFuer('selbstverletzung');
pruefe('Selbstverletzung: Telefonseelsorge 0800 111 0 111', sv.punkte.join(' ').includes('0800 111 0 111'));
pruefe('Selbstverletzung: Nummer gegen Kummer 116 111', sv.punkte.join(' ').includes('116 111'));
pruefe('andere Kategorie: kein Hinweis', Meldung.hinweisFuer('hass') === null);
pruefe('Eingangsbestätigung je Weg verschieden', new Set([Meldung.eingangText('post'), Meldung.eingangText('problem'), Meldung.eingangText('post', true)]).size === 3);
pruefe('Eingangsbestätigung = Satz der SQL-Funktion (Anfang)', sql.includes('Danke, deine Meldung ist angekommen. Wir prüfen sie') && Meldung.eingangText('post').startsWith('Danke, deine Meldung ist angekommen. Wir prüfen sie'));
pruefe('„kommt mit dem nächsten Update" je Art', /Community melden kommt mit dem nächsten Update/.test(Meldung.updateText('community')));
pruefe('Titel: Story melden / Problem melden', Meldung.titel('story') === 'Story melden' && Meldung.titel('problem') === 'Problem melden');
pruefe('massnahmeText wie SQL (sperren mit Datum)', Meldung.massnahmeText('sperren', '2026-12-24T12:00:00Z') === 'Das Konto wurde gesperrt bis 24.12.2026');
pruefe('massnahmeText wie SQL (warnen)', sql.includes(Meldung.massnahmeText('warnen')));
pruefe('Widerspruch: Frist offen/abgelaufen', Meldung.widerspruchOffen('2030-01-01') === true && Meldung.widerspruchOffen('2020-01-01') === false && Meldung.widerspruchOffen(null) === false);

console.log('\n   alter Weg (Schema 102 fehlt)');
pruefe('fehltFunktion: 42883, das inhalt_melden selbst nennt', Meldung.fehltFunktion({ code: '42883', message: 'function public.inhalt_melden(p_art => text) does not exist' }));
pruefe('fehltFunktion: 42883 einer Hilfsfunktion im Rumpf → KEIN alter Weg (Fund 28)', !Meldung.fehltFunktion({ code: '42883', message: 'function public.beitrag_sichtbar(uuid, boolean) does not exist' }));
pruefe('fehltFunktion: 42883 ohne Text → kein alter Weg', !Meldung.fehltFunktion({ code: '42883' }));
pruefe('fehltFunktion: Name der gerufenen Funktion zählt', Meldung.fehltFunktion({ code: '42883', message: 'function public.meine_meldungen() does not exist' }, 'meine_meldungen') && !Meldung.fehltFunktion({ code: '42883', message: 'function public.meine_meldungen_alt() does not exist' }, 'meine_meldungen'));
pruefe('fehltFunktion: PGRST202', Meldung.fehltFunktion({ code: 'PGRST202', message: 'Could not find the function public.inhalt_melden' }));
pruefe('fehltFunktion: anderer Fehler nicht', !Meldung.fehltFunktion({ code: '42501', message: 'permission denied' }) && !Meldung.fehltFunktion(null));
pruefe('alter Weg nur für die fünf alten Arten', Meldung.alterWegMoeglich('story') && !Meldung.alterWegMoeglich('community') && !Meldung.alterWegMoeglich('kanal_nachricht') && !Meldung.alterWegMoeglich('problem'));
const ag = Meldung.alterGrund({ art: 'message', kategorie: 'mobbing', begruendung: '  Er beleidigt mich  ', beleg: { text: 'Du Idiot', sitzung: 'xyz' } });
pruefe('alterGrund: Kategorie, Begründung, gemeldeter Text', ag === '[mobbing] Er beleidigt mich | Gemeldeter Text: Du Idiot', ag);
pruefe('alterGrund: Sitzungsschlüssel geht nicht mit', !ag.includes('xyz'));

console.log('\n   Entscheidung (meldung_entscheiden)');
const ent = { art: 'post', massnahme: 'entfernen', begruendung: 'Der Beitrag beleidigt Anna mit „…"', grundlage: 'regeln', zielProfil: 'u1' };
pruefe('gültige Entscheidung', Meldung.entscheidungPruefen(ent) === null);
pruefe('Begründung < 20 → begruendung_entscheidung', Meldung.entscheidungPruefen({ ...ent, begruendung: 'zu kurz' }) === 'begruendung_entscheidung');
pruefe('ohne Grundlage → grundlage', Meldung.entscheidungPruefen({ ...ent, grundlage: null }) === 'grundlage');
pruefe('„keine" braucht keine Grundlage', Meldung.entscheidungPruefen({ ...ent, massnahme: 'keine', grundlage: null }) === null);
pruefe('sperren ohne Konto → kein_konto', Meldung.entscheidungPruefen({ ...ent, massnahme: 'sperren', zielProfil: null }) === 'kein_konto');
pruefe('Profil entfernen → massnahme', Meldung.entscheidungPruefen({ ...ent, art: 'user', massnahme: 'entfernen' }) === 'massnahme');
pruefe('Profil: keine Entfernen-Maßnahmen zur Auswahl', !Meldung.massnahmenFuer('user').some((m) => m.key.startsWith('entfernen')));
pruefe('Problem: immer durch', Meldung.entscheidungPruefen({ art: 'problem', massnahme: 'keine', begruendung: '' }) === null);
pruefe('Dringlichkeit wie SQL-Sortierung', Meldung.dringlichkeit('kindesmissbrauch') === 0 && Meldung.dringlichkeit('gewalt_drohung') === 1 && Meldung.dringlichkeit('selbstverletzung') === 1 && Meldung.dringlichkeit('spam') === 2);
pruefe('Ablauf bei verborgenem Beleg: nicht öffnen, erst entfernen, BKA Pflicht, Sperre nach Bestätigung, 110', /nicht öffnen/.test(Meldung.ABLAUF_VERBORGEN[0]) && /nur „Inhalt entfernen"/.test(Meldung.ABLAUF_VERBORGEN[1]) && /Pflicht nach Art\. 18/.test(Meldung.ABLAUF_VERBORGEN[2]) && /BKA/.test(Meldung.ABLAUF_VERBORGEN[2]) && /bestätigt/.test(Meldung.ABLAUF_VERBORGEN[3]) && Meldung.ABLAUF_VERBORGEN.some((p) => /110/.test(p)));
pruefe('Ablauf: Beschwerdestelle nur zusätzlich, nicht „bzw." (Fund 6)', !Meldung.ABLAUF_VERBORGEN.join(' ').includes('bzw.') && /Zusätzlich/.test(Meldung.ABLAUF_VERBORGEN[2]));

console.log('\n   Gate 2: Kindesmissbrauch, Art. 18, Vorschrift, Klausel (Funde 5, 6, 8, 11, 17, 19, 30)');
const km2 = { art: 'post', kategorie: 'kindesmissbrauch', massnahme: 'entfernen', grundlage: 'gesetz', norm: '§ 184b StGB', begruendung: Meldung.vorlageFuer('kindesmissbrauch', 'entfernen'), zielProfil: 'u1', art18: false };
pruefe('Kindesmissbrauch: entfernen ohne Bestätigung geht', Meldung.entscheidungPruefen(km2) === null, Meldung.entscheidungPruefen(km2));
pruefe('Kindesmissbrauch: sperren ohne Bestätigung → bestaetigung', Meldung.entscheidungPruefen({ ...km2, massnahme: 'entfernen_sperren', bestaetigt: 'kurz', art18: true }) === 'bestaetigung');
pruefe('Kindesmissbrauch: sperren mit Bestätigung, ohne BKA-Vermerk → art18', Meldung.entscheidungPruefen({ ...km2, massnahme: 'entfernen_sperren', bestaetigt: 'Sichtung durch geschulte Person 31.10.', art18: false }) === 'art18');
pruefe('Kindesmissbrauch: sperren mit Bestätigung und Vermerk, ohne Enddatum → durch', Meldung.entscheidungPruefen({ ...km2, massnahme: 'entfernen_sperren', bestaetigt: 'Sichtung durch geschulte Person 31.10.', art18: true, sperreTage: null }) === null);
pruefe('Kindesmissbrauch: Grundlage Richtlinien → grundlage', Meldung.entscheidungPruefen({ ...km2, grundlage: 'regeln', klausel: 2 }) === 'grundlage');
pruefe('Kindesmissbrauch: Vorlage nur bei entfernen/entfernen_sperren', Meldung.vorlageFuer('kindesmissbrauch', 'keine') === '' && Meldung.vorlageFuer('kindesmissbrauch', 'warnen') === '' && Meldung.vorlageFuer('kindesmissbrauch', 'entfernen_sperren').length > 20);
pruefe('Kindesmissbrauch: Vorlage bei „Nichts tun" → vorlage', Meldung.entscheidungPruefen({ ...km2, massnahme: 'keine' }) === 'vorlage');
pruefe('Kindesmissbrauch: Vorlage nennt keine Behörde (Fund 17)', !/Behörde|BKA|gemeldet/i.test(Meldung.VORLAGEN.kindesmissbrauch));
pruefe('Sperre ohne Enddatum bei Mobbing → sperre_dauer', Meldung.entscheidungPruefen({ ...ent, kategorie: 'mobbing', klausel: 5, massnahme: 'sperren', sperreTage: null }) === 'sperre_dauer');
pruefe('Sperre 7 Tage bei Mobbing → durch', Meldung.entscheidungPruefen({ ...ent, kategorie: 'mobbing', klausel: 5, massnahme: 'sperren', sperreTage: 7 }) === null);
pruefe('Sperrdauern: „Ohne Enddatum" nur bei Kindesmissbrauch/Drohung', Meldung.sperrdauernFuer('mobbing').every((s) => s.tage) && Meldung.sperrdauernFuer('gewalt_drohung').some((s) => s.tage === null));
pruefe('Drohung: sperren ohne BKA-Vermerk → art18', Meldung.entscheidungPruefen({ ...ent, kategorie: 'gewalt_drohung', grundlage: 'gesetz', norm: '§ 241 StGB', massnahme: 'sperren', sperreTage: 30, art18: false }) === 'art18');
pruefe('Art.-18-Pflicht nur bei Kindesmissbrauch und Drohung', Meldung.art18Pflicht('kindesmissbrauch') && Meldung.art18Pflicht('gewalt_drohung') && !Meldung.art18Pflicht('selbstverletzung') && !Meldung.art18Pflicht('hass'));
pruefe('Art. 18: u-entrance, Beschwerdestelle zusätzlich, 110', Meldung.ART18.link === 'https://u-entrance.bka.de' && /ersetzt die Meldung an das BKA nicht/.test(Meldung.ART18.punkte.join(' ')) && /110/.test(Meldung.ART18.punkte.join(' ')));
pruefe('Vermerk-Mindestlänge = art18_vermerken (5)', Meldung.MIN_VERMERK === 5 && /length\(v\) < 5/.test(sql));
pruefe('Bestätigung-Mindestlänge = meldung_entscheiden (10)', Meldung.MIN_BESTAETIGUNG === 10 && /p_bestaetigt, ''\)\)\) < 10/.test(sql));
pruefe('Gesetz ohne Vorschrift → norm', Meldung.entscheidungPruefen({ ...ent, kategorie: 'hass', grundlage: 'gesetz', norm: '' }) === 'norm');
pruefe('Gesetz mit „130 StGB" ohne § → norm', Meldung.entscheidungPruefen({ ...ent, kategorie: 'hass', grundlage: 'gesetz', norm: '130 StGB' }) === 'norm');
pruefe('Gesetz mit „§ 130 StGB" → durch', Meldung.entscheidungPruefen({ ...ent, kategorie: 'hass', grundlage: 'gesetz', norm: '§ 130 StGB' }) === null);
pruefe('„Art." gilt wie in SQL', Meldung.normGueltig('Art. 6 DSGVO') && !Meldung.normGueltig('DSGVO'));
pruefe('Richtlinien ohne Klausel → klausel', Meldung.entscheidungPruefen({ ...ent, kategorie: 'regelverstoss', klausel: null }) === 'klausel');
const Rechtstexte = require('../../gemeinsam/rechtstexte');
const cr = Rechtstexte.dokument('community_richtlinien').abschnitte;
pruefe('Abschnitte = Community-Richtlinien in rechtstexte.js (Nummer und Titel)', cr.length === Meldung.RICHTLINIEN_ABSCHNITTE.length && Meldung.RICHTLINIEN_ABSCHNITTE.every((a, i) => a.nr === i + 1 && cr[i].titel === a.titel), cr.map((a) => a.titel).join(' | '));
pruefe('jede Kategorie hat einen Klausel-Eintrag (Zahl oder bewusst null)', Meldung.KATEGORIE_KEYS.every((k) => k in Meldung.KLAUSEL_JE_KATEGORIE));
pruefe('Klausel je Kategorie passt (Hass → 4, Kinder → 2, Urheberrecht → 9)', Meldung.klauselFuer('hass').titel === 'Hass' && Meldung.klauselFuer('kindesmissbrauch').nr === 2 && Meldung.klauselFuer('urheberrecht').titel === 'Rechte anderer');
pruefe('nur Verbots-Abschnitte wählbar (2–11)', Meldung.KLAUSELN.length === 10 && !Meldung.klausel(1) && !Meldung.klausel(12));
const mitK = Meldung.begruendungMitGrundlage({ massnahme: 'entfernen', grundlage: 'regeln', klausel: 4, begruendung: 'Der Inhalt nennt Geflüchtete „Ungeziefer".' });
pruefe('Begründung nennt Nummer und Titel der Klausel', /Community-Richtlinien, Abschnitt 4 „Hass“\)$/.test(mitK), mitK);
const mitN = Meldung.begruendungMitGrundlage({ massnahme: 'entfernen', grundlage: 'gesetz', norm: '§ 130 StGB', begruendung: 'Der Inhalt ruft zu Hass gegen Juden auf.' });
pruefe('Begründung nennt die Vorschrift (erfüllt die SQL-Prüfung auf § / Art.)', /\(Vorschrift: § 130 StGB\)$/.test(mitN) && /(§|Art\.)/.test(mitN), mitN);
pruefe('Vorschrift schon im Text → nicht doppelt', Meldung.begruendungMitGrundlage({ massnahme: 'entfernen', grundlage: 'gesetz', norm: '§ 130 StGB', begruendung: 'Volksverhetzung nach § 130 StGB, konkret …' }).split('§ 130').length === 2);
pruefe('„Nichts tun": Begründung unverändert', Meldung.begruendungMitGrundlage({ massnahme: 'keine', grundlage: 'regeln', klausel: 4, begruendung: 'Kein Verstoß erkennbar, Satire.' }) === 'Kein Verstoß erkennbar, Satire.');
pruefe('Urteil „stimmt nicht" neutral: Chiffre, später bearbeitet (Fund 30)', /gespeicherten Chiffre/.test(Meldung.BELEG.falsch) && /bearbeitet/.test(Meldung.BELEG.falsch));
pruefe('Medienvorschau: nie bei Kindesmissbrauch, nur offen, nur mit Medium', Meldung.mediumZeigbar({ kategorie: 'hass', status: 'eingegangen', beleg: { medium: true } }) && !Meldung.mediumZeigbar({ kategorie: 'kindesmissbrauch', status: 'eingegangen', beleg: { medium: true } }) && !Meldung.mediumZeigbar({ kategorie: 'hass', status: 'entschieden', beleg: { medium: true } }) && !Meldung.mediumZeigbar({ kategorie: 'hass', status: 'eingegangen', beleg: {} }));
pruefe('neue Gründe auf Deutsch: bestaetigung, sperre_dauer, ziel_weg, grundlage, norm, vermerk, art18, klausel', ['bestaetigung', 'sperre_dauer', 'ziel_weg', 'grundlage', 'norm', 'vermerk', 'art18', 'klausel', 'zweitpruefung'].every((g) => Meldung.GRUND[g] && /[äöüß]|[a-z]{3}/.test(Meldung.GRUND[g])));

console.log('\n2  krypto.js: meldebeleg / belegPruefen (echte Verschlüsselung)');
const anna = Krypto.schluesselpaarErzeugen();
const ben = Krypto.schluesselpaarErzeugen();
const ben2 = Krypto.schluesselpaarErzeugen(); // Bens zweites Gerät
const text = 'Ich weiß, wo du wohnst. Grüße 😀';
const v = Krypto.verschluesseln(text, anna.geheim, [
  { id: 'k-ben', oeffentlich: ben.oeffentlich },
  { id: 'k-ben2', oeffentlich: ben2.oeffentlich },
  { id: 'k-anna', oeffentlich: anna.oeffentlich },
]);
const andere = Krypto.verschluesseln('Eine ganz andere Nachricht', anna.geheim, [{ id: 'k-ben', oeffentlich: ben.oeffentlich }]);
const kopf = (x) => ({ version: x.version, chiffre: x.chiffre, nonce: x.nonce, absender: x.absender });
const kuvert = (x, id) => x.kuverts.find((k) => k.schluesselId === id);

const beleg = Krypto.meldebeleg(kopf(v), kuvert(v, 'k-ben'), ben.geheim);
pruefe('meldebeleg liefert Text und Sitzung', !!beleg && beleg.text === text && typeof beleg.sitzung === 'string');
pruefe('Sitzung ist 32 Byte (Base64, 44 Zeichen)', beleg && Krypto.ausBase64(beleg.sitzung).length === 32 && beleg.sitzung.length === 44);
pruefe('Gerätschlüssel steht NICHT im Beleg', beleg && !JSON.stringify(beleg).includes(ben.geheim) && beleg.sitzung !== ben.geheim);
const beleg2 = Krypto.meldebeleg(kopf(v), kuvert(v, 'k-ben2'), ben2.geheim);
pruefe('zweites Gerät: derselbe Sitzungsschlüssel', beleg2 && beleg2.sitzung === beleg.sitzung);
pruefe('belegPruefen: echt', Krypto.belegPruefen({ chiffre: v.chiffre, nonce: v.nonce }, beleg.sitzung, text) === true);
pruefe('belegPruefen: veränderter Text → false', Krypto.belegPruefen({ chiffre: v.chiffre, nonce: v.nonce }, beleg.sitzung, text + '!') === false);
pruefe('belegPruefen: anderer Schlüssel → false', Krypto.belegPruefen({ chiffre: v.chiffre, nonce: v.nonce }, Krypto.zuBase64(crypto.randomBytes(32)), text) === false);
pruefe('Beleg öffnet KEINE andere Nachricht', Krypto.belegPruefen({ chiffre: andere.chiffre, nonce: andere.nonce }, beleg.sitzung, 'Eine ganz andere Nachricht') === false);
pruefe('belegPruefen: kaputte Eingaben → false, kein Wurf', [
  Krypto.belegPruefen(null, beleg.sitzung, text),
  Krypto.belegPruefen({ chiffre: v.chiffre, nonce: v.nonce }, '', text),
  Krypto.belegPruefen({ chiffre: v.chiffre, nonce: 'kaputt' }, beleg.sitzung, text),
  Krypto.belegPruefen({ chiffre: 'kaputt', nonce: v.nonce }, beleg.sitzung, text),
  Krypto.belegPruefen({ chiffre: v.chiffre, nonce: v.nonce }, 'AAAA', text),
].every((x) => x === false));
pruefe('meldebeleg: fremdes Kuvert → null', Krypto.meldebeleg(kopf(v), kuvert(v, 'k-anna'), ben.geheim) === null);
pruefe('meldebeleg: falsche Version → null', Krypto.meldebeleg({ ...kopf(v), version: 99 }, kuvert(v, 'k-ben'), ben.geheim) === null);
pruefe('meldebeleg: ohne Kuvert → null', Krypto.meldebeleg(kopf(v), null, ben.geheim) === null);
// Bearbeitet (umschliessen): neue Chiffre, derselbe Sitzungsschlüssel.
const bearbeitet = Krypto.umschliessen('Bearbeitet', { version: v.version, absender: v.absender }, kuvert(v, 'k-anna'), anna.geheim);
const belegB = Krypto.meldebeleg({ ...kopf(v), chiffre: bearbeitet.chiffre, nonce: bearbeitet.nonce }, kuvert(v, 'k-ben'), ben.geheim);
pruefe('bearbeitete Nachricht: Beleg zeigt den aktuellen Text', belegB && belegB.text === 'Bearbeitet' && Krypto.belegPruefen(bearbeitet, belegB.sitzung, 'Bearbeitet'));
pruefe('bearbeitete Nachricht: alter Text passt nicht mehr zur neuen Chiffre', Krypto.belegPruefen(bearbeitet, beleg.sitzung, text) === false);

console.log(`\n${gut}/${gut + schlecht} Prüfungen bestanden`);
process.exit(schlecht ? 1 : 0);
