/**
 * Captcha für die App — Fahrplan Mail/Captcha C6 (Entwurf 19.11.2026).
 *
 * captchaHolen() → Promise<string | undefined>
 *   - undefined: kein Captcha eingerichtet (Server meldet keinen
 *     turnstileSiteKey) — die Anmeldung läuft wie bisher.
 *   - string:    frisches Turnstile-Token für genau EINEN Auth-Aufruf.
 *   - wirft:     CaptchaAbbruch bei Abbruch oder wenn nichts angezeigt werden kann.
 *
 * Turnstile läuft nativ nicht, nur in einer Webansicht (so von Cloudflare
 * vorgesehen). Die App öffnet dafür die Seite /captcha des eigenen Servers
 * in components/CaptchaHost.tsx — dieselbe Seite, die die Website im
 * Rahmen zeigt (web/server/app.js). Gegenstück: web/public/captcha.js.
 */

import { medienServerBasis } from './medien';

export class CaptchaAbbruch extends Error {
  constructor(text = 'Sicherheitsprüfung abgebrochen.') {
    super(text);
    this.name = 'CaptchaAbbruch';
  }
}

type Anzeiger = (adresse: string) => Promise<string | undefined>;
let anzeiger: Anzeiger | null = null;
let schluessel: string | null = null; // null = noch nicht gefragt, '' = aus

/** CaptchaHost meldet sich hier an, solange er eingehängt ist. */
export function captchaAnzeigerSetzen(fn: Anzeiger | null) {
  anzeiger = fn;
}

async function eingerichtet(): Promise<string> {
  if (schluessel !== null) return schluessel;
  try {
    const antwort = await fetch(`${medienServerBasis()}/api/konfiguration`);
    const konfig = await antwort.json();
    const sk: string = typeof konfig?.turnstileSiteKey === 'string' ? konfig.turnstileSiteKey : '';
    schluessel = sk;
    return sk;
  } catch {
    // Nicht merken — beim nächsten Versuch noch einmal fragen. Ohne Antwort
    // kein Token: ist das Captcha in Supabase an, meldet Supabase das selbst.
    return '';
  }
}

/** Nur für Einheitentests. */
export function _captchaZuruecksetzen() {
  schluessel = null;
  anzeiger = null;
}

export async function captchaHolen(): Promise<string | undefined> {
  const sk = await eingerichtet();
  if (!sk) return undefined;
  if (!anzeiger) throw new CaptchaAbbruch('Die Sicherheitsprüfung kann gerade nicht angezeigt werden.');
  const token = await anzeiger(`${medienServerBasis()}/captcha`);
  if (token === undefined) schluessel = ''; // Seite meldet „captcha-aus"
  return token;
}
