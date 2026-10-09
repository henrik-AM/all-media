/*
 * Einstellungen → Bildschirmzeit (Kasten 22).
 *
 * Ein Blatt mit Unterseiten — so wie iOS-Bildschirmzeit:
 *
 *   uebersicht   heute und die letzten 7 Tage je Bereich (nur gemessene Zahlen)
 *   gesamt       Tageslimit gesamt, werktags und am Wochenende
 *   bereiche     je Bereich: kein eigenes Limit · Immer erlaubt · Limit · Gesperrt
 *   auszeit      Zeitfenster, in dem nur „Immer erlaubt" offen ist
 *   pause        Pausen-Erinnerung alle X Minuten
 *   kinder       Eltern legen die Bildschirmzeit ihrer Kinder fest (Schema 52)
 *
 * Jede Änderung geht sofort an bildschirmzeit_setzen(). Lehnt die Datenbank
 * ab (z. B. weil die Eltern das Limit gesetzt haben), steht der Grund hier
 * im Blatt — nicht als Toast dahinter.
 *
 * Gleiches Blatt auf der Website: openBildschirmzeit() in web/public/app.js,
 * gleiche Texte aus gemeinsam/bildschirmzeit.js.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Switch, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Druck } from './Druck';
import { SheetRahmen } from './SheetRahmen';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';
import { useBildschirmzeit } from '../contexts/BildschirmzeitContext';
import { useSupabase } from '../contexts/SupabaseContext';
import {
  Bildschirmzeit,
  BzBereich,
  BzPerson,
  BzStand,
  bzElternkontrolleBeenden,
  bzMeldung,
  bzStandLaden,
} from '../lib/bildschirmzeit';

export type BzAnsicht = 'uebersicht' | 'gesamt' | 'bereiche' | 'auszeit' | 'pause' | 'kinder';
type Seite = BzAnsicht | 'menue' | `bereich:${BzBereich}`;

const TITEL: Record<string, string> = {
  uebersicht: 'Heute und letzte 7 Tage',
  gesamt: 'Tageslimit gesamt',
  bereiche: 'Limits je Bereich',
  auszeit: 'Auszeit',
  pause: 'Pausen-Erinnerung',
  kinder: 'Bildschirmzeit meiner Kinder',
  menue: 'Bildschirmzeit',
};

interface Props {
  ansicht: BzAnsicht;
  onClose: () => void;
}

export const BildschirmzeitSheet = ({ ansicht, onClose }: Props) => {
  const { supabase } = useSupabase();
  const bz = useBildschirmzeit();
  const [stapel, setStapel] = useState<Seite[]>([ansicht]);
  const [kind, setKind] = useState<BzPerson | null>(null);
  const [kindStand, setKindStand] = useState<BzStand | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  const seite = stapel[stapel.length - 1];
  const stand = kind ? kindStand : bz.stand;
  const regeln = Bildschirmzeit.normalisieren(stand?.regeln);
  const nutzung = kind ? kindStand?.nutzung ?? {} : bz.nutzungJetzt();

  const kindLaden = useCallback(async () => {
    if (!supabase || !kind) return;
    setKindStand(await bzStandLaden(supabase, kind.id));
  }, [supabase, kind]);
  useEffect(() => {
    void kindLaden();
  }, [kindLaden]);

  const zu = (s: Seite) => {
    setMeldung(null);
    setStapel((alt) => [...alt, s]);
  };
  const zurueck = () => {
    setMeldung(null);
    if (stapel.length <= 1) return onClose();
    const neu = stapel.slice(0, -1);
    // Zurück aus dem Kind-Menü: wieder die eigenen Regeln.
    if (seite === 'menue') {
      setKind(null);
      setKindStand(null);
    }
    setStapel(neu);
  };

  /** Eine Änderung speichern — sofort, mit Grund im Blatt bei Ablehnung. */
  const aendern = async (f: (r: ReturnType<typeof Bildschirmzeit.normalisieren>) => void) => {
    const neu = JSON.parse(JSON.stringify(regeln));
    f(neu);
    const fehler = Bildschirmzeit.pruefen(Bildschirmzeit.normalisieren(neu));
    if (fehler) return setMeldung(fehler);
    const a = await bz.speichern(neu, kind?.id ?? null);
    if (!a.ok) return setMeldung(bzMeldung(a));
    setMeldung(null);
    if (kind) await kindLaden();
  };

  const zeile = (text: string, neben: string, onPress?: () => void, haken?: boolean, key?: string) => (
    <Druck key={key ?? text} style={styles.zeile} onPress={onPress} disabled={!onPress}>
      <Text style={styles.zeileText} numberOfLines={1}>{text}</Text>
      {!!neben && <Text style={styles.neben}>{neben}</Text>}
      {haken ? <Ionicons name="checkmark" size={20} color={colors.brand} /> : null}
      {onPress && haken === undefined ? <Ionicons name="chevron-forward" size={18} color={colors.text3} /> : null}
    </Druck>
  );

  const kopf = (text: string) => <Text style={styles.kopf}>{text}</Text>;

  const chips = (werte: (number | null)[], aktuell: number | null, text: (w: number | null) => string, wahl: (w: number | null) => void) => (
    <ChipReihe werte={werte} aktuell={aktuell} text={text} wahl={wahl} />
  );

  const inhalt = () => {
    if (!stand) return <Text style={styles.hinweis}>Wird geladen …</Text>;

    if (seite === 'menue') {
      return (
        <>
          {(['uebersicht', 'gesamt', 'bereiche', 'auszeit', 'pause'] as const).map((p) =>
            zeile(TITEL[p], Bildschirmzeit.wertText(p, regeln, nutzung), () => zu(p))
          )}
          <Druck
            style={styles.gefahr}
            onPress={async () => {
              if (!supabase || !kind) return;
              const a = await bzElternkontrolleBeenden(supabase, kind.id);
              if (!a.ok) return setMeldung(bzMeldung(a));
              setMeldung(`${kind.name} kann die Bildschirmzeit jetzt selbst ändern.`);
              await kindLaden();
            }}
          >
            <Text style={styles.gefahrText}>Elternkontrolle beenden</Text>
          </Druck>
        </>
      );
    }

    if (seite === 'kinder') {
      const kinder = bz.stand?.kinder ?? [];
      if (!kinder.length) return <Text style={styles.hinweis}>Mit deinem Konto ist kein Kinderkonto verknüpft.</Text>;
      return (
        <>
          <Text style={styles.hinweis}>
            Was du hier festlegst, kann dein Kind nur strenger machen. Entsperren geht mit deinem Entsperrcode.
          </Text>
          {kinder.map((k) =>
            zeile(k.name, k.handle, () => {
              setKind(k);
              setKindStand(null);
              zu('menue');
            }, undefined, k.id)
          )}
        </>
      );
    }

    if (seite === 'uebersicht') {
      const woche = Bildschirmzeit.woche(stand.woche, stand.tag);
      // Heute mit der noch nicht geschickten Zeit (eigenes Konto).
      woche[6] = { ...woche[6], bereiche: { ...nutzung }, gesamt: Bildschirmzeit.summe(nutzung) };
      const max = Math.max(60, ...woche.map((t) => t.gesamt));
      const genutzt = Bildschirmzeit.BEREICHE.filter((b) => (nutzung[b.key] ?? 0) > 0);
      return (
        <>
          {kopf(`Heute · ${Bildschirmzeit.dauerText(Bildschirmzeit.summe(nutzung))}`)}
          {genutzt.length
            ? genutzt.map((b) => zeile(b.label, Bildschirmzeit.dauerText(nutzung[b.key] ?? 0)))
            : <Text style={styles.hinweis}>Heute wurde noch nichts gemessen.</Text>}
          {kopf('Letzte 7 Tage')}
          <View style={styles.balken} accessibilityLabel="Nutzung der letzten 7 Tage">
            {woche.map((t) => (
              <View key={t.tag} style={styles.balkenSpalte}>
                <View style={styles.balkenRahmen}>
                  <View style={[styles.balkenFuell, { height: `${Math.round((t.gesamt / max) * 100)}%` }]} />
                </View>
                <Text style={styles.balkenTag}>{t.wochentag}</Text>
              </View>
            ))}
          </View>
          {woche
            .slice()
            .reverse()
            .map((t) => zeile(`${t.wochentag}, ${t.tag.slice(8, 10)}.${t.tag.slice(5, 7)}.`, Bildschirmzeit.dauerText(t.gesamt), undefined, undefined, t.tag))}
          <Text style={styles.hinweis}>Gezählt wird nur, solange ein Bereich offen und im Vordergrund ist — App und Website zusammen.</Text>
        </>
      );
    }

    if (seite === 'gesamt') {
      const w = regeln.gesamt.werktag;
      const we = regeln.gesamt.wochenende;
      return (
        <>
          <Text style={styles.hinweis}>Ist es erreicht, bleiben nur Bereiche mit „Immer erlaubt" offen. Sie zählen nicht mit.</Text>
          {kopf('Werktags (Mo–Fr)')}
          {chips([null, ...Bildschirmzeit.GESAMT_MINUTEN], w, (x) => Bildschirmzeit.minutenText(x), (x) =>
            aendern((r) => {
              r.gesamt.werktag = x;
              if (x == null) r.gesamt.wochenende = null;
            })
          )}
          {w != null && kopf('Am Wochenende (Sa, So)')}
          {w != null &&
            chips([null, ...Bildschirmzeit.GESAMT_MINUTEN], we, (x) => (x == null ? 'Wie werktags' : Bildschirmzeit.minutenText(x)), (x) =>
              aendern((r) => {
                r.gesamt.wochenende = x;
              })
            )}
        </>
      );
    }

    if (seite === 'bereiche') {
      return (
        <>
          <Text style={styles.hinweis}>Die Bereiche tun Verschiedenes — leg für jeden fest, wie lange er offen sein darf.</Text>
          {Bildschirmzeit.BEREICHE.map((b) =>
            zeile(b.label, Bildschirmzeit.bereichWertText(regeln, b.key), () => zu(`bereich:${b.key}`), undefined, b.key)
          )}
        </>
      );
    }

    if (seite.startsWith('bereich:')) {
      const key = seite.slice(8) as BzBereich;
      const b = Bildschirmzeit.BEREICHE.find((x) => x.key === key)!;
      const modus = Bildschirmzeit.modusVon(regeln, key);
      const e = regeln.bereiche[key];
      return (
        <>
          <Text style={styles.hinweis}>{b.hinweis}</Text>
          {Bildschirmzeit.MODI.map((m) => (
            <Druck
              key={m.key}
              style={styles.modus}
              onPress={() =>
                aendern((r) => {
                  if (m.key === 'standard') delete r.bereiche[key];
                  else if (m.key === 'limit') r.bereiche[key] = { modus: 'limit', werktag: e?.werktag ?? 30, wochenende: e?.wochenende ?? null };
                  else r.bereiche[key] = { modus: m.key };
                })
              }
              accessibilityRole="radio"
              accessibilityState={{ selected: modus === m.key }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.zeileText}>{m.label}</Text>
                <Text style={styles.klein}>{m.hinweis}</Text>
              </View>
              {modus === m.key && <Ionicons name="checkmark" size={20} color={colors.brand} />}
            </Druck>
          ))}
          {modus === 'limit' && (
            <>
              {kopf('Werktags (Mo–Fr)')}
              {chips(Bildschirmzeit.LIMIT_MINUTEN, e?.werktag ?? null, (x) => Bildschirmzeit.minutenText(x), (x) =>
                aendern((r) => {
                  r.bereiche[key] = { ...r.bereiche[key]!, modus: 'limit', werktag: x };
                })
              )}
              {kopf('Am Wochenende (Sa, So)')}
              {chips([null, ...Bildschirmzeit.LIMIT_MINUTEN], e?.wochenende ?? null, (x) => (x == null ? 'Wie werktags' : Bildschirmzeit.minutenText(x)), (x) =>
                aendern((r) => {
                  r.bereiche[key] = { ...r.bereiche[key]!, modus: 'limit', wochenende: x };
                })
              )}
            </>
          )}
        </>
      );
    }

    if (seite === 'auszeit') {
      const a = regeln.auszeit;
      return (
        <>
          <View style={styles.zeile}>
            <Text style={styles.zeileText}>Auszeit</Text>
            <Switch
              value={a.an}
              onValueChange={(an) => aendern((r) => {
                r.auszeit.an = an;
              })}
              trackColor={{ true: colors.brand, false: colors.surface3 }}
              accessibilityLabel="Auszeit"
            />
          </View>
          <Text style={styles.hinweis}>{Bildschirmzeit.TEXTE.auszeitErklaerung}</Text>
          {kopf('Beginn')}
          {chips(Bildschirmzeit.UHRZEITEN.map(Bildschirmzeit.minuteAus), Bildschirmzeit.minuteAus(a.von), (x) => Bildschirmzeit.uhrzeit(x ?? 0), (x) =>
            aendern((r) => {
              r.auszeit.von = Bildschirmzeit.uhrzeit(x ?? 0);
            })
          )}
          {kopf('Ende')}
          {chips(Bildschirmzeit.UHRZEITEN.map(Bildschirmzeit.minuteAus), Bildschirmzeit.minuteAus(a.bis), (x) => Bildschirmzeit.uhrzeit(x ?? 0), (x) =>
            aendern((r) => {
              r.auszeit.bis = Bildschirmzeit.uhrzeit(x ?? 0);
            })
          )}
        </>
      );
    }

    // pause
    return (
      <>
        <Text style={styles.hinweis}>Nach so vielen Minuten am Stück erinnert dich All Media an eine Pause. Fünf Minuten weg zählen als Pause.</Text>
        {Bildschirmzeit.PAUSE_MINUTEN.map((p) =>
          zeile(p ? `Alle ${Bildschirmzeit.minutenText(p)}` : 'Aus', '', () => aendern((r) => {
            r.pause = p;
          }), regeln.pause === p, String(p))
        )}
      </>
    );
  };

  const titel = seite.startsWith('bereich:')
    ? Bildschirmzeit.bereichName(seite.slice(8))
    : kind && seite !== 'kinder'
      ? `${TITEL[seite]} · ${kind.name}`
      : TITEL[seite];

  return (
    <SheetRahmen visible title={titel} onClose={zurueck} hoch>
      <ScrollView contentContainerStyle={styles.inhalt} keyboardShouldPersistTaps="handled">
        {!kind && bz.stand?.eltern && seite !== 'uebersicht' && seite !== 'kinder' && (
          <Text style={styles.eltern}>{Bildschirmzeit.TEXTE.elternGesetzt(bz.stand.eltern.name)}</Text>
        )}
        {!!meldung && <Text style={styles.meldung} accessibilityRole="alert">{meldung}</Text>}
        {inhalt()}
      </ScrollView>
    </SheetRahmen>
  );
};

