import React, { useContext, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from './Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { SheetRahmen } from './SheetRahmen';
import { SichtbarkeitSheet } from './SichtbarkeitSheet';
import { useProfil } from '../contexts/ProfilContext';
import { colors, radius, sizes, spacing, themenStyles, typography } from '../constants/design';
import { useDaten } from '../contexts/DatenContext';
import { useSupabase } from '../contexts/SupabaseContext';
import { AuthContext } from '../contexts/AuthContext';
import { useAktionen } from '../lib/useAktionen';
import * as Aktion from '../lib/aktionen';
import { Story } from '../types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const GRUENDE = [
  'Spam oder Werbung',
  'Beleidigung oder Hass',
  'Gefälschtes Profil',
  'Nicht jugendfreie Inhalte',
  'Etwas anderes',
];

/* --------------------------------------------------- Wer sie gesehen hat */

interface AnsichtenProps {
  story: Story;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
}

/**
 * Prototyp: bei der eigenen Story steht unten „Ansichten" statt eines
 * Antwortfelds. Vorher kam dort nur ein Hinweis.
 *
 * Wer sie gesehen hat, kommt seit dem 09.09.2026 aus public.story_views.
 * Davor rechnete das Sheet die Liste aus den eigenen Kontakten und der
 * Aufnahmezeit aus: die Namen waren erfunden, und die Zahl wuchs mit dem
 * Alter der Story statt mit den Zuschauern.
 */
export const StoryAnsichtenSheet = ({ story, onClose, onOpenProfile }: AnsichtenProps) => {
  const { users: alleNutzer } = useDaten();
  const { supabase } = useSupabase();
  const { user } = useContext(AuthContext);
  const nutzerId = user?.id ?? '';
  const [seher, setSeher] = useState<Aktion.StorySeher[]>([]);
  const [laedt, setLaedt] = useState(true);

  useEffect(() => {
    let gilt = true;
    if (!supabase || !story.id) return;
    setLaedt(true);
    Aktion.storyAnsichten(supabase, story.id, nutzerId)
      .then((liste) => {
        if (!gilt) return;
        setSeher(liste);
        setLaedt(false);
      })
      .catch(() => {
        if (gilt) setLaedt(false);
      });
    return () => {
      gilt = false;
    };
  }, [supabase, story.id, nutzerId]);

  return (
    <SheetRahmen
      visible
      title={laedt ? 'Ansichten' : `${seher.length} ${seher.length === 1 ? 'Ansicht' : 'Ansichten'}`}
      onClose={onClose}
      hoch={seher.length > 5}
    >
      {laedt ? (
        <Text style={styles.hinweis}>Wird geladen …</Text>
      ) : seher.length === 0 ? (
        <Text style={styles.hinweis}>Noch hat niemand deine Story gesehen.</Text>
      ) : (
        <ScrollView>
          {seher.map((v) => {
            // Bekannte Person mit ihrem Namen aus dem Bestand, sonst mit dem,
            // was an der Ansicht steht.
            const person = alleNutzer[v.id];
            const name = person?.name || v.name;
            return (
              <Druck
                key={v.id}
                style={({ pressed }) => [styles.zeile, pressed && styles.gedrueckt]}
                onPress={() => {
                  onClose();
                  onOpenProfile(v.id);
                }}
              >
                <Avatar id={v.id} name={name} size={sizes.avatarSm} />
                <Text style={styles.label}>{name}</Text>
                <Text style={styles.neben}>{person?.handle || v.handle}</Text>
              </Druck>
            );
          })}
        </ScrollView>
      )}
    </SheetRahmen>
  );
};

/* ------------------------------------------------------------ Mehr-Menü */

interface OptionenProps {
  story: Story;
  eigene: boolean;
  onClose: () => void;
  onDelete: () => void;
  onNotice: (message: string) => void;
}

