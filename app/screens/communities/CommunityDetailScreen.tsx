import React, { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Motiv } from '../../components/Motiv';
import { colors, markenVerlauf, radius, spacing, themenStyles, typography } from '../../constants/design';
import { Community, Unterthema } from '../../types';

import { PushToTalk } from '../../components/PushToTalk';
import { CommunityOptionenSheet } from '../../components/CommunityOptionenSheet';
import { useProfil } from '../../contexts/ProfilContext';
import { ladePtt } from '../../lib/daten';
import { useSupabase } from '../../contexts/SupabaseContext';

interface Props {
  community: Community;
  onBack: () => void;
  /** Oeffnet den Chat eines Unterthemas. */
  onOpenUnterthema: (unterthema: Unterthema) => void;
  /**
   * Der Name und das "..." fuehren beide hierhin.
   *
   * Bis zum 02.09.2026 gab das nur einen Hinweistext aus, der die
   * Einstellungen ankuendigte und dann verschwand. Jetzt oeffnet der
   * Bildschirm sein eigenes Blatt — dasselbe, das die Website unter
   * openCommunityEinstellungen zeigt. Die Weiche nach aussen bleibt
   * trotzdem, damit App.tsx den Aufruf mitbekommt.
   */
  onEinstellungen: () => void;
  onBeitreten: () => void;
  onNeuesUnterthema: () => void;
  onNotice: (message: string) => void;
  /**
   * Das Mehr-Menue gleich beim Aufbau offen.
   *
   * Nur der Pruefschalter aus App.tsx setzt das, damit sich das Blatt
   * fotografieren laesst. Sonst liegt es hinter zwei Tipps und kommt in
   * keinem Bild vor.
   */
  optionenOffenStart?: boolean;
}

/**
 * Die Seite einer Community — Prototyp-Frame "CH + Kanal".
 *
 * Diesen Bildschirm gab es in der App bis zum 26.08.2026 gar nicht: eine
 * Community oeffnete direkt einen Gruppenchat. Henrik hat das als "Design ist
 * völlig falsch, geht am Prototyp vorbei" gemeldet.
 *
 * Der Frame gibt von oben nach unten vor:
 *
 *   ←                                   Zurueck-Pfeil, frei auf dem Bild
 *   [ grosses Kopfbild, 344x258 ]       also 4:3 bei fast voller Breite
 *   Name / Mitgliederzahl    [Knopf] …
 *   Biografie
 *   Link
 *   (+) neues Unterthema erstellen
 *   # Unterthema                        Zeilen ueber die volle Breite
 *   # Unterthema
 *
 * Dieselbe Seite gibt es in der Website unter renderCommunityChannels — beide
 * folgen demselben Frame, damit sie nicht wieder auseinanderlaufen.
 */