/**
 * Eine waagerechte Auswahl. Die gewählte Zahl/Uhrzeit wird beim Aufbau in die
 * Mitte gerollt — sonst stünde „22:00" weit rechts außer Sicht.
 */
const ChipReihe = ({
  werte,
  aktuell,
  text,
  wahl,
}: {
  werte: (number | null)[];
  aktuell: number | null;
  text: (w: number | null) => string;
  wahl: (w: number | null) => void;
}) => {
  const ref = useRef<ScrollView>(null);
  const breite = useRef(0);
  const gerollt = useRef(false);
  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
      onLayout={(e) => {
        breite.current = e.nativeEvent.layout.width;
      }}
    >
      {werte.map((w) => (
        <Druck
          key={String(w)}
          style={[styles.chip, aktuell === w && styles.chipAn]}
          onPress={() => wahl(w)}
          onLayout={(e: any) => {
            if (aktuell !== w || gerollt.current) return;
            gerollt.current = true;
            const { x, width } = e.nativeEvent.layout;
            ref.current?.scrollTo({ x: Math.max(0, x - breite.current / 2 + width / 2), animated: false });
          }}
          accessibilityState={{ selected: aktuell === w }}
        >
          <Text style={[styles.chipText, aktuell === w && styles.chipTextAn]}>{text(w)}</Text>
        </Druck>
      ))}
    </ScrollView>
  );
};

