/**
 * Drei-Punkte-Menü im Aussehen von TikTok: runde Symbolkreise mit der
 * Beschriftung darunter, nebeneinander statt einer Liste mit Pfeilen.
 *
 * Henrik (Feedback 21.09., Kasten 8.3): „Drei-Punkte-Menü (unten
 * eingeblendet): Link kopieren, herunterladen, zu Story hinzufügen, melden,
 * kein Interesse … Vorbild TikTok." Bis zum 28.09.2026 stand das Menü als
 * senkrechte Liste mit Chevron da (ActionSheet) — dieselben Einträge, aber
 * das Aussehen eines Einstellungsblatts, nicht das von TikTok.
 *
 * Die Reihenfolge ist Henriks Aufzählung (REIHENFOLGE). Wer einen Eintrag nicht
 * bekommt (kein Herunterladen erlaubt, eigener Beitrag ohne Melden), sieht die
 * übrigen in derselben Ordnung. Unten „Abbrechen" wie bei TikTok.
 *
 * Gegenstück auf der Website: openBeitragOptionen (`.optkachel`) in
 * web/public/app.js — dort dieselbe Reihenfolge.
 */

import React from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Druck } from './Druck';
import type { ActionSheetItem } from './ActionSheet';
import { colors, spacing, themenStyles, typography } from '../constants/design';

/** Henriks Aufzählung vom 21.09.2026. Unbekannte Schlüssel kommen ans Ende. */
export const REIHENFOLGE = ['link', 'sichern', 'story', 'melden', 'kein'];

export const ordnen = (items: ActionSheetItem[]): ActionSheetItem[] => {
  const rang = (k: string) => {
    const i = REIHENFOLGE.indexOf(k);
    return i < 0 ? REIHENFOLGE.length : i;
  };
  return [...items].sort((a, b) => rang(a.key) - rang(b.key));
};

interface Props {
  visible: boolean;
  items: ActionSheetItem[];
  /**
   * Zweiter Schritt (Meldegründe): lange Sätze passen unter keinen
   * Symbolkreis, also eine Liste mit Überschrift. Bewusst im SELBEN Modal —
   * zwei Modals, die sich auf iOS die Klinke in die Hand geben, lassen das
   * zweite oft gar nicht erscheinen.
   */
  liste?: { titel: string } | null;
  onSelect: (key: string) => void;
  onClose: () => void;
}

export const OptionenKacheln = ({ visible, items, liste, onSelect, onClose }: Props) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <Druck style={styles.backdrop} onPress={onClose} accessibilityLabel="Schließen" />
    <View style={styles.sheet}>
      <View style={styles.handle} />
      {/* Überschrift wie auf der Website (sheetKopf „Optionen"). */}
      <Text style={styles.titel}>{liste ? liste.titel : 'Optionen'}</Text>
      {liste ? (
        <View>
          {items.map((item) => (
            <Druck
              key={item.key}
              style={({ pressed }) => [styles.zeile, pressed && styles.zeileGedrueckt]}
              onPress={() => onSelect(item.key)}
              accessibilityRole="button"
            >
              <Text style={styles.zeileText}>{item.label}</Text>
            </Druck>
          ))}
        </View>
      ) : (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.reihe}
      >
        {ordnen(items).map((item) => (
          <Druck
            key={item.key}
            style={({ pressed }) => [styles.kachel, pressed && styles.gedrueckt]}
            onPress={() => onSelect(item.key)}
            accessibilityRole="button"
            accessibilityLabel={item.label}
          >
            <View style={[styles.kreis, item.gefahr && styles.kreisGefahr]}>
              <Ionicons name={item.icon} size={24} color={item.gefahr ? colors.danger : colors.text} />
            </View>
            {/* Ein einzelnes Wort („Herunterladen") bleibt auf einer Zeile und
                schrumpft notfalls ein wenig — sonst trennt iOS es mitten im Wort. */}
            <Text
              style={styles.text}
              numberOfLines={item.label.includes(' ') ? 2 : 1}
              adjustsFontSizeToFit={!item.label.includes(' ')}
              minimumFontScale={0.8}
            >
              {item.label}
            </Text>
          </Druck>
        ))}
      </ScrollView>
      )}
      <Druck style={styles.abbrechen} onPress={onClose} accessibilityRole="button">
        <Text style={styles.abbrechenText}>Abbrechen</Text>
      </Druck>
    </View>
  </Modal>
);

const styles = themenStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(6,8,12,0.52)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.xl,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  // Fünf Kacheln à 76 plus 2×8 Rand = 396: alle passen auf ein 402er-iPhone.
  reihe: { paddingHorizontal: spacing.sm },
  kachel: { width: 76, alignItems: 'center', paddingVertical: 4 },
  gedrueckt: { opacity: 0.6 },
  kreis: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  kreisGefahr: { backgroundColor: colors.surface2 },
  text: { ...typography.small, fontSize: 12, color: colors.text2, textAlign: 'center' },
  abbrechen: {
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
    paddingVertical: 13,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  abbrechenText: { ...typography.body, color: colors.text },
  titel: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 10,
    color: colors.text,
    ...typography.h3,
  },
  zeile: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  zeileGedrueckt: { backgroundColor: colors.surface2 },
  zeileText: { ...typography.body, color: colors.text },
}));
