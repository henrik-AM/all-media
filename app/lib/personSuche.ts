// Eine Person ueber Benutzername ODER Telefonnummer finden.
//
// Henrik wollte nicht mehr an den Benutzernamen gebunden sein - beim
// Hinzufuegen eines Kontakts und beim Zusammenstellen einer Gruppe soll auch
// die Telefonnummer gehen, so wie man es von WhatsApp kennt.
//
// NICHT MEHR IN GEBRAUCH (Stand 09.09.2026)
//
// Henrik am 07.09.2026: „Kontakt hinzufügen nur über Telefonnummer/QR-Code,
// nicht Username." Damit ist der Weg ueber den Benutzernamen weg, und die
// Suche ueber die Nummer laeuft seitdem in der Datenbank
// (`finde_per_nummer`, Schema 24) statt hier ueber die geladene Liste — in
// der steht die Nummer nur von beidseitigen Kontakten (Fund 1), und genau
// deshalb fand `findePerson` niemanden Neues.
//
// `AddContactSheet` und `NewGroupSheet` benutzen jetzt
// `aktionen.personPerNummer`. Diese Datei hat keinen Aufrufer mehr; sie steht
// noch da, bis Henrik entschieden hat, ob sie ganz weg soll.

import { User } from '../types';

// Dieselbe Regel wie in der Datenbank — siehe gemeinsam/telefon.js.
const Telefon = require('../../gemeinsam/telefon') as typeof import('../../gemeinsam/telefon');

/**
 * Vergleichsform einer Telefonnummer: nur Ziffern, fuehrende Null und
 * Laendervorwahl vereinheitlicht. "+49 170 1234567", "0170 1234567" und
 * "0049-170-1234567" ergeben damit denselben Wert.
 *
 * Die Rechnung stand am 07.09.2026 an drei Stellen — hier, in
 * web/server/sync-handlers.js und als `finde_per_nummer` in der Datenbank —
 * und die dritte rechnete anders: sie machte aus einer fuehrenden 0 keine 49.
 * Dadurch ging "0152 3456789" als freie Nummer durch, obwohl sie als
 * "+49 152 3456789" schon vergeben war. Jetzt gibt es sie einmal.
 */
export const normalisiereNummer = (eingabe: string): string =>
  Telefon.vergleichsform(eingabe);

/** Sieht die Eingabe nach einer Telefonnummer aus? */
export const istNummer = (eingabe: string): boolean => {
  const roh = eingabe.trim();
  if (!roh) return false;
  return /^[+\d][\d\s/()-]{4,}$/.test(roh);
};

/**
 * Sucht eine Person unter den bekannten Profilen.
 *
 * Die Liste wird uebergeben, nicht importiert: sie kommt aus der Datenbank
 * (useDaten().users) und ist damit bei jedem Aufruf die aktuelle. Vorher stand
 * hier ein fester Bestand aus dem Quelltext — wer sich neu registrierte, war
 * ueber die Suche nicht auffindbar.
 */
export const findePerson = (
  eingabe: string,
  users: Record<string, User>
): User | null => {
  const roh = eingabe.trim();
  if (!roh) return null;

  const personen = Object.values(users).filter((u) => u.id !== 'me');

  if (istNummer(roh)) {
    const gesucht = normalisiereNummer(roh);
    return personen.find((u) => u.phone && normalisiereNummer(u.phone) === gesucht) ?? null;
  }

  const name = roh.replace(/^@/, '').toLowerCase();
  return (
    personen.find(
      (u) => u.handle.replace('@', '').toLowerCase() === name || u.name.toLowerCase() === name
    ) ?? null
  );
};

/** Text fuer den Fall, dass nichts gefunden wurde - je nach Eingabeart. */
export const nichtGefundenText = (eingabe: string): string =>
  istNummer(eingabe)
    ? 'Zu dieser Nummer gibt es noch kein Konto'
    : 'Niemand mit diesem Benutzernamen gefunden';
