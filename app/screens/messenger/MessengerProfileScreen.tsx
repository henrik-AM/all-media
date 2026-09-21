import React, { useContext, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { AuthContext } from '../../contexts/AuthContext';
import { SwitchBar } from '../../components/SwitchBar';
import { SichtbarkeitSheet } from '../../components/SichtbarkeitSheet';
import { colors, sizes, spacing, themenStyles, typography } from '../../constants/design';
import { AreaKey } from '../../constants/navigation';
import { useProfil } from '../../contexts/ProfilContext';
import { useDaten } from '../../contexts/DatenContext';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useEinstellungen } from '../../contexts/EinstellungenContext';
import { SichtbarkeitBereich, SichtbarkeitStufe } from '../../lib/aktionen';
import { useAktionen } from '../../lib/useAktionen';

interface Props {
  onSwitchArea: (area: AreaKey) => void;
  /** Oeffnet die Kontoliste (anderes eigenes Konto). */
  onSwitchAccount: () => void;
  onOpenSettings: () => void;
  /** Fuehrt zum Formular, das Name, Info und Link aendert. */
  onBearbeiten: () => void;
  onAvatarPress?: () => void;
  onNotice: (message: string) => void;
}

/**
 * Prototyp-Frame "Messenger - Profil": Leiste „Profil wechseln", Bild links
 * neben Name und Biografie, die beiden Profilverweise, dann der Abschnitt
 * Einstellungen.
 */
