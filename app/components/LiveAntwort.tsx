/**
 * Antworten in der Live-Kommentarspalte (Feedback 28.09., Nachtrag 4.3c).
 *
 * Henrik am 11.10.2026: „Community Chats in jeglicher Art und Weise +
 * Kommentare etc. bei Videos." Das „etc." sind hier die Live-Kommentare
 * (`stream_comments`). Fäden wie unter einem Video ergeben in einer
 * durchlaufenden Spalte keinen Sinn — was eingeklappt ist, liest während
 * einer Sendung niemand. Also wie im Chat: nach rechts ziehen, über der
 * Antwort steht klein das Zitat. Gespeichert wird nur die Kennung
 * (`stream_comments.reply_to`, Schema 92).
 *
 * Zwei Stellen benutzen es: der Host (LivestreamScreen) und die Zuschauer
 * (ClipPlayerScreen). Die Website hat dasselbe in web/public/app.js
 * (liveZeileHtml). Zitattext und Leiste aus gemeinsam/kommentar.js.
 */

import React from 'react';
import { Text, TextStyle, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Druck } from './Druck';
import { ZiehZumAntworten } from './ZiehZumAntworten';
import { themenStyles } from '../constants/design';

const Kommentar = require('../../gemeinsam/kommentar') as typeof import('../../gemeinsam/kommentar');

export interface LiveKommentar {
  id: string;
  name: string;
  text: string;
  zeit?: string;
  antwortAuf?: { id: string; name: string; text: string; fehlt?: boolean };
}

interface ZeileProps {
  k: LiveKommentar;
  onAntworten: (k: LiveKommentar) => void;
  nameStil: TextStyle | (TextStyle | false | undefined)[];
  textStil: TextStyle | (TextStyle | false | undefined)[];
  zitatFarbe: string;
  einzeilig?: boolean;
  /** Ohne Wirkung, solange die Spalte nur als Vorschau dasteht. */
  aktiv?: boolean;
}

/** Eine Zeile der Spalte: ggf. Zitat, dann Name und Text. */
export const LiveKommentarZeile = ({
  k,
  onAntworten,
  nameStil,
  textStil,
  zitatFarbe,
  einzeilig,
  aktiv = true,
}: ZeileProps) => (
  <ZiehZumAntworten aktiv={aktiv} onAntworten={() => onAntworten(k)} testID={`live-${k.id}`}>
    <View style={styles.zeile}>
      {k.antwortAuf ? (
        <View style={styles.zitat}>
          <Ionicons name="return-down-forward" size={11} color={zitatFarbe} />
          <Text style={[styles.zitatText, { color: zitatFarbe }]} numberOfLines={1}>
            {Kommentar.liveZitat(k.antwortAuf)}
          </Text>
        </View>
      ) : null}
      <View style={styles.inhalt}>
        <Text style={nameStil}>{k.name}</Text>
        <Text style={textStil} numberOfLines={einzeilig ? 1 : undefined}>
          {k.text}
        </Text>
      </View>
    </View>
  </ZiehZumAntworten>
);

interface LeisteProps {
  an: LiveKommentar;
  onAbbrechen: () => void;
  farbe: string;
  hintergrund: string;
}

/** Über dem Eingabefeld: „Antwort an Anna" mit Zitat, × bricht ab. */
export const LiveAntwortLeiste = ({ an, onAbbrechen, farbe, hintergrund }: LeisteProps) => (
  <View style={[styles.leiste, { backgroundColor: hintergrund }]}>
    <View style={styles.leisteBalken} />
    <View style={styles.leisteText}>
      <Text style={[styles.leisteKopf, { color: farbe }]} numberOfLines={1}>
        {Kommentar.leistenText(an.name)}
      </Text>
      <Text style={[styles.leisteZitat, { color: farbe }]} numberOfLines={1}>
        {an.text}
      </Text>
    </View>
    <Druck onPress={onAbbrechen} hitSlop={8} accessibilityLabel="Antworten abbrechen">
      <Ionicons name="close" size={18} color={farbe} />
    </Druck>
  </View>
);

const styles = themenStyles((colors) => ({
  zeile: { paddingVertical: 3 },
  inhalt: { flexDirection: 'row', gap: 6 },
  zitat: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 1, opacity: 0.85 },
  zitatText: { flex: 1, fontSize: 11, lineHeight: 14 },
  leiste: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  leisteBalken: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: colors.brand },
  leisteText: { flex: 1, minWidth: 0 },
  leisteKopf: { fontSize: 11, fontWeight: '700' },
  leisteZitat: { fontSize: 12 },
}));
