// Eine Person ueber Benutzername ODER Telefonnummer finden.
//
// Henrik wollte nicht mehr an den Benutzernamen gebunden sein - beim
// Hinzufuegen eines Kontakts und beim Zusammenstellen einer Gruppe soll auch
// die Telefonnummer gehen, so wie man es von WhatsApp kennt.

import { User } from '../types';

/**
 * Vergleichsform einer Telefonnummer: nur Ziffern, fuehrende Null und
 * Laendervorwahl vereinheitlicht. "+49 170 1234567", "0170 1234567" und
 * "0049-170-1234567" ergeben damit denselben Wert.
 */
export const normalisiereNummer = (eingabe: string): string => {
  let ziffern = eingabe.replace(/[^\d+]/g, '');
  ziffern = ziffern.replace(/^\+/, '00');
  if (ziffern.startsWith('00')) ziffern = ziffern.slice(2);
  else if (ziffern.startsWith('0')) ziffern = '49' + ziffern.slice(1);
  return ziffern;
};

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
