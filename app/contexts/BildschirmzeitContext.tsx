/*
 * Eigene Bildschirmzeit — Messung, Sperre, Hinweise (Kasten 22).
 *
 * MESSUNG
 *
 * Gezählt wird nur, solange ein Bereich wirklich offen ist UND die App im
 * Vordergrund steht (`AppState === 'active'`). Welcher Bereich offen ist,
 * sagt die Schale (App.tsx) über `setAnsicht()` — aus `area`, `sub` und der
 * offenen Vollbildansicht, übersetzt von `Bildschirmzeit.bereichFuer()`. Die
 * gesammelten Sekunden gehen alle 30 s und beim Wechsel in den Hintergrund
 * nach Supabase (bildschirmzeit_zaehlen, mit Obergrenze). Die Website zählt
 * in dieselben Zeilen.
 *
 * SPERRE
 *
 * `status` ist die Antwort von `Bildschirmzeit.status()` für den offenen
 * Bereich — mit der gezählten Zeit plus dem, was noch nicht geschickt ist.
 * Die Schale zeigt bei `status.offen === false` die Sperrseite statt GENAU
 * dieses Bereichs; alles andere bleibt erreichbar.
 *
 * HINWEISE
 *
 * Fünf Minuten vor einer Sperre kommt einmal ein Hinweis (onNotice), und
 * nach X Minuten am Stück die Pausen-Erinnerung als Karte.
 *
 * Gegenstück auf der Website: bz… in web/public/app.js.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, Text, View } from 'react-native';

import { AuthContext } from './AuthContext';
import { useSupabase } from './SupabaseContext';
import { Druck } from '../components/Druck';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';
import {
  Bildschirmzeit,
  BzAntwort,
  BzBereich,
  BzStand,
  BzZiel,
  bzEntsperren,
  bzMehr,
  bzRegelnSetzen,
  bzStandLaden,
  bzZaehlen,
} from '../lib/bildschirmzeit';

type BzStatus = import('../../gemeinsam/bildschirmzeit').BzStatus;

type Wert = {
  stand: BzStand | null;
  bereich: BzBereich | null;
  status: BzStatus;
  /** Gezählt + noch nicht geschickt, je Bereich (Sekunden). */
  nutzungJetzt: () => Partial<Record<BzBereich, number>>;
  setAnsicht: (bereich: BzBereich | null) => void;
  neuLaden: () => Promise<void>;
  speichern: (regeln: unknown, kind?: string | null) => Promise<BzAntwort>;
  mehr: (ziel: BzZiel) => Promise<BzAntwort>;
  entsperren: (ziel: BzZiel, code: string, minuten: number | null) => Promise<BzAntwort>;
};

const OFFEN: BzStatus = { offen: true, grund: null, ziel: null, rest: null, restGrund: null, hinweis: false, mehrMoeglich: false };

const leer: Wert = {
  stand: null,
  bereich: null,
  status: OFFEN,
  nutzungJetzt: () => ({}),
  setAnsicht: () => {},
  neuLaden: async () => {},
  speichern: async () => ({ ok: false }),
  mehr: async () => ({ ok: false }),
  entsperren: async () => ({ ok: false }),
};

export const BildschirmzeitContext = createContext<Wert>(leer);

