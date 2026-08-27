import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { WebView as WebViewRoh } from 'react-native-webview';
import type { WebViewProps } from 'react-native-webview';
import { Druck } from './Druck';

/*
 * react-native-webview 13.10 deklariert die Komponente noch fuer die alten
 * React-Typen. Unter React 19 verengt TypeScript die Props deshalb auf `never`
 * und lehnt jedes einzelne Attribut ab. Der Bausatz laeuft, nur die
 * Typbeschreibung hinkt hinterher - deshalb hier einmal gerade gerueckt
 * statt an jeder Verwendungsstelle.
 */
const WebView = WebViewRoh as unknown as React.ComponentClass<
  WebViewProps & { ref?: React.Ref<WebViewRoh> }
>;

export interface Pin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Die Avatarfarbe des Kontakts - dieselbe wie in der Liste darunter. */
  farbe?: string;
}

export interface KartenSteuerung {
  zoomAuf: (pinId: string) => void;
  zuruecksetzen: () => void;
}

/**
 * Die drei Kartenansichten hinter dem Ebenen-Knopf. Henrik: "Kartenansicht-
 * Umschalter (Satellit, etc.)".
 *
 * Alle drei Anbieter liefern ohne Schluessel und ohne Vertrag - es entstehen
 * keine Kosten. Dafuer gilt bei allen dreien eine Nutzungsgrenze fuer
 * automatisierte Zugriffe; fuer eine echte Veroeffentlichung braeuchte es
 * einen bezahlten Anbieter. Dieselbe Tabelle steht in `web/public/app.js`.
 */
export const KARTEN_STILE = [
  {
    key: 'standard',
    label: 'Standard',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    quelle: '© OpenStreetMap',
    maxZoom: 19,
  },
  {
    key: 'satellit',
    label: 'Satellit',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    quelle: '© Esri',
    maxZoom: 19,
  },
  {
    key: 'gelaende',
    label: 'Gelände',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    quelle: '© OpenTopoMap',
    maxZoom: 17,
  },
] as const;

interface Props {
  pins: Pin[];
  aktiv?: string | null;
  onPinPress?: (pinId: string) => void;
  hoehe?: number;
  vollbild?: boolean;
  onVollbild?: () => void;
  /**
   * Der eigene Standort. `null` heisst: nicht anzeigen. Henrik: "Standort
   * ausschalten wird nicht beachtet - der Nutzer wird noch angezeigt."
   */
  eigenerStandort?: { lat: number; lng: number } | null;
}

