/**
 * Die Ordneransicht einer Playlist — Kasten 17.2.
 *
 * Henrik am 01.10.2026: „Playlists, stell dir so vor wie ein Ordner mit
 * speziellen Beiträgen. Zum Beispiel eine Gaming-Playlist: wenn man da drauf
 * drückt, ist man in einer Ansicht, wo nur Gaming-Videos von diesem Account
 * sind."
 *
 * Kopf mit Titel, darunter „Playlist · N Beiträge", dann das Raster nur mit
 * den Beiträgen dieser Playlist. Ein Tipp öffnet den Beitrag. Dieselbe
 * Ansicht für das eigene und das fremde Profil; was nur der Besitzer darf
 * (Titelbild, Löschen, Herausnehmen), reicht der Aufrufer über `kopfRechts`,
 * `onLangDruck` und `children` herein. Im fremden Profil bleiben die leer.
 *
 * Beim eigenen Highlight ist es die Bearbeiten-Ansicht (aus dem Betrachter
 * über „Highlight bearbeiten"), dort mit Storys statt Beiträgen.
 *
 * Gegenstück auf der Website: renderSammlung() in web/public/app.js.
 */

import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Druck } from './Druck';
import { Motiv } from './Motiv';
import { EmptyState } from './EmptyState';
import { colors, spacing, themenStyles, typography } from '../constants/design';
import { useKachelHoehe } from '../lib/raster';
import * as Aktion from '../lib/aktionen';
import { FarbfilterSchicht } from './Farbfilter';

const SammlungRegel = require('../../gemeinsam/sammlungen') as typeof import('../../gemeinsam/sammlungen');

interface Props {
  offen: { sammlung: Aktion.Sammlung; kacheln: Aktion.Rasterkachel[] } | null;
  onClose: () => void;
  onKachel: (kachel: Aktion.Rasterkachel) => void;
  /** Nur im eigenen Profil: langes Drücken, etwa zum Herausnehmen. */
  onLangDruck?: (kachel: Aktion.Rasterkachel) => void;
  /** Knöpfe rechts im Kopf — nur im eigenen Profil (Titelbild, Löschen). */
  kopfRechts?: React.ReactNode;
  /** Eine Zeile unter dem Kopf, z. B. der Hinweis im Titelbild-Wahlmodus. */
  hinweis?: string | null;
  /** Kachel mit Rahmen in der Ringfarbe: das gewählte Titelbild. */
  hervorheben?: (kachel: Aktion.Rasterkachel) => boolean;
  /** Der Text, wenn nichts darin liegt. */
  leerText?: string;
  /** Blätter, die über dieser Ansicht aufgehen müssen (im selben Modal). */
  children?: React.ReactNode;
}

export const SammlungOrdner = ({
  offen,
  onClose,
  onKachel,
  onLangDruck,
  kopfRechts,
  hinweis,
  hervorheben,
  leerText,
  children,
}: Props) => {
  const kachelHoehe = useKachelHoehe();
  const insets = useSafeAreaInsets();
  const s = offen?.sammlung;

  return (
    <Modal visible={offen !== null} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.screen} testID="sammlung-ordner">
        {/* statusBarTranslucent: ohne insets.top lag der Titel unter der Uhrzeit. */}
        <View style={[styles.kopf, { paddingTop: insets.top + spacing.sm }]}>
          <Druck onPress={onClose} style={styles.knopf} accessibilityLabel="Zurück zum Profil">
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Druck>
          <View style={styles.titelBlock}>
            <Text style={styles.titel} numberOfLines={1}>
              {s?.name ?? ''}
            </Text>
            {/* Die Zahl aus dem Raster selbst, nicht aus dem Kreis: was die
                Datenbank nicht herausgibt (privates Konto, gelöschter
                Beitrag), steht auch nicht im Raster. */}
            <Text style={styles.untertitel} testID="sammlung-untertitel">
              {s ? SammlungRegel.untertitel(s.art, offen?.kacheln.length ?? 0) : ''}
            </Text>
          </View>
          {kopfRechts}
        </View>
        {hinweis ? <Text style={styles.hinweis}>{hinweis}</Text> : null}
        {offen && offen.kacheln.length > 0 ? (
          <ScrollView contentContainerStyle={styles.inhalt}>
            <View style={styles.grid}>
              {offen.kacheln.map((k) => (
                <Druck
                  key={k.id}
                  testID="sammlung-kachel"
                  style={[
                    styles.kachel,
                    { height: kachelHoehe },
                    hervorheben?.(k) && s
                      ? { borderColor: SammlungRegel.ringfarbe(s.art), borderWidth: 3 }
                      : null,
                  ]}
                  onPress={() => onKachel(k)}
                  onLongPress={onLangDruck ? () => onLangDruck(k) : undefined}
                >
                  <Motiv
                    id={k.id}
                    bild={k.thumbnail ?? k.mediaUrl ?? undefined}
                    icon={k.kind === 'post' || k.kind === 'story' ? 'image-outline' : 'play-outline'}
                    iconSize={20}
                    style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                  />
                </Druck>
              ))}
            </View>
          </ScrollView>
        ) : (
          <EmptyState
            icon={s?.art === 'playlist' ? 'play-outline' : 'albums-outline'}
            title="Noch nichts darin"
            text={leerText}
          />
        )}
      </View>
      {children}
      {/* Kasten 21: Vollbild-Fenster — Farbfilter-Fläche als letztes Kind. */}
      <FarbfilterSchicht />
    </Modal>
  );
};

const styles = themenStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  kopf: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    paddingRight: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  knopf: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  titelBlock: { flex: 1 },
  titel: { ...typography.h3, color: colors.text },
  untertitel: { ...typography.small, color: colors.text2, marginTop: 2 },
  hinweis: { ...typography.small, color: colors.text2, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  inhalt: { paddingBottom: spacing.xl },
  // Wie im Profilraster: Abstand ueber einen Rand, damit drei Spalten passen.
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  kachel: {
    width: '33.333%',
    borderWidth: 1,
    borderColor: colors.surface,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
}));
