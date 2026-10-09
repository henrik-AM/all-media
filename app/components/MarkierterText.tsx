/**
 * Text mit @-Markierungen als antippbare Links zum Profil (Kasten 25.3).
 *
 * Überall, wo Text von Menschen steht — Beschreibung, Kommentar, Chatblase,
 * Unterthema, Story —, steht statt eines nackten <Text> dieses Bauteil.
 * Nur Namen, die es gibt, werden zum Link; ein @-Wort zu einem Namen ohne
 * Konto bleibt gewöhnlicher Text (gemeinsam/markierung.js, `stuecke`).
 *
 * Ein Link öffnet das öffentliche Profil über den Öffner, den App.tsx in
 * lib/markierung.ts anmeldet. Wer den Link-Stil an einer Stelle anders
 * braucht (weiße Schrift auf dem Video), gibt `linkStil` mit.
 */

import React, { useEffect, useMemo, useReducer } from 'react';
import { StyleProp, Text, TextProps, TextStyle } from 'react-native';
import { useDaten } from '../contexts/DatenContext';
import { useSupabase } from '../contexts/SupabaseContext';
import { colors } from '../constants/design';
import {
  aufHandlesHoeren,
  handleKennung,
  handleMerken,
  handlesNachschlagen,
  profilOeffnen,
} from '../lib/markierung';

const MarkierungRegel = require('../../gemeinsam/markierung') as typeof import('../../gemeinsam/markierung');

interface Props extends Omit<TextProps, 'children'> {
  text: string;
  style?: StyleProp<TextStyle>;
  linkStil?: StyleProp<TextStyle>;
  /** Statt des allgemeinen Öffners (z. B. erst ein Blatt schließen). */
  onOpenProfile?: (userId: string) => void;
  /** Was vor dem Text steht, im selben Absatz (z. B. der fette Name im Kommentar). */
  davor?: React.ReactNode;
}

export const MarkierterText = ({ text, style, linkStil, onOpenProfile, davor, ...rest }: Props) => {
  const { users } = useDaten();
  const { supabase } = useSupabase();
  const [, neu] = useReducer((x: number) => x + 1, 0);

  // Die geladenen Personen kennen ihren Namen schon.
  const ausDaten = useMemo(() => {
    const karte = new Map<string, string>();
    for (const u of Object.values(users)) {
      if (u?.handle) karte.set(MarkierungRegel.normal(u.handle), u.id);
    }
    return karte;
  }, [users]);

  const namen = useMemo(() => MarkierungRegel.handles(text || ''), [text]);

  useEffect(() => {
    if (!namen.length) return;
    namen.forEach((h) => {
      const id = ausDaten.get(h);
      if (id) handleMerken(h, id);
    });
    const ab = aufHandlesHoeren(neu);
    handlesNachschlagen(supabase, namen.filter((h) => handleKennung(h) === undefined));
    return ab;
  }, [namen, ausDaten, supabase]);

  const kennung = (h: string) => ausDaten.get(h) ?? handleKennung(h) ?? null;
  const stuecke = MarkierungRegel.stuecke(text || '', (h) => Boolean(kennung(h)));

  return (
    <Text style={style} {...rest}>
      {davor}
      {stuecke.map((s, i) =>
        s.art === 'markierung' ? (
          <Text
            key={i}
            style={[{ color: colors.brand, fontWeight: '600' }, linkStil]}
            accessibilityRole="link"
            onPress={() => {
              const id = kennung(s.handle);
              if (!id) return;
              (onOpenProfile ?? profilOeffnen)(id);
            }}
          >
            {s.text}
          </Text>
        ) : (
          <React.Fragment key={i}>{s.text}</React.Fragment>
        )
      )}
    </Text>
  );
};
