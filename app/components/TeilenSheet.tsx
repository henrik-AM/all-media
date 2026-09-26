import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from './Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { SearchBar } from './SearchBar';
import { SheetRahmen } from './SheetRahmen';
import { colors, radius, sizes, spacing, themenStyles, typography } from '../constants/design';
import { useDaten } from '../contexts/DatenContext';
import { useAktionen } from '../lib/useAktionen';
import { Chat, Contact } from '../types';

// Wer im Blatt steht — dieselbe Rechnung wie in web/public/app.js (openTeilen).
const Teilen = require('../../gemeinsam/teilen') as typeof import('../../gemeinsam/teilen');

export interface TeilenZiel {
  art: 'post' | 'video';
  id: string;
  titel: string;
  autor: string;
}

/** Über welchen der beiden Bereiche der Beitrag bei dieser Person landet. */
export type TeilenBereich = 'messenger' | 'community';

export interface TeilenErgebnis {
  gesendet: string[];
  fehlgeschlagen: { id: string; grund: string }[];
  /** Wenn gar nichts rausging: warum. */
  grund?: string;
}

interface Props {
  ziel: TeilenZiel | null;
  contacts: Contact[];
  /** Überschreibt die Zeile über dem Raster — etwa für eine Aufnahme. */
  titel?: string;
  /**
   * Sagt je Person, in welcher der beiden Chatlisten sie erreicht wird.
   *
   * Der Prototyp-Frame „Nutzer B + Beitrag teilen" hängt jedem Avatar unten
   * rechts ein Abzeichen an, und die Abzeichen sind im selben Raster
   * verschieden: bei der einen Person die grüne Sprechblase des Messengers,
   * bei der nächsten das blaue Personensymbol der Communitys. Es sagt also
   * nicht, aus welchem Bereich man gerade teilt, sondern wo *diese* Person
   * die Nachricht bekommt.
   */
  bereichFuer?: (userId: string) => TeilenBereich;
  onClose: () => void;
  /** Schickt an alle Ausgewählten — erst mit dem Senden-Knopf. */
  onSenden: (userIds: string[], ziel: TeilenZiel, bereiche: Record<string, TeilenBereich>) => Promise<TeilenErgebnis>;
}

interface Person {
  id: string;
  name: string;
  handle?: string;
}

/**
 * Prototyp-Frames "Nutzer B + Beitrag teilen" und "VQ + Video teilen": ein
 * Raster aus Personen.
 *
 * Feedback 21.09., Kasten 4: oben eine Suchleiste, unten ein Senden-Knopf.
 * Bis zum 26.09.2026 schickte schon der Tipp auf eine Kachel, und unter
 * „Weitere Vorschläge" stand jedes Profil der Datenbank — auch Fremde, deren
 * Namen man nie gesucht hat. Jetzt wählt ein Tipp nur aus; Fremde findet nur,
 * wer den genauen @nutzernamen eingibt.
 */
