/*
 * Einstellungen → Farbfilter (Kasten 21, 06.10.2026).
 *
 * Aufbau wie auf der Website (openFarbfilter in web/public/app.js), Texte
 * wörtlich aus gemeinsam/farbfilter.js:
 *
 *   Einleitung · Schalter · Vorschau (Farbstifte + Regenbogen, Knopf zum
 *   Vergleichen) · Filterliste mit Wofür-Satz · Intensität · Farbton (nur
 *   bei Farbtönung) · Zurücksetzen
 *
 * Die Vorschau zeigt die echten Farben — gefiltert werden sie wie alles
 * andere durch die Flächen über dem Blatt. „Vorher" sieht man, solange man
 * den Vergleichsknopf gedrückt hält (der Filter ist dann aus); ein zweites,
 * vorgerechnetes „Nachher"-Bild wäre unter dem aktiven Filter doppelt
 * gefiltert und damit falsch.
 *
 * Die Regler zeigen beim Ziehen sofort (Entwurf im FarbfilterContext) und
 * speichern beim Loslassen — sonst ginge bei jedem Pixel eine Anfrage an
 * Supabase.
 */
import React, { useRef, useState } from 'react';
import { PanResponder, Platform, ScrollView, Switch, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';

import { Druck } from './Druck';
import { SheetRahmen } from './SheetRahmen';
import { useFarbfilter } from './Farbfilter';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';

const Farbfilter = require('../../gemeinsam/farbfilter') as typeof import('../../gemeinsam/farbfilter');
const S = Farbfilter.SCHLUESSEL;

interface Props {
  onClose: () => void;
  onNotice?: (text: string) => void;
}

export const FarbfilterSheet = ({ onClose, onNotice }: Props) => {
  const { konfig, entwurf, speichern, zuruecksetzen, vergleichen } = useFarbfilter();
  const aktiv = Farbfilter.aktiv(konfig);

  const sichern = async (schluessel: string, wert: string) => {
    const ok = await speichern(schluessel, wert);
    if (!ok) onNotice?.('Einstellung konnte nicht gespeichert werden');
    return ok;
  };

  const waehlen = async (art: string) => {
    const warAn = konfig.an;
    await sichern(S.art, art);
    // Wer einen Filter antippt, will ihn sehen — iOS graut die Liste aus,
    // solange der Schalter aus ist; hier schaltet die Wahl ihn ein.
    if (!warAn) await sichern(S.an, 'an');
  };

  const reglerFertig = async (schluessel: string, wert: number) => {
    await sichern(schluessel, String(wert));
    if (!konfig.an) await sichern(S.an, 'an');
  };

  return (
    <SheetRahmen
      visible
      hoch
      title="Farbfilter"
      onClose={() => {
        vergleichen(false);
        onClose();
      }}
    >
      <ScrollView contentContainerStyle={styles.inhalt} testID="farbfilter-blatt">
        <Text style={styles.einleitung}>{Farbfilter.EINLEITUNG}</Text>

        <View style={styles.zeile}>
          <Ionicons name="color-palette-outline" size={20} color={colors.text2} />
          <Text style={styles.zeileText}>Farbfilter</Text>
          <Switch
            value={konfig.an}
            onValueChange={(an) => void sichern(S.an, an ? 'an' : 'aus')}
            trackColor={{ true: colors.brand, false: colors.surface3 }}
            accessibilityLabel="Farbfilter"
          />
        </View>

        <Text style={styles.kopf}>Vorschau</Text>
        <View style={styles.vorschau} accessibilityLabel="Vorschau: Farbstifte">
          <View style={styles.stifte}>
            {Farbfilter.VORSCHAU.map((v) => (
              <View key={v.name} style={styles.stift}>
                <View style={[styles.spitze, { borderBottomColor: '#E9C99B' }]} />
                <View style={[styles.mine, { backgroundColor: v.farbe }]} />
                <View style={[styles.schaft, { backgroundColor: v.farbe }]} />
                <Text style={styles.stiftName} numberOfLines={1}>{v.name}</Text>
              </View>
            ))}
          </View>
          <LinearGradient
            colors={['#ff0000', '#ff8000', '#ffff00', '#00c000', '#00c0c0', '#0060ff', '#8000ff', '#ff00a0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.verlauf}
          />
          <Druck
            style={[styles.vergleich, !aktiv && styles.aus]}
            disabled={!aktiv}
            onPressIn={() => vergleichen(true)}
            onPressOut={() => vergleichen(false)}
            accessibilityRole="button"
            accessibilityLabel={Farbfilter.VERGLEICH_TEXT}
          >
            <Text style={styles.vergleichText}>{Farbfilter.VERGLEICH_TEXT}</Text>
          </Druck>
        </View>

        <Text style={styles.kopf}>Filter</Text>
        <View accessibilityRole="radiogroup">
          {Farbfilter.FILTER.map((f) => {
            const gewaehlt = konfig.art === f.id;
            return (
              <Druck
                key={f.id}
                style={styles.wahl}
                onPress={() => void waehlen(f.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: gewaehlt }}
                accessibilityLabel={f.name}
                testID={`farbfilter-${f.id}`}
              >
                <View style={styles.wahlText}>
                  <Text style={styles.wahlName}>{f.name}</Text>
                  <Text style={styles.wahlKurz}>{f.kurz}</Text>
                  {!f.appExakt && <Text style={styles.hinweis}>{Farbfilter.APP_HINWEIS}</Text>}
                </View>
                {gewaehlt && <Ionicons name="checkmark" size={20} color={colors.brand} />}
              </Druck>
            );
          })}
        </View>

        <Regler
          titel="Intensität"
          wert={konfig.staerke}
          min={0}
          max={100}
          text={`${konfig.staerke} %`}
          onZiehen={(v) => entwurf(S.staerke, String(v))}
          onFertig={(v) => void reglerFertig(S.staerke, v)}
        />
        {konfig.art === 'farbton' && (
          <Regler
            titel="Farbton"
            wert={konfig.farbton}
            min={0}
            max={359}
            text={`${konfig.farbton}°`}
            punkt={Farbfilter.tonHex(konfig.farbton)}
            verlauf={['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000']}
            onZiehen={(v) => entwurf(S.farbton, String(v))}
            onFertig={(v) => void reglerFertig(S.farbton, v)}
          />
        )}

        <Druck
          style={styles.zurueck}
          onPress={() =>
            void (async () => {
              const ok = await zuruecksetzen();
              onNotice?.(ok ? 'Farbfilter zurückgesetzt' : 'Nicht alles ließ sich zurücksetzen');
            })()
          }
          accessibilityRole="button"
        >
          <Text style={styles.zurueckText}>Zurücksetzen</Text>
        </Druck>
      </ScrollView>
    </SheetRahmen>
  );
};

/*
 * Ein Regler ohne Zusatzpaket. `@react-native-community/slider` ist nicht
 * installiert, und ein neues natives Paket ginge an Expo Go vorbei — also
 * eine Bahn mit PanResponder. Für VoiceOver/TalkBack ist er „adjustable":
 * Wischen hoch/runter verstellt in Zehnteln.
 */
const Regler = ({
  titel,
  wert,
  min,
  max,
  text,
  punkt,
  verlauf,
  onZiehen,
  onFertig,
}: {
  titel: string;
  wert: number;
  min: number;
  max: number;
  text: string;
  punkt?: string;
  verlauf?: string[];
  onZiehen: (v: number) => void;
  onFertig: (v: number) => void;
}) => {
  const bahn = useRef<View>(null);
  const lage = useRef({ x: 0, breite: 1 });
  const letzter = useRef(wert);
  const [breite, setBreite] = useState(0);

  const ausX = (seiteX: number) => {
    const anteil = Math.min(1, Math.max(0, (seiteX - lage.current.x) / Math.max(1, lage.current.breite)));
    return Math.round(min + anteil * (max - min));
  };

  // Die Rückrufe ändern sich mit jedem Bild; der PanResponder entsteht nur einmal.
  const rueckrufe = useRef({ onZiehen, onFertig });
  rueckrufe.current = { onZiehen, onFertig };

  const greifer = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      // Die ScrollView darunter soll den Finger nicht übernehmen.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        bahn.current?.measureInWindow((x, _y, b) => {
          lage.current = { x, breite: b };
        });
        const v = ausX(e.nativeEvent.pageX);
        letzter.current = v;
        rueckrufe.current.onZiehen(v);
      },
      onPanResponderMove: (e) => {
        const v = ausX(e.nativeEvent.pageX);
        if (v === letzter.current) return;
        letzter.current = v;
        rueckrufe.current.onZiehen(v);
      },
      onPanResponderRelease: () => rueckrufe.current.onFertig(letzter.current),
      onPanResponderTerminate: () => rueckrufe.current.onFertig(letzter.current),
    })
  ).current;

  const anteil = (wert - min) / (max - min);
  const schritt = Math.max(1, Math.round((max - min) / 10));

  return (
    <View style={styles.regler}>
      <View style={styles.reglerKopf}>
        <Text style={styles.reglerTitel}>{titel}</Text>
        {punkt ? <View style={[styles.tonPunkt, { backgroundColor: punkt }]} /> : <Text style={styles.reglerWert}>{text}</Text>}
      </View>
      <View
        ref={bahn}
        style={styles.greifflaeche}
        onLayout={() =>
          bahn.current?.measureInWindow((x, _y, b) => {
            lage.current = { x, breite: b };
            setBreite(b);
          })
        }
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={titel}
        accessibilityValue={{ min, max, now: wert, text }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => {
          const v = Math.min(max, Math.max(min, wert + (e.nativeEvent.actionName === 'increment' ? schritt : -schritt)));
          onZiehen(v);
          onFertig(v);
        }}
        {...greifer.panHandlers}
      >
        {verlauf ? (
          <LinearGradient colors={verlauf as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.bahnBunt} />
        ) : (
          <View style={styles.bahn}>
            <View style={[styles.bahnVoll, { width: `${anteil * 100}%` }]} />
          </View>
        )}
        <View
          pointerEvents="none"
          style={[styles.knopf, { left: Math.max(0, anteil * breite - 13) }]}
        />
      </View>
    </View>
  );
};

