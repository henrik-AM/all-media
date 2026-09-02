/**
 * Eine Nachricht in andere Chats weiterleiten.
 *
 * Gewählt werden Chats, nicht Personen. Das ist der Unterschied zum
 * TeilenSheet, das einen Beitrag an Profile schickt und dafür erst einen
 * Chat sucht oder anlegt: hier gibt es die Chats schon, und eine Gruppe ist
 * ein gültiges Ziel — an sie ließe sich über eine Personenliste gar nicht
 * weiterleiten.
 *
 * Mehrere Ziele auf einmal, weil Weiterleiten fast immer heißt: dasselbe an
 * zwei oder drei Stellen. Einzeln wäre es dreimal derselbe Weg.
 */

import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { Druck } from './Druck';
import { SheetRahmen } from './SheetRahmen';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';
import { Chat } from '../types';

interface Props {
  visible: boolean;
  /** Alle Chats, in die weitergeleitet werden kann. */
  chats: Chat[];
  /** Der Chat, in dem die Nachricht steht — als Ziel sinnlos. */
  ausserId?: string;
  onClose: () => void;
  onWeiterleiten: (chatIds: string[]) => void;
}

export const WeiterleitenSheet = ({
  visible,
  chats,
  ausserId,
  onClose,
  onWeiterleiten,
}: Props) => {
  const [gewaehlt, setGewaehlt] = useState<string[]>([]);

  const ziele = chats.filter((c) => c.id !== ausserId);

  const umschalten = (id: string) =>
    setGewaehlt((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));

  const senden = () => {
    onWeiterleiten(gewaehlt);
    setGewaehlt([]);
  };

  return (
    <SheetRahmen
      visible={visible}
      title="Weiterleiten"
      onClose={() => {
        setGewaehlt([]);
        onClose();
      }}
      hoch
      fuss={
        <Druck
          style={[styles.knopf, !gewaehlt.length && styles.knopfAus]}
          disabled={!gewaehlt.length}
          onPress={senden}
        >
          <Ionicons name="arrow-redo" size={17} color={colors.white} />
          <Text style={styles.knopfText}>
            {gewaehlt.length
              ? `An ${gewaehlt.length} ${gewaehlt.length === 1 ? 'Chat' : 'Chats'} weiterleiten`
              : 'Wähle mindestens einen Chat'}
          </Text>
        </Druck>
      }
    >
      <ScrollView contentContainerStyle={styles.inhalt}>
        {ziele.length === 0 && (
          <Text style={styles.leer}>Es gibt keinen anderen Chat, in den das gehen könnte.</Text>
        )}
        {ziele.map((c) => {
          const an = gewaehlt.includes(c.id);
          return (
            <Druck key={c.id} style={styles.zeile} onPress={() => umschalten(c.id)}>
              <Avatar id={c.userId ?? c.id} name={c.name} size={38} group={c.isGroup} />
              <Text style={styles.name} numberOfLines={1}>
                {c.name}
              </Text>
              <Ionicons
                name={an ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={an ? colors.brand : colors.border}
              />
            </Druck>
          );
        })}
      </ScrollView>
    </SheetRahmen>
  );
};

const styles = themenStyles((colors) => ({
  inhalt: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  leer: { ...typography.small, color: colors.text2, paddingVertical: spacing.md },
  zeile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 9 },
  name: { flex: 1, ...typography.name, color: colors.text },
  knopf: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.brand,
    paddingVertical: 13,
    borderRadius: radius.pill,
  },
  knopfAus: { backgroundColor: colors.border },
  knopfText: { ...typography.name, color: colors.white },
}));
