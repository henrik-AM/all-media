import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import { EmptyState } from '../../components/EmptyState';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { OwnProfileHead } from '../../components/OwnProfileHead';
import { SwitchBar } from '../../components/SwitchBar';
import { colors, radius, spacing, themenStyles, typography } from '../../constants/design';
import { AreaKey } from '../../constants/navigation';
import { useDaten } from '../../contexts/DatenContext';
import { useProfil } from '../../contexts/ProfilContext';
import { Community } from '../../types';

interface Props {
  onSwitchArea: (area: AreaKey) => void;
  /**
   * Kasten 1.1 (Feedback 28.09.2026): „Profil wechseln" oeffnet die
   * Kontoliste und man landet danach wieder im Communitys-Profil — wie
   * Kasten 12.4 im Video-Profil. Bis zum 10.10.2026 fuehrte die Leiste hier
   * ueber onSwitchArea('messenger') ins Messenger-Profil.
   */
  onSwitchAccount?: () => void;
  /** Kasten 1.2: Antippen des eigenen Bilds aendert es (wie Kasten 12.5 in Videos). */
  onProfilbild?: () => void;
  onOpenCommunity: (community: Community) => void;
  /** Glocke, Plus und Menü oben rechts. */
  onAction: (key: string) => void;
  /** Fuehrt zum Formular, das Name, Info und Link aendert. */
  onBearbeiten: () => void;
  onAvatarPress?: () => void;
  onNotice: (message: string) => void;
}

