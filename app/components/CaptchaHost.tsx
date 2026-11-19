import React, { useEffect, useRef, useState } from 'react';
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

export function CaptchaHost() {
  const [offen, setOffen] = useState<Offen | null>(null);
  const offenRef = useRef<Offen | null>(null);
  offenRef.current = offen;

  useEffect(() => {
    captchaAnzeigerSetzen(
      (adresse) =>
        new Promise<string | undefined>((fertig, fehler) => {
          // Ein laufender Versuch wird abgelöst, nie doppelt angezeigt.
          offenRef.current?.fehler(new CaptchaAbbruch());
          setOffen({ adresse, fertig, fehler });
        })
    );
    return () => captchaAnzeigerSetzen(null);
  }, []);

  if (!offen) return null;

  const herkunft = offen.adresse.replace(/^(https?:\/\/[^/]+).*$/, '$1');

  const schliessen = () => setOffen(null);
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
    <Modal visible transparent animationType="fade" onRequestClose={abbrechen}>
      <View style={styles.huelle}>
        <View style={styles.karte}>
          <Text style={styles.titel}>Sicherheitsprüfung</Text>
          <WebView
            source={{ uri: offen.adresse }}
            style={styles.web}
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
    </Modal>
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
  web: { height: 200, backgroundColor: 'transparent' },
  knopf: { alignItems: 'center', paddingVertical: spacing.sm },
  knopfText: { ...typography.body, color: '#555' },
});
