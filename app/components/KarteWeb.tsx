import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

export interface Pin {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface KartenSteuerung {
  zoomAuf: (pinId: string) => void;
  zuruecksetzen: () => void;
}

interface Props {
  pins: Pin[];
  aktiv?: string | null;
  onPinPress?: (pinId: string) => void;
  hoehe?: number;
  vollbild?: boolean;
  onVollbild?: () => void;
}

const makeHtmlMap = (pins: Pin[], aktivId?: string | null) => {
  const pinJsons = pins
    .map(p => `{ id: '${p.id}', name: '${p.name}', lat: ${p.lat}, lng: ${p.lng} }`)
    .join(',');

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
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const pins = [${pinJsons}];
    const aktivId = '${aktivId || ''}';

    const map = L.map('map').setView([51.5, 10], 4);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 18
    }).addTo(map);

    pins.forEach(pin => {
      const isActive = pin.id === aktivId;
      const marker = L.circleMarker([pin.lat, pin.lng], {
        radius: isActive ? 12 : 8,
        fillColor: isActive ? '#ff3b30' : '#007AFF',
        color: isActive ? '#ff3b30' : '#007AFF',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
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
  ({ pins, aktiv, onPinPress, hoehe = 320, vollbild, onVollbild }, ref) => {
    const webViewRef = useRef<WebView>(null);

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
      <View style={[styles.container, { height: hoehe }]}>
        <WebView
          ref={webViewRef}
          source={{ html: makeHtmlMap(pins, aktiv) }}
          style={styles.webview}
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
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 12,
  },
  webview: {
    backgroundColor: 'transparent',
  },
});