/** Prototyp-Frame "Community - Profil": Erstellt und Beigetreten. */
export const CommunityProfileScreen = ({ onSwitchArea, onSwitchAccount, onProfilbild, onOpenCommunity, onAction, onBearbeiten, onAvatarPress, onNotice }: Props) => {
  // Nie mehr in den Messenger: ohne Kontoliste bleibt man hier stehen.
  const wechseln = () => (onSwitchAccount ? onSwitchAccount() : onNotice('Die Kontoliste ist gerade nicht erreichbar'));
  const { users: alleNutzer } = useDaten();
  // Die Liste kommt aus dem gemeinsamen Zustand, nicht mehr direkt aus den
  // Mock-Daten - sonst taucht ein neu erstellter Kanal hier nicht auf.
  const { communities, ungelesen, eigenesProfil } = useProfil();
  /*
   * "Erstellt" heisst: von mir angelegt. Bis zum 02.09.2026 stand hier
   * `visibility === 'private' && joined` — auf beiden Seiten dieselbe Weiche,
   * und auf beiden falsch. Eine selbst angelegte oeffentliche Community stand
   * damit unter "Beigetreten", eine fremde private unter "Erstellt". Die
   * Datenbank weiss es genau: `communities.created_by`, in beiden Ladewegen
   * bereits als `eigen` mitgeliefert.
   */
  const created = communities.filter((c) => c.eigen);
  const joined = communities.filter((c) => c.joined && !c.eigen);
  /*
   * Die Seite hinter "Erstellt →" bzw. "Beigetreten →". Bis zum 24.09.2026
   * gab die Ueberschrift nur einen Hinweis aus - Henrik am 21.09.: "Ueberall,
   * wo eine Ueberschrift mit Pfeil steht, muss sie auf die volle Uebersicht
   * fuehren." Die Website hatte die Seite schon (renderCommunityListe).
   */
  const [ansicht, setAnsicht] = useState<'erstellt' | 'beigetreten' | null>(null);

  const list = (items: Community[]) =>
    items.map((c) => (
      <Druck key={c.id} style={styles.row} onPress={() => onOpenCommunity(c)}>
        {/* Abgerundetes Quadrat, nicht Kreis: so unterscheidet die App eine
            Community von einer Person, und so steht es im Prototyp-Frame
            "Community - Profil". Hier war es als Einziges ein Kreis. */}
        <Avatar id={c.id} name={c.name} size={44} ecke={radius.lg} />
        <View style={styles.body}>
          <Text style={styles.name}>{c.name}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {c.topic} · {c.members.toLocaleString('de-DE')} Mitglieder
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text3} />
      </Druck>
    ));

  // Solange die Daten laden, gibt es das eigene Profil noch nicht.
  // Gleicher Fall wie in VideoProfileScreen.
  const ich = alleNutzer.me;
  if (!ich) {
    return <View style={styles.screen}><SwitchBar onPress={wechseln} /></View>;
  }

  if (ansicht) {
    const erstellt = ansicht === 'erstellt';
    const liste = erstellt ? created : joined;
    /*
     * Kasten 3.3 (Feedback 28.09.2026): „Wenn ich auf die dicke schwarze
     * Schrift mit dem Pfeil drücke … ist immer noch der Button Profil
     * wechseln." Die Leiste gehört nur aufs Profil selbst; diese Seite ist
     * eine eigene Seite mit Zurück-Pfeil — wie renderCommunityListe auf der
     * Website, die nie eine Leiste hatte.
     */
    return (
      <View style={styles.screen} testID="community-liste">
        <View style={styles.bar}>
          <Druck onPress={() => setAnsicht(null)} hitSlop={10} accessibilityLabel="Zurück zum Profil">
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Druck>
          <Text style={styles.barTitel} numberOfLines={1}>
            {erstellt ? 'Erstellte Communitys' : 'Beigetretene Communitys'}
          </Text>
        </View>
        {liste.length ? (
          <ScrollView contentContainerStyle={styles.content}>{list(liste)}</ScrollView>
        ) : (
          <EmptyState
            icon="people-outline"
            title={erstellt ? 'Noch nichts erstellt' : 'Noch nichts beigetreten'}
            text={
              erstellt
                ? 'Über das Plus oben rechts legst du eine eigene Community an.'
                : 'Unter „Suchen" findest du Communitys zum Beitreten.'
            }
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SwitchBar onPress={wechseln} />

      <ScrollView contentContainerStyle={styles.content}>
        <OwnProfileHead
          handle={ich.handle}
          stats={[
            { label: 'Erstellte Communitys', value: created.length },
            { label: 'Beigetretene Communitys', value: joined.length },
          ]}
          name={eigenesProfil.name}
          bio={eigenesProfil.bio}
          pronomen={eigenesProfil.pronomen}
          links={eigenesProfil.links}
          onNotice={onNotice}
          ungelesen={ungelesen('communities')}
          onAction={onAction}
          onBearbeiten={onBearbeiten}
          /*
           * Kasten 3.4/3.5: die Kacheln „Erstellte/Beigetretene Communitys"
           * öffnen dieselbe eigene Seite wie die Überschrift mit Pfeil. Bis zum
           * 10.10.2026 gaben sie nur ihre eigene Beschriftung als Hinweis aus.
           * Die Seite steht auch bei null Einträgen (dann mit Leertext) — die
           * Überschriften darunter gibt es dann gar nicht.
           */
          onStat={(label) => setAnsicht(label.startsWith('Erstellte') ? 'erstellt' : 'beigetreten')}
          onAvatarPress={onProfilbild ?? onAvatarPress ?? (() => onNotice('Dein Profilbild'))}
        />

        {created.length > 0 && (
          <Druck style={styles.sectionHeadPress} onPress={() => setAnsicht('erstellt')} accessibilityRole="button" accessibilityLabel="Erstellt, alle anzeigen">
            <Text style={styles.sectionHead}>Erstellt →</Text>
          </Druck>
        )}
        {list(created)}
        {joined.length > 0 && (
          <Druck style={styles.sectionHeadPress} onPress={() => setAnsicht('beigetreten')} accessibilityRole="button" accessibilityLabel="Beigetreten, alle anzeigen">
            <Text style={styles.sectionHead}>Beigetreten →</Text>
          </Druck>
        )}
        {list(joined)}
      </ScrollView>
    </View>
  );
};

const styles = themenStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingBottom: spacing.xl },
  bar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  barTitel: { flex: 1, ...typography.h3, fontSize: 17, color: colors.text },
  sectionHeadPress: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionHead: {
    ...typography.h3,
    color: colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
  },
  body: { flex: 1 },
  name: { ...typography.name, color: colors.text },
  sub: { ...typography.preview, color: colors.text2, marginTop: 2 },
}));
