import type { AreaKey, SubKey } from '../constants/navigation';

/**
 * Wohin es nach einem Kontowechsel geht (Kasten 12.4).
 *
 * Henrik am 21.09.2026: „‚Profil wechseln' leitet ins Messenger-Profil."
 * Der Grund lag nicht im Knopf, sondern im Aufbau: KontoFreigabe zeichnet
 * nach jedem Wechsel (neue user.id) erst eine leere Fläche und dann die
 * Schale neu. Die Schale fing dabei wieder bei `area = 'messenger'` an —
 * wer im Video-Profil wechselte, stand danach im Messenger.
 *
 * Die Stelle, von der aus gewechselt wurde, liegt deshalb hier auf
 * Modulebene: sie überlebt den Neuaufbau der Schale, aber keinen
 * Neustart der App. Abgeholt wird sie nur von einem ANDEREN Konto und nur
 * kurz danach — ein abgebrochener Wechsel oder ein Neustart Stunden später
 * soll nicht irgendwo landen, wo man nicht mehr damit rechnet.
 *
 * Die Wechsellogik selbst (Sitzungen, Schlüsselbund) gehört zu Kasten 13
 * und wird hier nicht angefasst.
 */
const FRIST_MS = 2 * 60_000;

let gemerkt: { vonKonto: string; area: AreaKey; sub: SubKey; zeit: number } | null = null;

export function merken(vonKonto: string | undefined, area: AreaKey, sub: SubKey): void {
  gemerkt = vonKonto ? { vonKonto, area, sub, zeit: Date.now() } : null;
}

/**
 * Die gemerkte Stelle — nur für ein anderes Konto und nur kurz danach.
 *
 * Liest nur, löscht nicht: React darf einen useState-Initialisierer doppelt
 * aufrufen, der zweite Aufruf fände sonst nichts mehr. Die Schale ruft nach
 * dem Aufbau `vergessen()`.
 */
export function abholen(jetzigesKonto: string | undefined): { area: AreaKey; sub: SubKey } | null {
  const g = gemerkt;
  if (!g || !jetzigesKonto || g.vonKonto === jetzigesKonto) return null;
  if (Date.now() - g.zeit > FRIST_MS) return null;
  return { area: g.area, sub: g.sub };
}

export function vergessen(): void {
  gemerkt = null;
}
