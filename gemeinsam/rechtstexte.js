/**
 * All Media — die Rechtstexte, wie App und Website sie beide zeigen.
 *
 * WARUM ES DAS GIBT
 *
 * Auftrag Henrik 21.10.2026: All Media rechtlich prüfen, Sicherheits- und
 * Jugendschutz-Regeln festlegen. Maßstab: eine veröffentlichte App mit vielen
 * Nutzern. Bis zum 22.10.2026 gab es kein Impressum und keine Community-
 * Richtlinien, die Datenschutzerklärung hatte drei Sätze, die Nutzungs-
 * bedingungen sagten „ab 13" (für Deutschland gilt 16, siehe alter.js) und
 * die Anmeldung behauptete „werden nicht mit Dritten geteilt" — falsch:
 * Supabase, Render, Bunny.net, Kartendienste und die Passwortprüfung bekommen Daten.
 *
 * Die Texte stehen NUR hier. App und Website zeigen sie über dieselbe
 * Funktion an, `test:recht` vergleicht sie mit alter.js, den Schemas und
 * dem Code (z. B. dass nur die Zweierchats „Ende-zu-Ende" heißen).
 *
 * ENTWURF
 *
 * Alles hier ist ein Entwurf ohne anwaltliche Prüfung. Vor dem Launch
 * fachlich prüfen lassen (Recht/All-Media-Rechtspruefung-21-10-2026.md im
 * Vault). Was nur Henrik bzw. seine Eltern wissen (Betreiber, Anschrift,
 * Kontakt), steht als ⟦Platzhalter⟧ da — nie erfunden. `test:recht -- --launch`
 * lässt keinen Platzhalter durch.
 *
 * VERSIONEN
 *
 * Jedes Dokument hat eine Versionsnummer. Ändert sich der Text, steigt sie
 * — `test:recht` merkt sich eine Prüfsumme je Version und schlägt Alarm,
 * wenn der Text ohne neue Nummer geändert wurde. Zustimmungen werden mit
 * Dokument und Version gespeichert (Kasten RS 7).
 *
 * WER DIESELBEN REGELN KENNT
 *
 * Altersgrenzen: alter.js und public.altersgrenzen (Schema 52).
 * Meldekategorien und Maßnahmen: SUPABASE_SCHEMA_102_melden_moderation.sql.
 * Konto löschen: konto-loeschen.js und Schema 103.
 * Feed: rang.js und feed_rang() (Schema 51).
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node und Metro.
    module.exports = factory(require('./alter'));
  } else {
    // Browser: als eigenes <script> eingebunden, nach alter.js.
    global.Rechtstexte = factory(global.Alter);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Alter) {
  'use strict';

  var STAND = '24.10.2026';

  /** Platzhalter für das, was nur Henrik bzw. seine Eltern eintragen können. */
  function P(was) { return '⟦' + was + '⟧'; }
  var PLATZHALTER_MUSTER = /⟦[^⟧]*⟧/g;

  var BETREIBER = {
    name: P('Name des Betreibers — Elternteil oder Firma'),
    anschrift: P('Straße, Hausnummer, PLZ, Ort'),
    email: P('Kontakt-E-Mail'),
    behoerden: P('E-Mail für Behörden nach Art. 11 DSA'),
    zweiter_weg: P('zweiter schneller Kontaktweg, z. B. Telefon oder Kontaktformular'),
    aufsicht: P('Datenschutz-Aufsichtsbehörde des Bundeslands, in dem der Betreiber sitzt'),
    // Google Play verlangt eine benannte Person; volljährig (Entscheidung E4).
    kinderschutz: P('Name und E-Mail der volljährigen Kinderschutz-Kontaktperson (Entscheidung E4)'),
  };

  /* Altersgrenze Deutschland aus alter.js, nicht abgeschrieben. */
  var DE = Alter.grenzeFuer('DE');
  var AB = DE.mindestalter;
  var UNTERGRENZE_DE = DE.untergrenze; // null = Eltern können jedes Alter freigeben (Entscheidung E1 offen)
  var VOLLJAEHRIG = Alter.VOLLJAEHRIG;

  var altersSatz =
    'In Deutschland darfst du All Media ab ' + AB + ' Jahren allein nutzen. Bist du jünger, ' +
    'brauchst du die Zustimmung eines Elternteils, das selbst ein All-Media-Konto hat und dein ' +
    'Konto von dort aus freigibt. ' +
    (UNTERGRENZE_DE ? 'Unter ' + UNTERGRENZE_DE + ' Jahren geht es auch mit Zustimmung nicht. ' : '') +
    'In anderen Ländern gilt die Grenze des Landes deiner Telefonnummer — die App sagt sie dir bei der Anmeldung.';

  var HILFE = [
    'Nummer gegen Kummer für Kinder und Jugendliche: 116 111 (kostenlos, anonym, Mo–Sa 14–20 Uhr) — nummergegenkummer.de',
    'Elterntelefon der Nummer gegen Kummer: 0800 111 0 550 (kostenlos, anonym, Mo, Mi, Fr 9–17 Uhr, Di, Do 9–19 Uhr)',
    'TelefonSeelsorge: 0800 111 0 111, 0800 111 0 222 oder 116 123 (kostenlos, rund um die Uhr)',
  'Hilfe-Telefon Sexueller Missbrauch: 0800 22 55 530 (kostenlos, anonym, Mo, Mi, Fr 9–14 Uhr, Di, Do 15–20 Uhr) — hilfe-portal-missbrauch.de',
    'In akuter Gefahr: Polizei 110, Notruf 112',
    'Cybermobbing, Hass, Nacktbilder: Jugendliche beraten Jugendliche bei juuuport.de',
    'Verstöße gegen den Jugendschutz melden: jugendschutz.net/verstoss-melden oder internet-beschwerdestelle.de',
    'Außerhalb Deutschlands: Hilfe- und Meldestellen deines Landes unter better-internet-for-kids.europa.eu',
  ];

  // -------------------------------------------------------------------
  // Die Dokumente
  // -------------------------------------------------------------------

  var DOKUMENTE = {

    // Art. 14 Abs. 3 DSA: so erklären, dass Minderjährige es verstehen.
    kurz_erklaert: {
      titel: 'Die Regeln kurz erklärt',
      version: 1,
      abschnitte: [
        { titel: 'Das Wichtigste in zehn Sätzen', text: [
          '1. ' + altersSatz,
          '2. Sei fair. Beleidigen, Drohen, Mobben und Hetzen sind verboten.',
          '3. Nacktbilder von Kindern und Jugendlichen sind immer verboten — auch von dir selbst. Wir melden so etwas der Polizei.',
          '4. Poste nur Fotos und Videos, die du posten darfst. Frag andere, bevor du sie zeigst oder markierst.',
          '5. Wenn dich etwas stört oder dir Angst macht: Tippe auf „Melden". Wir schauen es uns an und sagen dir, was wir entschieden haben. Wer gemeldet wurde, erfährt nicht, dass du es warst.',
          '6. Du kannst jeden blockieren oder stummschalten.',
          '7. Wenn wir etwas von dir löschen oder dein Konto sperren, sagen wir dir warum. Du kannst widersprechen (über „Problem melden") — dann prüft es jemand noch einmal.',
          '8. Deine Zweierchats sind verschlüsselt. Gruppen, Communitys, Anhänge und Anrufe noch nicht. Wir lesen eure Chats nicht.',
          '9. Du kannst dein Konto jederzeit in den Einstellungen löschen und vorher alle deine Daten herunterladen.',
          '10. Hilfe bekommst du auch außerhalb von All Media: Nummer gegen Kummer 116 111 — kostenlos und anonym.',
        ] },
      ],
    },

    nutzungsbedingungen: {
      titel: 'Nutzungsbedingungen',
      version: 1,
      abschnitte: [
        { titel: 'Wer All Media anbietet', text: [
          'All Media wird betrieben von ' + BETREIBER.name + ', ' + BETREIBER.anschrift + '. ' +
          'Kontakt: ' + BETREIBER.email + '. Alles Weitere steht im Impressum.',
        ] },
        { titel: 'Wer mitmachen darf', text: [
          altersSatz,
          'Die Altersangabe muss stimmen. Wer ein falsches Geburtsdatum angibt, um eine Grenze zu umgehen, verstößt gegen diese Bedingungen.',
          // Für 16- bis 17-Jährige in Deutschland ist das heute nur eine Bestätigung
          // des Jugendlichen, keine Zustimmung der Eltern selbst (§ 107 BGB) —
          // Entscheidung E9 in der Entscheidungsvorlage Recht.
          'Bist du unter ' + VOLLJAEHRIG + ', brauchst du für diesen Nutzungsvertrag das Einverständnis deiner Eltern. Unter der Altersgrenze geben sie es in der App; darüber bestätigst du mit der Anmeldung, dass sie einverstanden sind. All Media ist kostenlos; es entstehen keine Zahlungspflichten.',
        ] },
        { titel: 'Dein Konto', text: [
          'Pro Telefonnummer gibt es ein Konto. Halte dein Passwort geheim. Merkst du, dass jemand anderes dein Konto benutzt, ändere sofort dein Passwort und melde dich bei uns.',
          'Du kannst dein Konto jederzeit in den Einstellungen löschen. Es wird sofort und endgültig gelöscht — mit Profil, Beiträgen, Storys, Kommentaren, Nachrichten, Fotos und Videos.',
        ] },
        { titel: 'Deine Inhalte', text: [
          'Was du postest, gehört weiter dir. Damit wir es anzeigen können, erlaubst du uns, deine Inhalte auf All Media zu speichern, zu zeigen und technisch anzupassen (z. B. kleinere Vorschaubilder) — nur so weit, wie du sie selbst sichtbar machst. Die Erlaubnis endet, wenn du den Inhalt oder dein Konto löschst.',
          'Du bist dafür verantwortlich, dass du die Rechte an deinen Inhalten hast — auch an Musik, Fotos anderer Menschen und an den Personen, die darauf zu sehen sind.',
        ] },
        { titel: 'Was verboten ist', text: [
          'Was auf All Media nicht erlaubt ist, steht in den Community-Richtlinien. Sie sind Teil dieser Bedingungen.',
        ] },
        { titel: 'Melden und wie wir entscheiden', text: [
          'Jeden Beitrag, jede Story, jeden Kommentar, jedes Profil, jede Community und jede Nachricht kannst du über „Melden" an uns schicken. Du bekommst eine Eingangsbestätigung und später unsere Entscheidung (Art. 16 DSA).',
          'Meldungen prüft ein Mensch. Wir entscheiden nicht automatisch und setzen keine Software ein, die Inhalte selbstständig erkennt oder löscht.',
          'Meldungen zu Gewalt gegen Kinder und zu Drohungen bearbeiten wir zuerst. Besteht der Verdacht einer Straftat, die Leben oder Sicherheit eines Menschen gefährdet, informieren wir die Polizei (Art. 18 DSA).',
          'Eure Chats lesen wir nicht mit. Aus einem Chat sehen wir nur, was ein Gesprächsteilnehmer uns selbst meldet.',
        ] },
        { titel: 'Was passieren kann', text: [
          'Je nach Schwere: Wir lassen den Inhalt stehen, verwarnen dich, entfernen den Inhalt oder sperren dein Konto für eine bestimmte Zeit oder dauerhaft. Wer wiederholt gegen die Regeln verstößt, wird zuerst verwarnt und dann gesperrt. Bei Gewalt gegen Kinder sperren wir sofort.',
          'Jede Maßnahme begründen wir: was wir getan haben, warum, nach welcher Regel oder welchem Gesetz, und wie du dich wehren kannst (Art. 17 DSA).',
          'Läuft gegen dein Konto eine Sperre und du löschst es, kann deine Telefonnummer bis zum Ende der Sperre nicht für ein neues Konto benutzt werden.',
        ] },
        { titel: 'Widerspruch', text: [
          'Gegen jede Entscheidung — auch wenn wir etwas, das du gemeldet hast, stehen lassen — kannst du innerhalb von sechs Monaten widersprechen: in der App unter Einstellungen → Hilfe → „Problem melden" oder per E-Mail an ' + BETREIBER.email + '. Dann prüft eine andere Person noch einmal und antwortet dir mit Begründung (Art. 20 DSA).',
          'Du kannst dich außerdem an eine zertifizierte außergerichtliche Streitbeilegungsstelle wenden (Liste bei der Bundesnetzagentur) oder vor Gericht gehen.',
        ] },
        { titel: 'So funktioniert dein Feed', text: [
          'Die Reihenfolge im Feed richtet sich vor allem danach, wie lange Beiträge angesehen werden, wie viele Menschen sie liken, kommentieren oder teilen, ob sie zu Themen passen, die dich interessiert haben, und wie neu sie sind. Ältere Beiträge rutschen nach hinten.',
          'Jeder vierte Platz gehört einem neuen Beitrag, der noch kaum gesehen wurde. Beiträge derselben Person stehen mit etwas Abstand.',
          'Du kannst den Feed lenken („mehr", „weniger", „Kein Interesse") und ihn in den Einstellungen ganz zurücksetzen.',
        ] },
        { titel: 'Verschlüsselung', text: [
          'Texte in Zweierchats sind Ende-zu-Ende verschlüsselt: Lesen können sie nur die beiden Geräte. Gruppen, Community-Chats, Anhänge (Fotos, Videos, Sprachnachrichten) und Anrufe sind auf dem Weg verschlüsselt, liegen aber unverschlüsselt auf unseren Servern.',
        ] },
        { titel: 'Spenden', text: [
          'Spenden an andere Nutzer sind noch nicht freigeschaltet. Eine Spende wird nur vorgemerkt; es wird kein Geld bewegt, bis ein Zahlungsdienst angeschlossen ist. Darüber informieren wir vorher.',
        ] },
        { titel: 'Änderungen', text: [
          'Ändern wir diese Bedingungen wesentlich, sagen wir es dir vorher in der App. Du kannst dann zustimmen oder dein Konto löschen.',
        ] },
        { titel: 'Haftung und Recht', text: [
          'Wir bemühen uns, dass All Media läuft, können das aber nicht jederzeit versprechen. Für Schäden haften wir nach den gesetzlichen Vorschriften.',
          'Es gilt deutsches Recht. Wohnst du in einem anderen EU-Land, behältst du den Schutz der Verbraucherrechte deines Landes.',
        ] },
      ],
    },

    community_richtlinien: {
      titel: 'Community-Richtlinien',
      version: 1,
      abschnitte: [
        { titel: 'Worum es geht', text: [
          'All Media soll ein Ort sein, an dem sich alle sicher fühlen — besonders Kinder und Jugendliche. Diese Regeln gelten für Beiträge, Storys, Videos, Kommentare, Profile, Communitys und Nachrichten.',
        ] },
        { titel: 'Kinder schützen', text: [
          'Darstellungen sexuellen Missbrauchs von Kindern und Jugendlichen, Nacktbilder Minderjähriger (auch eigene) und jeder Versuch, Kinder anzusprechen, um sie sexuell auszunutzen (Cybergrooming), sind verboten. Wir entfernen solche Inhalte sofort, sperren das Konto und melden es dem Bundeskriminalamt.',
          'Siehst du so etwas: Nicht weiterleiten, nicht speichern, keinen Screenshot machen — nur melden. Du kannst das auch ohne Begründung tun.',
        ] },
        { titel: 'Gewalt und Drohungen', text: [
          'Keine Drohungen, keine Aufrufe zu Gewalt, keine Verherrlichung von Gewalt oder Terror.',
        ] },
        { titel: 'Hass', text: [
          'Niemanden wegen Herkunft, Hautfarbe, Religion, Geschlecht, sexueller Orientierung, Behinderung oder Alter herabwürdigen. Keine verbotenen Symbole.',
        ] },
        { titel: 'Mobbing und Belästigung', text: [
          'Niemanden beleidigen, bloßstellen, ausgrenzen oder immer wieder anschreiben, der das nicht will.',
        ] },
        { titel: 'Sexuelle Inhalte', text: [
          'Keine Pornografie und keine sexuellen Inhalte. Keine ungefragten Nacktbilder an andere.',
        ] },
        { titel: 'Selbstverletzung', text: [
          'Keine Inhalte, die Selbstverletzung, Suizid oder Essstörungen anleiten oder verherrlichen. Wenn es dir nicht gut geht: Nummer gegen Kummer 116 111 oder TelefonSeelsorge 0800 111 0 111.',
        ] },
        { titel: 'Betrug und Spam', text: [
          'Kein Betrug, keine Fake-Gewinnspiele, keine falschen Konten, die sich als jemand anderes ausgeben, kein massenhaftes Werben.',
        ] },
        { titel: 'Rechte anderer', text: [
          'Keine Inhalte, an denen du keine Rechte hast (Musik, Filme, Fotos anderer). Keine Fotos oder Videos von Menschen, die das nicht wollen. Keine privaten Daten anderer (Adresse, Telefonnummer).',
        ] },
        { titel: 'Jugendgefährdende Inhalte', text: [
          'Keine Inhalte, die für Kinder und Jugendliche gefährlich sind — etwa Drogen, Glücksspiel oder gefährliche Mutproben.',
        ] },
        { titel: 'Falschinformationen', text: [
          'Keine bewusst falschen Behauptungen, die anderen schaden oder Menschen in Gefahr bringen.',
        ] },
        { titel: 'Was wir tun', text: [
          'Je nach Schwere: stehen lassen, verwarnen, entfernen, befristet oder dauerhaft sperren. Wiederholte Verstöße führen zur Sperre. Jede Maßnahme begründen wir, und du kannst widersprechen (siehe Nutzungsbedingungen).',
        ] },
        { titel: 'Hilfe', text: HILFE },
      ],
    },

    datenschutz: {
      titel: 'Datenschutzerklärung',
      version: 1,
      abschnitte: [
        { titel: 'Wer verantwortlich ist', text: [
          'Verantwortlich für deine Daten ist ' + BETREIBER.name + ', ' + BETREIBER.anschrift + ', ' + BETREIBER.email + '.',
          'Diese Erklärung informiert dich (Art. 13 und 14 DSGVO). Du musst ihr nicht zustimmen; wo wir deine Einwilligung brauchen, fragen wir einzeln.',
        ] },
        { titel: 'Welche Daten wir speichern und wozu', text: [
          'Konto: E-Mail-Adresse, Telefonnummer, Passwort (nur als Hashwert), Geburtsdatum und das Land deiner Telefonnummer — um dein Konto zu führen und die Altersgrenze einzuhalten (Art. 6 Abs. 1 b und c DSGVO). Bei Kindern unter der Altersgrenze außerdem, welches Elternteil zugestimmt hat (Art. 8 DSGVO).',
          'Profil und Inhalte: Name, Benutzername, Profilbild, Beiträge, Storys, Videos, Kommentare, Communitys, Markierungen, Likes — damit All Media funktioniert (Art. 6 Abs. 1 b).',
          'Nachrichten: Zweierchats speichern wir nur verschlüsselt; lesen können sie nur eure Geräte. Gruppen-, Community-Nachrichten und Anhänge speichern wir unverschlüsselt, um sie zuzustellen. Wir lesen sie nicht und werten sie nicht aus (Fernmeldegeheimnis, § 3 TDDDG).',
          'Nutzung: welche Beiträge du ansiehst, wie lange, was du likst, wem du folgst und wessen Profil du aufrufst — um deinen Feed zu ordnen und dir Statistiken zu zeigen (Art. 6 Abs. 1 b und f).',
          'Telefonbuch-Abgleich: Nur wenn du ihn einschaltest, schickt die App die Telefonnummern aus deinem Telefonbuch (ohne Namen) verschlüsselt an unseren Server, um Bekannte zu finden. Der Server speichert davon nur einen Hashwert (SHA-256), nie die Nummer selbst. Davon betroffen sind auch Menschen, die All Media nicht nutzen (Art. 14 DSGVO). Höchstens fünf Abgleiche pro Tag.',
          'Standort: nur, wenn du ihn in einem Chat teilst oder einen Ort suchst, und nur mit deiner Erlaubnis im Betriebssystem.',
          'Spenden: Für eine hinterlegte Zahlungsmethode speichern wir nur die Art, die letzten vier Ziffern und das Ablaufdatum der Karte bzw. die PayPal-Adresse in gekürzter Form — nie die volle Kartennummer oder den Prüfcode. Deine Spenden-PIN speichern wir nur als Hashwert (Art. 6 Abs. 1 b).',
          'Sicherheit: Zeitpunkte von Anmeldungen und Zähler gegen Missbrauch (z. B. zu viele Nummernsuchen), Meldungen und Sperren (Art. 6 Abs. 1 c und f).',
        ] },
        { titel: 'Wer Daten von uns bekommt', text: [
          // Vertragspartner und Grundlage laut Supabase-DPA, geprüft 25.10.2026 (Gate 1b zu R3).
          'Supabase (Datenbank, Anmeldung, Speicher): Server in Irland (EU). Vertragspartner ist Supabase Pte. Ltd. in Singapur; Zugriffe von außerhalb der EU sind über Standardvertragsklauseln der EU-Kommission abgesichert (Art. 46 DSGVO), Grundlage ist ein Auftragsverarbeitungsvertrag (Art. 28 DSGVO).',
          // Grundlage laut Render-DPA Ziff. 6.2, gelesen 25.10.2026 (Gate 1b zu R3); die Region entscheidet L2.
          'Render (Website): ' + P('Region des Render-Dienstes prüfen; ohne Angabe USA') + '. Grundlage ist ein Auftragsverarbeitungsvertrag (Art. 28 DSGVO); Übermittlungen in die USA stützen sich auf das EU-US Data Privacy Framework, sonst auf Standardvertragsklauseln.',
          // Seit 28.10.2026 (Schema 115/116, Verarbeitungsverzeichnis V18). Firmierung und AVV prüft Gate 1.
          'Bunny.net (Fotos und Videos speichern und ausliefern): BunnyWay d.o.o. in Slowenien (EU); die Auslieferung läuft über Server in vielen Ländern, die dabei technisch deine IP-Adresse sehen. Grundlage ist ein Auftragsverarbeitungsvertrag (Art. 28 DSGVO). ' + P('Firmierung, AVV und Unterauftragnehmer von Bunny.net prüfen') + '.',
          'Passwortprüfung (Have I Been Pwned): Beim Festlegen eines Passworts schicken wir nur die ersten fünf Zeichen eines Hashwerts — nie das Passwort selbst — um zu prüfen, ob es schon in Datenlecks aufgetaucht ist.',
          'Karten und Ortssuche (OpenStreetMap Foundation, OpenTopoMap, Esri ArcGIS): Wenn du eine Karte öffnest oder einen Ort suchst, lädt dein Gerät Kartenbilder bzw. Suchergebnisse direkt von dort. Dabei sehen diese Dienste deine IP-Adresse und den Kartenausschnitt bzw. Suchbegriff.',
          'Schriften und Kartenbibliothek liefern wir selbst aus — es gehen dafür keine Daten an Google oder andere.',
          'Beim Aufruf der Website verarbeitet Render technisch deine IP-Adresse, Uhrzeit und die aufgerufene Adresse in Server-Protokollen (Art. 6 Abs. 1 f, Sicherheit und Betrieb). ' + P('Speicherdauer der Render-Protokolle prüfen und eintragen') + '.',
          'Behörden bekommen Daten nur, wenn ein Gesetz uns dazu verpflichtet. Inhalte verschlüsselter Chats können wir nicht herausgeben, weil wir sie nicht kennen.',
          'Wir verkaufen keine Daten und zeigen keine Werbung.',
        ] },
        { titel: 'Wie lange wir Daten speichern', text: [
          'Bis du sie oder dein Konto löschst. Gelöschte Konten sind sofort weg.',
          'Meldungen bleiben ohne deinen Namen erhalten, damit Entscheidungen nachvollziehbar bleiben. ' + P('Löschfrist für Meldungen und Moderationsprotokoll festlegen (Entscheidung E3)') + '.',
          'Lief beim Löschen eine Sperre, bleibt bis zu ihrem Ende ein Hashwert deiner Telefonnummer gespeichert — sonst nichts.',
        ] },
        { titel: 'Dein Gerät', text: [
          'Die App speichert auf deinem Gerät, was für die Anmeldung und für die Verschlüsselung nötig ist (deinen privaten Schlüssel, deine Sitzung). Das ist technisch erforderlich (§ 25 Abs. 2 TDDDG). Auf Kontakte, Standort, Kamera, Mikrofon und Fotos greift die App nur zu, wenn du es im Betriebssystem erlaubst.',
          'Die Website setzt keine Cookies für Werbung oder Statistik.',
        ] },
        { titel: 'Deine Rechte', text: [
          'Du kannst jederzeit Auskunft verlangen, Daten berichtigen, löschen, einschränken lassen, sie mitnehmen und der Verarbeitung widersprechen (Art. 15 bis 21 DSGVO). Am schnellsten: „Meine Daten herunterladen" und „Konto löschen" in den Einstellungen.',
          'Eine Einwilligung kannst du jederzeit widerrufen, z. B. den Telefonbuch-Abgleich ausschalten.',
          'Du kannst dich bei einer Datenschutz-Aufsichtsbehörde beschweren, z. B. bei ' + BETREIBER.aufsicht + '.',
          'Wir treffen keine Entscheidungen über dich, die allein auf automatischer Verarbeitung beruhen (Art. 22 DSGVO).',
        ] },
        { titel: 'Kinder und Jugendliche', text: [
          altersSatz,
          'Für Kinder unter der Altersgrenze verarbeiten wir Daten nur mit Zustimmung eines Elternteils (Art. 8 DSGVO). Eltern sehen den Status des Kontos und die Bildschirmzeit — nicht die Chats und nicht die Inhalte ihres Kindes.',
        ] },
      ],
    },

    eltern_info: {
      titel: 'Für Eltern',
      version: 1,
      abschnitte: [
        { titel: 'Wie die Freigabe funktioniert', text: [
          altersSatz,
          'Ihr Kind gibt bei der Anmeldung die Telefonnummer Ihres All-Media-Kontos an. Sie bekommen eine Anfrage und stimmen zu oder lehnen ab. Bis dahin kann Ihr Kind All Media nicht nutzen und ist für andere nicht auffindbar.',
        ] },
        { titel: 'Was Sie sehen und steuern', text: [
          'Sie sehen, ob das Konto Ihres Kindes freigegeben ist, und können die Bildschirmzeit festlegen.',
          'Chats, Beiträge und Kontakte Ihres Kindes sehen Sie nicht. Auch Kinder haben ein Recht auf Privatsphäre — sprechen Sie lieber mit Ihrem Kind darüber, was es erlebt.',
          'Löschen Sie Ihr eigenes Konto, endet die Bildschirmzeit-Steuerung; Ihr Kind wird darüber informiert. Ihre Zustimmung bleibt gültig.',
          P('Zustimmung widerrufen: bis die Funktion gebaut ist (Kasten RS 5), per E-Mail an') + ' ' + BETREIBER.email + '.',
        ] },
        { titel: 'Was All Media zum Schutz tut', text: [
          'Melden ist überall möglich, auch in Chats. Meldungen zu Gewalt gegen Kinder bearbeiten wir zuerst und melden sie dem Bundeskriminalamt.',
          'Chats lesen wir nicht mit. Zweierchats sind Ende-zu-Ende verschlüsselt.',
          'Jede Person kann blockiert und stummgeschaltet werden.',
        ] },
        { titel: 'Hilfe', text: HILFE },
      ],
    },

    impressum: {
      titel: 'Impressum',
      version: 1,
      abschnitte: [
        { titel: 'Angaben nach § 5 DDG', text: [
          BETREIBER.name,
          BETREIBER.anschrift,
          'E-Mail: ' + BETREIBER.email,
          BETREIBER.zweiter_weg,
          P('falls eine Firma betreibt: Rechtsform, Vertretungsberechtigte, Registergericht und -nummer, USt-IdNr.'),
        ] },
        { titel: 'Kontaktstellen nach Art. 11 und 12 DSA', text: [
          'Für Behörden, die EU-Kommission und das Gremium für digitale Dienste: ' + BETREIBER.behoerden + '. Sprachen: Deutsch, Englisch.',
          'Für Nutzerinnen und Nutzer: in der App unter Einstellungen → Hilfe → „Problem melden" oder per E-Mail an ' + BETREIBER.email + '. Es antwortet ein Mensch.',
        ] },
        { titel: 'Streitbeilegung', text: [
          'Zu Entscheidungen über Inhalte: zertifizierte außergerichtliche Streitbeilegungsstellen nach Art. 21 DSA (Liste bei der Bundesnetzagentur).',
        ] },
      ],
    },

    /*
     * Öffentliche Seiten für die Stores (Kasten RS 1b). Sie stehen nicht in
     * den Einstellungen, sondern nur unter /recht/<id> — die Stores verlangen
     * eine Adresse, die ohne App und ohne Anmeldung erreichbar ist.
     *
     * Google Play, Child Safety Standards (Pflicht für soziale Apps seit
     * 22.01.2025): veröffentlichte Standards gegen sexuelle Ausbeutung von
     * Kindern mit App- und Anbietername, Meldeweg in der App, Umgang mit
     * Missbrauchsdarstellungen, Einhaltung der Kinderschutzgesetze, benannte
     * Kontaktperson. Recherche R2, Abschnitt 6.2.
     */
    kinderschutz: {
      titel: 'Kinderschutz-Standards',
      version: 1,
      abschnitte: [
        { titel: 'Worum es geht', text: [
          'Diese Standards gelten für die App All Media und die Website von All Media. Anbieter: ' + BETREIBER.name + ', ' + BETREIBER.anschrift + '.',
          'All Media duldet keine sexuelle Ausbeutung und keinen sexuellen Missbrauch von Kindern und Jugendlichen — weder als Bild, Video oder Text noch als Kontaktversuch.',
        ] },
        { titel: 'Was verboten ist', text: [
          'Darstellungen sexuellen Missbrauchs von Kindern und Jugendlichen, auch gezeichnete oder künstlich erzeugte.',
          'Nacktbilder und sexualisierte Bilder von Minderjährigen, auch wenn sie selbst gemacht sind.',
          'Jeder Versuch, Kinder oder Jugendliche anzusprechen, um sie sexuell auszunutzen (Cybergrooming), sie zu erpressen (Sextortion) oder zu einem Treffen zu bringen.',
          'Inhalte, die Missbrauch verherrlichen, anleiten oder verkaufen.',
        ] },
        { titel: 'So meldest du es in der App', text: [
          'An jedem Beitrag, jeder Story, jedem Kommentar, jedem Profil, jeder Community und jeder Nachricht: „Melden" → „Sexualisierte Darstellung oder Ansprache von Minderjährigen".',
          'Du musst nichts begründen und nichts beweisen. Bitte nicht weiterleiten, nicht speichern und keinen Screenshot machen.',
          'Ohne Konto: per E-Mail an ' + BETREIBER.email + ' oder bei jugendschutz.net/verstoss-melden und internet-beschwerdestelle.de.',
        ] },
        { titel: 'Was wir dann tun', text: [
          'Meldungen dieser Art kommen ganz nach oben und werden sofort bearbeitet, spätestens innerhalb von 24 Stunden.',
          'Wir sperren den Inhalt sofort und sperren das Konto dauerhaft. Wer gesperrt ist, kann sich mit derselben Telefonnummer nicht neu anmelden.',
          'Wir sichern die Beweise getrennt und melden den Fall dem Bundeskriminalamt (Art. 18 DSA). Sichten darf solche Inhalte bei uns nur eine volljährige, dafür benannte Person — und nur so weit, wie es für die Meldung nötig ist.',
          'Private Chats lesen wir nicht mit und scannen sie nicht. Wir sehen eine Nachricht nur, wenn jemand aus dem Chat sie meldet und selbst freigibt.',
        ] },
        { titel: 'Schutz von Kindern und Jugendlichen', text: [
          altersSatz,
          'Konten unter der Altersgrenze ihres Landes sind erst nach der Freigabe durch ein Elternteil sichtbar und können vorher niemandem schreiben.',
          'Die Telefonnummer ist für andere nie sichtbar. Wer jemandem schreiben darf, entscheidet der Empfänger.',
        ] },
        { titel: 'Gesetze', text: [
          'Wir halten die Kinderschutzgesetze ein, die für uns gelten, insbesondere das Gesetz über digitale Dienste der EU (DSA), das deutsche Strafgesetzbuch (§§ 184b, 184c, 176 ff.) und das Jugendschutzgesetz.',
        ] },
        { titel: 'Kontakt für Kinderschutz', text: [
          BETREIBER.kinderschutz,
          'Behörden: ' + BETREIBER.behoerden,
        ] },
        { titel: 'Hilfe', text: HILFE },
      ],
    },

    /*
     * Google Play verlangt eine Adresse, unter der man das Löschen des Kontos
     * auch ohne die App anstoßen kann (Recherche R2, Abschnitt 6.2). Der
     * Ablauf entspricht konto-loeschen.js und Schema 103; was bleibt, steht
     * in Entscheidung E3.
     */
    konto_loeschen: {
      titel: 'All-Media-Konto löschen',
      version: 1,
      abschnitte: [
        { titel: 'In der App', text: [
          'Einstellungen → Konto → „Konto löschen". Du bestätigst mit deinem Passwort. Vorher kannst du unter „Meine Daten herunterladen" alles sichern.',
        ] },
        { titel: 'Ohne App', text: [
          'Auf dieser Website anmelden → Einstellungen → Konto → „Konto löschen". Es ist derselbe Ablauf wie in der App.',
          'Kommst du nicht mehr in dein Konto: Schreib von der E-Mail-Adresse deines Kontos an ' + BETREIBER.email + ' mit dem Betreff „Konto löschen" und deinem Benutzernamen. Wir löschen innerhalb eines Monats und bestätigen es dir.',
        ] },
        { titel: 'Was gelöscht wird', text: [
          'Sofort und endgültig: dein Profil, deine Beiträge, Storys, Reels, Kommentare, Likes, Nachrichten, Fotos und Videos, deine Kontakte und Einstellungen.',
          'Deine Nachrichten verschwinden auch bei den Personen, mit denen du geschrieben hast.',
          'Hast du als Elternteil ein Kinderkonto freigegeben, endet deine Elternkontrolle (Bildschirmzeit), und das Kind bekommt eine Mitteilung.',
        ] },
        { titel: 'Was eine Zeit lang bleibt', text: [
          'Meldungen, die du gemacht hast, bleiben ohne deinen Namen, damit wir sie zu Ende bearbeiten können. Entscheidungen über Inhalte bewahren wir ' + P('Löschfrist für Meldungen und Moderationsprotokoll festlegen (Entscheidung E3)') + ' auf.',
          'War dein Konto gesperrt, bleibt ein Hashwert deiner Telefonnummer bis zum Ende der Sperre gespeichert — sonst könnte man jede Sperre durch Löschen und Neuanmelden umgehen.',
        ] },
      ],
    },
  };

  /* Öffentliche Seiten für die Stores — nicht in den Einstellungen, nur unter /recht/<id>. */
  var SEITEN = ['kinderschutz', 'konto_loeschen'];

  var REIHENFOLGE = ['kurz_erklaert', 'nutzungsbedingungen', 'community_richtlinien', 'datenschutz', 'eltern_info', 'impressum'];

  /** Ein Dokument oder null. */
  function dokument(id) {
    return DOKUMENTE[id] || null;
  }

  /** Alle Dokumente in Anzeigereihenfolge: [{ id, titel, version }]. */
  function liste() {
    return REIHENFOLGE.map(function (id) {
      return { id: id, titel: DOKUMENTE[id].titel, version: DOKUMENTE[id].version };
    });
  }

  /** Der ganze Text eines Dokuments als ein String (für Prüfsumme und Suche). */
  function alsText(id) {
    var d = DOKUMENTE[id];
    if (!d) return '';
    return [d.titel].concat(d.abschnitte.map(function (a) {
      return a.titel + '\n' + a.text.join('\n');
    })).join('\n\n');
  }

  /** Alle ⟦Platzhalter⟧ eines Dokuments (oder aller, ohne id). */
  function platzhalter(id) {
    var ids = id ? [id] : REIHENFOLGE.concat(SEITEN);
    var gefunden = [];
    ids.forEach(function (i) {
      var t = alsText(i).match(PLATZHALTER_MUSTER) || [];
      t.forEach(function (p) { if (gefunden.indexOf(p) === -1) gefunden.push(p); });
    });
    return gefunden;
  }

  /*
   * Was beim Registrieren als Zustimmung mitgeht (signUp-Metadaten, also
   * auth.users.raw_user_meta_data — ohne neues Schema, Kasten RS 1/RS 7).
   * Zugestimmt wird den Nutzungsbedingungen samt Community-Richtlinien; die
   * Datenschutzerklärung ist eine Information (Art. 13 DSGVO) und wird nur
   * als „zur Kenntnis gegeben" mit Version vermerkt.
   */
  var ZUSTIMMUNG_PFLICHT = ['nutzungsbedingungen', 'community_richtlinien'];
  var ZUR_KENNTNIS = ['datenschutz'];

  /*
   * Prüfsumme des Texts, den DIESE App/Website zeigt: erste 16 Hex-Zeichen
   * von sha256(alsText(id)). Fest eingetragen statt im Client gerechnet
   * (React Native hat kein crypto.subtle ohne Zusatzpaket); test:recht
   * rechnet nach und vergleicht mit Schema 106. Neue Fassung eines Texts:
   * version erhöhen und hier die neue Summe eintragen — test:recht nennt sie.
   *
   * Codex-Fund F6 (31.10.2026): Bis dahin schickte zustimmen() die Version,
   * die der Server nannte. Eine alte App zeigte Fassung 1 und speicherte
   * eine Zustimmung zu Fassung 2. Jetzt schickt der Client Version UND
   * Prüfsumme dessen, was er zeigt, und der Server lehnt ab, wenn das nicht
   * die geltende Fassung ist (grund 'veraltet').
   */
  var PRUEFSUMMEN = {
    kurz_erklaert: '8bbbd3a159c055f7',
    nutzungsbedingungen: '093abb7871ad3802',
    community_richtlinien: '78549dde77a7bbe0',
    datenschutz: '73aa228acb1edf9d',
    eltern_info: 'b14f4267ef4df3fe',
    impressum: 'de376c5e63a63a01',
    kinderschutz: '8d5531d4ef88510d',
    konto_loeschen: 'eb8c47750a80e28d',
  };

  /** Fassung des mitgelieferten Texts: { version, pruefsumme } oder null. */
  function fassung(id) {
    var d = DOKUMENTE[id];
    if (!d) return null;
    return { version: d.version, pruefsumme: PRUEFSUMMEN[id] || null };
  }

  function zustimmungsDaten(zeitpunkt) {
    var daten = { zustimmung_am: (zeitpunkt || new Date()).toISOString() };
    ZUSTIMMUNG_PFLICHT.forEach(function (id) {
      daten['zustimmung_' + id] = String(DOKUMENTE[id].version);
      daten['pruefsumme_' + id] = PRUEFSUMMEN[id];
    });
    ZUR_KENNTNIS.forEach(function (id) {
      daten['kenntnis_' + id] = String(DOKUMENTE[id].version);
      daten['pruefsumme_' + id] = PRUEFSUMMEN[id];
    });
    return daten;
  }

  var ZUSTIMMUNG_FEHLT = 'Bitte stimme den Nutzungsbedingungen und Community-Richtlinien zu';

  return {
    STAND: STAND,
    ZUSTIMMUNG_PFLICHT: ZUSTIMMUNG_PFLICHT,
    ZUR_KENNTNIS: ZUR_KENNTNIS,
    ZUSTIMMUNG_FEHLT: ZUSTIMMUNG_FEHLT,
    zustimmungsDaten: zustimmungsDaten,
    HILFE: HILFE,
    REIHENFOLGE: REIHENFOLGE,
    SEITEN: SEITEN,
    PLATZHALTER_MUSTER: PLATZHALTER_MUSTER,
    dokument: dokument,
    liste: liste,
    alsText: alsText,
    fassung: fassung,
    PRUEFSUMMEN: PRUEFSUMMEN,
    platzhalter: platzhalter,
  };
});
