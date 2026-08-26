import React, { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { Karte, KartenSteuerung } from '../../components/Karte';
import { colors, radius, spacing, themenStyles, typography } from '../../constants/design';
import { mockFriendPins, mockUsers } from '../../mocks';

interface Props {
  onOpenProfile: (userId: string) => void;
  onNotice?: (message: string) => void;
}

/** Wem der eigene Standort gezeigt wird. */
type Freigabe = 'niemand' | 'kontakte' | 'ausgewaehlt';

const FREIGABEN: { key: Freigabe; label: string; text: string }[] = [
  { key: 'niemand', label: 'Niemand', text: 'Dein Standort bleibt privat' },
  { key: 'kontakte', label: 'Alle Kontakte', text: 'Alle deine Kontakte sehen dich' },
  { key: 'ausgewaehlt', label: 'Ausgewählte', text: 'Nur wen du freigibst' },
];

/** Prototyp-Frame "Messenger - Friend-Map": Karte plus Liste darunter. */
export const FriendMapScreen = ({ onOpenProfile, onNotice }: Props) => {
  const karte = useRef<KartenSteuerung>(null);
  const [aktiv, setAktiv] = useState<string | null>(null);
  const [sichtbar, setSichtbar] = useState(true);
  const [freigabe, setFreigabe] = useState<Freigabe>('kontakte');
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

  const pins = mockFriendPins.map((pin) => ({
    id: pin.id,
    name: mockUsers[pin.id].name,
    x: pin.x,
    y: pin.y,
  }));

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
      contentContainerStyle={[styles.content, vollbild && styles.contentVoll]}
      scrollEnabled={!vollbild}
      onLayout={(e) => setFlaeche(e.nativeEvent.layout.height)}
    >
      <Karte
        ref={karte}
        pins={pins}
        aktiv={aktiv}
        onPinPress={zeigeAufKarte}
        vollbild={vollbild}
        onVollbild={() => setVollbild((v) => !v)}
        // Im Vollbild bekommt die Karte den ganzen Bereich. flex allein reicht
        // nicht, weil die Karte eine feste Hoehe erwartet.
        hoehe={vollbild && flaeche > 0 ? flaeche : 320}
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
            <Text style={styles.freigabeSub}>
              {sichtbar ? FREIGABEN.find((f) => f.key === freigabe)?.text : 'Standort ist aus'}
            </Text>
          </View>
          <Switch
            value={sichtbar}
            onValueChange={(an) => {
              setSichtbar(an);
              onNotice?.(an ? 'Standort wird geteilt' : 'Standort ist aus');
            }}
            trackColor={{ true: colors.brand, false: colors.surface3 }}
          />
        </View>

        {sichtbar && (
          <View style={styles.optionen}>
            {FREIGABEN.map((f) => {
              const an = freigabe === f.key;
              return (
                <Druck
                  key={f.key}
                  style={[styles.option, an && styles.optionAn]}
                  onPress={() => {
                    setFreigabe(f.key);
                    onNotice?.(`Standort sichtbar für: ${f.label}`);
                  }}
                >
                  <Text style={[styles.optionText, an && styles.optionTextAn]}>{f.label}</Text>
                </Druck>
              );
            })}
          </View>
        )}
      </View>
      )}

      {!vollbild && <Text style={styles.listHead}>IN DEINER NÄHE</Text>}
      {!vollbild && mockFriendPins.map((pin) => {
        const person = mockUsers[pin.id];
        const istAktiv = aktiv === pin.id;
        return (
          <Druck
            key={pin.id}
            style={[styles.row, istAktiv && styles.rowAktiv]}
            onPress={() => zeigeAufKarte(pin.id)}
          >
            <Avatar id={pin.id} name={person.name} size={44} />
            <View style={styles.rowBody}>
              <Text style={styles.rowName}>{person.name}</Text>
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
    </ScrollView>
  );
};

const styles = themenStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xl },
  /* Im Vollbild fuellt die Karte den Bereich - kein Rand, kein Scrollen. */
  contentVoll: { flexGrow: 1, paddingTop: 0, paddingBottom: 0 },

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
