import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from './Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { SheetRahmen } from './SheetRahmen';
import { colors, radius, sizes, spacing, typography } from '../constants/design';
import { aufnehmen, ausGalerie } from '../lib/aufnehmen';
import { mockPlaces, mockUsers } from '../mocks';
import { Contact, Message } from '../types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Schritt = 'menue' | 'standort' | 'kontakt';

interface Props {
  visible: boolean;
  contacts: Contact[];
  /** Der Chatpartner selbst wird beim Kontakt-Anhang ausgelassen. */
  ausserId?: string;
  onClose: () => void;
  /** Liefert den fertigen Anhang, den der Chat dann anhaengt. */
  onAnhang: (teil: Partial<Message> & { text: string }) => void;
  onNotice: (message: string) => void;
}

const PUNKTE: { key: string; label: string; icon: IconName }[] = [
  { key: 'kamera', label: 'Foto aufnehmen', icon: 'camera-outline' },
  { key: 'galerie', label: 'Aus der Galerie', icon: 'image-outline' },
  { key: 'standort', label: 'Standort senden', icon: 'location-outline' },
  { key: 'kontakt', label: 'Kontakt senden', icon: 'person-outline' },
];

/** Das Plus in der Nachrichtenzeile: Foto, Standort oder Kontakt. */
export const AnhangSheet = ({ visible, contacts, ausserId, onClose, onAnhang, onNotice }: Props) => {
  const [schritt, setSchritt] = useState<Schritt>('menue');

  const schliessen = () => {
    setSchritt('menue');
    onClose();
  };

  const foto = async (ausDerGalerie: boolean) => {
    const uri = ausDerGalerie ? await ausGalerie('photo', onNotice) : await aufnehmen('photo', onNotice);
    if (!uri) return schliessen();
    onAnhang({ text: 'Foto', media: 'image', bildUri: uri });
    onNotice('Foto gesendet');
    schliessen();
  };

  const auswahl = contacts.filter((c) => mockUsers[c.id] && c.id !== ausserId);

  const titel = { menue: 'Anhang', standort: 'Standort senden', kontakt: 'Kontakt senden' }[schritt];

  return (
    <SheetRahmen visible={visible} title={titel} onClose={schliessen} hoch={schritt !== 'menue'}>
      {schritt === 'menue' && (
        <View>
          {PUNKTE.map((p) => (
            <Druck
              key={p.key}
              style={({ pressed }) => [styles.zeile, pressed && styles.gedrueckt]}
              onPress={() => {
                if (p.key === 'kamera') return foto(false);
                if (p.key === 'galerie') return foto(true);
                setSchritt(p.key as Schritt);
              }}
            >
              <View style={styles.symbol}>
                <Ionicons name={p.icon} size={18} color={colors.text2} />
              </View>
              <Text style={styles.label}>{p.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text3} />
            </Druck>
          ))}
        </View>
      )}

      {schritt === 'standort' && (
        <ScrollView>
          {mockPlaces.map((platz) => (
            <Druck
              key={platz.id}
              style={({ pressed }) => [styles.zeile, pressed && styles.gedrueckt]}
              onPress={() => {
                onAnhang({
                  text: `Standort: ${platz.name}`,
                  standort: {
                    name: platz.name,
                    adresse: platz.adresse,
                    koordinaten: platz.koordinaten,
                    x: platz.x,
                    y: platz.y,
                  },
                });
                onNotice('Standort gesendet');
                schliessen();
              }}
            >
              <View style={styles.symbol}>
                <Ionicons name="location-outline" size={18} color={colors.text2} />
              </View>
              <Text style={styles.label}>{platz.name}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text3} />
            </Druck>
          ))}
        </ScrollView>
      )}

      {schritt === 'kontakt' &&
        (auswahl.length === 0 ? (
          <Text style={styles.leer}>Du hast noch keinen Kontakt zum Weitergeben.</Text>
        ) : (
          <ScrollView>
            {auswahl.map((c) => {
              const person = mockUsers[c.id];
              return (
                <Druck
                  key={c.id}
                  style={({ pressed }) => [styles.zeile, pressed && styles.gedrueckt]}
                  onPress={() => {
                    onAnhang({
                      text: `Kontakt: ${person.name}`,
                      kontakt: { id: person.id, name: person.name, handle: person.handle },
                    });
                    onNotice('Kontakt gesendet');
                    schliessen();
                  }}
                >
                  <Avatar id={person.id} name={person.name} size={sizes.avatarSm} />
                  <Text style={styles.label}>{person.name}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.text3} />
                </Druck>
              );
            })}
          </ScrollView>
        ))}
    </SheetRahmen>
  );
};

const styles = StyleSheet.create({
  zeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  gedrueckt: { backgroundColor: colors.surface2 },
  symbol: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, ...typography.body, color: colors.text },
  leer: { ...typography.message, color: colors.text2, padding: spacing.lg },
});
