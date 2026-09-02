/**
 * Das Mehr-Menü einer Community.
 *
 * WARUM ES DAS GIBT
 *
 * Der Name oben und das „…" daneben führten in der App bis zum 02.09.2026
 * beide auf `onNotice("Einstellungen zu ‚…'")` — ein Hinweis, der die
 * Einstellungen ankündigt und dann verschwindet. Auf der Website gab es das
 * Blatt längst (`openCommunityEinstellungen`); die App hatte es nie.
 *
 * Der Aufbau folgt deshalb genau dem der Website, damit dieselbe Community
 * auf beiden Seiten dasselbe anbietet: Mitglieder, Sichtbarkeit,
 * Benachrichtigungen, verlassen.
 *
 * Der Schalter „Benachrichtigungen" war auf der Website Zierde — er legte
 * eine CSS-Klasse um und vergaß sie beim Schließen. Er hängt jetzt auf
 * beiden Seiten an `community_members.is_muted`.
 */

import React, { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Druck } from './Druck';
import { SheetRahmen } from './SheetRahmen';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';
import { useAktionen } from '../lib/useAktionen';
import { Community } from '../types';

interface Props {
  community: Community;
  onClose: () => void;
  /** Verlassen läuft über denselben Weg wie der Knopf im Kopf. */
  onVerlassen: () => void;
  /** Der neue Stumm-Zustand, damit die Liste außen ihn übernimmt. */
  onStumm: (stumm: boolean) => void;
  onNotice: (message: string) => void;
}

export const CommunityOptionenSheet = ({
  community,
  onClose,
  onVerlassen,
  onStumm,
  onNotice,
}: Props) => {
  const aktionen = useAktionen(onNotice);
  const [stumm, setStumm] = useState(Boolean(community.stumm));
  const [laeuft, setLaeuft] = useState(false);

  const umschalten = async () => {
    if (laeuft) return;
    setLaeuft(true);
    // Sofort umlegen, damit der Schalter nicht hängt — und zurückdrehen,
    // wenn die Datenbank nein sagt.
    const vorher = stumm;
    setStumm(!vorher);
    const jetzt = await aktionen.communityStumm(community.id);
    setLaeuft(false);
    if (jetzt === null) return setStumm(vorher);
    setStumm(jetzt);
    onStumm(jetzt);
    onNotice(jetzt ? 'Benachrichtigungen aus' : 'Benachrichtigungen an');
  };

  return (
    <SheetRahmen visible title={community.name} onClose={onClose}>
      <View>
        <View style={styles.zeile}>
          <View style={styles.symbol}>
            <Ionicons name="people-outline" size={18} color={colors.text2} />
          </View>
          <View style={styles.textBlock}>
            <Text style={styles.label}>Mitglieder</Text>
            <Text style={styles.neben}>
              {community.members.toLocaleString('de-DE')} in dieser Community
            </Text>
          </View>
        </View>

        <View style={styles.zeile}>
          <View style={styles.symbol}>
            {/* Ein Schloss neben "Öffentlich" widerspricht sich selbst. */}
            <Ionicons
              name={community.visibility === 'private' ? 'lock-closed-outline' : 'globe-outline'}
              size={18}
              color={colors.text2}
            />
          </View>
          <View style={styles.textBlock}>
            <Text style={styles.label}>Sichtbarkeit</Text>
            <Text style={styles.neben}>
              {community.visibility === 'private' ? 'Privat — nur auf Anfrage' : 'Öffentlich'}
            </Text>
          </View>
        </View>

        {/*
          Nur für Mitglieder. Wer nicht drin ist, hat keine Zeile in
          community_members — das UPDATE träfe nichts, und ein Schalter, der
          sich nicht merken lässt, ist schlimmer als keiner.
        */}
        {(community.joined || community.eigen) && (
          <View style={styles.zeile}>
            <View style={styles.symbol}>
              <Ionicons name="notifications-outline" size={18} color={colors.text2} />
            </View>
            <Text style={styles.label}>Benachrichtigungen</Text>
            {/* Markenfarbe wie in den Einstellungen — der Grundzustand des
                iOS-Schalters ist gruen und faellt sonst aus der App heraus. */}
            <Switch
              value={!stumm}
              onValueChange={umschalten}
              disabled={laeuft}
              trackColor={{ true: colors.brand, false: colors.surface3 }}
            />
          </View>
        )}

        {/*
          Eine eigene Community lässt sich nicht verlassen — sie stünde sonst
          ohne Besitzer da. Genau wie im Kopf des Bildschirms.
        */}
        {community.joined && !community.eigen && (
          <Druck
            style={({ pressed }) => [styles.zeile, pressed && styles.gedrueckt]}
            onPress={() => {
              onClose();
              onVerlassen();
            }}
          >
            <View style={styles.symbol}>
              <Ionicons name="close-outline" size={18} color={colors.danger} />
            </View>
            <Text style={[styles.label, styles.gefahr]}>Community verlassen</Text>
          </Druck>
        )}
      </View>
    </SheetRahmen>
  );
};

const styles = themenStyles((colors) => ({
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
  textBlock: { flex: 1 },
  label: { flex: 1, ...typography.body, color: colors.text },
  neben: { ...typography.small, color: colors.text2, marginTop: 2 },
  gefahr: { color: colors.danger },
}));
