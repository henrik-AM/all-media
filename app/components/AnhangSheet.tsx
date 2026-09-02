import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from './Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { SheetRahmen } from './SheetRahmen';
import { colors, radius, sizes, spacing, themenStyles, typography } from '../constants/design';
import { aufnehmen, ausGalerie } from '../lib/aufnehmen';
import * as DocumentPicker from 'expo-document-picker';
import { STICKER } from '../constants/sticker';
import { useDaten } from '../contexts/DatenContext';
import { Contact, Message } from '../types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Schritt = 'menue' | 'standort' | 'kontakt' | 'liveStandort' | 'sticker';

interface Props {
  visible: boolean;
  contacts: Contact[];
  /** Der Chatpartner selbst wird beim Kontakt-Anhang ausgelassen. */
  ausserId?: string;
  onClose: () => void;
  /** Liefert den fertigen Anhang, den der Chat dann anhaengt. */
  /*
   * `ortId` und `personId` sind die Kennungen für die Datenbank; alles andere
   * ist nur für die Anzeige. Der Chat schreibt daraus place_id beziehungsweise
   * contact_user_id — vorher blieb ein Anhang im Arbeitsspeicher der App und
   * war nach dem nächsten Start weg.
   */
  onAnhang: (
    teil: Partial<Message> & {
      text: string;
      ortId?: string;
      personId?: string;
      /* Bei einer Datei: ohne Name und Groesse steht dort ein graues Kaestchen. */
      dateiName?: string;
      dateiGroesse?: number;
    }
  ) => void;
  /**
   * Den Standort der Gegenseite anfragen. Das Handbuch nennt es ausdruecklich
   * ("Live-Standort Anfrage (im Privatchat)") — bis zum 01.09.2026 gab es nur
   * die Freigabe, also die eine Richtung.
   */
  onStandortAnfragen?: () => void;
  onNotice: (message: string) => void;
}

const PUNKTE: { key: string; label: string; icon: IconName }[] = [
  { key: 'kamera', label: 'Foto aufnehmen', icon: 'camera-outline' },
  { key: 'galerie', label: 'Aus der Galerie', icon: 'image-outline' },
  /*
   * Datei, Gif, Sticker und Standortanfrage kamen am 01.09.2026 dazu. Alle
   * vier stehen im Handbuch ("Dateien/Dokumente", "Gifs", "Sticker",
   * "Standortanfrage"); im Anhang-Menue gab es sie nicht.
   */
  { key: 'datei', label: 'Datei senden', icon: 'document-outline' },
  { key: 'gif', label: 'Gif senden', icon: 'film-outline' },
  { key: 'sticker', label: 'Sticker', icon: 'happy-outline' },
  { key: 'standort', label: 'Standort senden', icon: 'location-outline' },
  { key: 'liveStandort', label: 'Live-Standort teilen', icon: 'navigate-circle-outline' },
  { key: 'standortAnfragen', label: 'Standort anfragen', icon: 'help-circle-outline' },
  { key: 'kontakt', label: 'Kontakt senden', icon: 'person-outline' },
];

/** Das Plus in der Nachrichtenzeile: Foto, Standort oder Kontakt. */
export const AnhangSheet = ({
  visible,
  contacts,
  ausserId,
  onClose,
  onAnhang,
  onStandortAnfragen,
  onNotice,
}: Props) => {
  const { places: alleOrte, users: alleNutzer } = useDaten();
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

  /**
   * Eine Datei anhaengen.
   *
   * Name und Groesse gehen mit in die Datenbank. Ohne beides zeigte der Chat
   * nur ein graues Kaestchen — man saehe, dass etwas da ist, aber nicht was.
   */
  const datei = async () => {
    try {
      const wahl = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (wahl.canceled || !wahl.assets?.length) return schliessen();

      const d = wahl.assets[0];
      onAnhang({
        text: d.name,
        media: 'file',
        bildUri: d.uri,
        dateiName: d.name,
        dateiGroesse: d.size ?? 0,
      });
      onNotice('Datei gesendet');
    } catch {
      onNotice('Auf die Datei ließ sich nicht zugreifen');
    }
    schliessen();
  };

  /*
   * Ein Gif kommt aus der Galerie. Eine Suche bei einem Gif-Dienst braeuchte
   * einen fremden Zugang und wuerde jede Suchanfrage dorthin schicken — fuer
   * eine App, die mit Ende-zu-Ende wirbt, waere das der falsche Weg.
   */
  const gif = async () => {
    const uri = await ausGalerie('photo', onNotice);
    if (!uri) return schliessen();
    onAnhang({ text: 'Gif', media: 'gif', bildUri: uri });
    onNotice('Gif gesendet');
    schliessen();
  };

  const liveStandortTeilen = async () => {
    try {
      const location = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          reject,
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });
      onAnhang({
        text: `Mein Standort (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`,
        standort: {
          name: 'Mein Standort',
          adresse: 'Live-Standort',
          koordinaten: `${location.lat}, ${location.lng}`,
          x: 50,
          y: 50,
        },
      });
      onNotice('Live-Standort gesendet');
      schliessen();
    } catch (error) {
      onNotice('Standort-Zugriff verweigert oder nicht verfügbar');
    }
  };

  const auswahl = contacts.filter((c) => alleNutzer[c.id] && c.id !== ausserId);

  const titel = {
    menue: 'Anhang',
    standort: 'Standort senden',
    kontakt: 'Kontakt senden',
    liveStandort: 'Live-Standort',
    sticker: 'Sticker',
  }[schritt];

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
                if (p.key === 'datei') return datei();
                if (p.key === 'gif') return gif();
                if (p.key === 'liveStandort') return liveStandortTeilen();
                if (p.key === 'standortAnfragen') {
                  onStandortAnfragen?.();
                  return schliessen();
                }
                setSchritt(p.key as Schritt);
              }}
            >
              <View style={styles.symbol}>
                <Ionicons name={p.icon} size={22} color={colors.white} />
              </View>
              <Text style={styles.label}>{p.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text3} />
            </Druck>
          ))}
        </View>
      )}

      {schritt === 'sticker' && (
        <ScrollView contentContainerStyle={styles.stickerRaster}>
          {STICKER.map((st) => (
            <Druck
              key={st}
              style={styles.sticker}
              onPress={() => {
                onAnhang({ text: st, media: 'sticker' });
                schliessen();
              }}
            >
              <Text style={styles.stickerZeichen}>{st}</Text>
            </Druck>
          ))}
        </ScrollView>
      )}

      {schritt === 'standort' && (
        <ScrollView>
          {alleOrte.map((platz) => (
            <Druck
              key={platz.id}
              style={({ pressed }) => [styles.zeile, pressed && styles.gedrueckt]}
              onPress={() => {
                onAnhang({
                  text: `Standort: ${platz.name}`,
                  ortId: platz.id,
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
                <Ionicons name="location-outline" size={22} color={colors.white} />
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
              const person = alleNutzer[c.id];
              return (
                <Druck
                  key={c.id}
                  style={({ pressed }) => [styles.zeile, pressed && styles.gedrueckt]}
                  onPress={() => {
                    onAnhang({
                      text: `Kontakt: ${person.name}`,
                      personId: person.id,
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

const styles = themenStyles((colors) => ({
  stickerRaster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sticker: { width: '20%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  stickerZeichen: { fontSize: 40 },

  zeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  gedrueckt: { backgroundColor: colors.surface2 },
  symbol: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, ...typography.name, color: colors.text },
  leer: { ...typography.message, color: colors.text2, padding: spacing.lg },
}));