export const CommunityDetailScreen = ({
  community,
  onBack,
  onOpenUnterthema,
  onEinstellungen,
  onBeitreten,
  onNeuesUnterthema,
  onNotice,
  optionenOffenStart,
}: Props) => {
  const insets = useSafeAreaInsets();
  const unterthemen = community.unterthemen ?? [];
  const { kanalStummSetzen } = useProfil();
  const [optionenOffen, setOptionenOffen] = useState(Boolean(optionenOffenStart));

  const einstellungenOeffnen = () => {
    setOptionenOffen(true);
    onEinstellungen();
  };

  const linkOeffnen = async () => {
    const ziel = /^https?:\/\//i.test(community.link ?? '') ? community.link! : `https://${community.link}`;
    const geht = await Linking.canOpenURL(ziel);
    if (geht) Linking.openURL(ziel);
    else onNotice(community.link ?? '');
  };

  /*
   * Push-to-Talk. Das Handbuch beschreibt es als Nachricht an alle
   * Mitglieder einer Community — gedacht fuer Gruppenanrufe und fuer
   * Momente aussergewoehnlich hoher Aktivitaet. Bis zum 01.09.2026 gab es
   * dafuer nur einen Schalter in den Einstellungen.
   *
   * Der Knopf steht nur bei Mitgliedern. Wer nicht beigetreten ist, darf
   * nichts hineinsprechen — die Regeln der Datenbank lassen es ohnehin nicht
   * zu, und ein Knopf, der immer scheitert, ist schlimmer als keiner.
   */
  const { supabase } = useSupabase();
  const [ptt, setPtt] = useState<
    { id: string; name: string; dauer: number; zeit: string }[]
  >([]);

  const pttHolen = useCallback(async () => {
    if (!supabase || !(community.joined || community.eigen)) return;
    try {
      setPtt(await ladePtt(supabase, community.id));
    } catch (e: any) {
      console.error('Push-to-Talk laden fehlgeschlagen:', e?.message ?? e);
    }
  }, [supabase, community.id, community.joined, community.eigen]);

  useEffect(() => {
    pttHolen();
  }, [pttHolen]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <View style={styles.bild}>
          <Motiv
            id={`community-${community.id}`}
            icon="people-outline"
            iconSize={44}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
          {/* Der Pfeil liegt auf dem Bild, nicht darueber - so steht er im
              Frame. Der dunkle Kreis haelt ihn auf hellen Motiven lesbar. */}
          <Druck style={styles.zurueck} onPress={onBack} accessibilityLabel="Zurück" hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Druck>
        </View>

        <View style={styles.kopfzeile}>
          {/*
            Name und Mitgliederzahl untereinander. Im Frame stehen sie
            nebeneinander - dort ist der Name aber der Platzhalter "Name".
            Echte Namen wie "Design Systeme" wurden nebeneinander
            abgeschnitten, und das ist schlimmer als eine zweite Zeile.
          */}
          <Druck style={styles.titel} onPress={einstellungenOeffnen}>
            <Text style={styles.name} numberOfLines={1}>
              {community.name}
            </Text>
            <Text style={styles.mitglieder}>
              {community.members.toLocaleString('de-DE')} Mitglieder
            </Text>
          </Druck>

          {community.eigen ? (
            // Eine eigene Community laesst sich nicht verlassen - vorher
            // konnte Henrik sich aus seiner eigenen Community entfernen.
            <View style={styles.eigen}>
              <Text style={styles.eigenText}>Deine Community</Text>
            </View>
          ) : community.joined ? (
            <Druck style={styles.knopfLeise} onPress={onBeitreten}>
              <Text style={styles.knopfLeiseText}>Verlassen</Text>
            </Druck>
          ) : (
            <Druck onPress={onBeitreten}>
              <LinearGradient
                colors={markenVerlauf()}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.knopf}
              >
                <Text style={styles.knopfText}>
                  {community.visibility === 'private' ? 'Anfrage' : 'Beitreten'}
                </Text>
              </LinearGradient>
            </Druck>
          )}

          <Druck style={styles.mehr} onPress={einstellungenOeffnen} accessibilityLabel="Mehr" hitSlop={8}>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.text3} />
          </Druck>
        </View>

        {!!community.bio && <Text style={styles.bio}>{community.bio}</Text>}
        {!!community.link && (
          <Druck onPress={linkOeffnen}>
            <Text style={styles.link}>{community.link}</Text>
          </Druck>
        )}

        {(community.joined || community.eigen) && (
          <View style={styles.pttBlock}>
            <PushToTalk
              communityId={community.id}
              onNotice={onNotice}
              onGesendet={pttHolen}
            />
            {ptt.length > 0 && (
              <View style={styles.pttListe}>
                {ptt.slice(0, 5).map((p) => (
                  <View key={p.id} style={styles.pttZeile}>
                    <Ionicons name="volume-high-outline" size={15} color={colors.brand} />
                    <Text style={styles.pttName}>{p.name}</Text>
                    <Text style={styles.pttMeta}>
                      {p.dauer}s · {p.zeit}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <Druck style={styles.neu} onPress={onNeuesUnterthema}>
          <LinearGradient
            colors={markenVerlauf()}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.neuKreis}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.neuText}>neues Unterthema erstellen</Text>
        </Druck>

        <View>
          {unterthemen.map((ut) => (
            <Druck
              key={ut.id}
              style={({ pressed }) => [styles.thema, pressed && styles.themaPressed]}
              onPress={() => onOpenUnterthema(ut)}
            >
              <Text style={styles.themaName}># {ut.name}</Text>
              <Text style={styles.themaSub} numberOfLines={1}>
                {ut.themen.length ? ut.themen.join(' · ') : 'Noch keine Themen'}
              </Text>
            </Druck>
          ))}
        </View>
      </ScrollView>

      {optionenOffen && (
        <CommunityOptionenSheet
          community={community}
          onClose={() => setOptionenOffen(false)}
          onVerlassen={onBeitreten}
          onStumm={(stumm) => kanalStummSetzen(community.id, stumm)}
          onNotice={onNotice}
        />
      )}
    </View>
  );
};

const styles = themenStyles((colors) => ({
  pttBlock: { paddingHorizontal: '7.2%', paddingTop: spacing.md, gap: spacing.sm },
  pttListe: { gap: 4 },
  pttZeile: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pttName: { flex: 1, ...typography.small, color: colors.text },
  pttMeta: { ...typography.tiny, color: colors.text3 },

  screen: { flex: 1, backgroundColor: colors.surface },

  /* 4:3 wie im Frame (344 zu 258), mit Rand ringsum. */
  bild: {
    marginHorizontal: '7.2%',
    marginTop: spacing.md,
    aspectRatio: 344 / 258,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.surface3,
  },
  zurueck: {
    position: 'absolute',
    left: 10,
    top: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
  },

  kopfzeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: '7.2%',
    paddingTop: spacing.lg,
  },
  titel: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...typography.h2, color: colors.text },
  mitglieder: { ...typography.small, color: colors.text3 },

  knopf: { paddingHorizontal: 16, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  knopfText: { color: colors.white, fontSize: 14, fontWeight: '600' },
  knopfLeise: {
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  knopfLeiseText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  eigen: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
  },
  eigenText: { color: colors.brand, fontSize: 12, fontWeight: '600' },
  mehr: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  bio: {
    paddingHorizontal: '7.2%',
    paddingTop: spacing.md,
    color: colors.text2,
    fontSize: 14,
    lineHeight: 20,
  },
  link: { paddingHorizontal: '7.2%', paddingTop: 6, color: colors.brand, fontSize: 14 },

  neu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: '7.2%',
    paddingTop: spacing.xl,
    paddingBottom: 18,
  },
  neuKreis: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  neuText: { color: colors.text, fontSize: 14.5 },

  /* Die Unterthemen: breite Zeilen ueber die volle Breite, 68px hoch. */
  thema: {
    minHeight: 68,
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: '7.2%',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  themaPressed: { backgroundColor: colors.surface2 },
  themaName: { ...typography.name, color: colors.text },
  themaSub: { ...typography.small, color: colors.text3 },
}));