export const MessengerProfileScreen = ({ onSwitchArea, onSwitchAccount, onOpenSettings, onBearbeiten, onAvatarPress, onNotice }: Props) => {
  const { user } = useContext(AuthContext);
  /*
   * Name und Info kommen aus demselben Zustand wie im Videos- und
   * Community-Profil. Vorher stand hier "user.profile.about" - das ist der
   * Begruessungstext des Kontos ("Hey, ich nutze All Media!"), nicht die
   * Info, die "Profil bearbeiten" aendert. Auf diesem Bildschirm stand
   * deshalb etwas anderes als auf den beiden anderen.
   */
  const { eigenesProfil } = useProfil();

  /*
   * DIE DREI EINSTELLUNGEN AUF DIESER SEITE (Stand 09.09.2026)
   *
   * Henrik am 07.09.2026: „Profilseiten-Einstellungen (nur 3) mit echter
   * Einstellungsseite synchron halten." Vorher waren es drei Beschriftungen
   * ohne Inhalt: rechts stand nichts, und jedes Antippen sprang nur in die
   * Einstellungen. Ob die Standort-Sichtbarkeit gerade auf „Alle" oder auf
   * „Niemand" stand, war hier nicht zu sehen.
   *
   * Jetzt lesen sie aus derselben Quelle wie die Einstellungsseite —
   * `sichtbarkeit` aus dem DatenContext und `user_settings` — und schreiben
   * ueber dieselben Aktionen zurueck. Es ist kein zweiter Satz Schalter,
   * sondern derselbe an einer zweiten Stelle.
   */
  const { sichtbarkeit, ichId, neuLaden } = useDaten();
  const { supabase } = useSupabase();
  const aktionen = useAktionen(onNotice);
  /*
   * Seit dem 17.09.2026 aus dem `EinstellungenContext`. Vorher lud dieser
   * Bildschirm dieselbe Zeile ein zweites Mal — wer die Lesebestaetigung
   * hier umlegte, sah sie in den Einstellungen bis zum Neustart falsch.
   */
  const { einstellungen, an, setzen } = useEinstellungen();
  const [sichtOffen, setSichtOffen] = useState<{ bereich: SichtbarkeitBereich; titel: string } | null>(null);

  const sicht = (bereich: SichtbarkeitBereich) =>
    sichtbarkeit[bereich] || { stufe: 'alle' as SichtbarkeitStufe, ausnahmen: [] };

  /** Was rechts neben dem Punkt steht — wortgleich mit den Einstellungen. */
  const sichtText = (bereich: SichtbarkeitBereich) => {
    const s = sicht(bereich);
    const namen: Record<string, string> = {
      niemand: 'Niemand',
      niemand_bis_auf: 'Niemand bis auf …',
      alle_bis_auf: 'Alle bis auf …',
      alle: 'Alle',
    };
    const zahl = s.ausnahmen.length;
    return zahl && s.stufe !== 'alle' && s.stufe !== 'niemand'
      ? `${namen[s.stufe]} (${zahl})`
      : namen[s.stufe];
  };

  // Ohne Eintrag ist die Lesebestaetigung an - der Auslieferungszustand steht
  // in SCHALTER_STANDARD im EinstellungenContext.
  const lesebestaetigung = an('lesebestaetigung');

  const lesebestaetigungSetzen = async (ein: boolean) => {
    const gespeichert = await setzen('lesebestaetigung', ein ? 'an' : 'aus');
    if (!gespeichert) onNotice?.('Einstellung konnte nicht gespeichert werden');
  };

  return (
  <View style={styles.screen}>
    {/* Fuehrt zur Kontoliste - hier hat Henrik den Kontowechsel gesucht. */}
    <SwitchBar onPress={onSwitchAccount} />

    <ScrollView contentContainerStyle={styles.content}>
      {/*
        * DER KOPF (Stand 09.09.2026)
        *
        * Henrik am 07.09.2026: „Obere Haelfte wirkt gequetscht (Vorbild
        * Instagram/WhatsApp)." Vorher stand die Biografie in einer schmalen
        * Spalte rechts neben dem Bild — bei drei Zeilen Text wurde daraus
        * ein Block aus Wortfetzen, und Bild, Text und Knopf klebten
        * aneinander.
        *
        * Jetzt wie bei Instagram: oben die Zeile mit Bild und Namen, darunter
        * die Biografie ueber die volle Breite, dann der Knopf. Der Text hat
        * die ganze Breite, und zwischen den drei Teilen ist Luft.
        */}
      <View style={styles.head}>
        <Druck disabled={!onAvatarPress} onPress={onAvatarPress}>
          <Avatar id={user?.profile.id ?? 'me'} name={eigenesProfil.name} size={sizes.avatarXl} />
        </Druck>
        <View style={styles.headText}>
          <Text style={styles.name} numberOfLines={1}>{eigenesProfil.name}</Text>
          {!!user?.profile.handle && (
            <Text style={styles.handle} numberOfLines={1}>{user.profile.handle}</Text>
          )}
        </View>
      </View>

      {!!eigenesProfil.bio && <Text style={styles.bio}>{eigenesProfil.bio}</Text>}

      {/* Punkt 19: "Profil bearbeiten" gab es nur im Videos-Profil. Die
          Website hat den Knopf laengst an allen dreien, hier fehlte er.
          Seit dem 09.09.2026 oeffnet er ein kleines Blatt statt in die
          Einstellungen zu springen (siehe App.tsx, profilBearbeiten). */}
      <Druck style={styles.bearbeiten} onPress={onBearbeiten}>
        <Text style={styles.bearbeitenText}>Profil bearbeiten</Text>
      </Druck>

      <View style={styles.links}>
        <Druck style={styles.linkPille} onPress={() => onSwitchArea('videos')}>
          <Text style={styles.link}>@videoprofil</Text>
        </Druck>
        <Druck style={styles.linkPille} onPress={() => onSwitchArea('communities')}>
          <Text style={styles.link}>@communityprofil</Text>
        </Druck>
      </View>

      <Druck style={styles.sectionLink} onPress={onOpenSettings}>
        <Text style={styles.sectionLinkText}>Einstellungen</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.text} />
      </Druck>

      <View style={styles.group}>
        <Druck
          style={styles.item}
          onPress={() => setSichtOffen({ bereich: 'standort', titel: 'Standort-Sichtbarkeit' })}
        >
          <Text style={styles.itemLabel}>Standort-Sichtbarkeit</Text>
          <Text style={styles.itemValue}>{sichtText('standort')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.text3} />
        </Druck>

        <Druck
          style={styles.item}
          onPress={() => setSichtOffen({ bereich: 'story', titel: 'Story-Sichtbarkeit' })}
        >
          <Text style={styles.itemLabel}>Story-Sichtbarkeit</Text>
          <Text style={styles.itemValue}>{sichtText('story')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.text3} />
        </Druck>

        {/* Ein Schalter, kein Pfeil: in den Einstellungen ist es auch einer.
            Solange die Werte noch geladen werden, bleibt er aus dem Weg —
            ein Schalter, der gleich umspringt, ist eine Falschaussage. */}
        <View style={styles.item}>
          <Text style={styles.itemLabel}>Lesebestätigung</Text>
          {einstellungen === null ? (
            <Text style={styles.itemValue}>…</Text>
          ) : (
            <Switch
              value={lesebestaetigung}
              onValueChange={(an) => void lesebestaetigungSetzen(an)}
              trackColor={{ false: colors.border, true: colors.brand }}
            />
          )}
        </View>
      </View>
    </ScrollView>

    {/*
      * Dasselbe Blatt wie in den Einstellungen, mit denselben Aktionen —
      * damit „synchron" nicht heisst, dass zwei Stellen dasselbe nachbauen.
      */}
    {sichtOffen && (
      <SichtbarkeitSheet
        visible
        titel={sichtOffen.titel}
        stufe={sicht(sichtOffen.bereich).stufe}
        ausnahmen={sicht(sichtOffen.bereich).ausnahmen}
        onStufe={async (stufe) => {
          await aktionen.sichtbarkeit(sichtOffen.bereich, stufe, () => {});
          await neuLaden();
        }}
        onAusnahme={async (userId) => {
          await aktionen.sichtbarkeitAusnahme(sichtOffen.bereich, userId, () => {});
          await neuLaden();
        }}
        inVideos={sichtOffen.bereich === 'story' ? sicht('story').inVideos : undefined}
        onInVideos={
          sichtOffen.bereich === 'story'
            ? async (an: boolean) => {
                await aktionen.storyInVideos(an, () => {});
                await neuLaden();
              }
            : undefined
        }
        onClose={() => setSichtOffen(null)}
      />
    )}
  </View>
  );
};

const styles = themenStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingBottom: spacing.xl },
  head: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md },
  headText: { flex: 1 },
  name: { fontSize: 21, fontWeight: '700', color: colors.text },
  handle: { ...typography.message, color: colors.text2, marginTop: 2 },
  /* Die Biografie steht ueber die volle Breite unter dem Kopf, nicht mehr in
     der schmalen Spalte daneben. */
  bio: { ...typography.message, color: colors.text, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  /* Derselbe Knopf wie in OwnProfileHead, damit die drei Profile nicht
     unterschiedlich aussehen. */
  bearbeiten: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  bearbeitenText: { fontSize: 14, fontWeight: '600', color: colors.text, letterSpacing: -0.1 },
  links: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  /* Die beiden Profilverweise waren blosser fetter Text nebeneinander — dass
     man sie antippen kann, sah man ihnen nicht an. */
  linkPille: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  link: { fontSize: 14, fontWeight: '700', color: colors.text },
  sectionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: 14,
    paddingBottom: spacing.sm,
  },
  sectionLinkText: { fontSize: 15, fontWeight: '700', color: colors.text },
  group: { backgroundColor: colors.surface },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    height: 54,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemLabel: { ...typography.body, color: colors.text, flex: 1 },
  itemValue: { ...typography.body, color: colors.text2 },
}));