export const StoryOptionenSheet = ({ story, eigene, onClose, onDelete, onNotice }: OptionenProps) => {
  const { users: alleNutzer, sichtbarkeit, neuLaden } = useDaten();
  const { stummSchalten, melden } = useProfil();
  const { supabase } = useSupabase();
  const { user } = useContext(AuthContext);
  const nutzerId = user?.id ?? '';
  const aktionen = useAktionen(onNotice);
  const { medienSichern } = aktionen;
  const [meldeSchritt, setMeldeSchritt] = useState(false);
  /*
   * Henrik, 07.09.2026: "Eigene-Story-Menü (3 Punkte) ohne Funktion."
   *
   * Von den drei Punkten war einer eine Sackgasse: „Wer darf sie sehen"
   * meldete nur „steht in den Einstellungen unter Chats" und schloss sich
   * wieder. Ein Menüpunkt, der einem sagt, wo man selbst nachsehen soll, ist
   * kein Menüpunkt. Er öffnet jetzt dieselbe Sichtbarkeitswahl, die auch in
   * den Einstellungen steht — vier Stufen, Ausnahmeliste, und der Zusatz
   * „Story auch in Videos teilen" (Schema 30).
   */
  const [sichtOffen, setSichtOffen] = useState(false);
  const person = alleNutzer[story.userId];

  /*
   * "Auf dem Geraet sichern" stand nur bei der eigenen Story. Die
   * Einstellung "Downloadeinstellungen" hatte damit nichts, worueber sie
   * haette entscheiden koennen.
   *
   * Jetzt steht der Punkt auch bei fremden Storys — aber nur, wenn die
   * Person es zulaesst. Gefragt wird, bevor das Blatt gezeichnet ist: ein
   * Knopf, der beim Antippen "darfst du nicht" sagt, ist die schlechtere
   * Antwort als einer, der gar nicht erst dasteht.
   */
  const [darfSichern, setDarfSichern] = useState(eigene);

  useEffect(() => {
    if (eigene || !supabase || !nutzerId || !story.mediaUri) return;
    let abgebrochen = false;
    Aktion.darfHerunterladen(supabase, story.userId, nutzerId)
      .then((erlaubt) => {
        if (!abgebrochen) setDarfSichern(erlaubt);
      })
      .catch(() => setDarfSichern(false));
    return () => {
      abgebrochen = true;
    };
  }, [eigene, supabase, nutzerId, story.userId, story.mediaUri]);

  const punkte: { key: string; label: string; icon: IconName; gefahr?: boolean }[] = eigene
    ? [
        { key: 'sichtbar', label: 'Wer darf sie sehen', icon: 'eye-outline' },
        { key: 'sichern', label: 'Auf dem Gerät sichern', icon: 'bookmark-outline' },
        { key: 'loeschen', label: 'Story löschen', icon: 'trash-outline', gefahr: true },
      ]
    : [
        { key: 'link', label: 'Link kopieren', icon: 'link-outline' },
        ...(darfSichern
          ? [{ key: 'sichern', label: 'Auf dem Gerät sichern', icon: 'bookmark-outline' as IconName }]
          : []),
        { key: 'stumm', label: `${person?.name ?? 'Diese Person'} stummschalten`, icon: 'volume-mute-outline' as IconName },
        { key: 'melden', label: 'Story melden', icon: 'shield-outline' as IconName, gefahr: true },
      ];

  const waehlen = (key: string) => {
    if (key === 'loeschen') {
      onDelete();
      return onClose();
    }
    if (key === 'sichern') {
      // Hier stand die Meldung "Story gesichert" — und sonst nichts. Kein
      // Herunterladen, keine Datei. Jetzt wird wirklich gesichert.
      if (!story.mediaUri) {
        onNotice('Diese Story hat noch kein Bild');
        return onClose();
      }
      onClose();
      medienSichern(story.mediaUri, `all-media-story-${story.id}.jpg`).then((ok) => {
        if (ok) onNotice('Story gesichert');
      });
      return;
    }
    if (key === 'sichtbar') return setSichtOffen(true);
    if (key === 'link') {
      onNotice(`all-media.app/story/${story.id}`);
      return onClose();
    }
    if (key === 'stumm') {
      const jetzt = stummSchalten(story.userId);
      onNotice(jetzt ? `${person?.name} stummgeschaltet` : 'Stummschaltung aufgehoben');
      return onClose();
    }
    setMeldeSchritt(true);
  };

  /*
   * Die Sichtbarkeit der eigenen Story — dieselbe Wahl wie in den
   * Einstellungen, nur an der Stelle, an der man sie braucht. Sie liegt über
   * dem Menü, nicht daneben: das Menü bleibt offen, damit man danach noch
   * löschen oder sichern kann.
   */
  const sicht = sichtbarkeit.story || { stufe: 'alle' as const, ausnahmen: [] };
  if (sichtOffen) {
    return (
      <SichtbarkeitSheet
        visible
        titel="Wer darf deine Story sehen"
        stufe={sicht.stufe}
        ausnahmen={sicht.ausnahmen}
        onStufe={async (stufe) => {
          await aktionen.sichtbarkeit('story', stufe, () => {});
          await neuLaden();
        }}
        onAusnahme={async (userId) => {
          await aktionen.sichtbarkeitAusnahme('story', userId, () => {});
          await neuLaden();
        }}
        inVideos={sicht.inVideos}
        onInVideos={async (an) => {
          await aktionen.storyInVideos(an, () => {});
          await neuLaden();
        }}
        onClose={() => setSichtOffen(false)}
      />
    );
  }

  return (
    <SheetRahmen
      visible
      title={meldeSchritt ? 'Story melden' : eigene ? 'Deine Story' : person?.name ?? 'Story'}
      onClose={onClose}
    >
      {meldeSchritt ? (
        <ScrollView>
          {GRUENDE.map((grund) => (
            <Druck
              key={grund}
              style={({ pressed }) => [styles.zeile, pressed && styles.gedrueckt]}
              onPress={() => {
                melden(story.userId, grund);
                onNotice('Danke, wir sehen uns das an');
                onClose();
              }}
            >
              <Text style={styles.label}>{grund}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text3} />
            </Druck>
          ))}
        </ScrollView>
      ) : (
        <View>
          {punkte.map((p) => (
            <Druck
              key={p.key}
              style={({ pressed }) => [styles.zeile, pressed && styles.gedrueckt]}
              onPress={() => waehlen(p.key)}
            >
              <View style={styles.symbol}>
                <Ionicons name={p.icon} size={18} color={p.gefahr ? colors.danger : colors.text2} />
              </View>
              <Text style={[styles.label, p.gefahr && styles.gefahr]}>{p.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text3} />
            </Druck>
          ))}
        </View>
      )}
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
  label: { flex: 1, ...typography.body, color: colors.text },
  neben: { ...typography.small, color: colors.text3 },
  gefahr: { color: colors.danger },
  hinweis: { ...typography.message, color: colors.text2, padding: spacing.lg },
}));
