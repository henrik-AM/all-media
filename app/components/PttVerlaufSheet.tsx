/**
 * Der Verlauf hinter einer Zeile „Push to Talk" — Kasten 8.6 (28.09.2026).
 *
 * Henrik: „… und da kann man dann drauf drücken und dann soll man den ganzen
 * Verlauf sehen können" — wer, wann, was.
 *
 *   wer   Name des Sprechers
 *   wann  Uhrzeit (Sekunden genau; das Datum steht im Kopf)
 *   was   die Aufnahme zum Abspielen, mit Dauer
 *
 * Gelesen wird ptt_messages mit sitzung_id = diese Zeile (Schema 90), unter
 * der Regel „PTT in eigenen Communitys lesen" — wer kein Mitglied ist oder
 * den Sprecher in den Einstellungen ausgenommen hat, sieht dessen Beitrag
 * nicht. Leer heisst dann ehrlich „Keine Wortmeldungen sichtbar".
 *
 * Gleiche Ansicht auf der Website: openPttVerlauf in web/public/app.js.
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { SheetRahmen } from './SheetRahmen';
import { Druck } from './Druck';
import { Avatar } from './Avatar';
import { colors, spacing, themenStyles, typography } from '../constants/design';
import { useSupabase } from '../contexts/SupabaseContext';
import { ladePttSitzung } from '../lib/daten';
import { aktiveWiedergabe, wiedergabeModusSetzen } from '../lib/tonModus';

const Ptt = require('../../gemeinsam/ptt') as typeof import('../../gemeinsam/ptt');

type Eintrag = { id: string; userId: string; name: string; audioUrl: string; dauer: number; zeitpunkt: string };

interface Props {
  /** Die id der Zeile „Push to Talk" = die Sitzung. */
  sitzungId: string;
  /** Zeitpunkt der Zeile, fuer Datum und Uhrzeit im Kopf. */
  zeitpunkt?: string;
  onClose: () => void;
}

/** Eine Wortmeldung mit eigenem Spieler — so laeuft nie mehr als eine. */
const Wortmeldung = ({ e }: { e: Eintrag }) => {
  const spieler = useAudioPlayer(e.audioUrl ? { uri: e.audioUrl } : undefined);
  const status = useAudioPlayerStatus(spieler);
  const laeuft = status.playing;

  useEffect(() => {
    const schluessel = `ptt-${e.id}`;
    aktiveWiedergabe(schluessel, laeuft);
    return () => aktiveWiedergabe(schluessel, false);
  }, [laeuft, e.id]);

  const umschalten = async () => {
    if (!e.audioUrl) return;
    if (status.playing) return spieler.pause();
    await wiedergabeModusSetzen();
    if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.3)) spieler.seekTo(0);
    spieler.play();
  };

  return (
    <View style={styles.zeile}>
      <Avatar id={e.userId} name={e.name || '?'} size={36} />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {e.name || 'Unbekannt'}
        </Text>
        <Text style={styles.meta}>
          {Ptt.uhrzeit(e.zeitpunkt)} · {Ptt.dauer(e.dauer)}
        </Text>
      </View>
      <Druck
        style={styles.play}
        onPress={umschalten}
        accessibilityLabel={`${laeuft ? 'Pause' : 'Abspielen'}: ${e.name || 'Wortmeldung'} ${Ptt.uhrzeit(e.zeitpunkt)}`}
        hitSlop={6}
      >
        <Ionicons name={laeuft ? 'pause' : 'play'} size={18} color={colors.white} />
      </Druck>
    </View>
  );
};

export const PttVerlaufSheet = ({ sitzungId, zeitpunkt, onClose }: Props) => {
  const { supabase } = useSupabase();
  const [eintraege, setEintraege] = useState<Eintrag[] | null>(null);
  const [fehler, setFehler] = useState(false);

  useEffect(() => {
    let aktiv = true;
    if (!supabase) return;
    ladePttSitzung(supabase, sitzungId)
      .then((liste) => aktiv && setEintraege(liste as Eintrag[]))
      .catch((e: any) => {
        console.error('Push-to-Talk-Verlauf laden fehlgeschlagen:', e?.message ?? e);
        if (aktiv) setFehler(true);
      });
    return () => {
      aktiv = false;
    };
  }, [supabase, sitzungId]);

  return (
    <SheetRahmen visible title={Ptt.TITEL} onClose={onClose} hoch>
      <Text style={styles.kopf}>{Ptt.datumZeit(zeitpunkt)}</Text>
      {fehler ? (
        <Text style={styles.leer}>Der Verlauf ließ sich nicht laden</Text>
      ) : eintraege === null ? (
        <ActivityIndicator style={styles.laden} color={colors.text3} />
      ) : eintraege.length === 0 ? (
        <Text style={styles.leer}>{Ptt.LEER}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.liste}>
          {eintraege.map((e) => (
            <Wortmeldung key={e.id} e={e} />
          ))}
        </ScrollView>
      )}
    </SheetRahmen>
  );
};

const styles = themenStyles((colors) => ({
  kopf: { ...typography.small, color: colors.text2, textAlign: 'center', marginBottom: spacing.sm },
  laden: { marginTop: spacing.xl },
  leer: { ...typography.body, color: colors.text3, textAlign: 'center', marginTop: spacing.xl },
  liste: { paddingBottom: spacing.lg },
  zeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  text: { flex: 1 },
  name: { ...typography.name, color: colors.text },
  meta: { ...typography.tiny, color: colors.text3, marginTop: 2 },
  play: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
}));
