import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Druck } from './Druck';
import { SheetRahmen } from './SheetRahmen';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';
import { ausGalerie } from '../lib/aufnehmen';
import { STICKER } from '../constants/sticker';
import { Message } from '../types';

type Reiter = 'gif' | 'sticker';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Derselbe Weg wie beim Anhang-Blatt: der Chat schreibt in die Datenbank. */
  onAnhang: (teil: Partial<Message> & { text: string }) => void;
  onNotice: (message: string) => void;
}

/**
 * GIFs und Sticker — der Knopf rechts im Eingabefeld (Kasten 28/6.3).
 *
 * Henrik, 28.09.2026: „Gifs und Sticker soll man nicht über Anhänge senden
 * können, sondern in der Chat-Spalte … rechts … ein Button, wo ich auf Gifs
 * und Sticker zugreifen kann. Schaue mal bei WhatsApp." WhatsApp oeffnet
 * dort ein Blatt mit Reitern — hier GIF | Sticker.
 *
 * GIF: Eine GIF-Suche (Giphy, Tenor) braucht einen Zugangsschluessel bei
 * einem fremden Konto und schickt jede Suchanfrage dorthin — beides ist
 * ausgeschlossen (nur kostenlose Dienste ohne Schluessel). Darum kommt ein
 * GIF wie bisher aus der eigenen Galerie; der Reiter sagt das offen, statt
 * eine Suche vorzutaeuschen.
 *
 * Gleiches Blatt auf der Website: openGifSticker() in web/public/app.js.
 */
export const GifStickerSheet = ({ visible, onClose, onAnhang, onNotice }: Props) => {
  const [reiter, setReiter] = useState<Reiter>('sticker');

  const gifAusGalerie = async () => {
    const uri = await ausGalerie('photo', onNotice);
    if (!uri) return;
    onAnhang({ text: 'Gif', media: 'gif', bildUri: uri });
    onNotice('Gif gesendet');
    onClose();
  };

  return (
    <SheetRahmen visible={visible} title="GIFs und Sticker" onClose={onClose} hoch>
      <View style={styles.reiter} accessibilityRole="tablist">
        {(['gif', 'sticker'] as Reiter[]).map((r) => {
          const an = r === reiter;
          return (
            <Druck
              key={r}
              style={[styles.reiterKnopf, an && styles.reiterKnopfAn]}
              onPress={() => setReiter(r)}
              accessibilityRole="tab"
              accessibilityState={{ selected: an }}
              accessibilityLabel={r === 'gif' ? 'GIF' : 'Sticker'}
            >
              <Text style={[styles.reiterText, an && styles.reiterTextAn]}>
                {r === 'gif' ? 'GIF' : 'Sticker'}
              </Text>
            </Druck>
          );
        })}
      </View>

      {reiter === 'sticker' ? (
        <ScrollView contentContainerStyle={styles.raster}>
          {STICKER.map((st) => (
            <Druck
              key={st}
              style={({ pressed }) => [styles.sticker, pressed && styles.gedrueckt]}
              accessibilityLabel={`Sticker ${st}`}
              onPress={() => {
                onAnhang({ text: st, media: 'sticker' });
                onClose();
              }}
            >
              <Text style={styles.stickerZeichen}>{st}</Text>
            </Druck>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.gif}>
          <View style={styles.gifSymbol}>
            <Ionicons name="film-outline" size={30} color={colors.white} />
          </View>
          <Text style={styles.gifTitel}>GIF aus deiner Galerie</Text>
          <Text style={styles.gifText}>
            Eine GIF-Suche gibt es nicht: sie würde jede Suche an einen fremden Dienst schicken.
          </Text>
          <Druck style={styles.gifKnopf} onPress={gifAusGalerie} accessibilityLabel="GIF aus der Galerie wählen">
            <Ionicons name="images-outline" size={18} color={colors.white} />
            <Text style={styles.gifKnopfText}>GIF aus der Galerie wählen</Text>
          </Druck>
        </View>
      )}
    </SheetRahmen>
  );
};

const styles = themenStyles((colors) => ({
  reiter: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: 3,
    borderRadius: radius.soft,
    backgroundColor: colors.surface2,
  },
  reiterKnopf: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.soft - 3,
  },
  reiterKnopfAn: { backgroundColor: colors.surface },
  reiterText: { ...typography.name, color: colors.text2 },
  reiterTextAn: { color: colors.text },
  raster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  sticker: {
    width: '20%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  gedrueckt: { backgroundColor: colors.surface2 },
  stickerZeichen: { fontSize: 40 },
  gif: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.md },
  gifSymbol: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#8E44AD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gifTitel: { ...typography.name, color: colors.text },
  gifText: { ...typography.message, color: colors.text2, textAlign: 'center' },
  gifKnopf: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
    marginTop: spacing.sm,
  },
  gifKnopfText: { ...typography.name, color: colors.white },
}));
