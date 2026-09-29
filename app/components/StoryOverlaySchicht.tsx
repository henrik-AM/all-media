/**
 * Die Bearbeitung einer Story über dem Bild — Kasten 11.6.
 *
 * Text, Schrift, Farbe, Filter und die Namensschilder der Markierten stehen
 * als Daten an der Story (stories.overlays), nicht ins Bild gebrannt. Diese
 * Schicht zeichnet sie im Betrachter und in der Bearbeitung — dieselbe
 * Komponente an beiden Stellen, sonst sähe die Story beim Posten anders aus
 * als beim Ansehen. Die Website zeichnet dieselben Daten mit CSS
 * (storyOverlayHtml in web/public/app.js).
 *
 * Positionen sind relativ (0 bis 1) zur Bildfläche. Die Schriftgröße ist auf
 * eine Bildbreite von 390 Punkten bezogen und wird mitskaliert — so steht der
 * Text auf dem kleinen iPhone und im breiten Browserfenster gleich groß im
 * Verhältnis zum Bild.
 */
import React, { useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, Text, View } from 'react-native';
import { filterZu } from '../constants/filter';
import { StoryOverlays } from '../types';

const StoryRegeln = require('../../gemeinsam/story') as typeof import('../../gemeinsam/story');

/** Bezugsbreite für die Schriftgröße (siehe oben). */
export const BEZUG_BREITE = 390;

/** Die Schriftfamilie für React Native. */
export const schriftStil = (key: string) => {
  const s = StoryRegeln.schriftZu(key);
  return {
    fontFamily: Platform.OS === 'ios' ? (s.ios === 'System' ? undefined : s.ios) : s.android,
    fontWeight: s.gewicht as '400' | '600' | '900',
    fontStyle: s.kursiv ? ('italic' as const) : ('normal' as const),
  };
};

interface Props {
  overlays?: StoryOverlays | null;
  /** Namensschild antippen (Betrachter: Profil öffnen). */
  onMarkierung?: (userId: string) => void;
  /** Ohne Filter — wenn die Bearbeitung den Filter selbst zeichnet. */
  ohneFilter?: boolean;
  /** Ohne Texte — wenn die Bearbeitung die Texte selbst verschiebbar zeichnet. */
  ohneTexte?: boolean;
}

export const StoryOverlaySchicht = ({ overlays, onMarkierung, ohneFilter, ohneTexte }: Props) => {
  const [breite, setBreite] = useState(BEZUG_BREITE);
  if (!overlays) return null;
  const o = StoryRegeln.overlaysPruefen(overlays);
  const f = filterZu(o.filter);
  const faktor = breite / BEZUG_BREITE;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={(e: LayoutChangeEvent) => setBreite(e.nativeEvent.layout.width || BEZUG_BREITE)}
    >
      {!ohneFilter && f.staerke > 0 && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: f.ton, opacity: f.staerke }]} />
      )}
      {!ohneFilter && Boolean(f.ecken) && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.kante, styles.oben, { opacity: f.ecken }]} />
          <View style={[styles.kante, styles.unten, { opacity: f.ecken }]} />
          <View style={[styles.kante, styles.links, { opacity: f.ecken }]} />
          <View style={[styles.kante, styles.rechts, { opacity: f.ecken }]} />
        </View>
      )}
      {!ohneTexte &&
        o.texte.map((t, i) => (
          <View
            key={`t${i}`}
            pointerEvents="none"
            style={[styles.anker, { left: `${t.x * 100}%`, top: `${t.y * 100}%` }]}
          >
            <Text
              testID="story-text"
              style={[
                styles.text,
                schriftStil(t.schrift),
                {
                  color: t.farbe,
                  fontSize: t.groesse * faktor,
                  backgroundColor: t.hintergrund ? 'rgba(0,0,0,0.55)' : 'transparent',
                },
              ]}
            >
              {t.text}
            </Text>
          </View>
        ))}
      {o.markiert.map((m) => (
        <View key={m.userId} style={[styles.anker, { left: `${m.x * 100}%`, top: `${m.y * 100}%` }]}>
          <Text
            testID="story-markierung"
            style={styles.schild}
            onPress={onMarkierung ? () => onMarkierung(m.userId) : undefined}
          >
            @{m.name || 'Person'}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  kante: { position: 'absolute', backgroundColor: '#000' },
  oben: { top: 0, left: 0, right: 0, height: '16%' },
  unten: { bottom: 0, left: 0, right: 0, height: '16%' },
  links: { top: 0, bottom: 0, left: 0, width: '10%' },
  rechts: { top: 0, bottom: 0, right: 0, width: '10%' },
  // Der Punkt (x, y) ist die Mitte des Textes.
  anker: {
    position: 'absolute',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  text: {
    position: 'absolute',
    width: 320,
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  schild: {
    position: 'absolute',
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: 'hidden',
    minWidth: 60,
    textAlign: 'center',
  },
});
