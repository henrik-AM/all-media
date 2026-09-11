import React, { useMemo } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

/*
 * Der eigene QR-Code als Bild auf dem Bildschirm.
 *
 * Henrik am 07.09.2026: „Kontakt hinzufügen nur über Telefonnummer/QR-Code,
 * nicht Username." Der Code muss also gezeigt UND gelesen werden koennen;
 * dies hier ist die Anzeige, das Lesen macht `QrScanner`.
 *
 * WARUM AUS RECHTECKEN UND NICHT ALS BILD
 *
 * Ein QR-Code als PNG braucht entweder einen Server, der ihn zeichnet, oder
 * `react-native-svg`. Das eine setzt eine Internetverbindung voraus, um die
 * eigene Nummer anzuzeigen — die man schon hat; das andere waere ein weiteres
 * natives Paket, und natives Paket heisst bei Expo Go: geht nur, wenn es dort
 * eingebaut ist. Ein QR-Code ist ein Raster aus schwarzen und weissen
 * Feldern, und ein schwarzes Feld ist ein `View` mit Hintergrundfarbe.
 *
 * Damit daraus nicht 625 einzelne Views werden, wird jede Zeile zu Streifen
 * zusammengefasst: aus fuenf schwarzen Feldern nebeneinander wird EIN View
 * mit fuenffacher Breite. Bei einer Nummer bleiben so rund 150 statt 625.
 *
 * Die Rechnung selbst macht `qrcode` — dasselbe Paket, mit dem die Website
 * ihren Code zeichnet (`/api/qr.svg` in web/server/app.js). Zwei
 * verschiedene Rechnungen haetten zwei verschiedene Codes ergeben, und
 * gelesen wird der eine wie der andere.
 */

// Nur der Kern, nicht das ganze Paket: `qrcode/lib/browser` zieht eine
// Canvas-Ausgabe mit, die es in React Native nicht gibt.
const QR = require('qrcode/lib/core/qrcode') as {
  create: (
    text: string,
    optionen: { errorCorrectionLevel: string }
  ) => { modules: { size: number; get: (zeile: number, spalte: number) => number } };
};

interface Props {
  /** Der Inhalt — bei uns immer `QrKontakt.link(nummer)`. */
  text: string;
  /** Kantenlaenge des fertigen Codes in Punkten. */
  groesse?: number;
  hintergrund?: string;
  vordergrund?: string;
  style?: ViewStyle;
}

/*
 * Der weisse Rand rundherum. Die Norm verlangt vier Felder; ohne ihn findet
 * eine Kamera den Code auf dunklem Grund nicht wieder. Zwei Felder reichen in
 * der Praxis und sparen Flaeche — der Code steht hier auf weissem Grund.
 */
const RAND = 2;

export const QrCode = ({
  text,
  groesse = 220,
  hintergrund = '#FFFFFF',
  vordergrund = '#000000',
  style,
}: Props) => {
  /*
   * `useMemo`, weil die Rechnung bei jedem Bild sonst neu liefe: die Nummer
   * aendert sich nicht, waehrend das Blatt offen ist.
   *
   * Faellt sie aus — leerer Text, zu lang —, gibt es keine Zeilen und damit
   * eine leere weisse Flaeche. Besser als ein halber Code, den eine Kamera
   * als falsche Nummer liest.
   */
  const zeilen = useMemo(() => {
    if (!text) return [];
    try {
      const { modules } = QR.create(text, { errorCorrectionLevel: 'M' });
      const n = modules.size;
      const ergebnis: { start: number; laenge: number }[][] = [];
      for (let z = 0; z < n; z++) {
        const streifen: { start: number; laenge: number }[] = [];
        let s = 0;
        while (s < n) {
          if (!modules.get(z, s)) {
            s++;
            continue;
          }
          let laenge = 1;
          while (s + laenge < n && modules.get(z, s + laenge)) laenge++;
          streifen.push({ start: s, laenge });
          s += laenge;
        }
        ergebnis.push(streifen);
      }
      return ergebnis;
    } catch (fehler: any) {
      console.error('QR-Code konnte nicht gerechnet werden:', fehler?.message ?? fehler);
      return [];
    }
  }, [text]);

  const felder = zeilen.length + RAND * 2;
  // Auf ganze Punkte abrunden: bei krummen Werten laesst iOS zwischen zwei
  // Feldern eine Haarlinie stehen, und die zerlegt den Code fuer die Kamera.
  const feld = felder ? Math.floor((groesse / felder) * 2) / 2 : 0;
  const kante = feld * felder;

  return (
    <View
      style={[
        styles.rahmen,
        { width: kante, height: kante, padding: feld * RAND, backgroundColor: hintergrund },
        style,
      ]}
    >
      {zeilen.map((streifen, z) => (
        <View key={z} style={{ height: feld }}>
          {streifen.map((s) => (
            <View
              key={s.start}
              style={{
                position: 'absolute',
                left: s.start * feld,
                width: s.laenge * feld,
                height: feld,
                backgroundColor: vordergrund,
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  rahmen: { borderRadius: 8, overflow: 'hidden' },
});
