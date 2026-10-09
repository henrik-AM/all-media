/*
 * Farbfilter über der ganzen App (Kasten 21, 06.10.2026).
 *
 * WAS ES TUT
 *
 * Henrik: „Farbfilter in All Media integrieren (Einstellungsbereich unter
 * Einstellungen)." Gewählt wird im Blatt (FarbfilterSheet.tsx), gespeichert
 * in `user_settings` (farbfilter, farbfilterArt, farbfilterStaerke,
 * farbfilterFarbton) — also auf jedem Gerät des Kontos und auf der Website
 * gleich. Die Rechnung steht in gemeinsam/farbfilter.js.
 *
 * WIE ES WIRKT
 *
 * React Native hat keinen Farbmatrix-Filter für einen ganzen Baum. Der
 * Style `filter` kann auf iOS nur brightness/opacity (der Rest hängt an
 * `enableSwiftUIBasedFilters`, in Expo Go aus). Was iOS und Android beide
 * können (neue Architektur, RN ≥ 0.77): `mixBlendMode`. Über die App legen
 * sich deshalb bis zu drei Flächen, die nichts abfangen
 * (`pointerEvents="none"`) und sich mit allem darunter mischen — Text,
 * Bilder, Videos:
 *
 *   Graustufen     graue Fläche, Modus `saturation`, Deckkraft = Intensität
 *   Warmton        warme Fläche, Modus `multiply`
 *   Farbtönung     Tönung, Modus `color`, Deckkraft = Intensität
 *   Sehschwächen   multiply → saturation → color-dodge (Näherung)
 *
 * Die ersten drei sind exakt dieselbe Rechnung wie die Matrix der Website
 * (geprüft in test/_farbfilter_rechnung.js); die Sehschwächen sind eine
 * Näherung, das Blatt sagt es dazu.
 *
 * WO DIE FLÄCHEN LIEGEN
 *
 *   - einmal über dem ganzen App-Baum (`FarbfilterRahmen` in App.tsx),
 *   - und in JEDEM `Modal`: ein Modal ist auf iOS und Android ein eigenes
 *     Fenster, die Fläche der App liegt nicht darüber. Bei Blättern mit
 *     durchsichtigem Schleier sitzt sie im Blatt selbst, nicht über dem
 *     ganzen Fenster — auf Android würde sie über durchsichtigen Stellen
 *     sonst als Schleier in ihrer eigenen Farbe stehen (Mischmodus über
 *     „nichts" zeigt die Quelle).
 *
 * Was NICHT mitgefiltert wird, weil es nicht zur App gehört: Statusleiste,
 * Tastatur, Systemdialoge (Alert, Teilen-Blatt, Fotoauswahl), der native
 * Vollbild-Player. Dafür gibt es die Farbfilter des Telefons.
 *
 * KEIN AUFBLITZEN
 *
 * Der letzte Stand liegt zusätzlich im AsyncStorage. Bis er gelesen ist
 * (wenige Millisekunden), zeichnet der Rahmen eine leere Fläche statt der
 * ungefilterten App — dasselbe Muster wie Root beim Holen der Sitzung.
 * Nach dem ersten Lesen bleibt er im Modul, damit ein Neuaufbau (Wechsel
 * des Designs baut den Baum neu) nicht noch einmal wartet.
 *
 * Gegenstück auf der Website: web/public/farbfilter-start.js.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useEinstellungen } from '../contexts/EinstellungenContext';
import { colors } from '../constants/design';

const Farbfilter = require('../../gemeinsam/farbfilter') as typeof import('../../gemeinsam/farbfilter');
type Konfig = import('../../gemeinsam/farbfilter').FarbfilterKonfig;
type Schicht = import('../../gemeinsam/farbfilter').FarbfilterSchicht;

const SPEICHER = 'all-media.farbfilter.v1';
const SCHLUESSEL = Object.values(Farbfilter.SCHLUESSEL);

/** Der zuletzt gelesene Sofortwert — überlebt einen Neuaufbau des Baums. */
let zwischenspeicher: Record<string, string> | null = null;

type FarbfilterWert = {
  /** Was gerade gilt (Konto, sonst Gerät, darüber ein laufendes Ziehen). */
  konfig: Konfig;
  /** Die Flächen über der App — leer, wenn nichts wirkt. */
  schichten: Schicht[];
  /** Ein Wert beim Ziehen eines Reglers — sofort sichtbar, noch nicht gespeichert. */
  entwurf: (schluessel: string, wert: string | null) => void;
  /** Speichern in `user_settings`. `false`, wenn es nicht ging. */
  speichern: (schluessel: string, wert: string) => Promise<boolean>;
  /** Alle vier Werte auf den Auslieferungszustand. */
  zuruecksetzen: () => Promise<boolean>;
  /** Vorher/Nachher: solange `true`, ist der Filter aus. */
  vergleichen: (an: boolean) => void;
  /** Sofortwert gelesen? Vorher zeichnet der Rahmen nichts. */
  bereit: boolean;
};

const leer: FarbfilterWert = {
  konfig: Farbfilter.STANDARD,
  schichten: [],
  entwurf: () => {},
  speichern: async () => false,
  zuruecksetzen: async () => false,
  vergleichen: () => {},
  bereit: true,
};

const FarbfilterContext = createContext<FarbfilterWert>(leer);

export const useFarbfilter = () => useContext(FarbfilterContext);

