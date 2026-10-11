import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from './Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { SheetRahmen } from './SheetRahmen';
import { colors, radius, sizes, spacing, themenStyles, typography } from '../constants/design';
import { ausGalerie } from '../lib/aufnehmen';
import * as DocumentPicker from 'expo-document-picker';
import { useDaten } from '../contexts/DatenContext';
import { StandortWahl } from './StandortWahl';

const OrtSuche = require('../../gemeinsam/ortsuche') as typeof import('../../gemeinsam/ortsuche');
import { Contact, Message } from '../types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Schritt = 'menue' | 'standort' | 'kontakt' | 'liveStandort';

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
  /**
   * Anhang-Arten, die es hier nicht gibt.
   *
   * Im Unterthema einer Community faellt "Standort anfragen" weg: die Anfrage
   * richtet sich an eine bestimmte Person, und ein Kanal hat kein Gegenueber.
   * Der Punkt stand dort und antwortete mit "In einer Gruppe geht das nicht" —
   * ein Knopf, dessen einzige Wirkung eine Absage ist, gehoert weg.
   */
  ohne?: string[];
  onNotice: (message: string) => void;
}

/*
 * Kasten 28/6.2 (Henrik 28.09.2026): „gefällt mir das Design nicht … hoch
 * professionell … orientiere dich an WhatsApp." Statt einer Liste mit
 * Pfeilen ein Raster runder, farbiger Symbole mit Beschriftung darunter —
 * jede Art mit eigener Farbe, damit man sie ohne Lesen wiederfindet.
 * Dieselben Farben in web/public/app.js (ANHANG_FARBEN) und styles.css.
 */
const FARBEN: Record<string, string> = {
  galerie: '#007BFC',
  datei: '#7F66FF',
  standort: '#1FA855',
  liveStandort: '#00A5A8',
  standortAnfragen: '#FF8A00',
  kontakt: '#009DE2',
};

/** Kurze Beschriftungen unter den Kreisen; die langen bleiben für VoiceOver. */
const KURZ: Record<string, string> = {
  galerie: 'Galerie',
  datei: 'Dokument',
  standort: 'Standort',
  liveStandort: 'Live-Standort',
  standortAnfragen: 'Standort anfragen',
  kontakt: 'Kontakt',
};

const PUNKTE: { key: string; label: string; icon: IconName }[] = [
  { key: 'galerie', label: 'Aus der Galerie', icon: 'image-outline' },
  /*
   * Datei, Gif, Sticker und Standortanfrage kamen am 01.09.2026 dazu. Alle
   * vier stehen im Handbuch ("Dateien/Dokumente", "Gifs", "Sticker",
   * "Standortanfrage"); im Anhang-Menue gab es sie nicht.
   */
  { key: 'datei', label: 'Datei senden', icon: 'document-outline' },
  /*
   * Kasten 28/6.1 (Henrik 28.09.2026): „Foto aufnehmen", „GIF senden" und
   * „Sticker" fliegen aus der Liste. Die Kamera sitzt im Eingabefeld, GIFs
   * und Sticker hinter dem eigenen Knopf rechts davon (GifStickerSheet).
   */
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
  ohne = [],
  onNotice,
}: Props) => {
  const { users: alleNutzer } = useDaten();
  const [schritt, setSchritt] = useState<Schritt>('menue');

  const schliessen = () => {
    setSchritt('menue');
    onClose();
  };

  const foto = async () => {
    const uri = await ausGalerie('photo', onNotice);
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
  }[schritt];

  return (
    <SheetRahmen visible={visible} title={titel} onClose={schliessen} hoch={schritt !== 'menue'}>
      {schritt === 'menue' && (
        <View style={styles.raster}>
          {PUNKTE.filter((p) => !ohne.includes(p.key)).map((p) => (
            <Druck
              key={p.key}
              style={({ pressed }) => [styles.kachel, pressed && styles.kachelGedrueckt]}
              accessibilityRole="button"
              accessibilityLabel={p.label}
              onPress={() => {
                if (p.key === 'galerie') return foto();
                if (p.key === 'datei') return datei();
                if (p.key === 'liveStandort') return liveStandortTeilen();
                if (p.key === 'standortAnfragen') {
                  onStandortAnfragen?.();
                  return schliessen();
                }
                setSchritt(p.key as Schritt);
              }}
            >
              <View style={[styles.kreis, { backgroundColor: FARBEN[p.key] ?? colors.brand }]}>
                <Ionicons name={p.icon} size={26} color="#FFFFFF" />
              </View>
              <Text style={styles.kachelText} numberOfLines={2}>
                {KURZ[p.key] ?? p.label}
              </Text>
            </Druck>
          ))}
        </View>
      )}

      {/*
        Kasten 28/6.5: Ort suchen oder auf der Karte waehlen statt der festen
        Liste aus `places`. Der Ort geht als Text (gemeinsam/ortsuche.js,
        alsText) — damit laeuft er im Zweierchat mit durch die
        Verschluesselung, und es braucht kein neues Schema. Die Blase macht
        daraus wieder die Karte (OrtSuche.ausText).
      */}
      {schritt === 'standort' && (
        <StandortWahl
          onNotice={onNotice}
          onWahl={(ort) => {
            const text = OrtSuche.alsText(ort);
            if (!text) return onNotice('Dieser Ort lässt sich nicht senden');
            onAnhang({ text, standort: OrtSuche.ausText(text) ?? undefined });
            onNotice('Standort gesendet');
            schliessen();
          }}
        />
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
  // Kasten 28/6.2: drei Kacheln je Reihe, wie das Anhang-Blatt bei WhatsApp.
  raster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  kachel: {
    width: '33.333%',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    gap: 8,
  },
  kachelGedrueckt: { backgroundColor: colors.surface2 },
  kreis: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  kachelText: { ...typography.small, fontWeight: '500', color: colors.text, textAlign: 'center' },
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