export const TeilenSheet = ({ ziel, contacts, titel, bereichFuer, onClose, onSenden }: Props) => {
  const { users: alleNutzer, communityChats, chats, gefolgt } = useDaten();
  const aktion = useAktionen();
  const [gewaehlt, setGewaehlt] = useState<string[]>([]);
  const [gesendet, setGesendet] = useState<string[]>([]);
  const [suche, setSuche] = useState('');
  const [fremde, setFremde] = useState<Record<string, Person>>({});
  const [treffer, setTreffer] = useState<string | null>(null);
  const [sendet, setSendet] = useState(false);
  const [meldung, setMeldung] = useState<string[]>([]);

  const wer = (id: string): Person | null => (alleNutzer[id] ? { ...alleNutzer[id], id } : fremde[id] ?? null);

  /*
   * Der genaue Nutzername geht an die Datenbank — erst nach einer kurzen
   * Pause, sonst fragte jeder Tastendruck einzeln. Übernommen wird nur die
   * Antwort auf die Eingabe, die noch im Feld steht.
   */
  useEffect(() => {
    setTreffer(null);
    const handle = Teilen.nutzername(suche);
    if (!handle || !ziel) return;
    let gilt = true;
    const uhr = setTimeout(async () => {
      const p = await aktion.personPerNutzername(handle);
      if (!gilt || !p) return;
      setFremde((f) => ({ ...f, [p.id]: p }));
      setTreffer(p.id);
    }, 300);
    return () => {
      gilt = false;
      clearTimeout(uhr);
    };
    // aktion wechselt bei jedem Zeichnen; entscheidend ist die Eingabe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suche, ziel]);

  /** Der Stand der Chat-Anfrage mit dieser Person, aus beiden Listen. */
  const anfrage = (id: string) =>
    [...chats, ...communityChats].find((c: Chat) => !c.isGroup && c.userId === id)?.requestState;

  const gruppen = useMemo(() => {
    const liste = Teilen.gruppen({
      kontakte: contacts.map((c) => c.id),
      community: communityChats.filter((c) => !c.isGroup && c.userId).map((c) => c.userId as string),
      gefolgt,
      person: wer,
      suche,
    }) as { art: string; titel: string; ids: string[] }[];
    const drin = new Set(liste.flatMap((g) => g.ids));
    // Der Fremde steht nur da, wenn er nicht schon in einer Gruppe steht.
    if (treffer && !drin.has(treffer)) liste.push({ art: 'nutzername', titel: 'Nutzername', ids: [treffer] });
    return liste;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, communityChats, gefolgt, alleNutzer, fremde, suche, treffer]);

  if (!ziel) return null;

  const schliessen = () => {
    setGewaehlt([]);
    setGesendet([]);
    setSuche('');
    setMeldung([]);
    onClose();
  };

  const senden = async () => {
    if (!gewaehlt.length || sendet) return;
    const bereiche: Record<string, TeilenBereich> = {};
    for (const id of gewaehlt) bereiche[id] = bereichFuer?.(id) ?? 'messenger';
    setSendet(true);
    setMeldung([]);
    const ergebnis = await onSenden(gewaehlt, ziel, bereiche);
    setSendet(false);
    setGesendet((g) => [...g, ...ergebnis.gesendet]);
    setGewaehlt((g) => g.filter((id) => !ergebnis.gesendet.includes(id)));

    /*
     * Fehler stehen im Blatt, nicht im Toast: der liegt hinter dem Blatt
     * (siehe „Meldung hinter dem Modal"). Ging alles raus, geht das Blatt zu,
     * und die Meldung „An … gesendet" kommt vom Bildschirm dahinter.
     */
    if (ergebnis.grund) return setMeldung([ergebnis.grund]);
    if (ergebnis.fehlgeschlagen.length) {
      return setMeldung(ergebnis.fehlgeschlagen.map((f) => `${wer(f.id)?.name ?? '?'}: ${f.grund}`));
    }
    schliessen();
  };

  const raster = (ids: string[]) => (
    <View style={styles.raster}>
      {ids.map((id) => {
        const person = wer(id);
        if (!person) return null;
        const fertig = gesendet.includes(id);
        const an = gewaehlt.includes(id);
        const sperre = Teilen.sperre(anfrage(id));
        const bereich = bereichFuer?.(id) ?? 'messenger';
        return (
          <Druck
            key={id}
            style={[styles.kachel, (fertig || sperre) && styles.kachelFertig]}
            disabled={fertig || !!sperre}
            accessibilityLabel={person.name}
            accessibilityState={{ selected: an, disabled: fertig || !!sperre }}
            onPress={() => {
              setMeldung([]);
              setGewaehlt((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
            }}
          >
            <View style={an && styles.bildGewaehlt}>
              <Avatar id={id} name={person.name} size={sizes.avatarLg} />
              {/*
                Das Abzeichen aus dem Prototyp. Es sitzt am Avatar, nicht an
                der Kachel, damit es auch dann unten rechts am Bild klebt,
                wenn die Kachel breiter wird als der Avatar.
              */}
              <View
                style={[
                  styles.bereichMarke,
                  bereich === 'community' ? styles.bereichCommunity : styles.bereichMessenger,
                ]}
              >
                <Ionicons
                  name={bereich === 'community' ? 'people' : 'chatbubble'}
                  size={10}
                  color={colors.white}
                />
              </View>
            </View>
            {(fertig || an) && (
              <View style={styles.haken}>
                <Ionicons name="checkmark" size={13} color={colors.white} />
              </View>
            )}
            <Text style={styles.name} numberOfLines={1}>
              {person.name}
            </Text>
            {sperre ? (
              <Text style={styles.sperre} numberOfLines={1}>
                {sperre}
              </Text>
            ) : null}
          </Druck>
        );
      })}
    </View>
  );

  return (
    <SheetRahmen
      visible
      title={titel ?? (ziel.art === 'video' ? 'Video teilen' : 'Beitrag teilen')}
      onClose={schliessen}
      hoch
      fuss={
        <View>
          {meldung.length > 0 && (
            <View style={styles.meldung} accessibilityRole="alert">
              {meldung.map((m) => (
                <Text key={m} style={styles.meldungText}>
                  {m}
                </Text>
              ))}
            </View>
          )}
          <Druck
            style={[styles.knopf, (!gewaehlt.length || sendet) && styles.knopfAus]}
            disabled={!gewaehlt.length || sendet}
            onPress={senden}
            accessibilityLabel="Senden"
          >
            <Text style={styles.knopfText}>{sendet ? 'Wird gesendet …' : Teilen.knopf(gewaehlt.length)}</Text>
          </Druck>
        </View>
      }
    >
      <View style={styles.suche}>
        <SearchBar value={suche} onChangeText={setSuche} placeholder="Name oder @nutzername" />
      </View>
      <ScrollView contentContainerStyle={styles.inhalt} keyboardShouldPersistTaps="handled">
        {gruppen.map((g) => (
          <View key={g.art}>
            <Text style={styles.kopf}>{g.titel}</Text>
            {raster(g.ids)}
          </View>
        ))}
        {gruppen.length === 0 && (
          <Text style={styles.leer}>
            {suche
              ? 'Niemand gefunden. Fremde findest du über den genauen @nutzernamen.'
              : 'Noch niemand zum Teilen da.'}
          </Text>
        )}
      </ScrollView>
    </SheetRahmen>
  );
};

const styles = themenStyles((colors) => ({
  suche: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  inhalt: { paddingBottom: spacing.lg },
  kopf: { ...typography.small, fontWeight: '600', color: colors.text2, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 6 },
  raster: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md },
  kachel: {
    width: '33.33%',
    alignItems: 'center',
    gap: 7,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  kachelFertig: { opacity: 0.55 },
  /* Ausgewählt, aber noch nicht gesendet: Ring um den Avatar. */
  bildGewaehlt: { borderRadius: 999, borderWidth: 2, borderColor: colors.brand, padding: 2, margin: -4 },
  /*
   * Der weisse Ring ist nicht Zierde: ohne ihn verschwimmt ein gruener Punkt
   * auf einem gruenen Avatarverlauf. Er trennt das Abzeichen vom Bild
   * darunter, in beiden Themen.
   */
  bereichMarke: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bereichMessenger: { backgroundColor: colors.online },
  bereichCommunity: { backgroundColor: colors.brand },
  haken: {
    position: 'absolute',
    top: spacing.md,
    right: '50%',
    transform: [{ translateX: 28 }],
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...typography.small, color: colors.text, maxWidth: '92%' },
  sperre: { fontSize: 11, color: colors.text3, marginTop: -4, maxWidth: '92%' },
  leer: { ...typography.small, color: colors.text2, textAlign: 'center', padding: spacing.lg },
  meldung: { paddingBottom: spacing.sm, gap: 2 },
  meldungText: { ...typography.small, color: colors.danger },
  knopf: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knopfAus: { opacity: 0.45 },
  knopfText: { ...typography.name, color: colors.white },
}));