const styles = themenStyles((colors) => ({
  inhalt: { paddingBottom: spacing.xxl },
  einleitung: { ...typography.small, color: colors.text2, lineHeight: 19, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  zeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    height: 54,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  zeileText: { flex: 1, ...typography.body, color: colors.text },
  kopf: { ...typography.overline, color: colors.text3, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  vorschau: { marginHorizontal: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface2 },
  stifte: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  stift: { width: 30, alignItems: 'center' },
  // Holzspitze als Dreieck aus Rändern, darüber die Mine in der Stiftfarbe.
  spitze: {
    width: 0,
    height: 0,
    borderLeftWidth: 15,
    borderRightWidth: 15,
    borderBottomWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  mine: { position: 'absolute', top: 0, width: 8, height: 6, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  schaft: { width: 30, height: 48, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  stiftName: { fontSize: 10, color: colors.text3, marginTop: 4 },
  verlauf: { height: 14, borderRadius: 7, marginTop: spacing.md },
  vergleich: {
    marginTop: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aus: { opacity: 0.45 },
  vergleichText: { ...typography.small, fontWeight: '600', color: colors.text },
  wahl: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  wahlText: { flex: 1, minWidth: 0, gap: 2 },
  wahlName: { ...typography.body, color: colors.text },
  wahlKurz: { ...typography.small, color: colors.text3, lineHeight: 18 },
  hinweis: { ...typography.small, fontSize: 12, color: colors.text2, fontStyle: 'italic', lineHeight: 17, marginTop: 2 },
  regler: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  reglerKopf: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  reglerTitel: { ...typography.body, fontWeight: '600', color: colors.text },
  reglerWert: { ...typography.body, color: colors.text2 },
  tonPunkt: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: colors.border },
  greifflaeche: { height: 32, justifyContent: 'center' },
  bahn: { height: 6, borderRadius: 3, backgroundColor: colors.surface3, overflow: 'hidden' },
  bahnVoll: { height: 6, backgroundColor: colors.brand },
  bahnBunt: { height: 12, borderRadius: 6 },
  knopf: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: Platform.OS === 'ios' ? 0.5 : 1,
    borderColor: 'rgba(0,0,0,0.15)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  zurueck: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  zurueckText: { ...typography.body, fontWeight: '600', color: colors.danger },
}));
