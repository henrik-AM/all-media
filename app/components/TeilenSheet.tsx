import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from './Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { SheetRahmen } from './SheetRahmen';
import { colors, radius, sizes, spacing, themenStyles, typography } from '../constants/design';
import { useDaten } from '../contexts/DatenContext';
import { Contact } from '../types';

export interface TeilenZiel {
  art: 'post' | 'video';
  id: string;
  titel: string;
  autor: string;
}

/** Über welchen der beiden Bereiche der Beitrag bei dieser Person landet. */
export type TeilenBereich = 'messenger' | 'community';

interface Props {
  ziel: TeilenZiel | null;
  contacts: Contact[];
  /** Überschreibt die Zeile über dem Raster — etwa für eine Aufnahme. */
  titel?: string;
  /**
   * Sagt je Person, in welcher der beiden Chatlisten sie erreicht wird.
   *
   * Der Prototyp-Frame „Nutzer B + Beitrag teilen" hängt jedem Avatar unten
   * rechts ein Abzeichen an, und die Abzeichen sind im selben Raster
   * verschieden: bei der einen Person die grüne Sprechblase des Messengers,
   * bei der nächsten das blaue Personensymbol der Communitys. Es sagt also
   * nicht, aus welchem Bereich man gerade teilt, sondern wo *diese* Person
   * die Nachricht bekommt.
   */
  bereichFuer?: (userId: string) => TeilenBereich;
  onClose: () => void;
  /** Schickt den Beitrag in den Chat mit dieser Person. */
  onSend: (userId: string, ziel: TeilenZiel, bereich: TeilenBereich) => void;
}

/**
 * Prototyp-Frames "Nutzer B + Beitrag teilen" und "VQ + Video teilen": ein
 * Raster aus Personen. Wen man antippt, der bekommt es in den Chat.
 */
export const TeilenSheet = ({ ziel, contacts, titel, bereichFuer, onClose, onSend }: Props) => {
  const { users: alleNutzer } = useDaten();
  const [gesendet, setGesendet] = useState<string[]>([]);

  if (!ziel) return null;

  const kontaktIds = contacts.map((c) => c.id).filter((id) => alleNutzer[id]);
  const uebrige = Object.keys(alleNutzer).filter((id) => id !== 'me' && !kontaktIds.includes(id));

  const raster = (ids: string[]) => (
    <View style={styles.raster}>
      {ids.map((id) => {
        const fertig = gesendet.includes(id);
        const bereich = bereichFuer?.(id) ?? 'messenger';
        return (
          <Druck
            key={id}
            style={[styles.kachel, fertig && styles.kachelFertig]}
            disabled={fertig}
            onPress={() => {
              setGesendet((prev) => [...prev, id]);
              onSend(id, ziel, bereich);
            }}
          >
            <View>
              <Avatar id={id} name={alleNutzer[id].name} size={sizes.avatarLg} />
              {/*
                Das Abzeichen aus dem Prototyp. Es sitzt am Avatar, nicht an
                der Kachel, damit es auch dann unten rechts am Bild klebt,
                wenn die Kachel breiter wird als der Avatar.
              */}
              <View
                style={[
                  styles.bereichMarke,
                  bereich === 'community' ? styles.bereichCommunity : styles.bereichMessenger,
                ]}
              >
                <Ionicons
                  name={bereich === 'community' ? 'people' : 'chatbubble'}
                  size={10}
                  color={colors.white}
                />
              </View>
            </View>
            {fertig && (
              <View style={styles.haken}>
                <Ionicons name="checkmark" size={13} color={colors.white} />
              </View>
            )}
            <Text style={styles.name} numberOfLines={1}>
              {alleNutzer[id].name}
            </Text>
          </Druck>
        );
      })}
    </View>
  );

  return (
    <SheetRahmen
      visible
      title={titel ?? (ziel.art === 'video' ? 'Video teilen' : 'Beitrag teilen')}
      onClose={() => {
        setGesendet([]);
        onClose();
      }}
      hoch
    >
      <ScrollView contentContainerStyle={styles.inhalt}>
        {kontaktIds.length > 0 && <Text style={styles.kopf}>Deine Kontakte</Text>}
        {raster(kontaktIds)}
        {uebrige.length > 0 && <Text style={styles.kopf}>Weitere Vorschläge</Text>}
        {raster(uebrige)}
      </ScrollView>
    </SheetRahmen>
  );
};

const styles = themenStyles((colors) => ({
  inhalt: { paddingBottom: spacing.lg },
  kopf: { ...typography.small, fontWeight: '600', color: colors.text2, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 6 },
  raster: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md },
  kachel: {
    width: '33.33%',
    alignItems: 'center',
    gap: 7,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  kachelFertig: { opacity: 0.55 },
  /*
   * Der weisse Ring ist nicht Zierde: ohne ihn verschwimmt ein gruener Punkt
   * auf einem gruenen Avatarverlauf. Er trennt das Abzeichen vom Bild
   * darunter, in beiden Themen.
   */
  bereichMarke: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bereichMessenger: { backgroundColor: colors.online },
  bereichCommunity: { backgroundColor: colors.brand },
  haken: {
    position: 'absolute',
    top: spacing.md,
    right: '50%',
    transform: [{ translateX: 28 }],
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...typography.small, color: colors.text, maxWidth: '92%' },
}));
