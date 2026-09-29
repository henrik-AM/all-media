/**
 * Story bearbeiten und posten — Kasten 11.5 und 11.6.
 *
 * WARUM ES DAS GIBT
 *
 * Henrik am 21.09.2026: „Story-Bearbeitung fehlt komplett: kein Text, keine
 * Filter, keine Schrift, kein Markieren von Personen. Vorbild Instagram,
 * TikTok, WhatsApp." Bis dahin ging eine Aufnahme aus der Kamera ohne
 * Zwischenschritt in die Story.
 *
 * Und: „Beim Hochladen aus der Story-Leiste unter Videos soll die Wahl
 * *nur Videos* oder *Messenger und Videos* lauten. Im Messenger umgekehrt."
 * Die Wahl steht unten als zwei Knöpfe — welcher Knopf wo steht, entscheidet
 * gemeinsam/story.js (zielWahl), dieselbe Regel nutzt die Website.
 *
 * WIE ES GEBAUT IST
 *
 * Nichts wird ins Bild gebrannt. Text, Schrift, Farbe, Filter und die Lage
 * der Markierungen gehen als Daten an die Story (stories.overlays) und werden
 * beim Ansehen gezeichnet — in der App von StoryOverlaySchicht, auf der
 * Website mit CSS. So sieht die Story auf beiden Seiten gleich aus, und ein
 * Video bekommt dieselbe Bearbeitung wie ein Foto.
 *
 * Markieren darf man nur, wer einen markieren lassen will: die Liste kommt
 * aus der Datenbank (story_markierbar), die die Einstellung „Wer darf mich
 * markieren" der anderen Person kennt. Die Markierung selbst steht in
 * story_tags, und ein Auslöser dort schreibt die Mitteilung.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Druck } from '../../components/Druck';
import { Avatar } from '../../components/Avatar';
import { Videoflaeche } from '../../components/Videoflaeche';
import { BEZUG_BREITE, StoryOverlaySchicht, schriftStil } from '../../components/StoryOverlaySchicht';
import { FILTER } from '../../constants/filter';
import { colors, radius, spacing, themenStyles, typography } from '../../constants/design';
import { useAktionen } from '../../lib/useAktionen';
import { StoryOverlays, StoryText } from '../../types';

const StoryRegeln = require('../../../gemeinsam/story') as typeof import('../../../gemeinsam/story');

type Ziel = import('../../../gemeinsam/story').StoryZiel;

export interface StoryFertig {
  ziel: Ziel;
  overlays: StoryOverlays;
  /** Kennungen der markierten Personen (für story_tags). */
  markiert: string[];
}

interface Props {
  uri: string;
  mediaTyp: 'image' | 'video';
  /** Woher die Story kommt — bestimmt die Zielwahl (11.5). */
  bereich: 'messenger' | 'videos';
  /** Story-Sichtbarkeit auf „Alle"? Nur dann darf sie unter Videos stehen. */
  darfVideos: boolean;
  onAbbrechen: () => void;
  onPosten: (fertig: StoryFertig) => void;
  onNotice: (m: string) => void;
}

type Werkzeug = null | 'text' | 'filter' | 'markieren';

const neuerText = (): StoryText => ({
  text: '',
  schrift: StoryRegeln.SCHRIFTEN[0].key,
  farbe: StoryRegeln.FARBEN[0],
  hintergrund: false,
  groesse: 28,
  x: 0.5,
  y: 0.4,
});

/**
 * Ein verschiebbares Element auf der Bildfläche. Die Lage ist relativ (0–1),
 * damit sie auf jeder Bildschirmgröße und auf der Website gleich sitzt.
 */
