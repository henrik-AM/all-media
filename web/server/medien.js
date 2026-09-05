/**
 * Medienadressen unterschreiben.
 *
 * Sicherheitspruefung 04.09.2026 (Fund 4).
 *
 * Der Eimer `media` war oeffentlich. Jede hochgeladene Datei — Chat-Anhaenge,
 * Storys privater Profile, Profilbilder — hing an einer rohen Adresse, die
 * ohne Anmeldung abrufbar war. Die ganze Sichtbarkeitslogik der Datenbank
 * (`sichtbar_fuer`, `beitrag_sichtbar`, `is_chat_member`) schuetzt die ZEILE.
 * Die DATEI dahinter kannte keine dieser Regeln. Wer eine Story-Adresse
 * einmal gesehen hatte, konnte sie unbegrenzt weiterreichen, und das Loeschen
 * der Story aenderte daran nichts.
 *
 * WARUM KEINE DATENWANDERUNG
 *
 * In den Zeilen stehen fertige Adressen der Form
 * `https://<projekt>.supabase.co/storage/v1/object/public/media/<pfad>` — in
 * `posts.media_url`, `posts.thumbnail_url`, `stories.media_url`,
 * `messages.attachment_url` und weiteren. Diese Spalten alle umzuschreiben
 * waere eine Wanderung ueber den gesamten Bestand, mit einem Rueckweg, den
 * niemand mehr hat.
 *
 * Stattdessen bleiben die Zeilen, wie sie sind, und die Umwandlung passiert
 * einmal zentral beim Ausliefern: jede Antwort der API wird durchlaufen, jede
 * gefundene Adresse gegen eine unterschriebene mit Ablauf getauscht. Wer die
 * Zeile nicht lesen darf, bekommt sie gar nicht erst — und damit auch keine
 * Adresse zum Unterschreiben.
 *
 * DER ABLAUF
 *
 * Vier Stunden. Kurz genug, dass eine weitergereichte Adresse wertlos wird;
 * lang genug, dass eine Sitzung nicht mitten im Blaettern auf tote Bilder
 * laeuft. Die Oberflaeche holt die Startdaten bei jedem Laden neu.
 */

const OEFFENTLICH = '/storage/v1/object/public/media/';

/** Steckt in diesem Wert eine Adresse aus unserem Eimer? */
function istMedienAdresse(wert) {
  return typeof wert === 'string' && wert.includes(OEFFENTLICH);
}

/** Aus der vollen Adresse den Pfad im Eimer holen. */
function pfadAus(adresse) {
  const stelle = adresse.indexOf(OEFFENTLICH);
  if (stelle === -1) return null;
  const rest = adresse.slice(stelle + OEFFENTLICH.length);
  // Ein angehaengtes ?t=... oder #... gehoert nicht zum Pfad.
  return decodeURIComponent(rest.split(/[?#]/)[0]);
}

/**
 * Jede Medienadresse in `daten` durch eine unterschriebene ersetzen.
 *
 * Laeuft in zwei Durchgaengen: erst alle Pfade einsammeln, dann in EINEM
 * Aufruf unterschreiben lassen, dann ersetzen. Ein Aufruf je Bild waere bei
 * zweihundert Beitraegen zweihundert Anfragen.
 *
 * Faellt das Unterschreiben aus, bleibt die urspruengliche Adresse stehen.
 * Sie fuehrt dann ins Leere (der Eimer ist nicht mehr oeffentlich) — aber ein
 * fehlendes Bild ist besser als eine Seite, die gar nicht laedt.
 */
async function signiereMedien(client, daten, sekunden = 4 * 60 * 60) {
  if (!client || daten == null) return daten;

  const pfade = new Set();
  sammle(daten, pfade);
  if (pfade.size === 0) return daten;

  const liste = [...pfade];
  let karte = new Map();
  try {
    const { data, error } = await client.storage.from('media').createSignedUrls(liste, sekunden);
    if (error) throw error;
    for (const eintrag of data || []) {
      if (eintrag?.signedUrl && !eintrag.error) karte.set(eintrag.path, eintrag.signedUrl);
    }
  } catch (fehler) {
    // Sichtbar machen, nicht verschlucken.
    console.error('Medienadressen unterschreiben fehlgeschlagen:', fehler.message);
    return daten;
  }

  return ersetze(daten, karte);
}

function sammle(wert, pfade) {
  if (istMedienAdresse(wert)) {
    const p = pfadAus(wert);
    if (p) pfade.add(p);
    return;
  }
  if (Array.isArray(wert)) {
    for (const e of wert) sammle(e, pfade);
    return;
  }
  if (wert && typeof wert === 'object') {
    for (const e of Object.values(wert)) sammle(e, pfade);
  }
}

function ersetze(wert, karte) {
  if (istMedienAdresse(wert)) {
    const p = pfadAus(wert);
    return (p && karte.get(p)) || wert;
  }
  if (Array.isArray(wert)) return wert.map((e) => ersetze(e, karte));
  if (wert && typeof wert === 'object') {
    const neu = {};
    for (const [schluessel, e] of Object.entries(wert)) neu[schluessel] = ersetze(e, karte);
    return neu;
  }
  return wert;
}

module.exports = { signiereMedien, istMedienAdresse, pfadAus };
