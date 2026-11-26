import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { WebView as WebViewRoh } from 'react-native-webview';
import type { WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import { Druck } from './Druck';
import { CaptchaAbbruch, captchaAnzeigerSetzen } from '../lib/captcha';
import { colors, radius, spacing, typography } from '../constants/design';

// Dieselbe Typ-Begradigung wie in KarteWeb.tsx / StandortWahl.tsx.
const WebView = WebViewRoh as unknown as React.ComponentClass<WebViewProps>;

/*
 * Zeigt die Seite /captcha des eigenen Servers in einer Webansicht, sobald
 * lib/captcha.ts ein Token braucht (Fahrplan C6, Entwurf 19.11.2026).
 *
 * Einmal ganz außen eingehängt (App.tsx), damit Anmeldung, Registrierung,
 * „Passwort vergessen", Spenden-PIN und Konto löschen denselben Weg nutzen.
 *
 * Sicherheit: Nachrichten kommen nur von der Seite, die hier geladen wurde;
 * Navigation weg von ihr (außer zu Turnstile selbst) wird nicht zugelassen.
 */
type Offen = { adresse: string; fertig: (t: string | undefined) => void; fehler: (e: Error) => void };

/*
 * iOS zeigt kein zweites Modal über einem schon offenen (Lehre Paket 9,
 * UploadAnzeige; Simulator 26.11.2026: „Konto hinzufügen" → Anmelden hing
 * still, weil das Captcha-Modal hinter dem Blatt lag). Darum:
 *   - der Zustand liegt hier im Modul, nicht in einer Komponente;
 *   - CaptchaHost (App-Wurzel) zeigt ein Modal nur, solange kein Blatt offen ist;
 *   - CaptchaSchicht steckt in jedem Blatt (SheetRahmen, KontoWechsel) und
 *     zeigt die Prüfung als Schicht im selben Fenster — nur im obersten Blatt,
 *     damit nie zwei Widgets gleichzeitig laufen.
 */
let aktuell: Offen | null = null;
const hoerer = new Set<() => void>();
let ebenen: number[] = [];
let naechsteEbene = 1;
const melden = () => hoerer.forEach((f) => f());

function setzen(o: Offen | null) {
  aktuell = o;
  melden();
}

captchaAnzeigerSetzen(
  (adresse) =>
    new Promise<string | undefined>((fertig, fehler) => {
      // Ein laufender Versuch wird abgelöst, nie doppelt angezeigt.
      aktuell?.fehler(new CaptchaAbbruch());
      setzen({ adresse, fertig, fehler });
    })
);

function useStand() {
  const [, neu] = useState(0);
  useEffect(() => {
    const f = () => neu((n) => n + 1);
    hoerer.add(f);
    return () => {
      hoerer.delete(f);
    };
  }, []);
  return { offen: aktuell, ebenen };
}

function Pruefung({ offen }: { offen: Offen }) {
  const herkunft = offen.adresse.replace(/^(https?:\/\/[^/]+).*$/, '$1');

  const schliessen = () => {
    if (aktuell === offen) setzen(null);
  };
  const abbrechen = () => {
    offen.fehler(new CaptchaAbbruch());
    schliessen();
  };

  const empfangen = (e: WebViewMessageEvent) => {
    // Nur Nachrichten von der eigenen /captcha-Seite.
    if (!String(e.nativeEvent.url || '').startsWith(herkunft + '/captcha')) return;
    let n: { art?: string; token?: string; grund?: string } = {};
    try {
      n = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (n.art === 'captcha' && typeof n.token === 'string' && n.token) {
      offen.fertig(n.token);
      schliessen();
    } else if (n.art === 'captcha-aus') {
      offen.fertig(undefined);
      schliessen();
    }
    // 'captcha-fehler': offen lassen, das Widget bietet einen neuen Versuch an.
  };

  return (
    <View style={styles.huelle} testID="captcha-pruefung">
      <View style={styles.karte}>
        <Text style={styles.titel}>Sicherheitsprüfung</Text>
        <WebView
          source={{ uri: offen.adresse }}
          style={styles.web}
          // Ohne flex: 0 am Behälter fällt die Ansicht auf ~0 Höhe zusammen (Doku containerStyle;
          // Simulator 26.11.2026: interaktives Widget unsichtbar).
          containerStyle={styles.webBehaelter}
          onMessage={empfangen}
          originWhitelist={[herkunft, 'https://challenges.cloudflare.com']}
          onShouldStartLoadWithRequest={(r) =>
            r.url.startsWith(herkunft + '/captcha') ||
            r.url.startsWith('https://challenges.cloudflare.com/') ||
            r.url === 'about:blank'
          }
          javaScriptEnabled
          incognito
        />
        <Druck onPress={abbrechen} style={styles.knopf} accessibilityRole="button" accessibilityLabel="Abbrechen">
          <Text style={styles.knopfText}>Abbrechen</Text>
        </Druck>
      </View>
    </View>
  );
}

/** Einmal an der App-Wurzel: zeigt die Prüfung, solange kein Blatt offen ist. */
export function CaptchaHost() {
  const { offen, ebenen: offeneBlaetter } = useStand();
  if (!offen || offeneBlaetter.length > 0) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => { offen.fehler(new CaptchaAbbruch()); setzen(null); }}>
      <Pruefung offen={offen} />
    </Modal>
  );
}

/** In jedem Blatt (eigenes Modal): zeigt die Prüfung, wenn dieses Blatt oben liegt. */
export function CaptchaSchicht() {
  const [id] = useState(() => naechsteEbene++);
  useEffect(() => {
    ebenen = [...ebenen, id];
    melden();
    return () => {
      ebenen = ebenen.filter((e) => e !== id);
      melden();
    };
  }, [id]);
  const { offen, ebenen: liste } = useStand();
  if (!offen || liste[liste.length - 1] !== id) return null;
  return (
    <View style={[StyleSheet.absoluteFill, styles.schicht]}>
      <Pruefung offen={offen} />
    </View>
  );
}

const styles = StyleSheet.create({
  huelle: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  karte: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  titel: { ...typography.body, fontWeight: '600', textAlign: 'center', color: '#111' },
  web: { flex: 0, height: 200, backgroundColor: 'transparent' },
  webBehaelter: { flex: 0, height: 200, width: '100%' },
  knopf: { alignItems: 'center', paddingVertical: spacing.sm },
  knopfText: { ...typography.body, color: '#555' },
  schicht: { zIndex: 100, elevation: 100 },
});
