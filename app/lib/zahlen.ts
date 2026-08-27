/*
 * Grosse Zahlen kurz schreiben: 1.200 wird "1,2k", 3.400.000 wird "3,4 Mio."
 *
 * Die Funktion stand dreimal wortgleich in HomeFeedScreen, VideoFeedScreen und
 * UserProfileScreen. Dieselbe Regel gilt in der Website (compactNumber in
 * web/public/app.js).
 */
export function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} Mio.`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.', ',')}k`;
  return String(n);
}