const makeHtmlMap = (pins: Pin[], aktivId?: string | null) => {
  const pinJsons = pins
    .map(
      p =>
        `{ id: '${p.id}', name: '${p.name}', lat: ${p.lat}, lng: ${p.lng}, ` +
        `farbe: '${p.farbe || '#007AFF'}' }`
    )
    .join(',');
  const stil = KARTEN_STILE[0];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    #map { width: 100%; height: 100vh; }
    .leaflet-popup-content { font-size: 14px; }
    /* Die Steuerung sitzt als echter Knopf ueber der Karte, nicht hier drin. */
    .leaflet-control-attribution { font-size: 9px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const pins = [${pinJsons}];
    const aktivId = '${aktivId || ''}';

    const map = L.map('map', { zoomControl: false }).setView([51.5, 10], 4);

    // Die Kachelschicht wird beim Umschalten der Ansicht ausgetauscht, statt
    // die Seite neu zu laden - sonst springt der Ausschnitt jedes Mal zurueck.
    var kacheln = L.tileLayer('${stil.url}', {
      attribution: '${stil.quelle}',
      maxZoom: ${stil.maxZoom}
    }).addTo(map);

    window.stilSetzen = function (url, quelle, maxZoom) {
      if (kacheln) map.removeLayer(kacheln);
      kacheln = L.tileLayer(url, { attribution: quelle, maxZoom: maxZoom }).addTo(map);
    };

    // Die eigene Nadel haengt am Schalter im Screen, nicht an der Karte.
    var ichNadeln = [];
    window.eigenenOrtSetzen = function (lat, lng) {
      ichNadeln.forEach(function (n) { map.removeLayer(n); });
      ichNadeln = [];
      if (lat === null) return;
      // Zwei Kreise: der weite blasse Ring hebt die eigene Nadel von den
      // Kontakten ab. Mit nur einem Punkt war sie von einem blauen Kontakt
      // nicht zu unterscheiden.
      ichNadeln.push(L.circleMarker([lat, lng], {
        radius: 18, fillColor: '#0a84ff', stroke: false,
        fillOpacity: 0.2, interactive: false
      }).addTo(map));
      ichNadeln.push(L.circleMarker([lat, lng], {
        radius: 8, fillColor: '#0a84ff', color: '#fff',
        weight: 3, opacity: 1, fillOpacity: 1
      }).bindPopup('Du').addTo(map));
    };

    pins.forEach(pin => {
      const isActive = pin.id === aktivId;
      const marker = L.circleMarker([pin.lat, pin.lng], {
        radius: isActive ? 12 : 8,
        fillColor: isActive ? '#ff3b30' : pin.farbe,
        // Weisser Rand: die Nutzerfarben sind kraeftig, aber auf einer
        // Satellitenkachel geht jede von ihnen ohne Absetzung unter.
        color: '#fff',
        weight: 2.5,
        opacity: 1,
        fillOpacity: 1
      })
        .bindPopup(pin.name)
        .addTo(map);

      marker.on('click', () => {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pin', id: pin.id }));
      });
    });
  </script>
</body>
</html>
  `;
};

export const KarteWeb = forwardRef<KartenSteuerung, Props>(
  ({ pins, aktiv, onPinPress, hoehe = 320, vollbild, onVollbild, eigenerStandort }, ref) => {
    const webViewRef = useRef<WebViewRoh>(null);
    const [stilIndex, setStilIndex] = useState(0);
    const stil = KARTEN_STILE[stilIndex];

    /*
     * Der eigene Ort wird nachtraeglich hineingereicht statt ins HTML
     * eingebaut: das HTML wird nur einmal aufgebaut, der Schalter im Screen
     * kann aber jederzeit umgelegt werden.
     */
    const ortHineinreichen = () => {
      const ort = eigenerStandort
        ? `${eigenerStandort.lat}, ${eigenerStandort.lng}`
        : 'null, null';
      webViewRef.current?.injectJavaScript(`window.eigenenOrtSetzen(${ort}); true;`);
    };

    React.useEffect(ortHineinreichen, [eigenerStandort?.lat ?? null, eigenerStandort?.lng ?? null]);

    const stilWeiterschalten = () => {
      const naechster = (stilIndex + 1) % KARTEN_STILE.length;
      const s = KARTEN_STILE[naechster];
      setStilIndex(naechster);
      webViewRef.current?.injectJavaScript(
        `window.stilSetzen('${s.url}', '${s.quelle}', ${s.maxZoom}); true;`
      );
    };

    useImperativeHandle(ref, () => ({
      zoomAuf: (pinId: string) => {
        const pin = pins.find(p => p.id === pinId);
        if (pin && webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            map.setView([${pin.lat}, ${pin.lng}], 10, { animate: true });
            true;
          `);
        }
      },
      zuruecksetzen: () => {
        if (webViewRef.current) {
          webViewRef.current.injectJavaScript(`
            map.setView([51.5, 10], 4, { animate: true });
            true;
          `);
        }
      },
    }));

    return (
      <View style={[styles.container, { height: hoehe }, vollbild && styles.containerVoll]}>
        <WebView
          ref={webViewRef}
          source={{ html: makeHtmlMap(pins, aktiv) }}
          style={styles.webview}
          onLoadEnd={ortHineinreichen}
          onMessage={(event) => {
            try {
              const msg = JSON.parse(event.nativeEvent.data);
              if (msg.type === 'pin' && onPinPress) {
                onPinPress(msg.id);
              }
            } catch (e) {
              console.error('WebView message parse error:', e);
            }
          }}
          scrollEnabled={false}
        />

        {/* Henrik: "Plus/Minus entfernen und durch einen diagonalen Pfeil
            ersetzen, der die Vollbildansicht oeffnet." Daneben der Umschalter
            fuer die Kartenansicht. Beide liegen als echte Knoepfe ueber der
            WebView - in der Karte selbst wuerden sie mitzoomen. */}
        <View style={styles.werkzeuge} pointerEvents="box-none">
          <Druck
            style={styles.werkzeug}
            onPress={onVollbild}
            accessibilityLabel={vollbild ? 'Vollbild verlassen' : 'Karte im Vollbild'}
          >
            <Ionicons name={vollbild ? 'contract-outline' : 'expand-outline'} size={18} color="#1a1d21" />
          </Druck>
          <Druck
            style={styles.werkzeug}
            onPress={stilWeiterschalten}
            accessibilityLabel={`Kartenansicht: ${stil.label}`}
          >
            <Ionicons name="layers-outline" size={18} color="#1a1d21" />
          </Druck>
        </View>

        {/* Ein Schild statt eines Menues: der Umschalter geht reihum, und das
            Schild sagt, wo man gerade steht. */}
        <View style={styles.schild} pointerEvents="none">
          <Text style={styles.schildText}>{stil.label}</Text>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 18,
    /* Derselbe Rand wie auf der Website (`margin: 0 16px`) - die beiden
       Fassungen sollen nebeneinander gleich aussehen. */
    marginHorizontal: 16,
  },
  /* Im Vollbild fuellt die Karte den Bereich - kein Rand, keine Ecken. */
  containerVoll: {
    borderRadius: 0,
    marginHorizontal: 0,
  },
  webview: {
    backgroundColor: 'transparent',
  },
  werkzeuge: {
    position: 'absolute',
    right: 10,
    top: 10,
    gap: 6,
  },
  werkzeug: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  schild: {
    position: 'absolute',
    left: 10,
    top: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  schildText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1a1d21',
  },
});
