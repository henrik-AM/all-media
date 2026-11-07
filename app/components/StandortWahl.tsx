import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { WebView as WebViewRoh } from 'react-native-webview';
import type { WebViewProps } from 'react-native-webview';
import { Druck } from './Druck';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';

// Gemeinsam mit der Website (openStandortWahl in web/public/app.js).
const OrtSuche = require('../../gemeinsam/ortsuche') as typeof import('../../gemeinsam/ortsuche');
type Ort = import('../../gemeinsam/ortsuche').Ort;

// Dieselbe Typ-Begradigung wie in KarteWeb.tsx (react-native-webview 13 + React 19).
const WebView = WebViewRoh as unknown as React.ComponentClass<
  WebViewProps & { ref?: React.Ref<WebViewRoh> }
>;

interface Props {
  /** Der gewaehlte Ort — Name/Adresse aus Suche oder Rueckfrage, Nadel vom Nutzer. */
  onWahl: (ort: Ort) => void;
  onNotice: (text: string) => void;
}

/*
 * Leaflet-Karte mit fester Nadel in der Mitte: man schiebt die Karte unter
 * die Nadel (WhatsApp/Uber-Muster) — zuverlaessiger als Tippen auf einen
 * Punkt, und mit dem Finger sieht man, wohin die Nadel zeigt. Nach jedem
 * Verschieben meldet die Karte ihre Mitte an die App.
 *
 * Alles, was hineingeht, sind Zahlen; kein Text aus Daten landet als
 * Quelltext im Skript (siehe alsDaten in KarteWeb.tsx).
 *
 * Leaflet kommt vom eigenen Website-Server wie in KarteWeb.tsx — bis zum
 * 07.11.2026 von cdnjs.cloudflare.com, einem Dienst, der in der
 * Datenschutzerklärung nicht steht (Richtlinie 7.1, test:recht).
 */
const KARTE_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://all-media-website.onrender.com/lib/leaflet-1.9.4/leaflet.css" />
<script src="https://all-media-website.onrender.com/lib/leaflet-1.9.4/leaflet.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { touch-action: none; height: 100%; }
  #map { width: 100%; height: 100vh; }
  .leaflet-control-attribution { font-size: 9px; }
</style></head>
<body><div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: false, zoomSnap: 0, bounceAtZoomLimits: false })
    .setView([51.1657, 10.4515], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 19
  }).addTo(map);
  function melden(art) {
    var c = map.getCenter();
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: art, lat: c.lat, lng: c.lng }));
  }
  map.on('moveend', function () { melden('mitte'); });
  window.hinZu = function (lat, lng) { map.setView([lat, lng], 16, { animate: true }); };
  window.zoomEin = function () { map.zoomIn(1); };
  window.zoomAus = function () { map.zoomOut(1); };
  melden('bereit');