const Ziehbar = ({
  x,
  y,
  flaeche,
  onVerschoben,
  onTippen,
  children,
  testID,
}: {
  x: number;
  y: number;
  flaeche: { w: number; h: number };
  onVerschoben: (x: number, y: number) => void;
  onTippen?: () => void;
  children: React.ReactNode;
  testID?: string;
}) => {
  const start = useRef({ x, y });
  const bewegt = useRef(false);
  const aktuell = useRef({ x, y, flaeche, onVerschoben, onTippen });
  aktuell.current = { x, y, flaeche, onVerschoben, onTippen };
  const griff = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        start.current = { x: aktuell.current.x, y: aktuell.current.y };
        bewegt.current = false;
      },
      onPanResponderMove: (_e, g) => {
        if (Math.abs(g.dx) + Math.abs(g.dy) > 4) bewegt.current = true;
        const { w, h } = aktuell.current.flaeche;
        if (!w || !h) return;
        const nx = Math.min(0.95, Math.max(0.05, start.current.x + g.dx / w));
        const ny = Math.min(0.95, Math.max(0.05, start.current.y + g.dy / h));
        aktuell.current.onVerschoben(nx, ny);
      },
      onPanResponderRelease: () => {
        if (!bewegt.current) aktuell.current.onTippen?.();
      },
    })
  ).current;
  return (
    <View style={[styles.anker, { left: `${x * 100}%`, top: `${y * 100}%` }]} pointerEvents="box-none">
      <View {...griff.panHandlers} style={styles.ziehbar} testID={testID}>
        {children}
      </View>
    </View>
  );
};

