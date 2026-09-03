import { StyleSheet } from 'react-native';

/*
 * All Media — Designsprache.
 *
 * Ziel: die App soll nicht nach „noch ein Messenger" aussehen, sondern nach
 * einem eigenen Produkt. Drei Entscheidungen tragen das:
 *
 *  1. Eine eigene Markenfarbe. Das frühere Blau (#0A66FF) ist exakt das Blau
 *     von Facebook Messenger und LinkedIn — es liest sich als Kopie. All Media
 *     bekommt stattdessen ein tiefes Indigo, das in ein Violett verläuft.
 *     Farbe kommt fast nur über diesen Verlauf ins Bild, nie flächig.
 *  2. Ruhige Flächen, feine Linien. Getrennt wird über 1px-Linien in einem
 *     sehr hellen Kühlgrau, nicht über Grauflächen. Dadurch wirkt jede Liste
 *     aufgeräumter.
 *  3. Echte Tiefe. Schatten sind zweilagig (enger Kontaktschatten + weiter
 *     Streuschatten) und farbig, wo die Marke im Spiel ist. Ein einzelner
 *     harter Schatten wirkt billig, zwei weiche wirken teuer.
 *
 * Die Token-NAMEN bleiben stabil — daran hängen alle Screens.
 */

const hellFarben = {
  brand: '#5B45E0',
  brand2: '#8B5CF6',
  brandDeep: '#3D2CB8',
  brandSoft: '#EEEBFD',
  accent: '#06B6D4',

  // Gesendet bleibt grün — das ist bei Chats die Erwartung. Aber ein
  // gedämpftes, kühleres Grün statt des grellen WhatsApp-Tons.
  bubbleOut: '#DCF5E3',
  bubbleOutText: '#0D2E19',
  bubbleOutMeta: '#4A7A5C',
  bubbleIn: '#FFFFFF',

  surface: '#FFFFFF',
  surface2: '#F7F8FB',
  surface3: '#F0F1F6',

  text: '#0C0E14',
  text2: '#666E7D',
  text3: '#9AA1AF',
  border: '#ECEDF2',
  hairline: '#F2F3F7',

  danger: '#E5484D',
  dangerSoft: 'rgba(229,72,77,0.12)',
  success: '#12A150',
  online: '#22C55E',

  white: '#FFFFFF',
  black: '#000000',
};

const dunkelFarben: typeof hellFarben = {
  brand: '#8B7CF6',
  brand2: '#A78BFA',
  brandDeep: '#6D5AE6',
  brandSoft: '#1C1733',
  accent: '#22D3EE',

  bubbleOut: '#16452F',
  bubbleOutText: '#DDF5E5',
  bubbleOutMeta: '#7FB694',
  bubbleIn: '#16181D',

  surface: '#000000',
  surface2: '#0E1014',
  surface3: '#191C22',

  text: '#F3F5F8',
  text2: '#9AA2AF',
  text3: '#6B7280',
  border: '#1E2128',
  hairline: '#16181D',

  danger: '#F26D70',
  dangerSoft: 'rgba(242,109,112,0.16)',
  success: '#2DD07C',
  online: '#22C55E',

  white: '#FFFFFF',
  black: '#000000',
};

/** Der Markenverlauf. Überall dort, wo früher eine Brand-Fläche war. */
export const brandGradient = ['#5B45E0', '#8B5CF6'] as const;
export const brandGradientDark = ['#6D5AE6', '#A78BFA'] as const;

/**
 * Story-Ring. Warm nach kühl — erkennbar als „Story", aber ein eigener
 * Farbweg statt des bekannten Instagram-Verlaufs.
 */
export const storyGradient = ['#FF9A3D', '#F0397E', '#8B5CF6'] as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  /** Weiches Rechteck — für Suchfeld und Buttons. Wirkt gebauter als die
   *  volle Pille, die jede zweite App benutzt. */
  soft: 14,
  pill: 999,
};

/*
 * Schatten. Zwei Lagen: enger Kontaktschatten für die Kante, weiter
 * Streuschatten für die Höhe. React Native kennt nur eine Lage pro View,
 * deshalb gibt es hier die jeweils wichtigere.
 */
