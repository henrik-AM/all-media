import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { KarteWeb, KartenSteuerung, Pin } from '../../components/KarteWeb';
import { avatarColor, colors, radius, spacing, themenStyles, typography } from '../../constants/design';
import { useDaten } from '../../contexts/DatenContext';
import { SichtbarkeitSheet } from '../../components/SichtbarkeitSheet';
import { useAktionen } from '../../lib/useAktionen';
import { SichtbarkeitStufe } from '../../lib/aktionen';

interface Props {
  onOpenProfile: (userId: string) => void;
  onEditSelectedContacts?: () => void;
  onNotice?: (message: string) => void;
}

/*
 * Wem der eigene Standort gezeigt wird.
 *
 * Hier standen bis zum 03.09.2026 drei eigene Stufen — „Niemand / Alle
 * Kontakte / Ausgewählte" — in einem `useState`, der nichts speicherte.
 * Unter Einstellungen → Messenger → Standort-Sichtbarkeit standen zur selben
 * Sache vier Stufen mit Ausnahmeliste, und die gingen in die Datenbank.
 *
 * Zwei Wahlen für dieselbe Frage, die voneinander nichts wussten: wer hier
 * „Ausgewählte" einstellte, fand das in den Einstellungen nicht wieder, und
 * umgekehrt. Jetzt ist es eine Einstellung, an zwei Orten bedienbar —
 * dieselbe wie überall, `visibility_settings` mit Bereich `standort`.
 */
const STUFEN_TEXT: Record<SichtbarkeitStufe, string> = {
  niemand: 'Dein Standort bleibt privat',
  niemand_bis_auf: 'Nur wen du freigibst',
  alle_bis_auf: 'Alle deine Kontakte bis auf die, die du ausnimmst',
  alle: 'Alle deine Kontakte sehen dich',
};

const STUFEN_NAME: Record<SichtbarkeitStufe, string> = {
  niemand: 'Niemand',
  niemand_bis_auf: 'Niemand bis auf …',
  alle_bis_auf: 'Alle bis auf …',
  alle: 'Alle',
};

