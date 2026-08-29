import React, { useContext, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { AuthContext } from '../../contexts/AuthContext';
import { ThemeContext } from '../../contexts/ThemeContext';
import { useProfil } from '../../contexts/ProfilContext';
import { EinstellungSheet, ListenZeile } from '../../components/EinstellungSheet';
import { FormularSheet } from '../../components/FormularSheet';
import { mockChats, mockPosts, mockUsers } from '../../mocks';
import { colors, radius, sizes, spacing, themenStyles, typography } from '../../constants/design';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface EingabeFeld {
  key: string;
  label: string;
  typ?: 'text' | 'mehrzeilig' | 'zahl';
  platzhalter?: string;
  pflicht?: boolean;
}

/*
 * Jeder Punkt hat eine Art, damit keiner davon nur ein Hinweis bleibt:
 *
 *   toggle       Schalter
 *   wahl         eine aus mehreren Möglichkeiten, die gewählte steht rechts
 *   eingabe      Formular mit Feldern
 *   liste        was gerade eingetragen ist (Geräte, blockierte Profile, ...)
 *   info         Erklärtext
 *   bestaetigen  Nachfrage vor etwas Endgültigem
 *   aktion       tut etwas Einmaliges
 */
interface Item {
  label: string;
  icon: IconName;
  toggle?: string;
  wahl?: string[];
  standard?: string;
  eingabe?: EingabeFeld[];
  pruefen?: (werte: Record<string, string>) => string | null;
  fertig?: string;
  liste?: string;
  info?: string;
  bestaetigen?: string;
  aktion?: 'sicherung' | 'einladen';
  gefahr?: boolean;
}

interface Section {
  id: string;
  title: string;
  items: Item[];
}

/*
 * Prototyp-Frame "Einstellungen": vier Abschnitte mit einer Sprungleiste
 * darüber. Die Einträge sind eins zu eins übernommen.
 */
// Mehrfach gebrauchte Auswahlen - einmal benannt statt viermal getippt.
const WER = ['Alle', 'Meine Kontakte', 'Niemand'];
const STORY = ['Alle', 'Meine Kontakte', 'Enge Freunde'];
const STATUS = ['Aktiv', 'Beschäftigt', 'Unsichtbar'];

const SPENDENCODE: Item = {
  label: 'Spendencode',
  icon: 'bookmark-outline',
  eingabe: [{ key: 'code', label: 'Dein Spendencode', platzhalter: 'z. B. HENRIK2026', pflicht: true }],
  fertig: 'Spendencode gespeichert',
};

const SECTIONS: Section[] = [
  {
    id: 'allgemein',
    title: 'Allgemein',
    items: [
      {
        label: 'Erziehungsberechtigte/r',
        icon: 'shield-outline',
        eingabe: [
          { key: 'name', label: 'Name', platzhalter: 'Vor- und Nachname', pflicht: true },
          { key: 'mail', label: 'E-Mail-Adresse', platzhalter: 'name@beispiel.de', pflicht: true },
        ],
        fertig: 'Einladung verschickt — die Verknüpfung gilt, sobald sie bestätigt wurde',
      },
      SPENDENCODE,
      {
        label: 'Sicherheits-/Entsperrcode',
        icon: 'lock-closed-outline',
        eingabe: [
          { key: 'code', label: 'Neuer Code (4 bis 8 Ziffern)', typ: 'zahl', pflicht: true },
          { key: 'wdh', label: 'Code wiederholen', typ: 'zahl', pflicht: true },
        ],
        pruefen: (w) =>
          !/^\d{4,8}$/.test(w.code)
            ? 'Der Code muss aus 4 bis 8 Ziffern bestehen'
            : w.code !== w.wdh
            ? 'Die beiden Eingaben stimmen nicht überein'
            : null,
        fertig: 'Code gesetzt',
      },
      { label: 'Geräteverknüpfung', icon: 'phone-portrait-outline', liste: 'geraete' },
      { label: 'Dunkles Design', icon: 'moon-outline', toggle: 'theme' },
    ],
  },
  {
    id: 'konto',
    title: 'Konto',
    items: [
      {
        label: 'Profil bearbeiten',
        icon: 'person-circle-outline',
        eingabe: [
          { key: 'name', label: 'Name', pflicht: true },
          { key: 'bio', label: 'Biografie', typ: 'mehrzeilig' },
          { key: 'link', label: 'Link' },
        ],
        fertig: 'Profil gespeichert',
      },
      {
        label: 'Telefonnummer ändern',
        icon: 'call-outline',
        eingabe: [{ key: 'nummer', label: 'Neue Telefonnummer', platzhalter: '+49 …', pflicht: true }],
        fertig: 'Wir haben dir einen Bestätigungscode geschickt',
      },
      {
        label: 'Passwort ändern',
        icon: 'key-outline',
        eingabe: [
          { key: 'alt', label: 'Bisheriges Passwort', pflicht: true },
          { key: 'neu', label: 'Neues Passwort', pflicht: true },
          { key: 'wdh', label: 'Neues Passwort wiederholen', pflicht: true },
        ],
        pruefen: (w) =>
          w.neu.length < 8
            ? 'Das neue Passwort braucht mindestens acht Zeichen'
            : w.neu !== w.wdh
            ? 'Die beiden Eingaben stimmen nicht überein'
            : null,
        fertig: 'Passwort geändert',
      },
      { label: 'Zwei-Faktor-Anmeldung', icon: 'shield-checkmark-outline', wahl: ['Aus', 'Per SMS', 'Über eine App'], standard: 'Aus' },
      { label: 'Konto löschen', icon: 'trash-outline', gefahr: true, bestaetigen: 'Konto endgültig löschen?' },
    ],
  },
  {
    id: 'datenschutz',
    title: 'Datenschutz',
    items: [
      { label: 'Zuletzt online', icon: 'time-outline', wahl: WER, standard: 'Meine Kontakte' },
      { label: 'Profilbild sichtbar für', icon: 'image-outline', wahl: WER, standard: 'Alle' },
      { label: 'Info sichtbar für', icon: 'information-circle-outline', wahl: WER, standard: 'Meine Kontakte' },
      { label: 'Blockierte Kontakte', icon: 'ban-outline', liste: 'blockiert' },
      { label: 'Gruppen: wer darf hinzufügen', icon: 'people-outline', wahl: WER, standard: 'Meine Kontakte' },
      { label: 'Bildschirmsperre', icon: 'finger-print-outline', toggle: 'bildschirmsperre' },
    ],
  },
  {
    id: 'benachrichtigungen',
    title: 'Mitteilungen',
    items: [
      { label: 'Nachrichten-Töne', icon: 'notifications-outline', toggle: 'toene' },
      { label: 'Vibration', icon: 'phone-portrait-outline', toggle: 'vibration' },
      { label: 'Vorschau anzeigen', icon: 'eye-outline', toggle: 'vorschau' },
      { label: 'Gruppen-Mitteilungen', icon: 'people-circle-outline', wahl: ['Alle Nachrichten', 'Nur Erwähnungen', 'Aus'], standard: 'Alle Nachrichten' },
      { label: 'Ruhezeiten', icon: 'moon-outline', wahl: ['Aus', '22 – 7 Uhr', '23 – 8 Uhr', '0 – 9 Uhr'], standard: 'Aus' },
    ],
  },
  {
    // Henrik: "Insbesondere einen Messenger-Unterpunkt ergaenzen, analog zu
    // Videos und Communitys." Der Abschnitt hiess "Chats" und war damit der
    // einzige, der nicht nach seinem Bereich benannt war.
    id: 'messenger',
    title: 'Messenger',
    items: [
      { label: 'Lesebestätigung', icon: 'checkmark-done-outline', toggle: 'lesebestaetigung' },
      { label: 'Standort-Sichtbarkeit', icon: 'location-outline', wahl: ['Alle Kontakte', 'Ausgewählte Kontakte', 'Niemand'], standard: 'Alle Kontakte' },
      { label: 'Story-Sichtbarkeit', icon: 'eye-outline', wahl: STORY, standard: 'Meine Kontakte' },
      { label: 'Zuletzt online', icon: 'eye-outline', wahl: ['Alle', 'Meine Kontakte', 'Niemand'], standard: 'Meine Kontakte' },
      { label: 'Mit Enter senden', icon: 'return-down-back-outline', toggle: 'entersenden' },
      { label: 'Chat-Hintergrund', icon: 'color-palette-outline', wahl: ['Hell', 'Dunkel', 'Farbverlauf'], standard: 'Hell' },
      { label: 'Schriftgröße', icon: 'text-outline', wahl: ['Klein', 'Mittel', 'Groß'], standard: 'Mittel' },
      { label: 'Wer darf mich zu Gruppen hinzufügen', icon: 'people-outline', wahl: ['Alle', 'Meine Kontakte', 'Niemand'], standard: 'Meine Kontakte' },
      { label: 'Selbstlöschende Nachrichten', icon: 'time-outline', wahl: ['Aus', 'Nach 24 Stunden', 'Nach 7 Tagen', 'Nach 90 Tagen'], standard: 'Aus' },
      { label: 'Chat-Verlauf sichern', icon: 'cloud-upload-outline', aktion: 'sicherung' },
      { label: 'Archivierte Chats', icon: 'archive-outline', liste: 'archiv' },
    ],
  },
  {
    id: 'speicher',
    title: 'Speicher',
    items: [
      { label: 'Automatischer Download', icon: 'download-outline', wahl: ['Nie', 'Nur im WLAN', 'Immer'], standard: 'Nur im WLAN' },
      { label: 'Speicher verwalten', icon: 'pie-chart-outline', liste: 'speicher' },
      { label: 'Datensparmodus', icon: 'cellular-outline', toggle: 'datensparen' },
      { label: 'Medienqualität', icon: 'options-outline', wahl: ['Standard', 'Hoch'], standard: 'Standard' },
    ],
  },
  {
    id: 'videos',
    title: 'Videos',
    items: [
      { label: 'Privates Profil', icon: 'lock-closed-outline', toggle: 'videoPrivate' },
      SPENDENCODE,
      { label: 'Insights', icon: 'compass-outline', liste: 'insights' },
      { label: 'Wem ich folge', icon: 'person-outline', liste: 'gefolgt' },
      { label: 'Mit Glocke markierte Profile', icon: 'notifications-outline', liste: 'glocke' },
      { label: 'Repost-Sichtbarkeit', icon: 'repeat-outline', wahl: ['Alle', 'Meine Follower', 'Niemand'], standard: 'Alle' },
      { label: 'Likes-Sichtbarkeit', icon: 'heart-outline', wahl: ['Alle', 'Nur ich'], standard: 'Alle' },
      { label: 'Downloadeinstellungen', icon: 'image-outline', wahl: ['Erlaubt', 'Nur Follower', 'Aus'], standard: 'Erlaubt' },
      { label: 'Story-Sichtbarkeit', icon: 'eye-outline', wahl: STORY, standard: 'Meine Kontakte' },
      { label: 'Nutzerstatus', icon: 'person-outline', wahl: STATUS, standard: 'Aktiv' },
      { label: 'Profilbanner', icon: 'tv-outline', wahl: ['Ohne', 'Farbverlauf', 'Eigenes Bild'], standard: 'Ohne' },
    ],
  },
  {
    id: 'hilfe',
    title: 'Hilfe',
    items: [
      {
        label: 'Hilfebereich',
        icon: 'help-circle-outline',
        info: 'Fragen und Antworten zu All Media. Bei allem, was hier nicht steht: schreib uns über „Problem melden“ — wir antworten meist innerhalb eines Werktags.',
      },
      {
        label: 'Problem melden',
        icon: 'bug-outline',
        eingabe: [
          { key: 'was', label: 'Was ist passiert?', typ: 'mehrzeilig', pflicht: true },
          { key: 'kontakt', label: 'Antwort an (freiwillig)', platzhalter: 'E-Mail oder Telefonnummer' },
        ],
        fertig: 'Danke, die Meldung ist bei uns angekommen',
      },
      {
        label: 'Nutzungsbedingungen',
        icon: 'document-text-outline',
        info: 'All Media ist für Menschen ab 13 Jahren. Inhalte, die andere herabwürdigen oder gegen geltendes Recht verstoßen, werden entfernt. Wer sein Konto löscht, verliert seine Beiträge unwiderruflich.',
      },
      {
        label: 'Datenschutzerklärung',
        icon: 'lock-closed-outline',
        info: 'Beiträge, Nachrichten und Profildaten liegen auf unseren Servern. Standortdaten nur, solange die Friend-Map eingeschaltet ist. Aufnahmen aus Kamera und Galerie bleiben auf deinem Gerät, bis du sie veröffentlichst.',
      },
      { label: 'Freunde einladen', icon: 'share-social-outline', aktion: 'einladen' },
    ],
  },
  {
    id: 'communitys',
    title: 'Communitys',
    items: [
      SPENDENCODE,
      { label: 'Nutzerstatus', icon: 'person-outline', wahl: STATUS, standard: 'Aktiv' },
      { label: 'Privates Profil', icon: 'lock-closed-outline', toggle: 'commPrivate' },
      { label: 'Nachrichten erlaubt von', icon: 'chatbubble-outline', wahl: ['Alle', 'Mitglieder meiner Communitys', 'Niemand'], standard: 'Mitglieder meiner Communitys' },
      { label: 'Push-to-Talk Nachricht', icon: 'mic-outline', wahl: ['An', 'Aus'], standard: 'An' },
      { label: 'Gestummte Communitys', icon: 'volume-mute-outline', liste: 'stummeKanaele' },
      { label: 'Gestummte Profile', icon: 'ban-outline', liste: 'stummeProfile' },
    ],
  },
];

interface Props {
  onNotice: (message: string) => void;
  onLogout: () => void;
  /** Oeffnet die Kontoliste zum Umschalten. */
  onSwitchAccount: () => void;
  /**
   * Abschnitt, bei dem die Seite aufgehen soll - kommt aus dem Menue im
   * eigenen Profil (Prototyp "VP + Einstellung" / "CP + Einstellung").
   */
  sprung?: string | null;
  onSprungFertig?: () => void;
  /** Zurueck zur vorherigen Seite (Profil/Messenger). */
  onBack?: () => void;
}

export const SettingsScreen = ({ onNotice, onLogout, onSwitchAccount, sprung, onSprungFertig, onBack }: Props) => {
  const { user, konten } = useContext(AuthContext);
  const { communities, istBlockiert, istStumm, raster, gefolgt, eigenesProfil, profilSpeichern } =
    useProfil();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  // Der offene Punkt und die getroffenen Auswahlen. Sie gelten fuer diese
  // Sitzung - dauerhaft speichern kann erst das Backend.
  const [offen, setOffen] = useState<Item | null>(null);
  const [gewaehlt, setGewaehlt] = useState<Record<string, string>>({});

  const wert = (item: Item) => gewaehlt[item.label] ?? item.standard ?? '';

  /** Inhalt der Listen-Punkte. Alles kommt aus dem echten Zustand. */
  const listeVon = (art: string): { zeilen: ListenZeile[]; leer: string; knopf?: string } => {
    if (art === 'geraete') {
      return {
        leer: '',
        zeilen: [
          { text: 'Dieses Gerät', neben: 'gerade aktiv' },
          { text: 'All Media Web', neben: 'zuletzt heute' },
        ],
        knopf: 'Gerät verknüpfen',
      };
    }
    if (art === 'blockiert') {
      const ids = Object.keys(mockUsers).filter((id) => istBlockiert(id));
      return { leer: 'Du hast niemanden blockiert.', zeilen: ids.map((id) => ({ text: mockUsers[id].name, neben: 'blockiert' })) };
    }
    if (art === 'stummeProfile') {
      const ids = Object.keys(mockUsers).filter((id) => istStumm(id));
      return { leer: 'Kein Profil ist stummgeschaltet.', zeilen: ids.map((id) => ({ text: mockUsers[id].name, neben: 'stumm' })) };
    }
    if (art === 'stummeKanaele') {
      const stumm = communities.filter((c) => c.joined && c.unreadCount === 0 && c.visibility === 'private');
      return { leer: 'Keine Community ist stummgeschaltet.', zeilen: stumm.map((c) => ({ text: c.name, neben: 'stumm' })) };
    }
    if (art === 'archiv') return { leer: 'Kein Chat ist archiviert.', zeilen: [] };
    if (art === 'speicher') {
      return {
        leer: '',
        zeilen: [
          { text: 'Chats', neben: `${mockChats.length} Unterhaltungen` },
          { text: 'Fotos und Videos', neben: `${raster.filter((r) => r.eigen).length} eigene Aufnahmen` },
          { text: 'Zwischenspeicher', neben: 'wird beim Beenden geleert' },
        ],
      };
    }
    if (art === 'insights') {
      return {
        leer: '',
        zeilen: [
          { text: 'Eigene Beiträge', neben: String(raster.filter((r) => r.eigen).length) },
          { text: 'Follower', neben: '340' },
          { text: 'Aufrufe (30 Tage)', neben: '1.284' },
          { text: 'Neue Follower (30 Tage)', neben: '46' },
        ],
      };
    }
    /*
     * Henrik: "In den Einstellungen muss man sehen koennen, wem man folgt."
     * Die Liste kommt aus demselben Zustand wie die Folgen-Knoepfe im Feed
     * (ProfilContext), damit beide immer dasselbe zeigen.
     */
    if (art === 'gefolgt') {
      return {
        leer: 'Du folgst noch niemandem.',
        zeilen: gefolgt.map((id) => ({
          text: mockUsers[id]?.name ?? id,
          neben: mockUsers[id]?.handle ?? '',
        })),
      };
    }
    const mit = mockPosts.filter((p) => p.notify);
    return {
      leer: 'Du hast bei keinem Profil die Glocke angeschaltet.',
      zeilen: mit.map((p) => ({ text: mockUsers[p.userId].name, neben: 'Glocke an' })),
    };
  };

  const oeffne = (item: Item) => {
    if (item.aktion === 'sicherung') {
      return onNotice(`Sicherung erstellt — ${mockChats.length} Unterhaltungen gespeichert`);
    }
    if (item.aktion === 'einladen') {
      return onNotice('Einladung kopiert: all-media.app');
    }
    setOffen(item);
  };
  const offsets = useRef<Record<string, number>>({});
  const { isDark, setTheme } = useContext(ThemeContext);
  const insets = useSafeAreaInsets();
  const [switches, setSwitches] = useState<Record<string, boolean>>({
    videoPrivate: false,
    commPrivate: false,
    bildschirmsperre: false,
    toene: true,
    vibration: true,
    vorschau: true,
    lesebestaetigung: true,
    entersenden: false,
    datensparen: false,
  });

  // Die Abstaende stehen erst nach dem ersten Zeichnen fest, deshalb der
  // kurze Aufschub - vorher waere offsets.current noch leer.
  useEffect(() => {
    if (!sprung) return;
    const zeit = setTimeout(() => {
      scroll.current?.scrollTo({ y: offsets.current[sprung] ?? 0, animated: false });
      onSprungFertig?.();
    }, 80);
    return () => clearTimeout(zeit);
  }, [sprung, onSprungFertig]);

  return (
    <View style={styles.screen}>
      {/*
        Einstellungen ist der einzige Bereich ohne obere Leiste (so steht es im
        Prototyp). Damit fehlt aber auch derjenige, der sonst den Platz für
        Uhrzeit und Notch frei hält — die Reiter liefen bisher unter die
        Statusleiste. Dieser Bildschirm muss sich den Platz deshalb selbst
        nehmen.
      */}
      <View style={[styles.head, { paddingTop: insets.top + spacing.sm }]}>
        {onBack && (
          <Druck style={styles.back} onPress={onBack} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Druck>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
          {SECTIONS.map((section) => (
            <Druck
              key={section.id}
              style={styles.pill}
              onPress={() => scroll.current?.scrollTo({ y: offsets.current[section.id] ?? 0, animated: true })}
            >
              <Text style={styles.pillText}>{section.title}</Text>
            </Druck>
          ))}
        </ScrollView>
      </View>

      <ScrollView ref={scroll} contentContainerStyle={styles.content}>
        {/*
          Der Kontowechsel gehoert nach ganz oben: Es ist die Einstellung, die
          das ganze uebrige Bild veraendert.
        */}
        <Druck style={styles.konto} onPress={onSwitchAccount}>
          <Avatar
            id={user?.profile.id ?? 'me'}
            name={user?.profile.name ?? 'Konto'}
            size={sizes.avatarLg}
          />
          <View style={styles.kontoBody}>
            <Text style={styles.kontoName}>{user?.profile.name ?? 'Nicht angemeldet'}</Text>
            <Text style={styles.kontoSub}>
              {user?.email ?? '—'}
              {konten.length > 1 ? `  ·  ${konten.length} Konten` : ''}
            </Text>
          </View>
          <Ionicons name="swap-horizontal-outline" size={22} color={colors.brand} />
        </Druck>

        <Druck style={styles.wechselBtn} onPress={onSwitchAccount}>
          <Ionicons name="people-outline" size={18} color={colors.brand} />
          <Text style={styles.wechselText}>Konto wechseln oder hinzufügen</Text>
        </Druck>

        {SECTIONS.map((section) => (
          <View
            key={section.id}
            onLayout={(e) => {
              offsets.current[section.id] = e.nativeEvent.layout.y;
            }}
          >
            <Text style={styles.sectionHead}>{section.title} →</Text>
            <View style={styles.group}>
              {section.items.map((item) => (
                <Druck
                  key={`${section.id}-${item.label}`}
                  style={styles.item}
                  onPress={item.toggle ? undefined : () => oeffne(item)}
                  disabled={!!item.toggle}
                >
                  <Ionicons name={item.icon} size={20} color={item.gefahr ? colors.danger : colors.text2} />
                  <Text style={[styles.itemLabel, item.gefahr && styles.danger]} numberOfLines={1}>{item.label}</Text>
                  {item.toggle ? (
                    <Switch
                      value={item.toggle === 'theme' ? isDark : switches[item.toggle]}
                      onValueChange={(next) => {
                        if (item.toggle === 'theme') {
                          setTheme(next ? 'dark' : 'light');
                          return;
                        }
                        setSwitches({ ...switches, [item.toggle as string]: next });
                      }}
                      trackColor={{ true: colors.brand, false: colors.surface3 }}
                    />
                  ) : (
                    <>
                      {!!item.wahl && <Text style={styles.itemValue}>{wert(item)}</Text>}
                      <Ionicons name="chevron-forward" size={18} color={colors.text3} />
                    </>
                  )}
                </Druck>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.group}>
          <View style={styles.item}>
            <Ionicons name="information-circle-outline" size={20} color={colors.text2} />
            <Text style={styles.itemLabel}>Über All Media</Text>
            <Text style={styles.itemValue}>1.0.0</Text>
          </View>
          <Druck style={styles.item} onPress={onLogout}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={[styles.itemLabel, styles.danger]}>Abmelden</Text>
          </Druck>
        </View>
      </ScrollView>

      {offen?.eingabe && (
        <FormularSheet
          visible
          title={offen.label}
          felder={offen.eingabe}
          knopf="Speichern"
          vorbelegung={
            offen.label === 'Profil bearbeiten'
              ? { name: eigenesProfil.name, bio: eigenesProfil.bio, link: eigenesProfil.link }
              : undefined
          }
          onClose={() => setOffen(null)}
          onSubmit={(werte) => {
            const fehler = offen.pruefen?.(werte);
            if (fehler) return fehler;
            /*
             * "Profil bearbeiten" hat den Namen bisher nirgends
             * hingeschrieben - es kam nur ein Hinweis. Jetzt landet er im
             * gemeinsamen Zustand und steht damit auch im Profil.
             */
            if (offen.label === 'Profil bearbeiten') {
              profilSpeichern({
                name: werte.name?.trim() || eigenesProfil.name,
                bio: werte.bio ?? eigenesProfil.bio,
                link: werte.link ?? eigenesProfil.link,
              });
            }
            setGewaehlt((prev) => ({ ...prev, [offen.label]: werte[offen.eingabe![0].key] }));
            onNotice(offen.fertig ?? 'Gespeichert');
            return null;
          }}
          onNotice={onNotice}
        />
      )}

      {offen && !offen.eingabe && (
        <EinstellungSheet
          titel={offen.label}
          wahl={offen.wahl}
          aktuell={wert(offen)}
          onWahl={(w) => {
            setGewaehlt((prev) => ({ ...prev, [offen.label]: w }));
            setOffen(null);
            onNotice(`${offen.label}: ${w}`);
          }}
          zeilen={offen.liste ? listeVon(offen.liste).zeilen : undefined}
          leer={offen.liste ? listeVon(offen.liste).leer : undefined}
          knopf={offen.liste ? listeVon(offen.liste).knopf : undefined}
          onKnopf={() => {
            setOffen(null);
            onNotice('Zum Verknüpfen den QR-Code auf dem anderen Gerät scannen');
          }}
          info={offen.info}
          bestaetigen={offen.bestaetigen}
          onBestaetigt={() => {
            setOffen(null);
            // Ohne Backend wird nichts wirklich geloescht - das gehoert
            // gesagt, statt es vorzutaeuschen.
            onNotice('Löschauftrag vorgemerkt — er greift, sobald das Backend steht');
          }}
          onClose={() => setOffen(null)}
        />
      )}
    </View>
  );
};

const styles = themenStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  head: { paddingTop: spacing.md, paddingBottom: spacing.sm, position: 'relative' },
  back: { position: 'absolute', left: spacing.lg, top: spacing.md + spacing.sm, zIndex: 10 },
  pills: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillText: { ...typography.small, fontWeight: '600', color: colors.text2 },
  content: { paddingBottom: spacing.xxl },
  sectionHead: {
    ...typography.overline,
    color: colors.text3,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  konto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  kontoBody: { flex: 1, minWidth: 0 },
  kontoName: { color: colors.text, ...typography.h3 },
  kontoSub: { color: colors.text3, marginTop: 2, ...typography.small },
  wechselBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
  },
  wechselText: { color: colors.brand, ...typography.name },

  group: { backgroundColor: colors.surface },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    height: 54,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemLabel: { flex: 1, ...typography.body, color: colors.text },
  itemValue: { ...typography.preview, color: colors.text3 },
  rechts: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  danger: { color: colors.danger },
}));
