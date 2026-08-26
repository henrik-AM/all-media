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

export const colors = {
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

export const darkColors: typeof colors = {
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

/** Zwei Töne für den Avatar-Verlauf, stabil pro Person. */
export function avatarPair(id: string): [string, string] {
  return AVATAR_PAIRS[hashOf(id) % AVATAR_PAIRS.length];
}

/** Einzelfarbe — für Stellen, an denen kein Verlauf möglich ist. */
export function avatarColor(id: string): string {
  return avatarPair(id)[1];
}

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}