export const BildschirmzeitProvider = ({
  children,
  onNotice,
}: {
  children: React.ReactNode;
  onNotice: (text: string) => void;
}) => {
  const { supabase } = useSupabase();
  const { user } = useContext(AuthContext);
  const [stand, setStand] = useState<BzStand | null>(null);
  const [bereich, setBereich] = useState<BzBereich | null>(null);
  const [vordergrund, setVordergrund] = useState(AppState.currentState === 'active');
  // Taktgeber: alle 5 s neu rechnen (Restzeit läuft ab, Sperre greift ohne Navigation).
  const [jetzt, setJetzt] = useState(Date.now());
  const [pauseOffen, setPauseOffen] = useState(false);
  const uhr = useRef(Bildschirmzeit.uhr()).current;
  const gezeigt = useRef<string | null>(null);
  const schickt = useRef(false);

  const neuLaden = useCallback(async () => {
    if (!supabase || !user?.id) {
      setStand(null);
      return;
    }
    const s = await bzStandLaden(supabase);
    if (s) setStand(s);
  }, [supabase, user?.id]);

  useEffect(() => {
    void neuLaden();
  }, [neuLaden]);

  /** Gesammelte Sekunden schicken; schlägt es fehl, kommen sie zurück in die Uhr. */
  const schicken = useCallback(async () => {
    if (!supabase || !user?.id || schickt.current) return;
    const stuecke = uhr.abgeben(Date.now());
    if (!stuecke.length) return;
    schickt.current = true;
    try {
      const a = await bzZaehlen(supabase, stuecke);
      if (!a.ok) {
        uhr.zuruecklegen(stuecke);
        return;
      }
      setStand((alt) =>
        alt && a.tag === alt.tag
          ? { ...alt, nutzung: (a.nutzung as BzStand['nutzung']) ?? alt.nutzung }
          : alt
      );
      // Neuer Tag: alles frisch holen (Nutzung, Freigaben, Woche).
      if (stand && a.tag && a.tag !== stand.tag) void neuLaden();
    } finally {
      schickt.current = false;
    }
  }, [supabase, user?.id, uhr, stand, neuLaden]);

  // Vordergrund/Hintergrund: Uhr anhalten, gleich schicken; zurück: frisch laden.
  useEffect(() => {
    const horcher = AppState.addEventListener('change', (z) => {
      const aktiv = z === 'active';
      setVordergrund(aktiv);
      if (!aktiv) void schicken();
      else void neuLaden();
    });
    return () => horcher.remove();
  }, [schicken, neuLaden]);

  // Die Uhr kennt immer den Bereich und ob er sichtbar ist.
  useEffect(() => {
    uhr.setzen(bereich, vordergrund && !!user?.id, Date.now());
  }, [bereich, vordergrund, user?.id, uhr]);

  // Takt: 5 s rechnen, 30 s schicken.
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      setJetzt(Date.now());
      n += 5;
      if (n >= Bildschirmzeit.TAKT_SEKUNDEN) {
        n = 0;
        void schicken();
      }
    }, 5000);
    return () => clearInterval(t);
  }, [schicken]);

  // Mitternacht in der Zeitzone des Kontos: neuer Tag, neue Zahlen.
  useEffect(() => {
    if (!stand) return;
    if (Bildschirmzeit.ortszeit(jetzt, stand.zeitzone).tag !== stand.tag) void neuLaden();
  }, [jetzt, stand, neuLaden]);

  const nutzungJetzt = useCallback(
    () => Bildschirmzeit.zusammen(stand?.nutzung ?? {}, uhr.offen(Date.now())) as Partial<Record<BzBereich, number>>,
    [stand, uhr]
  );

  const status = useMemo<BzStatus>(() => {
    if (!stand) return OFFEN;
    return Bildschirmzeit.status(
      {
        regeln: stand.regeln,
        nutzung: Bildschirmzeit.zusammen(stand.nutzung, uhr.offen(jetzt)),
        freigaben: stand.freigaben,
        jetzt,
        zeitzone: stand.zeitzone,
        tag: stand.tag,
      },
      bereich
    );
  }, [stand, bereich, jetzt, uhr]);

  // Hinweis kurz vor der Sperre — einmal je Bereich und Grenze.
  useEffect(() => {
    if (!bereich || !status.offen || !status.hinweis || !vordergrund) return;
    const schluessel = `${stand?.tag}:${bereich}:${status.restGrund}`;
    if (gezeigt.current === schluessel) return;
    gezeigt.current = schluessel;
    onNotice(Bildschirmzeit.hinweisText(status, bereich));
  }, [status, bereich, stand?.tag, vordergrund, onNotice]);

  // Pausen-Erinnerung nach X Minuten am Stück.
  const pause = stand ? Bildschirmzeit.normalisieren(stand.regeln).pause : 0;
  useEffect(() => {
    if (!pause || pauseOffen || !vordergrund) return;
    if (uhr.amStueck(jetzt) >= pause * 60) setPauseOffen(true);
  }, [jetzt, pause, pauseOffen, vordergrund, uhr]);

  const speichern = useCallback(
    async (regeln: unknown, kind?: string | null) => {
      if (!supabase) return { ok: false } as BzAntwort;
      const a = await bzRegelnSetzen(supabase, regeln, kind);
      if (a.ok && !kind) await neuLaden();
      return a;
    },
    [supabase, neuLaden]
  );

  const mehr = useCallback(
    async (ziel: BzZiel) => {
      if (!supabase) return { ok: false } as BzAntwort;
      await schicken();
      const a = await bzMehr(supabase, ziel);
      if (a.ok) await neuLaden();
      return a;
    },
    [supabase, schicken, neuLaden]
  );

  const entsperren = useCallback(
    async (ziel: BzZiel, code: string, minuten: number | null) => {
      if (!supabase) return { ok: false } as BzAntwort;
      await schicken();
      const a = await bzEntsperren(supabase, ziel, code, minuten);
      if (a.ok) await neuLaden();
      return a;
    },
    [supabase, schicken, neuLaden]
  );

  const wert = useMemo<Wert>(
    () => ({ stand, bereich, status, nutzungJetzt, setAnsicht: setBereich, neuLaden, speichern, mehr, entsperren }),
    [stand, bereich, status, nutzungJetzt, neuLaden, speichern, mehr, entsperren]
  );

  return (
    <BildschirmzeitContext.Provider value={wert}>
      {children}
      <Modal visible={pauseOffen} transparent animationType="fade" onRequestClose={() => setPauseOffen(false)}>
        <View style={styles.schleier}>
          <View style={styles.karte} accessibilityLabel="Pausen-Erinnerung">
            <Text style={styles.titel}>{Bildschirmzeit.TEXTE.pauseTitel}</Text>
            <Text style={styles.text}>{Bildschirmzeit.TEXTE.pauseText(pause)}</Text>
            <Druck
              style={styles.knopf}
              onPress={() => {
                uhr.stueckNeu(Date.now());
                setPauseOffen(false);
              }}
            >
              <Text style={styles.knopfText}>Okay</Text>
            </Druck>
          </View>
        </View>
      </Modal>
    </BildschirmzeitContext.Provider>
  );
};

export const useBildschirmzeit = () => useContext(BildschirmzeitContext);

const styles = themenStyles((colors) => ({
  schleier: { flex: 1, backgroundColor: 'rgba(6,8,12,0.52)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  karte: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, width: '100%', maxWidth: 380, gap: spacing.md },
  titel: { ...typography.h3, color: colors.text },
  text: { ...typography.body, color: colors.text2 },
  knopf: { backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  knopfText: { color: '#fff', fontWeight: '600' },
}));