export const StoryEditorScreen = ({
  uri,
  mediaTyp,
  bereich,
  darfVideos,
  onAbbrechen,
  onPosten,
  onNotice,
}: Props) => {
  const insets = useSafeAreaInsets();
  const aktion = useAktionen(onNotice);
  const [flaeche, setFlaeche] = useState({ w: BEZUG_BREITE, h: 700 });
  const [filter, setFilter] = useState('keiner');
  const [texte, setTexte] = useState<StoryText[]>([]);
  const [markiert, setMarkiert] = useState<{ userId: string; name: string; x: number; y: number }[]>([]);
  const [werkzeug, setWerkzeug] = useState<Werkzeug>(null);
  /** Welcher Text gerade bearbeitet wird (Index), -1 = ein neuer. */
  const [bearbeitet, setBearbeitet] = useState<number | null>(null);
  const [entwurf, setEntwurf] = useState<StoryText>(neuerText());
  const [suche, setSuche] = useState('');
  const [treffer, setTreffer] = useState<{ id: string; name: string; handle: string }[]>([]);
  const [sucheLaeuft, setSucheLaeuft] = useState(false);

  const ziele = StoryRegeln.zielWahl(bereich, darfVideos);
  const faktor = flaeche.w / BEZUG_BREITE;

  // Die Personenliste kommt aus der Datenbank — nur wer markiert werden darf.
  useEffect(() => {
    if (werkzeug !== 'markieren') return;
    let aus = false;
    setSucheLaeuft(true);
    const t = setTimeout(async () => {
      const liste = await aktion.storyMarkierbar(suche.trim());
      if (aus) return;
      setTreffer(liste ?? []);
      setSucheLaeuft(false);
    }, 250);
    return () => {
      aus = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [werkzeug, suche]);

  const textBeginnen = (index: number | null) => {
    setWerkzeug('text');
    setBearbeitet(index ?? -1);
    setEntwurf(index !== null && index >= 0 ? { ...texte[index] } : neuerText());
  };

  const textFertig = () => {
    const t = { ...entwurf, text: entwurf.text.trim().slice(0, StoryRegeln.TEXT_LAENGE) };
    setTexte((vorher) => {
      if (bearbeitet !== null && bearbeitet >= 0) {
        // Leer gemacht heißt: entfernen.
        return t.text ? vorher.map((v, i) => (i === bearbeitet ? t : v)) : vorher.filter((_, i) => i !== bearbeitet);
      }
      if (!t.text) return vorher;
      if (vorher.length >= StoryRegeln.TEXTE_HOECHSTENS) {
        onNotice(`Höchstens ${StoryRegeln.TEXTE_HOECHSTENS} Texte je Story`);
        return vorher;
      }
      return [...vorher, t];
    });
    setBearbeitet(null);
    setWerkzeug(null);
  };

  const markieren = (p: { id: string; name: string }) => {
    if (markiert.some((m) => m.userId === p.id)) {
      setMarkiert((v) => v.filter((m) => m.userId !== p.id));
      return;
    }
    if (markiert.length >= StoryRegeln.MARKIERUNGEN_HOECHSTENS) {
      return onNotice(`Höchstens ${StoryRegeln.MARKIERUNGEN_HOECHSTENS} Markierungen je Story`);
    }
    // Neue Schilder untereinander, damit sie sich nicht verdecken.
    const y = Math.min(0.9, 0.62 + markiert.length * 0.07);
    setMarkiert((v) => [...v, { userId: p.id, name: p.name, x: 0.5, y }]);
  };

  const posten = (ziel: Ziel) => {
    const overlays = StoryRegeln.overlaysPruefen({ filter, texte, markiert });
    onPosten({ ziel, overlays, markiert: markiert.map((m) => m.userId) });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.kopf, { paddingTop: insets.top + spacing.sm }]}>
        <Druck onPress={onAbbrechen} hitSlop={10} accessibilityLabel="Story verwerfen">
          <Ionicons name="close" size={28} color={colors.white} />
        </Druck>
        <View style={{ flex: 1 }} />
        <Druck
          style={[styles.werkzeug, werkzeug === 'text' && styles.werkzeugAn]}
          onPress={() => (werkzeug === 'text' ? textFertig() : textBeginnen(null))}
          accessibilityLabel="Text hinzufügen"
        >
          <Text style={styles.werkzeugText}>Aa</Text>
        </Druck>
        <Druck
          style={[styles.werkzeug, werkzeug === 'filter' && styles.werkzeugAn]}
          onPress={() => setWerkzeug(werkzeug === 'filter' ? null : 'filter')}
          accessibilityLabel="Filter"
        >
          <Ionicons name="color-filter-outline" size={22} color={colors.white} />
        </Druck>
        <Druck
          style={[styles.werkzeug, werkzeug === 'markieren' && styles.werkzeugAn]}
          onPress={() => setWerkzeug(werkzeug === 'markieren' ? null : 'markieren')}
          accessibilityLabel="Personen markieren"
        >
          <Ionicons name="at" size={22} color={colors.white} />
        </Druck>
      </View>

      <View
        style={styles.buehne}
        onLayout={(e: LayoutChangeEvent) =>
          setFlaeche({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
        }
      >
        {mediaTyp === 'video' ? (
          <Videoflaeche id="story-entwurf" quelle={uri} laeuft schleife stumm fuellen="contain" style={styles.bild} />
        ) : (
          <Image source={{ uri }} style={styles.bild} resizeMode="contain" />
        )}
        {/* Filter gezeichnet wie im Betrachter — dieselbe Schicht. */}
        <StoryOverlaySchicht overlays={{ filter, texte: [], markiert: [] }} />

        {texte.map((t, i) =>
          bearbeitet === i ? null : (
            <Ziehbar
              key={`t${i}`}
              testID="story-editor-text"
              x={t.x}
              y={t.y}
              flaeche={flaeche}
              onVerschoben={(x, y) => setTexte((v) => v.map((w, j) => (j === i ? { ...w, x, y } : w)))}
              onTippen={() => textBeginnen(i)}
            >
              <Text
                style={[
                  styles.text,
                  schriftStil(t.schrift),
                  {
                    color: t.farbe,
                    fontSize: t.groesse * faktor,
                    backgroundColor: t.hintergrund ? 'rgba(0,0,0,0.55)' : 'transparent',
                  },
                ]}
              >
                {t.text}
              </Text>
            </Ziehbar>
          )
        )}
        {markiert.map((m) => (
          <Ziehbar
            key={m.userId}
            x={m.x}
            y={m.y}
            flaeche={flaeche}
            onVerschoben={(x, y) =>
              setMarkiert((v) => v.map((w) => (w.userId === m.userId ? { ...w, x, y } : w)))
            }
          >
            <Text style={styles.schild}>@{m.name}</Text>
          </Ziehbar>
        ))}

        {werkzeug === 'text' && (
          <View style={styles.textEbene}>
            <TextInput
              autoFocus
              multiline
              value={entwurf.text}
              maxLength={StoryRegeln.TEXT_LAENGE}
              onChangeText={(text) => setEntwurf((e) => ({ ...e, text }))}
              placeholder="Text eingeben"
              placeholderTextColor="rgba(255,255,255,0.6)"
              accessibilityLabel="Story-Text"
              style={[
                styles.textEingabe,
                schriftStil(entwurf.schrift),
                {
                  color: entwurf.farbe,
                  fontSize: entwurf.groesse * faktor,
                  backgroundColor: entwurf.hintergrund ? 'rgba(0,0,0,0.55)' : 'transparent',
                },
              ]}
            />
          </View>
        )}
      </View>

      {/* Werkzeugleisten unter der Bühne */}
      {werkzeug === 'text' && (
        <View style={styles.leiste}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reihe}>
            {StoryRegeln.SCHRIFTEN.map((s) => (
              <Druck
                key={s.key}
                style={[styles.chip, entwurf.schrift === s.key && styles.chipAn]}
                onPress={() => setEntwurf((e) => ({ ...e, schrift: s.key }))}
                accessibilityLabel={`Schrift ${s.label}`}
              >
                <Text style={[styles.chipText, schriftStil(s.key)]}>{s.label}</Text>
              </Druck>
            ))}
          </ScrollView>
          <View style={styles.reihe}>
            {StoryRegeln.FARBEN.map((f) => (
              <Druck
                key={f}
                accessibilityLabel={`Farbe ${f}`}
                style={[styles.farbe, { backgroundColor: f }, entwurf.farbe === f && styles.farbeAn]}
                onPress={() => setEntwurf((e) => ({ ...e, farbe: f }))}
              />
            ))}
          </View>
          <View style={styles.reihe}>
            <Druck
              style={[styles.chip, entwurf.hintergrund && styles.chipAn]}
              onPress={() => setEntwurf((e) => ({ ...e, hintergrund: !e.hintergrund }))}
            >
              <Text style={styles.chipText}>Hintergrund</Text>
            </Druck>
            <Druck
              style={styles.chip}
              accessibilityLabel="Schrift kleiner"
              onPress={() => setEntwurf((e) => ({ ...e, groesse: Math.max(14, e.groesse - 4) }))}
            >
              <Text style={styles.chipText}>A−</Text>
            </Druck>
            <Druck
              style={styles.chip}
              accessibilityLabel="Schrift größer"
              onPress={() => setEntwurf((e) => ({ ...e, groesse: Math.min(64, e.groesse + 4) }))}
            >
              <Text style={styles.chipText}>A+</Text>
            </Druck>
            <View style={{ flex: 1 }} />
            <Druck style={[styles.chip, styles.fertig]} onPress={textFertig}>
              <Text style={styles.chipText}>Fertig</Text>
            </Druck>
          </View>
        </View>
      )}

      {werkzeug === 'filter' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.leiste}
          contentContainerStyle={styles.reihe}
        >
          {FILTER.map((f) => (
            <Druck
              key={f.key}
              style={[styles.chip, filter === f.key && styles.chipAn]}
              onPress={() => setFilter(f.key)}
              accessibilityLabel={`Filter ${f.label}`}
            >
              <Text style={styles.chipText}>{f.label}</Text>
            </Druck>
          ))}
        </ScrollView>
      )}

      {werkzeug === 'markieren' && (
        <View style={[styles.leiste, { maxHeight: 260 }]}>
          <TextInput
            value={suche}
            onChangeText={setSuche}
            placeholder="Person suchen"
            placeholderTextColor="rgba(255,255,255,0.6)"
            style={styles.suche}
            accessibilityLabel="Person suchen"
            autoCapitalize="none"
          />
          <ScrollView keyboardShouldPersistTaps="handled">
            {sucheLaeuft && !treffer.length ? (
              <ActivityIndicator color={colors.white} style={{ margin: spacing.md }} />
            ) : !treffer.length ? (
              <Text style={styles.hinweis}>
                Niemand gefunden. Markieren lassen sich nur Personen, die das in ihren Einstellungen
                erlauben.
              </Text>
            ) : (
              treffer.map((p) => {
                const an = markiert.some((m) => m.userId === p.id);
                return (
                  <Druck
                    key={p.id}
                    style={styles.person}
                    onPress={() => markieren(p)}
                    accessibilityLabel={`${p.name} markieren`}
                  >
                    <Avatar id={p.id} name={p.name} size={32} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.personName}>{p.name}</Text>
                      {p.handle ? <Text style={styles.hinweisKlein}>@{p.handle}</Text> : null}
                    </View>
                    <Ionicons
                      name={an ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={an ? colors.brand : 'rgba(255,255,255,0.6)'}
                    />
                  </Druck>
                );
              })
            )}
          </ScrollView>
        </View>
      )}

      {/* Kasten 11.5: das Ziel. Zwei Knöpfe, jeder postet sofort. */}
      {werkzeug !== 'text' && (
        <View style={[styles.fuss, { paddingBottom: insets.bottom + spacing.sm }]}>
          {bereich === 'videos' && !darfVideos ? (
            <Text style={styles.hinweis}>
              Deine Story-Sichtbarkeit steht nicht auf „Alle“ — unter Videos kann die Story deshalb
              nicht stehen.
            </Text>
          ) : null}
          <View style={styles.zielReihe}>
            {ziele.map((z, i) => (
              <Druck
                key={z.key}
                testID={`story-ziel-${z.key}`}
                accessibilityLabel={z.label}
                style={[styles.ziel, i === ziele.length - 1 && styles.zielHaupt]}
                onPress={() => posten(z)}
              >
                <Text style={styles.zielText}>{z.label}</Text>
              </Druck>
            ))}
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = themenStyles((c) => ({
  container: { flex: 1, backgroundColor: '#000' },
  kopf: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  werkzeug: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  werkzeugAn: { backgroundColor: c.brand },
  werkzeugText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  buehne: { flex: 1, overflow: 'hidden', borderRadius: radius.lg, marginHorizontal: spacing.sm },
  bild: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%' },
  anker: { position: 'absolute', width: 0, height: 0, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  ziehbar: { position: 'absolute', alignItems: 'center' },
  text: {
    maxWidth: 320,
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  schild: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: 'hidden',
  },
  textEbene: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  textEingabe: { minWidth: 120, maxWidth: '100%', textAlign: 'center', paddingHorizontal: 8, borderRadius: 6 },
  leiste: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  reihe: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  chipAn: { backgroundColor: c.brand },
  chipText: { color: '#fff', fontSize: 14 },
  fertig: { backgroundColor: c.brand },
  farbe: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  farbeAn: { borderColor: '#fff', transform: [{ scale: 1.15 }] },
  suche: {
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: spacing.lg,
    color: '#fff',
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 8 },
  personName: { color: '#fff', ...typography.body },
  hinweis: { color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'center', marginVertical: spacing.sm },
  hinweisKlein: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  fuss: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  zielReihe: { flexDirection: 'row', gap: spacing.sm },
  ziel: {
    flex: 1,
    height: 46,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  zielHaupt: { backgroundColor: c.brand },
  zielText: { color: '#fff', fontSize: 15, fontWeight: '600' },
}));