/** Prototyp-Frame "Messenger - Friend-Map": Karte plus Liste darunter. */
export const FriendMapScreen = ({ onOpenProfile, onEditSelectedContacts, onNotice }: Props) => {
  const { friendPins: alleKartenpunkte, users: alleNutzer, neuLaden } = useDaten();
  const insets = useSafeAreaInsets();
  const karte = useRef<KartenSteuerung>(null);
  const [aktiv, setAktiv] = useState<string | null>(null);
  const { sichtbarkeit } = useDaten();
  const aktionen = useAktionen(onNotice);
  const [sichtOffen, setSichtOffen] = useState(false);

  const sicht = sichtbarkeit.standort ?? { stufe: 'alle' as SichtbarkeitStufe, ausnahmen: [] };
  const sichtbar = sicht.stufe !== 'niemand';

  /*
   * Der Schalter ist die schnelle Geste: aus heißt „Niemand", an holt die
   * weiteste Stufe zurück. Er ist kein zweiter Speicher — sonst stünde der
   * Schalter auf „an" und die Stufe auf „Niemand", und beide hätten recht.
   */
  const schalten = (an: boolean) => {
    void (async () => {
      await aktionen.sichtbarkeit('standort', an ? 'alle' : 'niemand', () => {});
      await neuLaden();
    })();
    onNotice?.(an ? 'Standort wird geteilt' : 'Standort ist aus');
  };
  /*
   * Vollbild: die Karte füllt den Bereich, Freigabe und Liste treten zurück.
   * Henrik hatte das für die Website gefordert („Vollbild-Pfeil statt
   * Plus/Minus") — in der App war es liegen geblieben.
   */
  const [vollbild, setVollbild] = useState(false);
  /*
   * Die sichtbare Hoehe des Bereichs. Sie wird gemessen und nicht geraten:
   * die Karte rechnet mit `hoehe` (Zoomweg, Mittigsetzen einer Nadel), ein
   * geschaetzter Wert wuerde die Nadel beim Hineinzoomen danebensetzen.
   */
  const [flaeche, setFlaeche] = useState(0);

  const percentToCoords = (x: number, y: number): [number, number] => {
    const lat = 55.1 - ((y / 100) * (55.1 - 47.3));
    const lng = 5.9 + ((x / 100) * (15.0 - 5.9));
    return [lat, lng];
  };

  const pins: Pin[] = alleKartenpunkte.map((pin) => {
    const [lat, lng] = percentToCoords(pin.x, pin.y);
    const user = alleNutzer[pin.id];
    return {
      id: pin.id,
      name: user?.name || 'Unbekannt',
      lat,
      lng,
      // Dieselbe Farbe wie der Avatar in der Liste darunter - sonst laesst
      // sich eine Nadel keiner Zeile zuordnen.
      farbe: avatarColor(pin.id),
    };
  });

  /**
   * Tippen auf einen Kontakt zoomt auf der Karte zu ihm - vorher landete man
   * im Bereich Videos, was aus der Karte heraus nicht passt.
   */
  const zeigeAufKarte = (id: string) => {
    setAktiv(id);
    karte.current?.zoomAuf(id);
  };

  return (
    <ScrollView
      style={styles.screen}
      /*
       * Hier stand `insets.top + spacing.md`. Den Platz fuer die Insel und
       * die Statusleiste macht aber schon App.tsx frei (`inselPlatz`) — der
       * Abstand wurde also zweimal gezaehlt, und ueber der Karte klaffte ein
       * Streifen von knapp achtzig Punkten. Kein anderer Bildschirm rechnet
       * hier mit `insets`.
       */
      contentContainerStyle={[styles.content, vollbild && styles.contentVoll, { paddingTop: vollbild ? 0 : spacing.md }]}
      scrollEnabled={!vollbild}
      onLayout={(e) => setFlaeche(e.nativeEvent.layout.height)}
    >
      <KarteWeb
        ref={karte}
        pins={pins}
        aktiv={aktiv}
        onPinPress={zeigeAufKarte}
        vollbild={vollbild}
        onVollbild={() => setVollbild((v) => !v)}
        hoehe={vollbild && flaeche > 0 ? flaeche : 320}
        /* Henrik: "Standort ausschalten wird nicht beachtet - der Nutzer wird
           noch angezeigt." Der Schalter und die Freigabe "Niemand" nehmen die
           eigene Nadel jetzt wirklich von der Karte. */
        eigenerStandort={sichtbar ? { lat: 52.52, lng: 13.405 } : null}
      />

      {/* Standort-Freigabe: steht bewusst ueber der Liste, weil es die Frage
          ist, die man sich zuerst stellt. Im Vollbild gehoert der Platz
          ganz der Karte. */}
      {!vollbild && (
      <View style={styles.freigabe}>
        <View style={styles.freigabeKopf}>
          <Ionicons name="location-outline" size={19} color={colors.brand} />
          <View style={styles.freigabeText}>
            <Text style={styles.freigabeTitel}>Deinen Standort teilen</Text>
            <Text style={styles.freigabeSub}>{STUFEN_TEXT[sicht.stufe]}</Text>
          </View>
          <Switch
            value={sichtbar}
            onValueChange={schalten}
            trackColor={{ true: colors.brand, false: colors.surface3 }}
          />
        </View>

        {/*
          Eine Zeile statt drei Knöpfen. Vier Stufen samt Ausnahmeliste
          passen nicht nebeneinander, und der Prototyp will hier ohnehin
          keine Wahlleiste — er will wissen, was gerade gilt.
        */}
        <Druck style={styles.stufeZeile} onPress={() => setSichtOffen(true)}>
          <Text style={styles.stufeLabel}>Sichtbar für</Text>
          <Text style={styles.stufeWert}>
            {STUFEN_NAME[sicht.stufe]}
            {sicht.ausnahmen.length > 0 && sicht.stufe !== 'alle' && sicht.stufe !== 'niemand'
              ? ` (${sicht.ausnahmen.length})`
              : ''}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.text3} />
        </Druck>
      </View>
      )}

      {!vollbild && <Text style={styles.listHead}>IN DEINER NÄHE</Text>}
      {!vollbild && alleKartenpunkte.map((pin) => {
        const person = alleNutzer[pin.id];
        const istAktiv = aktiv === pin.id;
        const name = person?.name || 'Unbekannt';
        return (
          <Druck
            key={pin.id}
            style={[styles.row, istAktiv && styles.rowAktiv]}
            onPress={() => zeigeAufKarte(pin.id)}
          >
            <Avatar id={pin.id} name={name} size={44} />
            <View style={styles.rowBody}>
              <Text style={styles.rowName}>{name}</Text>
              <Text style={styles.rowSub}>
                {pin.place} · {pin.when}
              </Text>
            </View>
            {/* Zum Profil geht es weiterhin - aber ausdruecklich ueber diesen
                Knopf, nicht mehr durch Tippen auf die ganze Zeile. */}
            <Druck
              hitSlop={8}
              style={styles.profilBtn}
              onPress={() => onOpenProfile(pin.id)}
            >
              <Ionicons name="person-circle-outline" size={24} color={colors.text3} />
            </Druck>
          </Druck>
        );
      })}

      {/*
        Dasselbe Blatt wie in den Einstellungen — vier Stufen samt
        Ausnahmeliste. Wer hier etwas umstellt, findet es unter
        Einstellungen → Messenger → Standort-Sichtbarkeit wieder, und
        umgekehrt. Vorher waren es zwei Wahlen, die voneinander nichts
        wussten.
      */}
      {sichtOffen && (
      <SichtbarkeitSheet
        visible
        titel="Standort sichtbar für"
        stufe={sicht.stufe}
        ausnahmen={sicht.ausnahmen}
        onStufe={async (stufe) => {
          await aktionen.sichtbarkeit('standort', stufe, () => {});
          await neuLaden();
        }}
        onAusnahme={async (userId) => {
          await aktionen.sichtbarkeitAusnahme('standort', userId, () => {});
          await neuLaden();
        }}
        onClose={() => setSichtOffen(false)}
      />
      )}
    </ScrollView>
  );
};

