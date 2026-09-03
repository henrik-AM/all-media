import React, { useContext, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Avatar } from '../../components/Avatar';
import { AuthContext } from '../../contexts/AuthContext';
import { ThemeContext } from '../../contexts/ThemeContext';
import { useProfil } from '../../contexts/ProfilContext';
import { EinstellungSheet, ListenZeile } from '../../components/EinstellungSheet';
import { FormularSheet } from '../../components/FormularSheet';
import { useDaten } from '../../contexts/DatenContext';
import { colors, radius, sizes, spacing, themenStyles, typography, verlaufAus } from '../../constants/design';
import { SichtbarkeitSheet } from '../../components/SichtbarkeitSheet';
import { useAktionen } from '../../lib/useAktionen';
import { useSupabase } from '../../contexts/SupabaseContext';
import { ladeBanne, ladeEinstellungen, ladeStatistik, Statistik } from '../../lib/daten';
import { SichtbarkeitBereich, SichtbarkeitStufe } from '../../lib/aktionen';

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
  /*
   * Der Schluessel, unter dem die Wahl in `user_settings` liegt.
   *
   * Bewusst nicht die Beschriftung: die ist Text fuer Menschen und wird
   * umformuliert — dann waere die Einstellung verloren. Zwei Punkte duerfen
   * denselben Schluessel tragen; "Wer darf mich zu Gruppen hinzufuegen"
   * steht unter Datenschutz und unter Messenger und meint beide Male
   * dasselbe. Ein Schluessel, ein Wert, und beide zeigen dasselbe.
   */
  wahlKey?: string;
  standard?: string;
  eingabe?: EingabeFeld[];
  pruefen?: (werte: Record<string, string>) => string | null;
  fertig?: string;
  liste?: string;
  /*
   * Sichtbarkeit in den vier Stufen des Handbuchs, mit Ausnahmeliste.
   * Der Wert ist der Bereich in der Datenbank — standort, story, repost,
   * onlinestatus, ptt, likes, download, dm.
   */
  sichtbar?: SichtbarkeitBereich;
  info?: string;
  bestaetigen?: string;
  aktion?: 'sicherung' | 'einladen' | 'alter' | 'datenauskunft';
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
        label: 'Alter und Erziehungsberechtigte/r',
        icon: 'shield-outline',
        eingabe: [
          /*
           * Geburtsdatum statt Name und E-Mail.
           *
           * Das Handbuch verlangt: unter 16 nur mit Zustimmung eines
           * Erziehungsberechtigten, "der einen All Media Account besitzen"
           * muss. Vorher stand hier ein Formular fuer Name und E-Mail, an
           * dem gar nichts hing — kein Geburtsdatum, keine Pruefung, keine
           * Verknuepfung. Ein Nutzername laesst sich in der Datenbank
           * nachschlagen, eine E-Mail-Adresse kann jeder erfinden.
           */
          {
            key: 'geburtsdatum',
            label: 'Geburtsdatum',
            platzhalter: 'JJJJ-MM-TT, z. B. 2012-04-19',
            pflicht: true,
          },
          {
            key: 'guardian',
            label: 'Nutzername des/der Erziehungsberechtigten (nur unter 16)',
            platzhalter: '@nutzername',
          },
        ],
        aktion: 'alter',
        fertig: 'Gespeichert',
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
      { label: 'Zwei-Faktor-Anmeldung', icon: 'shield-checkmark-outline', wahlKey: 'zweiFaktor', wahl: ['Aus', 'Per SMS', 'Über eine App'], standard: 'Aus' },
      /*
       * Artikel 15 und 20 DSGVO: jeder darf seine Daten sehen und
       * mitnehmen. Fuer eine App, die live gehen soll, ist das keine
       * Zusatzfunktion — und es fehlte, obwohl die Datenschutzerklaerung
       * daneben stand.
       */
      { label: 'Meine Daten herunterladen', icon: 'download-outline', aktion: 'datenauskunft' },
      { label: 'Konto löschen', icon: 'trash-outline', gefahr: true, bestaetigen: 'Konto endgültig löschen?' },
    ],
  },
  {
    id: 'datenschutz',
    title: 'Datenschutz',
    items: [
      { label: 'Zuletzt online', icon: 'time-outline', wahlKey: 'zuletztOnline', wahl: WER, standard: 'Meine Kontakte' },
      { label: 'Profilbild sichtbar für', icon: 'image-outline', wahlKey: 'profilbildSichtbar', wahl: WER, standard: 'Alle' },
      { label: 'Info sichtbar für', icon: 'information-circle-outline', wahlKey: 'infoSichtbar', wahl: WER, standard: 'Meine Kontakte' },
      { label: 'Blockierte Kontakte', icon: 'ban-outline', liste: 'blockiert' },
      { label: 'Gruppen: wer darf hinzufügen', icon: 'people-outline', wahlKey: 'gruppenHinzufuegen', wahl: WER, standard: 'Meine Kontakte' },
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
      { label: 'Gruppen-Mitteilungen', icon: 'people-circle-outline', wahlKey: 'gruppenMitteilungen', wahl: ['Alle Nachrichten', 'Nur Erwähnungen', 'Aus'], standard: 'Alle Nachrichten' },
      { label: 'Ruhezeiten', icon: 'moon-outline', wahlKey: 'ruhezeiten', wahl: ['Aus', '22 – 7 Uhr', '23 – 8 Uhr', '0 – 9 Uhr'], standard: 'Aus' },
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
      /*
       * Steht auch unter Datenschutz. Absichtlich zweimal: wer jemanden
       * blockiert hat, sucht die Liste im Messenger und nicht unter einer
       * Ueberschrift, die er sich erst uebersetzen muss. Die Website hat
       * beide Orte laengst.
       */
      { label: 'Blockierte Kontakte', icon: 'ban-outline', liste: 'blockiert' },
      { label: 'Standort-Sichtbarkeit', icon: 'location-outline', sichtbar: 'standort' },
      { label: 'Story-Sichtbarkeit', icon: 'eye-outline', sichtbar: 'story' },
      { label: 'Zuletzt online', icon: 'eye-outline', sichtbar: 'onlinestatus' },
      { label: 'Mit Enter senden', icon: 'return-down-back-outline', toggle: 'entersenden' },
      { label: 'Chat-Hintergrund', icon: 'color-palette-outline', wahlKey: 'chatHintergrund', wahl: ['Hell', 'Dunkel', 'Farbverlauf'], standard: 'Hell' },
      { label: 'Schriftgröße', icon: 'text-outline', wahlKey: 'schriftgroesse', wahl: ['Klein', 'Mittel', 'Groß'], standard: 'Mittel' },
      { label: 'Wer darf mich zu Gruppen hinzufügen', icon: 'people-outline', wahlKey: 'gruppenHinzufuegen', wahl: ['Alle', 'Meine Kontakte', 'Niemand'], standard: 'Meine Kontakte' },
      { label: 'Selbstlöschende Nachrichten', icon: 'time-outline', wahlKey: 'selbstloeschend', wahl: ['Aus', 'Nach 24 Stunden', 'Nach 7 Tagen', 'Nach 90 Tagen'], standard: 'Aus' },
      { label: 'Chat-Verlauf sichern', icon: 'cloud-upload-outline', aktion: 'sicherung' },
      { label: 'Archivierte Chats', icon: 'archive-outline', liste: 'archiv' },
    ],
  },
  {
    id: 'speicher',
    title: 'Speicher',
    items: [
      { label: 'Automatischer Download', icon: 'download-outline', wahlKey: 'autoDownload', wahl: ['Nie', 'Nur im WLAN', 'Immer'], standard: 'Nur im WLAN' },
      { label: 'Speicher verwalten', icon: 'pie-chart-outline', liste: 'speicher' },
      { label: 'Datensparmodus', icon: 'cellular-outline', toggle: 'datensparen' },
      { label: 'Medienqualität', icon: 'options-outline', wahlKey: 'medienqualitaet', wahl: ['Standard', 'Hoch'], standard: 'Standard' },
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
      { label: 'Repost-Sichtbarkeit', icon: 'repeat-outline', sichtbar: 'repost' },
      { label: 'Likes-Sichtbarkeit', icon: 'heart-outline', sichtbar: 'likes' },
      // Die beiden ueblichen Wege, auf denen Fremde an einem vorbeikommen.
      { label: 'Wer darf kommentieren', icon: 'chatbubble-ellipses-outline', sichtbar: 'kommentare' },
      { label: 'Wer darf mich markieren', icon: 'pricetag-outline', sichtbar: 'markierung' },
      { label: 'Downloadeinstellungen', icon: 'image-outline', sichtbar: 'download' },
      { label: 'Story-Sichtbarkeit (Videos)', icon: 'eye-outline', sichtbar: 'story' },
      { label: 'Nutzerstatus', icon: 'person-outline', wahlKey: 'nutzerstatus', wahl: STATUS, standard: 'Aktiv' },
      /*
       * "Nutzerstatus -> immer offline fuer ..." aus dem Handbuch. Es ist
       * keine eigene Einstellung, sondern der Onlinestatus in der Stufe
       * "Alle bis auf ..." — deshalb steht hier derselbe Bereich.
       */
      { label: 'Immer offline für …', icon: 'eye-off-outline', sichtbar: 'onlinestatus' },
      { label: 'Profilbann-Verlauf', icon: 'warning-outline', liste: 'banne' },
      { label: 'Profilbanner', icon: 'tv-outline', wahlKey: 'profilbanner', wahl: ['Ohne', 'Farbverlauf', 'Eigenes Bild'], standard: 'Ohne' },
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
      { label: 'Nutzerstatus', icon: 'person-outline', wahlKey: 'nutzerstatus', wahl: STATUS, standard: 'Aktiv' },
      { label: 'Privates Profil', icon: 'lock-closed-outline', toggle: 'commPrivate' },
      { label: 'Nachrichten erlaubt von', icon: 'chatbubble-outline', sichtbar: 'dm' },
      { label: 'Push-to-Talk Benachrichtigung', icon: 'mic-outline', sichtbar: 'ptt' },
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
  const { chats: alleChats, posts: alleBeitraege, users: alleNutzer } = useDaten();
  const { user, konten } = useContext(AuthContext);
  const { communities, istBlockiert, istStumm, raster, gefolgt, eigenesProfil, profilSpeichern } =
    useProfil();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const [offen, setOffen] = useState<Item | null>(null);

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
      const ids = Object.keys(alleNutzer).filter((id) => istBlockiert(id));
      return { leer: 'Du hast niemanden blockiert.', zeilen: ids.map((id) => ({ text: alleNutzer[id].name, neben: 'blockiert' })) };
    }
    if (art === 'stummeProfile') {
      const ids = Object.keys(alleNutzer).filter((id) => istStumm(id));
      return { leer: 'Kein Profil ist stummgeschaltet.', zeilen: ids.map((id) => ({ text: alleNutzer[id].name, neben: 'stumm' })) };
    }
    /*
     * Hier stand `joined && unreadCount === 0 && visibility === 'private'`.
     * `unreadCount` steht in lib/daten.ts fest auf 0, die Bedingung war also
     * immer erfuellt: die Liste zeigte jede private Community, in der man
     * Mitglied ist — als waeren sie alle stummgeschaltet. Die Website zeigte
     * an derselben Stelle Gruppen*chats*. Beide lesen jetzt
     * community_members.is_muted.
     */
    if (art === 'stummeKanaele') {
      const stumm = communities.filter((c) => c.stumm);
      return { leer: 'Keine Community ist stummgeschaltet.', zeilen: stumm.map((c) => ({ text: c.name, neben: 'stumm' })) };
    }
    if (art === 'archiv') {
      /*
       * Hier stand fest "keine". Archiviert wird in chat_members.is_archived
       * vermerkt, lib/daten.ts liest es mit — die Liste hat nur nie
       * hineingesehen. Wer auf der Website einen Chat archivierte, fand ihn
       * in der App unter "Archivierte Chats" trotzdem nicht.
       */
      const archiviert = alleChats.filter((c) => c.archiviert);
      return {
        leer: 'Kein Chat ist archiviert.',
        zeilen: archiviert.map((c) => ({ text: c.name, neben: 'archiviert' })),
      };
    }
    if (art === 'speicher') {
      return {
        leer: '',
        zeilen: [
          { text: 'Chats', neben: `${alleChats.length} Unterhaltungen` },
          { text: 'Fotos und Videos', neben: `${raster.filter((r) => r.eigen).length} eigene Aufnahmen` },
          { text: 'Zwischenspeicher', neben: 'wird beim Beenden geleert' },
        ],
      };
    }
    /*
     * Der Bann-Verlauf. Das Handbuch verlangt ihn ausdruecklich "mit Grund" —
     * ohne Begruendung ist eine Sperre nicht nachvollziehbar und nicht
     * anfechtbar.
     */
    if (art === 'banne') {
      return {
        leer: 'Gegen dein Profil liegt nichts vor.',
        zeilen: banne.map((b) => ({
          text: `${b.grund} (${b.bereich})`,
          neben: b.laeuft ? `läuft seit ${b.von}` : `beendet · ${b.von}`,
        })),
      };
    }
    /*
     * Die Statistik zum eigenen Profil.
     *
     * Henrik: "man kann dann sehen wie viele Aufrufe hat mein Profil gehabt
     * in den letzten Wochen". Das ging vorher nicht — nicht, weil es niemand
     * angezeigt haette, sondern weil nichts gemessen wurde. `posts.views`
     * ist ein Zaehlerstand ohne Verlauf: der Stand von heute laesst sich
     * lesen, der von letzter Woche nie.
     *
     * Seit Schema 16 vermerkt `profile_views` jeden fremden Profilaufruf mit
     * Zeitpunkt. Die Zeitraeume kommen aus der Sicht `profil_statistik`,
     * damit App und Website nicht zwei Rechnungen fuehren.
     *
     * Aufgeteilt in drei Blöcke, weil eine Liste aus neun gleich aussehenden
     * Zeilen niemand liest.
     */
    if (art === 'insights') {
      if (!statistik) return { leer: 'Wird geladen …', zeilen: [] };
      const z = (n: number) => n.toLocaleString('de-DE');
      return {
        leer: '',
        zeilen: [
          { text: 'Profil', kopf: true },
          { text: 'Profilaufrufe (7 Tage)', neben: z(statistik.profilaufrufe7) },
          { text: 'Profilaufrufe (30 Tage)', neben: z(statistik.profilaufrufe30) },
          // Wie viele Menschen, nicht wie oft: zwanzig Aufrufe von einer
          // Person sind etwas anderes als zwanzig von zwanzig.
          { text: 'Verschiedene Besucher (30 Tage)', neben: z(statistik.besucher30) },
          { text: 'Profilaufrufe gesamt', neben: z(statistik.profilaufrufe) },

          { text: 'Follower', kopf: true },
          { text: 'Neue Follower (7 Tage)', neben: z(statistik.follower7) },
          { text: 'Neue Follower (30 Tage)', neben: z(statistik.follower30) },
          { text: 'Follower gesamt', neben: z(statistik.follower) },

          { text: 'Inhalte', kopf: true },
          { text: 'Eigene Beiträge', neben: z(statistik.beitraege) },
          // "gesamt" und nicht "(30 Tage)": posts.views ist ein Zaehlerstand
          // ohne Verlauf. Einen Zeitraum zu behaupten, den niemand misst,
          // waere derselbe Fehler wie die erfundenen Zahlen davor.
          { text: 'Aufrufe der Beiträge gesamt', neben: z(statistik.aufrufe) },
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
          text: alleNutzer[id]?.name ?? id,
          neben: alleNutzer[id]?.handle ?? '',
        })),
      };
    }
    const mit = alleBeitraege.filter((p) => p.notify);
    return {
      leer: 'Du hast bei keinem Profil die Glocke angeschaltet.',
      zeilen: mit.map((p) => ({ text: alleNutzer[p.userId].name, neben: 'Glocke an' })),
    };
  };

  const oeffne = (item: Item) => {
    if (item.aktion === 'sicherung') {
      return onNotice(`Sicherung erstellt — ${alleChats.length} Unterhaltungen gespeichert`);
    }
    if (item.aktion === 'einladen') {
      return onNotice('Einladung kopiert: all-media.app');
    }
    /*
     * Die Datenauskunft. Auf dem Telefon gibt es keinen "Download"-Ordner
     * wie im Browser — deshalb legt die App die Datei ab und teilt sie ueber
     * das Systemblatt. Wer sie in die Cloud, in eine Mail oder in seine
     * Dateien legen will, entscheidet dort.
     */
    if (item.aktion === 'datenauskunft') {
      void (async () => {
        onNotice('Deine Daten werden zusammengestellt …');
        const datei = await aktionen.datenauskunft();
        if (datei) onNotice('Auskunft fertig — bitte einen Ort zum Sichern wählen');
      })();
      return;
    }
    setOffen(item);
  };
  const offsets = useRef<Record<string, number>>({});

  /*
   * Sichtbarkeit und Bann-Verlauf, nachgetragen am 01.09.2026.
   *
   * Die Stufen kommen aus der Datenbank (DatenContext) und werden hier nur
   * angezeigt und geaendert. Ein zweiter Stand im Bildschirm waere genau der
   * Weg, auf dem Anzeige und Wirklichkeit auseinanderlaufen.
   */
  const { sichtbarkeit, ichId, neuLaden } = useDaten();
  const { supabase } = useSupabase();
  const aktionen = useAktionen(onNotice);

  /*
   * Die getroffenen Auswahlen und Schalter.
   *
   * Hier stand bis zum 03.09.2026: "Sie gelten fuer diese Sitzung -
   * dauerhaft speichern kann erst das Backend." Neun Schalter und achtzehn
   * Auswahlen lagen damit im Bildschirmzustand und waren beim naechsten
   * Start wieder weg — darunter "Privates Profil" und "Lesebestaetigung",
   * also Zusagen an den Nutzer, die nichts taten.
   *
   * Jetzt kommt beides aus `user_settings`. `null` heisst "noch nicht
   * geladen"; erst danach steht fest, was der Nutzer gewaehlt hat, und
   * vorher waere jeder Schalter eine Behauptung.
   */
  const [einstellungen, setEinstellungen] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    if (!supabase || !ichId) return;
    ladeEinstellungen(supabase, ichId)
      .then(setEinstellungen)
      .catch((e: any) => {
        console.error('Einstellungen laden fehlgeschlagen:', e?.message ?? e);
        setEinstellungen({});
      });
  }, [supabase, ichId]);

  const wert = (item: Item) =>
    (item.wahlKey ? einstellungen?.[item.wahlKey] : undefined) ?? item.standard ?? '';

  /**
   * Eine Einstellung umstellen: sofort anzeigen, dann schreiben — und bei
   * einem Fehler zurueckdrehen. Dasselbe Vorgehen wie beim Herz.
   */
  const einstellungSetzen = async (schluessel: string, neuerWert: string) => {
    const vorher = einstellungen?.[schluessel];
    setEinstellungen((prev) => ({ ...(prev ?? {}), [schluessel]: neuerWert }));

    const gespeichert = await aktionen.einstellung(schluessel, neuerWert);
    if (gespeichert === null) {
      setEinstellungen((prev) => {
        const kopie = { ...(prev ?? {}) };
        if (vorher === undefined) delete kopie[schluessel];
        else kopie[schluessel] = vorher;
        return kopie;
      });
      return false;
    }
    return true;
  };

  const [sichtOffen, setSichtOffen] = useState<Item | null>(null);
  const [banne, setBanne] = useState<
    { id: string; bereich: string; grund: string; von: string; laeuft: boolean }[]
  >([]);

  /*
   * Die Statistik hinter "Insights". Sie stand bis zum 02.09.2026 in App und
   * Website als dieselben vier erfundenen Zahlen im Code.
   */
  const [statistik, setStatistik] = useState<Statistik | null>(null);

  useEffect(() => {
    if (!supabase || !ichId) return;
    ladeBanne(supabase, ichId)
      .then(setBanne)
      .catch((e: any) => console.error('Bann-Verlauf laden fehlgeschlagen:', e?.message ?? e));
    ladeStatistik(supabase, ichId)
      .then(setStatistik)
      .catch((e: any) => console.error('Statistik laden fehlgeschlagen:', e?.message ?? e));
  }, [supabase, ichId]);

  /** Stufe und Ausnahmen zu einem Bereich — ohne Eintrag gilt „alle". */
  const sicht = (bereich?: SichtbarkeitBereich) =>
    (bereich && sichtbarkeit[bereich]) || { stufe: 'alle' as SichtbarkeitStufe, ausnahmen: [] };

  /** Was rechts neben dem Punkt steht. */
  const sichtText = (bereich?: SichtbarkeitBereich) => {
    const s = sicht(bereich);
    const namen: Record<string, string> = {
      niemand: 'Niemand',
      niemand_bis_auf: 'Niemand bis auf …',
      alle_bis_auf: 'Alle bis auf …',
      alle: 'Alle',
    };
    // Bei den "bis auf"-Stufen die Zahl dazu. Ohne sie sieht eine leere
    // Ausnahmeliste genauso aus wie eine mit zwölf Namen.
    const zahl = s.ausnahmen.length;
    return zahl && s.stufe !== 'alle' && s.stufe !== 'niemand'
      ? `${namen[s.stufe]} (${zahl})`
      : namen[s.stufe];
  };
  const { isDark, setTheme } = useContext(ThemeContext);
  /*
   * Der Auslieferungszustand jedes Schalters. Was in `user_settings` steht,
   * sticht ihn; was fehlt, gilt als dieser Wert. So braucht eine neue
   * Einstellung keine Nachtraege fuer bestehende Konten.
   */
  const SCHALTER_STANDARD: Record<string, boolean> = {
    videoPrivate: false,
    commPrivate: false,
    bildschirmsperre: false,
    toene: true,
    vibration: true,
    vorschau: true,
    lesebestaetigung: true,
    entersenden: false,
    datensparen: false,
  };

  const schalter = (schluessel: string) => {
    const gespeichert = einstellungen?.[schluessel];
    if (gespeichert === undefined) return SCHALTER_STANDARD[schluessel] ?? false;
    return gespeichert === 'an';
  };

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

        {/*
          Ein weicher Auslauf an der rechten Kante.
          Die Reiterreihe ist breiter als der Bildschirm — die vierte Pille
          wurde bis zum 03.09.2026 mitten im Wort gekappt, und ein halbes „M"
          liest sich wie ein Layoutfehler, nicht wie „hier geht es weiter".
          Der Verlauf nimmt keinen Platz weg und faengt keine Tipps ab
          (`pointerEvents="none"`).
        */}
        <LinearGradient
          colors={[verlaufAus(colors.surface), colors.surface]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.auslauf}
          pointerEvents="none"
        />
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
                  onPress={() => {
                    if (item.toggle) return;
                    if (item.sichtbar) return setSichtOffen(item);
                    oeffne(item);
                  }}
                >
                  <Ionicons name={item.icon} size={20} color={item.gefahr ? colors.danger : colors.text2} />
                  <Text style={[styles.itemLabel, item.gefahr && styles.danger]} numberOfLines={1}>{item.label}</Text>
                  {item.toggle ? (
                    <Switch
                      value={item.toggle === 'theme' ? isDark : schalter(item.toggle)}
                      onValueChange={(next) => {
                        if (item.toggle === 'theme') {
                          setTheme(next ? 'dark' : 'light');
                          return;
                        }
                        // 'an'/'aus' statt true/false: der Wert ist Text in
                        // der Datenbank, und beide Seiten schreiben dasselbe.
                        void einstellungSetzen(item.toggle as string, next ? 'an' : 'aus');
                      }}
                      trackColor={{ true: colors.brand, false: colors.surface3 }}
                    />
                  ) : (
                    <>
                      {!!item.wahl && <Text style={styles.itemValue}>{wert(item)}</Text>}
                      {!!item.sichtbar && (
                        <Text style={styles.itemValue}>{sichtText(item.sichtbar)}</Text>
                      )}
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

      {/*
        * Sichtbarkeit in vier Stufen mit Ausnahmeliste. Die Aenderung geht
        * sofort in die Datenbank; scheitert sie, stellt useAktionen den
        * alten Stand wieder her und sagt warum.
        */}
      {sichtOffen?.sichtbar && (
        <SichtbarkeitSheet
          visible
          titel={sichtOffen.label}
          stufe={sicht(sichtOffen.sichtbar).stufe}
          ausnahmen={sicht(sichtOffen.sichtbar).ausnahmen}
          onStufe={async (stufe) => {
            await aktionen.sichtbarkeit(sichtOffen.sichtbar!, stufe, () => {});
            await neuLaden();
          }}
          onAusnahme={async (userId) => {
            await aktionen.sichtbarkeitAusnahme(sichtOffen.sichtbar!, userId, () => {});
            await neuLaden();
          }}
          onClose={() => setSichtOffen(null)}
        />
      )}

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
            /*
             * Die Altersangabe geht wirklich in die Datenbank. Vorher stand
             * hier ein Formular, an dem gar nichts hing: man trug einen
             * Erziehungsberechtigten ein und es passierte nichts.
             *
             * Das Ergebnis wird nicht abgewartet, weil das Blatt sonst
             * haengen bliebe — die Meldung kommt hinterher, und bei einem
             * Fehler (unbekannter Nutzername, unglaubwuerdiges Datum) nennt
             * sie den Grund.
             */
            if (offen.aktion === 'alter') {
              void (async () => {
                const ergebnis = await aktionen.altersangabe(
                  werte.geburtsdatum?.trim() ?? '',
                  werte.guardian?.trim() || undefined
                );
                if (!ergebnis) return;
                await neuLaden();
                onNotice(
                  ergebnis.brauchtFreigabe
                    ? `${ergebnis.alter} Jahre — die Freigabe ist angefragt`
                    : `${ergebnis.alter} Jahre — keine Freigabe nötig`
                );
              })();
              setOffen(null);
              return null;
            }

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
            setOffen(null);
            if (!offen.wahlKey) return onNotice(`${offen.label}: ${w}`);
            void (async () => {
              const ok = await einstellungSetzen(offen.wahlKey as string, w);
              if (ok) onNotice(`${offen.label}: ${w}`);
            })();
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
  auslauf: { position: 'absolute', right: 0, bottom: 0, width: 28, top: 0 },
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
