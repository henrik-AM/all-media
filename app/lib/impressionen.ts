/**
 * Wer hat welchen Beitrag wie lange gesehen.
 *
 * WARUM ES DAS GIBT
 *
 * Der Feed sortiert heute nach `created_at` und sonst nichts. Ein Ranking
 * braucht mehr als Likes: ein Beitrag, den zweihundert Menschen gesehen und
 * keiner geliket hat, ist etwas anderes als einer, den niemand gesehen hat.
 * An den Likes allein sind die beiden nicht zu unterscheiden.
 *
 * Deshalb wird ab jetzt mitgeschrieben — lange bevor es das Ranking gibt.
 * Die Ranking-Funktion laesst sich an einem Nachmittag schreiben, der
 * Datenbestand darunter nicht: der braucht Wochen Vorlauf. Siehe
 * `SUPABASE_SCHEMA_28_impressionen.sql` und die Notiz
 * "All-Media-Feed-Algorithmus-02-09-2026" im Vault.
 *
 * WAS HIER PASSIERT UND WAS NICHT
 *
 * Dieses Stueck kennt weder Supabase noch React. Es bekommt gesagt, was
 * gerade zu sehen ist, misst die Zeit und gibt Buendel heraus. Wohin die
 * gehen, entscheidet der Aufrufer — in der App `useAktionen`, auf der
 * Website `web/public/impressionen.js`, das dieselbe Rechnung anstellt.
 *
 * Sichtungen sind Nebensache. Nichts hier darf den Feed aufhalten, und ein
 * Fehler beim Senden ist kein Fehler, den jemand zu sehen bekommt.
 */

export type Impressionsquelle = 'feed' | 'reels' | 'explorer' | 'profil' | 'community';

export interface Impression {
  beitrag: string;
  dauer: number;
  herkunft: Impressionsquelle;
}

/**
 * Unter einer Sekunde zaehlt nicht als gesehen.
 *
 * Wer durch den Feed streicht, hat jeden Beitrag technisch "auf dem
 * Bildschirm gehabt". Als Sichtung zaehlen soll nur, wobei jemand
 * stehengeblieben ist — sonst rankt das spaetere Ranking das, was zufaellig
 * zwischen zwei Fingerbewegungen lag.
 */
const MINDESTDAUER_MS = 1000;

/** Ab so vielen gesammelten Sichtungen wird abgeschickt. */
const BUENDEL = 20;

/** Und spaetestens nach dieser Zeit, auch wenn das Buendel nicht voll ist. */
const SPAETESTENS_MS = 15000;

/** Mehr nimmt `impressionen_vermerken()` in einem Aufruf nicht an. */
const HOECHSTENS = 100;

type Senden = (eintraege: Impression[]) => Promise<unknown>;

export class Impressionssammler {
  private laufend = new Map<string, number>();
  private fertig = new Map<string, number>();
  private herkunft: Impressionsquelle;
  private senden: Senden;
  private jetzt: () => number;
  private uhr: ReturnType<typeof setTimeout> | null = null;

  constructor(herkunft: Impressionsquelle, senden: Senden, jetzt: () => number = Date.now) {
    this.herkunft = herkunft;
    this.senden = senden;
    this.jetzt = jetzt;
  }

  /**
   * Was gerade zu sehen ist — die vollstaendige Liste, nicht die Aenderung.
   *
   * Wer verschwunden ist, wird abgerechnet; wer neu dazugekommen ist, faengt
   * an zu laufen; wer bleibt, laeuft weiter. Dieselbe Liste zweimal
   * hintereinander aendert nichts, und genau das ist wichtig: die Listen von
   * FlatList und IntersectionObserver kommen oft doppelt.
   */
  sichtbar(ids: readonly string[]): void {
    const zeit = this.jetzt();
    const jetztSichtbar = new Set(ids);

    for (const [id, seit] of [...this.laufend]) {
      if (!jetztSichtbar.has(id)) {
        this.laufend.delete(id);
        this.buchen(id, zeit - seit);
      }
    }

    for (const id of jetztSichtbar) {
      if (!this.laufend.has(id)) this.laufend.set(id, zeit);
    }

    this.uhrStellen();
  }

  /**
   * Alles abrechnen und abschicken — beim Verlassen des Bildschirms, beim
   * Wechsel in den Hintergrund, beim Schliessen der Seite.
   *
   * Ohne das ginge genau die laengste Sichtung verloren: die, bei der jemand
   * stehengeblieben und dann weggegangen ist.
   */
  async abgeben(): Promise<void> {
    const zeit = this.jetzt();
    for (const [id, seit] of this.laufend) this.buchen(id, zeit - seit);
    // Die laufenden bleiben stehen, aber ab jetzt neu gemessen: sonst wird
    // dieselbe Zeit beim naechsten Abgeben ein zweites Mal gebucht.
    for (const id of [...this.laufend.keys()]) this.laufend.set(id, zeit);

    await this.abschicken();
  }

  /** Was noch nicht abgeschickt ist. Fuer die Prueflaeufe. */
  get offen(): number {
    return this.fertig.size;
  }

  private buchen(id: string, dauer: number): void {
    if (!(dauer >= MINDESTDAUER_MS)) return;
    this.fertig.set(id, (this.fertig.get(id) ?? 0) + Math.round(dauer));
  }

  private uhrStellen(): void {
    if (this.fertig.size >= BUENDEL) {
      void this.abschicken();
      return;
    }
    if (this.fertig.size === 0 || this.uhr) return;
    this.uhr = setTimeout(() => {
      this.uhr = null;
      void this.abschicken();
    }, SPAETESTENS_MS);
  }

  private async abschicken(): Promise<void> {
    if (this.uhr) {
      clearTimeout(this.uhr);
      this.uhr = null;
    }
    if (this.fertig.size === 0) return;

    const eintraege: Impression[] = [...this.fertig]
      .slice(0, HOECHSTENS)
      .map(([beitrag, dauer]) => ({ beitrag, dauer, herkunft: this.herkunft }));
    for (const e of eintraege) this.fertig.delete(e.beitrag);

    try {
      await this.senden(eintraege);
    } catch {
      /*
       * Absichtlich still und absichtlich ohne zweiten Versuch.
       *
       * Eine verlorene Sichtung ist ein fehlender Datenpunkt unter vielen
       * tausend. Sie zurueckzulegen und spaeter erneut zu schicken hiesse,
       * bei jedem Netzausfall einen wachsenden Stapel mitzuschleppen — und
       * am Ende Zeiten zu buchen, die Stunden zurueckliegen.
       */
    }

    // Ist waehrend des Sendens mehr aufgelaufen, gleich weiter.
    if (this.fertig.size > 0) this.uhrStellen();
  }
}