export const shadow = {
  sm: {
    shadowColor: '#0C0E14',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  md: {
    shadowColor: '#0C0E14',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  brand: {
    shadowColor: '#5B45E0',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
};

/*
 * Typografie. Der frühere Satz war eng gestaffelt (15 / 15.5 / 14.5 / 13.5) —
 * so entsteht keine Hierarchie, alles wirkt gleich wichtig. Neu: klarere
 * Sprünge und negatives Tracking bei allem ab 16px, wie es Systemschriften
 * optisch verlangen.
 */
export const typography = {
  title: { fontSize: 27, fontWeight: '700' as const, letterSpacing: -0.7 },
  h2: { fontSize: 20, fontWeight: '700' as const, letterSpacing: -0.4 },
  h3: { fontSize: 16, fontWeight: '600' as const, letterSpacing: -0.2 },
  name: { fontSize: 16, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' as const, letterSpacing: -0.1 },
  message: { fontSize: 15, fontWeight: '400' as const, letterSpacing: -0.1 },
  preview: { fontSize: 14, fontWeight: '400' as const, letterSpacing: -0.05 },
  small: { fontSize: 12.5, fontWeight: '500' as const },
  tiny: { fontSize: 10.5, fontWeight: '600' as const, letterSpacing: 0.1 },
  overline: { fontSize: 11.5, fontWeight: '700' as const, letterSpacing: 0.8 },
};

export const sizes = {
  avatarLg: 54,
  avatarMd: 44,
  avatarSm: 36,
  avatarXl: 88,
  storyRing: 64,
  tabBar: 62,
  topBar: 56,
};

/*
 * Avatare. Früher eine Fläche in einer von acht Farben — flach und beliebig.
 * Jetzt zwei Töne pro Person, aus denen ein Verlauf gezeichnet wird. Das ist
 * derselbe Aufwand im Code, sieht aber sofort gebaut aus.
 *
 * Die Paare bleiben in einer Farbfamilie, laufen darin aber über zwei bis drei
 * Helligkeitsstufen. Ein zu enges Paar sieht auf 54px wieder wie eine Fläche
 * aus — genau das sollte hier weg. Weit auseinanderliegende Paare (Grün nach
 * Pink) wirken dagegen wie ein Testbild.
 */
const AVATAR_PAIRS: [string, string][] = [
  ['#FFB877', '#EE5F2A'],
  ['#93AEFF', '#4152D8'],
  ['#FBA0C4', '#DC3F7C'],
  ['#6FE2D0', '#12907F'],
  ['#C4A4F7', '#7C46EE'],
  ['#A3B6F7', '#5062D0'],
  ['#FCA2BC', '#E04570'],
  ['#75DCF2', '#1791BA'],
  ['#FBD277', '#D88F1C'],
  ['#9FDD84', '#419A32'],
];

function hashOf(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash;
}

/**
 * Zwei Töne für den Avatar-Verlauf, stabil pro Person.
 *
 * `farbe` ist der Wert aus `profiles.color` — ein CSS-Verlauf, so wie ihn die
 * Website direkt verwendet. Steht er da, zählt er: die Farbe gehört zur
 * Person und muss in App und Website dieselbe sein. Ohne ihn wird wie bisher
 * aus der Kennung gewürfelt, damit auch eine Person ohne Eintrag eine feste
 * eigene Farbe hat.
 */
export function avatarPair(id: string, farbe?: string): [string, string] {
  const ausDatenbank = farbe ? farbenAusVerlauf(farbe) : null;
  return ausDatenbank ?? AVATAR_PAIRS[hashOf(id) % AVATAR_PAIRS.length];
}

/**
 * Die beiden Farben aus "linear-gradient(135deg,#FCA2BC,#E04570)" holen.
 *
 * React Native kennt keine CSS-Verläufe; LinearGradient will die Farben
 * einzeln. Steht etwas anderes in der Spalte — eine einzelne Farbe etwa —,
 * wird sie für beide Enden genommen. Ist gar nichts zu erkennen, gibt die
 * Funktion null und der Aufrufer würfelt.
 */
function farbenAusVerlauf(wert: string): [string, string] | null {
  const treffer = wert.match(/#[0-9a-fA-F]{3,8}/g);
  if (!treffer || treffer.length === 0) return null;
  return [treffer[0], treffer[treffer.length - 1]];
}

/** Einzelfarbe — für Stellen, an denen kein Verlauf möglich ist. */
export function avatarColor(id: string): string {
  return avatarPair(id)[1];
}

/*
 * Die Initialen zu einem Namen.
 *
 * `name` ist nachsichtig angenommen und nicht als Pflicht: am 03.09.2026
 * stuerzte die App mit "Cannot read property 'trim' of null" ab, weil ein
 * Kontakt ohne Namen in einer Liste stand. Eine Hilfsfunktion, die den
 * ganzen Bildschirm mitnimmt, wenn ein Feld leer ist, ist eine Falle — der
 * Aufrufer kann nicht an jeder der vierzig Stellen daran denken.
 *
 * Ein leerer Name ergibt einen leeren Kreis. Das sieht man, und es ist
 * besser als ein roter Bildschirm.
 */
/**
 * Dieselbe Farbe, nur durchsichtig — fuer das offene Ende eines Verlaufs.
 *
 * Nicht `'transparent'` nehmen: das ist rgba(0,0,0,0), und iOS blendet dann
 * ueber Schwarz. Aus einem Auslauf auf weissem Grund wird so ein Grauschleier.
 * Die Farbe muss dieselbe sein, nur mit Alpha 0.
 */
export function verlaufAus(farbe: string): string {
  const hex = farbe.trim();
  return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}00` : 'rgba(255,255,255,0)';
}

export function initialsOf(name?: string | null): string {
  return String(name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

/* ------------------------------------------------------------------ Thema */
/*
 * Dunkelmodus.
 *
 * Vorher gab es `darkColors` — aber niemand hat sie benutzt. Der Schalter
 * „Dunkles Design" in den Einstellungen der App hat deshalb nichts bewirkt:
 * die App war immer hell, während die Website längst einen Dunkelmodus hatte.
 *
 * Das Problem beim Nachrüsten: `StyleSheet.create` liest die Farbwerte einmal
 * beim Laden des Moduls und friert sie ein. In 51 Dateien mit zusammen 634
 * Farbverwendungen jede Komponente auf einen Hook umzubauen wäre ein Umbau
 * mit hohem Risiko und wenig Gewinn.
 *
 * Deshalb dieser Weg: `themenStyles` baut beide Fassungen einmal beim Laden
 * und gibt einen Stellvertreter zurück, der bei jedem Zugriff die passende
 * heraussucht. In den Dateien ändert sich damit nur eine Zeile — aus
 *
 *   const styles = StyleSheet.create({ … colors.surface … });
 * wird
 *   const styles = themenStyles((colors) => ({ … colors.surface … }));
 *
 * Das `colors` im Inneren ist jetzt der Parameter statt des Moduls, und
 * derselbe Rumpf erzeugt beide Fassungen.
 */

let dunkelAktiv = false;

/** Wird vom ThemeProvider gesetzt, bevor der Baum neu aufgebaut wird. */
export function setzeDunkel(an: boolean) {
  dunkelAktiv = an;
}

export type Farbsatz = typeof hellFarben;

/**
 * Farben für die Verwendung direkt im JSX (z. B. `color={colors.text3}` an
 * einem Symbol). Auch das ist ein Stellvertreter, damit die 634 Stellen
 * unverändert bleiben können.
 */
export const colors: Farbsatz = new Proxy({} as Farbsatz, {
  get: (_ziel, schluessel) => (dunkelAktiv ? dunkelFarben : hellFarben)[schluessel as keyof Farbsatz],
  // Ohne diese beiden Fallen wirft ein Aufzählen über das Objekt.
  has: (_ziel, schluessel) => schluessel in hellFarben,
  ownKeys: () => Reflect.ownKeys(hellFarben),
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});

/** Nur für Stellen, die beide Sätze brauchen (Prüfwerkzeuge). */
export const farbsaetze = { hell: hellFarben, dunkel: dunkelFarben };

/**
 * Stylesheet, das dem Thema folgt. Ersatz für `StyleSheet.create`.
 *
 * Beide Fassungen entstehen einmal beim Laden — der Stellvertreter kostet zur
 * Laufzeit nur einen Zugriff und keine neue Berechnung.
 */
export function themenStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  // Wortgleiche Schranke wie bei StyleSheet.create - inklusive des any, das
  // dort steht. Ohne sie verliert TypeScript die genauen Werte: aus
  // flexDirection: 'row' wird string, und jede Verwendung schlägt fehl.
  bauen: (farben: Farbsatz) => T & StyleSheet.NamedStyles<any>
): T {
  const hell = StyleSheet.create(bauen(hellFarben));
  const dunkel = StyleSheet.create(bauen(dunkelFarben));
  return new Proxy({} as T, {
    get: (_ziel, schluessel) => (dunkelAktiv ? dunkel : hell)[schluessel as keyof T],
    has: (_ziel, schluessel) => schluessel in hell,
    ownKeys: () => Reflect.ownKeys(hell),
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  });
}

/** Der Markenverlauf folgt dem Thema — im Dunkeln ist er eine Spur heller. */
export function markenVerlauf(): readonly [string, string] {
  return dunkelAktiv ? brandGradientDark : brandGradient;
}