const styles = themenStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xl },
  /* Im Vollbild fuellt die Karte den Bereich - kein Rand, kein Scrollen. */
  contentVoll: { flexGrow: 1, paddingTop: 0, paddingBottom: 0 },

  /* Die Zeile "Sichtbar für …" unter dem Schalter. */
  stufeZeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  stufeLabel: { flex: 1, ...typography.body, color: colors.text },
  stufeWert: { ...typography.body, color: colors.text2 },

  freigabe: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
  },
  freigabeKopf: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  freigabeText: { flex: 1 },
  freigabeTitel: { color: colors.text, ...typography.name },
  freigabeSub: { color: colors.text2, marginTop: 2, ...typography.small },
  optionen: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  /* Wie die Filter im Messenger: nicht gewählt ist nur eine Linie, gewählt
     trägt die Markenfarbe. Drei graue Kacheln nebeneinander sind unruhig. */
  option: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionAn: { backgroundColor: colors.brand, borderColor: 'transparent' },
  optionText: { color: colors.text2, fontSize: 13, fontWeight: '600' },
  optionTextAn: { color: colors.white },

  bearbeitenLink: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    borderColor: colors.brand,
  },
  bearbeitenLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  bearbeitenLinkText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.brand,
    flex: 1,
  },
  listHead: {
    ...typography.overline,
    color: colors.text3,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
  },
  rowAktiv: { backgroundColor: colors.brandSoft },
  rowBody: { flex: 1 },
  rowName: { ...typography.name, color: colors.text },
  rowSub: { ...typography.preview, color: colors.text2, marginTop: 2 },
  profilBtn: { padding: 2 },
}));