</script></body></html>`;

/**
 * „Standort senden": Ort suchen oder auf der Karte waehlen (Kasten 28/6.5).
 *
 * Henrik, 28.09.2026: „kein Standort aussuchen auf der Karte oder kein
 * Suchfenster … nur ein paar vorgeschlagene Standorte, mit denen ich nichts
 * anfangen kann." Die feste Liste aus `places` ist deshalb weg.
 *
 * Gesucht wird erst auf „Suchen"/Enter, nicht bei jedem Tastendruck — so
 * verlangen es die Nutzungsregeln von Nominatim (siehe gemeinsam/ortsuche.js).
 */
export const StandortWahl = ({ onWahl, onNotice }: Props) => {
  const webRef = useRef<WebViewRoh>(null);
  const [suche, setSuche] = useState('');
  const [treffer, setTreffer] = useState<Ort[] | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [mitte, setMitte] = useState<{ lat: number; lng: number } | null>(null);
  const [gewaehlt, setGewaehlt] = useState<Ort | null>(null);
  const [sendet, setSendet] = useState(false);
  const html = useMemo(() => KARTE_HTML, []);

  const suchen = async () => {
    const text = suche.trim();
    if (text.length < 2) return;
    setLaedt(true);
    try {
      const liste = await OrtSuche.suchen(text, fetch as any, { mitKennung: true });
      setTreffer(liste);
    } catch {
      onNotice('Die Ortssuche antwortet gerade nicht');
      setTreffer(null);
    } finally {
      setLaedt(false);
    }
  };

  const hinZu = (ort: Ort) => {
    setGewaehlt(ort);
    setTreffer(null);
    webRef.current?.injectJavaScript(`window.hinZu(${Number(ort.lat)}, ${Number(ort.lng)}); true;`);
  };

  /*
   * Liegt die Nadel noch (fast) auf dem gewaehlten Treffer, gilt dessen Name.
   * Wurde die Karte danach verschoben, wird die neue Stelle benannt —
   * sonst stuende „Marienplatz" an einer Nadel zwei Strassen weiter.
   */
  const senden = async () => {
    const punkt = mitte;
    if (!punkt) return onNotice('Die Karte lädt noch');
    const nahe =
      gewaehlt &&
      Math.abs(gewaehlt.lat - punkt.lat) < 0.0003 &&
      Math.abs(gewaehlt.lng - punkt.lng) < 0.0003;
    if (nahe && gewaehlt) return onWahl(gewaehlt);
    setSendet(true);
    const ort = await OrtSuche.benennen(punkt.lat, punkt.lng, fetch as any, { mitKennung: true });
    setSendet(false);
    if (ort) onWahl(ort);
  };

  return (
    <View style={styles.huelle}>
      <View style={styles.suchZeile}>
        <View style={styles.suchFeld}>
          <Ionicons name="search" size={17} color={colors.text3} />
          <TextInput
            style={styles.suchEingabe}
            value={suche}
            onChangeText={setSuche}
            placeholder="Ort oder Adresse suchen"
            placeholderTextColor={colors.text3}
            returnKeyType="search"
            onSubmitEditing={suchen}
            accessibilityLabel="Ort oder Adresse suchen"
          />
        </View>
        <Druck style={styles.suchKnopf} onPress={suchen} accessibilityLabel="Suchen">
          {laedt ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.suchKnopfText}>Suchen</Text>
          )}
        </Druck>
      </View>

      {treffer !== null && (
        <ScrollView style={styles.treffer} keyboardShouldPersistTaps="handled">
          {treffer.length === 0 ? (
            <Text style={styles.leer}>Nichts gefunden. Versuch es mit Straße und Ort.</Text>
          ) : (
            treffer.map((t, i) => (
              <Druck
                key={`${t.lat},${t.lng},${i}`}
                style={({ pressed }) => [styles.trefferZeile, pressed && styles.gedrueckt]}
                onPress={() => hinZu(t)}
                accessibilityLabel={t.name}
              >
                <View style={styles.trefferSymbol}>
                  <Ionicons name="location" size={18} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.trefferName} numberOfLines={1}>{t.name}</Text>
                  {t.adresse ? <Text style={styles.trefferAdresse} numberOfLines={1}>{t.adresse}</Text> : null}
                </View>
              </Druck>
            ))
          )}
        </ScrollView>
      )}

      <View style={styles.karte}>
        <WebView
          ref={webRef}
          source={{ html }}
          style={{ backgroundColor: 'transparent' }}
          scrollEnabled={false}
          originWhitelist={['about:blank']}
          onShouldStartLoadWithRequest={(a) => a.url === 'about:blank' || a.url.startsWith('about:')}
          onMessage={(e) => {
            try {
              const m = JSON.parse(e.nativeEvent.data);
              if ((m.type === 'mitte' || m.type === 'bereit') && Number.isFinite(m.lat) && Number.isFinite(m.lng)) {
                setMitte({ lat: Number(m.lat), lng: Number(m.lng) });
              }
            } catch {
              /* fremde Nachricht — nichts tun */
            }
          }}
        />
        {/* Die Nadel steht fest in der Mitte; die Karte bewegt sich darunter. */}
        <View style={styles.nadel} pointerEvents="none">
          <Ionicons name="location-sharp" size={40} color="#E5484D" />
        </View>
        <View style={styles.zoom} pointerEvents="box-none">
          <Druck style={styles.zoomKnopf} onPress={() => webRef.current?.injectJavaScript('window.zoomEin(); true;')} accessibilityLabel="Hineinzoomen">
            <Ionicons name="add" size={18} color="#1a1d21" />
          </Druck>
          <Druck style={styles.zoomKnopf} onPress={() => webRef.current?.injectJavaScript('window.zoomAus(); true;')} accessibilityLabel="Herauszoomen">
            <Ionicons name="remove" size={18} color="#1a1d21" />
          </Druck>
        </View>
      </View>

      <Text style={styles.quelle}>{OrtSuche.QUELLE}</Text>
      <Druck
        style={[styles.senden, (!mitte || sendet) && { opacity: 0.6 }]}
        onPress={senden}
        disabled={!mitte || sendet}
        accessibilityLabel="Diesen Ort senden"
      >
        {sendet ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="send" size={16} color="#FFFFFF" />}
        <Text style={styles.sendenText}>Diesen Ort senden</Text>
      </Druck>
    </View>
  );
};

const styles = themenStyles((colors) => ({
  huelle: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  suchZeile: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  suchFeld: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: radius.soft,
    backgroundColor: colors.surface3,
  },
  suchEingabe: { flex: 1, paddingVertical: 10, color: colors.text, ...typography.body },
  suchKnopf: {
    paddingHorizontal: 14,
    height: 40,
    minWidth: 76,
    borderRadius: radius.soft,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  suchKnopfText: { ...typography.name, color: '#FFFFFF' },
  treffer: { maxHeight: 220, borderRadius: radius.md, backgroundColor: colors.surface2 },
  trefferZeile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  gedrueckt: { backgroundColor: colors.surface3 },
  trefferSymbol: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1FA855',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trefferName: { ...typography.name, color: colors.text },
  trefferAdresse: { ...typography.small, color: colors.text2 },
  leer: { ...typography.message, color: colors.text2, padding: spacing.md },
  karte: { flex: 1, minHeight: 260, borderRadius: radius.lg, overflow: 'hidden' },
  nadel: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    // Die Spitze der Nadel, nicht ihre Mitte, zeigt auf den Ort.
    paddingBottom: 40,
  },
  zoom: { position: 'absolute', right: 10, top: 10, gap: 4 },
  zoomKnopf: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  quelle: { ...typography.tiny, color: colors.text3, textAlign: 'center' },
  senden: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: '#1FA855',
  },
  sendenText: { ...typography.name, color: '#FFFFFF' },
}));
