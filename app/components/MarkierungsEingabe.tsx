/**
 * Ein Eingabefeld, das beim Tippen von @ Personen vorschlägt (Kasten 25.1).
 *
 * Eins-zu-eins-Ersatz für <TextInput> in jedem Feld, in dem man jemanden
 * markieren kann: Videobeschreibung, Kommentar, Story-Text, Messenger-Chat,
 * Gruppe, Community-Unterthema. Die Website hat dasselbe in
 * `markierungsEingabe()` (web/public/app.js).
 *
 * Die Liste steht ÜBER dem Feld (Profilbild, Name, @name). Wer an der Stelle
 * vorgeschlagen wird, entscheidet die Datenbank (`markierung_vorschlaege`):
 * im Chat/Unterthema zuerst die Mitglieder, sonst Gefolgte, Folgende,
 * Kontakte, dann die Suche — und nur, wer sich markieren lässt. Fehlt die
 * Funktion noch (Schema nicht eingespielt) oder ist das Netz weg, schlägt das
 * Feld aus den geladenen Personen vor, statt still nichts zu zeigen.
 *
 * Gemeinsame Regeln (welches Wort gerade getippt wird, wie es ersetzt wird,
 * Reihenfolge) aus gemeinsam/markierung.js.
 */

import React, { forwardRef, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  NativeSyntheticEvent,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  TextInputSelectionChangeEventData,
  View,
  ViewStyle,
} from 'react-native';
import { Druck } from './Druck';
import { Avatar } from './Avatar';
import { useDaten } from '../contexts/DatenContext';
import { useSupabase } from '../contexts/SupabaseContext';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';
import * as Aktion from '../lib/aktionen';
import { handleMerken } from '../lib/markierung';

const MarkierungRegel = require('../../gemeinsam/markierung') as typeof import('../../gemeinsam/markierung');

type Vorschlag = Aktion.MarkierungVorschlag;

interface Props extends TextInputProps {
  value: string;
  onChangeText: (text: string) => void;
  /** Im Chat: dessen Mitglieder zuerst. */
  chatId?: string | null;
  /** Im Community-Unterthema: die Mitglieder der Community zuerst. */
  kanalId?: string | null;
  /** Stil der Hülle (statt des Feldes) — z. B. flex: 1 in einer Zeile. */
  huelle?: StyleProp<ViewStyle>;
  /** Liste unter statt über dem Feld (Felder oben im Blatt). */
  listeUnten?: boolean;
}

export const MarkierungsEingabe = forwardRef<TextInput, Props>(
  ({ value, onChangeText, chatId, kanalId, huelle, listeUnten, onSelectionChange, ...rest }, ref) => {
    const { users, ichId } = useDaten();
    const { supabase } = useSupabase();
    const [cursor, setCursor] = useState<number>(value.length);
    const [erzwungen, setErzwungen] = useState<{ start: number; end: number } | undefined>();
    const [liste, setListe] = useState<Vorschlag[]>([]);
    const anfrage = useRef(0);

    const wort = MarkierungRegel.aktuellesWort(value, cursor);
    const suche = wort ? wort.suche : null;

    useEffect(() => {
      if (suche === null) {
        setListe([]);
        return;
      }
      const nr = ++anfrage.current;
      // Ersatz aus den geladenen Personen — sofort, und wenn die Datenbank schweigt.
      const ersatz: Vorschlag[] = MarkierungRegel.vorschlaegeOrdnen(
        Object.values(users)
          .filter((u) => u && u.id !== 'me' && u.id !== ichId && u.handle)
          .map((u) => ({ id: u.id, name: u.name, handle: u.handle, avatar_url: u.avatar ?? null, color: u.color ?? null, rang: 'nah' as const })),
        suche
      ).slice(0, 8);
      setListe(ersatz);
      if (!supabase) return;
      const client = supabase;
      const t = setTimeout(async () => {
        try {
          const aus = await Aktion.markierungVorschlaege(client, suche, { chat: chatId, kanal: kanalId });
          if (nr !== anfrage.current) return;
          setListe(MarkierungRegel.vorschlaegeOrdnen(aus, suche).slice(0, 8));
        } catch (e: any) {
          console.warn('[markierung] Vorschläge aus den geladenen Personen:', e?.message ?? e);
        }
      }, 180);
      return () => clearTimeout(t);
      // users absichtlich nicht: sonst fragt jede neu geladene Liste erneut.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [suche, chatId, kanalId, supabase]);

    const waehlen = (p: Vorschlag) => {
      const neu = MarkierungRegel.einsetzen(value, cursor, p.handle);
      handleMerken(MarkierungRegel.normal(p.handle), p.id);
      onChangeText(neu.text);
      setCursor(neu.cursor);
      setErzwungen({ start: neu.cursor, end: neu.cursor });
      setListe([]);
    };

    const liste_ = suche !== null && liste.length > 0 && (
      <View
        style={[styles.liste, listeUnten ? styles.listeUnten : styles.listeOben]}
        accessibilityLabel="Personen markieren"
      >
        <FlatList
          data={liste}
          keyExtractor={(p) => p.id}
          keyboardShouldPersistTaps="always"
          renderItem={({ item }) => (
            <Druck style={styles.zeile} onPress={() => waehlen(item)} accessibilityLabel={`${item.name} markieren`}>
              <Avatar id={item.id} name={item.name} size={30} bild={item.avatar_url ?? null} farbe={item.color ?? undefined} />
              <View style={styles.namen}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.handle} numberOfLines={1}>{item.handle}</Text>
              </View>
            </Druck>
          )}
        />
      </View>
    );

    return (
      <View style={[styles.huelle, huelle]}>
        {liste_}
        <TextInput
          ref={ref}
          {...rest}
          value={value}
          selection={erzwungen}
          onChangeText={(t) => {
            onChangeText(t);
            // Beim Tippen steht der Cursor hinter dem letzten Zeichen der
            // Änderung; onSelectionChange kommt gleich danach und stellt ihn genau.
            setCursor(Math.min(t.length, cursor + (t.length - value.length)));
          }}
          onSelectionChange={(e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
            setCursor(e.nativeEvent.selection.end);
            if (erzwungen) setErzwungen(undefined);
            onSelectionChange?.(e);
          }}
        />
      </View>
    );
  }
);

const styles = themenStyles((colors) => ({
  huelle: { position: 'relative' },
  liste: {
    position: 'absolute',
    left: 0,
    right: 0,
    maxHeight: 232,
    zIndex: 50,
    elevation: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0C0E14',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    overflow: 'hidden',
  },
  listeOben: { bottom: '100%', marginBottom: 6 },
  listeUnten: { top: '100%', marginTop: 6 },
  zeile: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 8 },
  namen: { flex: 1, minWidth: 0 },
  name: { ...typography.small, fontWeight: '600', color: colors.text },
  handle: { ...typography.small, color: colors.text3 },
}));
