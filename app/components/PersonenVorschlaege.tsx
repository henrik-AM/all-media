/**
 * „Personen, die du kennen könntest" — waagrechte Kartenreihe wie bei
 * Instagram (Kasten 23, Henrik 06.10.2026: „nur unter Videos und
 * Communitys").
 *
 * Steht an genau zwei Stellen: im Videos-Feed (HomeFeedScreen, nach dem
 * zweiten Beitrag) und auf der Communitys-Startseite (CommunitiesScreen).
 * Im Messenger nirgends — dort gilt „Kontakt nur über die Nummer" (Schema 57).
 *
 * Gegenstück auf der Website: vorschlaegeHtml()/vorschlaegeEinhaengen() in
 * web/public/app.js — gleiche Überschrift, gleiche Reihenfolge, gleiche
 * Begründung (alles aus personen_vorschlaege() in Supabase).
 *
 * Verhalten:
 *   - Karte: Profilbild, Name, @handle, Begründung, „Folgen", × (Entfernen).
 *   - Nach „Folgen" oder × verschwindet die Karte, die Liste lädt nach.
 *   - Leer → der ganze Abschnitt ist weg. Nichts Erfundenes als Ersatz.
 *   - Schema 87: solange „Kontakte abgleichen" weder an noch aus ist, steht
 *     vorne eine Karte mit der Frage (Erlauben / Nicht jetzt) — auch wenn
 *     die Liste sonst leer wäre. Ist der Abgleich an, wird einmal am Tag neu
 *     abgeglichen (lib/kontakte.ts). Die Website hat diese Karte nicht: der
 *     Browser kann das Adressbuch nicht lesen.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Druck } from './Druck';
import { Avatar } from './Avatar';
import { colors, radius, spacing, themenStyles } from '../constants/design';
import { useSupabase } from '../contexts/SupabaseContext';
import { useDaten } from '../contexts/DatenContext';
import { useProfil } from '../contexts/ProfilContext';
import { useEinstellungen } from '../contexts/EinstellungenContext';
import {
  KONTAKTE_SCHLUESSEL,
  kontakteAbgleichenWennFaellig,
  kontakteErlauben,
} from '../lib/kontakte';
import {
  ladeVorschlaege,
  vorschlagEntfernen,
  Vorschlag,
  VorschlagBereich,
  VORSCHLAG_TITEL,
} from '../lib/vorschlaege';

interface Props {
  bereich: VorschlagBereich;
  onOpenProfile?: (userId: string) => void;
  onNotice: (message: string) => void;
}

export const PersonenVorschlaege = ({ bereich, onOpenProfile, onNotice }: Props) => {
  const { supabase } = useSupabase();
  // `geladen` ändert sich bei jedem (Neu-)Laden der Daten — dann auch hier
  // neu fragen, etwa nach dem Herunterziehen.
  const { ichId, geladen } = useDaten();
  const { folgtPerson, folgenUmschalten } = useProfil();
  const { einstellungen, wert, setzen } = useEinstellungen();
  const [liste, setListe] = useState<Vorschlag[]>([]);
  const [fragtGerade, setFragtGerade] = useState(false);
  // Erst fragen, wenn die Einstellungen geladen sind — sonst blitzt die Karte
  // bei jemandem auf, der längst geantwortet hat.
  const abgleich = einstellungen ? wert(KONTAKTE_SCHLUESSEL, '') : null;

  /*
   * Wen man hier schon gefolgt oder entfernt hat. Das Folgen schreibt im
   * Hintergrund (ProfilContext.schreiben); lädt die Liste nach, bevor die
   * Zeile in `follows` steht, käme dieselbe Person sonst sofort zurück.
   */
  const erledigt = useRef<Set<string>>(new Set());

  const laden = useCallback(async () => {
    if (!supabase || !ichId) return;
    const neu = await ladeVorschlaege(supabase, bereich);
    setListe(neu.filter((v) => !erledigt.current.has(v.id)));
  }, [supabase, ichId, bereich]);

  useEffect(() => {
    laden();
  }, [laden, geladen]);

  // Abgleich an: einmal am Tag neu, danach die Liste neu holen.
  useEffect(() => {
    if (abgleich !== 'an' || !supabase) return;
    void kontakteAbgleichenWennFaellig(supabase).then((neu) => {
      if (neu) laden();
    });
  }, [abgleich, supabase, laden]);

  const erlauben = async () => {
    if (!supabase) return;
    setFragtGerade(true);
    const a = await kontakteErlauben(supabase);
    setFragtGerade(false);
    // Auch bei „Nein" gilt die Frage als beantwortet — sonst stünde die Karte
    // nach jeder Ablehnung wieder da.
    await setzen(KONTAKTE_SCHLUESSEL, a.ok ? 'an' : 'aus');
    if (!a.ok) return onNotice(a.meldung);
    onNotice('Kontakte abgeglichen');
    laden();
  };

  const wegnehmen = (id: string) => {
    erledigt.current.add(id);
    setListe((vorher) => vorher.filter((v) => v.id !== id));
  };

  const folgen = (v: Vorschlag) => {
    wegnehmen(v.id);
    // Die vorhandene Folgen-Aktion. Sie schaltet um — folgt man (auf einem
    // anderen Gerät) schon, darf sie nicht entfolgen.
    if (!folgtPerson(v.id)) folgenUmschalten(v.id);
    onNotice(`Du folgst ${v.name}`);
    // Nachladen, damit die Reihe wieder voll wird.
    setTimeout(laden, 800);
  };

  const entfernen = async (v: Vorschlag) => {
    if (!supabase || !ichId) return;
    wegnehmen(v.id);
    try {
      const steht = await vorschlagEntfernen(supabase, ichId, v.id);
      if (!steht) throw new Error('nicht gespeichert');
      laden();
    } catch (e: any) {
      console.error('Entfernen fehlgeschlagen:', e?.message ?? e);
      erledigt.current.delete(v.id);
      onNotice('Entfernen hat nicht geklappt');
      laden();
    }
  };

  // Wem man inzwischen anderswo gefolgt ist (Knopf am Beitrag), der fällt
  // sofort heraus — nicht erst beim nächsten Laden.
  const sichtbar = liste.filter((v) => !folgtPerson(v.id));
  const fragen = abgleich === '';
  if (!sichtbar.length && !fragen) return null;

  return (
    <View style={styles.abschnitt} testID={`vorschlaege-${bereich}`}>
      <Text style={styles.titel}>{VORSCHLAG_TITEL}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.reihe}
      >
        {fragen && (
          <View style={[styles.karte, styles.frage]} testID="vorschlag-kontakte-frage">
            <Ionicons name="people-circle-outline" size={44} color={colors.brand} />
            <Text style={styles.name} numberOfLines={2}>
              Kontakte finden
            </Text>
            <Text style={styles.grund} numberOfLines={4}>
              Darf All Media die Nummern in deinen Kontakten abgleichen?
            </Text>
            <Druck
              style={styles.folgen}
              onPress={erlauben}
              disabled={fragtGerade}
              accessibilityRole="button"
              testID="vorschlag-kontakte-erlauben"
            >
              <Text style={styles.folgenText}>Erlauben</Text>
            </Druck>
            <Druck
              style={styles.nichtJetzt}
              onPress={() => void setzen(KONTAKTE_SCHLUESSEL, 'aus')}
              accessibilityRole="button"
              testID="vorschlag-kontakte-nicht"
            >
              <Text style={styles.nichtJetztText}>Nicht jetzt</Text>
            </Druck>
          </View>
        )}
        {sichtbar.map((v) => (
          <Druck
            key={v.id}
            style={styles.karte}
            onPress={() => onOpenProfile?.(v.id)}
            testID="vorschlag-karte"
            accessibilityLabel={`${v.name}, ${v.grund}`}
          >
            <Druck
              style={styles.weg}
              onPress={() => entfernen(v)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`${v.name} entfernen`}
              testID="vorschlag-entfernen"
            >
              <Ionicons name="close" size={16} color={colors.text3} />
            </Druck>
            <Avatar id={v.id} name={v.name} size={64} farbe={v.color} />
            <Text style={styles.name} numberOfLines={1}>
              {v.name}
            </Text>
            <Text style={styles.handle} numberOfLines={1}>
              {v.handle.startsWith('@') ? v.handle : `@${v.handle}`}
            </Text>
            <Text style={styles.grund} numberOfLines={2}>
              {v.grund}
            </Text>
            <Druck
              style={styles.folgen}
              onPress={() => folgen(v)}
              accessibilityRole="button"
              testID="vorschlag-folgen"
            >
              <Text style={styles.folgenText}>Folgen</Text>
            </Druck>
          </Druck>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = themenStyles((colors) => ({
  abschnitt: { paddingTop: 12, paddingBottom: 14, backgroundColor: colors.surface },
  titel: { paddingHorizontal: spacing.lg, paddingBottom: 10, color: colors.text, fontSize: 14, fontWeight: '700' },
  reihe: { paddingHorizontal: spacing.lg, gap: 10 },
  karte: {
    width: 150,
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 12,
    paddingHorizontal: 10,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  weg: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  name: { marginTop: 8, color: colors.text, fontSize: 13.5, fontWeight: '700', maxWidth: '100%' },
  handle: { marginTop: 1, color: colors.text2, fontSize: 12, maxWidth: '100%' },
  grund: { marginTop: 4, minHeight: 30, color: colors.text3, fontSize: 11.5, textAlign: 'center' },
  folgen: { marginTop: 8, alignSelf: 'stretch', alignItems: 'center', paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.brand },
  folgenText: { color: colors.white, fontSize: 12.5, fontWeight: '600' },
  frage: { paddingTop: 12, paddingBottom: 8 },
  nichtJetzt: { marginTop: 4, alignSelf: 'stretch', alignItems: 'center', paddingVertical: 4 },
  nichtJetztText: { color: colors.text2, fontSize: 12, fontWeight: '600' },
}));