export const FarbfilterProvider = ({ children }: { children: React.ReactNode }) => {
  const { einstellungen, setzen } = useEinstellungen();
  const [geraet, setGeraet] = useState<Record<string, string> | null>(zwischenspeicher);
  const [entwuerfe, setEntwuerfe] = useState<Record<string, string>>({});
  const [vergleich, setVergleich] = useState(false);

  // Sofortwert vom Gerät.
  useEffect(() => {
    if (zwischenspeicher) return;
    AsyncStorage.getItem(SPEICHER)
      .then((roh) => {
        const werte = roh ? (JSON.parse(roh) as Record<string, string>) : {};
        zwischenspeicher = werte;
        setGeraet(werte);
      })
      .catch(() => {
        zwischenspeicher = {};
        setGeraet({});
      });
  }, []);

  /*
   * Sobald die Einstellungen des Kontos da sind, gelten sie — und werden
   * für den nächsten Start auf dem Gerät abgelegt. Nur die vier Schlüssel,
   * nicht alles: der Rest gehört nicht hierher.
   */
  useEffect(() => {
    if (!einstellungen) return;
    const auszug: Record<string, string> = {};
    for (const s of SCHLUESSEL) if (einstellungen[s] !== undefined) auszug[s] = einstellungen[s];
    const text = JSON.stringify(auszug);
    if (zwischenspeicher && JSON.stringify(zwischenspeicher) === text) return;
    zwischenspeicher = auszug;
    setGeraet(auszug);
    AsyncStorage.setItem(SPEICHER, text).catch(() => {
      // Nicht sichern zu können heißt nur: beim nächsten Start kurz ohne Filter.
    });
  }, [
    einstellungen?.[Farbfilter.SCHLUESSEL.an],
    einstellungen?.[Farbfilter.SCHLUESSEL.art],
    einstellungen?.[Farbfilter.SCHLUESSEL.staerke],
    einstellungen?.[Farbfilter.SCHLUESSEL.farbton],
    einstellungen === null,
  ]);

  const quelle = einstellungen ?? geraet ?? {};
  const konfig = useMemo(
    () => Farbfilter.lesen({ ...quelle, ...entwuerfe }),
    [
      quelle[Farbfilter.SCHLUESSEL.an],
      quelle[Farbfilter.SCHLUESSEL.art],
      quelle[Farbfilter.SCHLUESSEL.staerke],
      quelle[Farbfilter.SCHLUESSEL.farbton],
      entwuerfe,
    ]
  );

  const schichten = useMemo(
    () => (!vergleich && Farbfilter.aktiv(konfig) ? Farbfilter.schichten(konfig.art, konfig.staerke, konfig.farbton) : []),
    [konfig, vergleich]
  );

  const entwurf = useCallback((schluessel: string, wert: string | null) => {
    setEntwuerfe((vorher) => {
      const neu = { ...vorher };
      if (wert === null) delete neu[schluessel];
      else neu[schluessel] = wert;
      return neu;
    });
  }, []);

  const speichern = useCallback(
    async (schluessel: string, wert: string) => {
      // Der Kontext zeigt sofort an und dreht bei einem Fehler zurück.
      const ok = await setzen(schluessel, wert);
      entwurf(schluessel, null);
      return ok;
    },
    [setzen, entwurf]
  );

  const zuruecksetzen = useCallback(async () => {
    setEntwuerfe({});
    let alle = true;
    for (const [schluessel, wert] of Farbfilter.ZURUECKSETZEN) {
      alle = (await setzen(schluessel, wert)) && alle;
    }
    return alle;
  }, [setzen]);

  const wert = useMemo<FarbfilterWert>(
    () => ({
      konfig,
      schichten,
      entwurf,
      speichern,
      zuruecksetzen,
      vergleichen: setVergleich,
      bereit: geraet !== null || einstellungen !== null,
    }),
    [konfig, schichten, entwurf, speichern, zuruecksetzen, geraet, einstellungen]
  );

  return <FarbfilterContext.Provider value={wert}>{children}</FarbfilterContext.Provider>;
};

/**
 * Die Flächen selbst. Gehört als LETZTES Kind in eine deckende Fläche —
 * alles, was vorher gezeichnet wird, mischt sich mit ihnen.
 *
 * `radius`: obere Ecken eines Blattes, `rundum`: alle vier Ecken einer
 * Karte — damit die Fläche nicht über die Rundung hinaus ins Durchsichtige
 * ragt.
 */
export const FarbfilterSchicht = ({ radius, rundum }: { radius?: number; rundum?: number }) => {
  const { schichten } = useFarbfilter();
  if (schichten.length === 0) return null;
  const ecken = rundum
    ? { borderRadius: rundum }
    : radius
    ? { borderTopLeftRadius: radius, borderTopRightRadius: radius }
    : null;
  return (
    <>
      {schichten.map((s, i) => (
        <View
          key={i + s.modus}
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          testID={i === 0 ? 'farbfilter-schicht' : undefined}
          // zIndex: über allem, was selbst eine Ebene hat (TopSwitcher 15, Toast …).
          style={[StyleSheet.absoluteFill, ecken, { backgroundColor: s.farbe, mixBlendMode: s.modus, zIndex: 10000, elevation: 10000 }]}
        />
      ))}
    </>
  );
};

/**
 * Der Rahmen um die ganze App: eine Fläche, die sicher als eigene Ansicht
 * entsteht (`collapsable={false}` — sonst könnte React Native sie
 * wegoptimieren, und die Flächen mischten sich mit einem Elternteil, das
 * es nicht gibt), darin die App und darüber die Filterflächen.
 */
export const FarbfilterRahmen = ({ children }: { children: React.ReactNode }) => {
  const { bereit } = useFarbfilter();
  return (
    <View style={styles.rahmen} collapsable={false}>
      {bereit ? children : <View style={[styles.rahmen, { backgroundColor: colors.surface }]} />}
      <FarbfilterSchicht />
    </View>
  );
};

const styles = StyleSheet.create({
  rahmen: { flex: 1 },
});