const styles = themenStyles((colors) => ({
  inhalt: { paddingBottom: spacing.xxl },
  zeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  zeileText: { flex: 1, ...typography.body, color: colors.text },
  neben: { ...typography.preview, color: colors.text3 },
  modus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  klein: { ...typography.small, color: colors.text3, marginTop: 2 },
  kopf: { ...typography.overline, color: colors.text3, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  hinweis: { ...typography.small, color: colors.text2, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  eltern: { ...typography.small, color: colors.brand, backgroundColor: colors.brandSoft, padding: spacing.md, margin: spacing.md, borderRadius: radius.md },
  meldung: { ...typography.small, color: colors.danger, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  chips: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  chipAn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { ...typography.small, color: colors.text2, fontWeight: '600' },
  chipTextAn: { color: '#fff' },
  balken: { flexDirection: 'row', height: 120, paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: 'flex-end' },
  balkenSpalte: { flex: 1, alignItems: 'center', gap: 4, height: '100%' },
  balkenRahmen: { flex: 1, width: '70%', justifyContent: 'flex-end', backgroundColor: colors.surface2, borderRadius: 6, overflow: 'hidden' },
  balkenFuell: { width: '100%', backgroundColor: colors.brand, borderRadius: 6 },
  balkenTag: { ...typography.small, color: colors.text3 },
  gefahr: { margin: spacing.lg, paddingVertical: 12, alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger },
  gefahrText: { color: colors.danger, fontWeight: '600' },
}));
