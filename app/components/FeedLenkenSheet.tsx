/**
 * „Feed steuern" — Einstellungen → Videos (Kasten 24).
 *
 * Henrik am 06.10.2026: „Ein Nutzer soll die Möglichkeit haben, seinen
 * Algorithmus selbstständig in eine Richtung zu lenken … durch Eingabe von
 * #/Sounds/Orten/Profilen/etc." Vorbilder: TikTok „Themen verwalten" und
 * „For You zurücksetzen", Instagram „Dein Algorithmus", YouTube „Kanal nicht
 * empfehlen".
 *
 * Oben die Art (Hashtag, Sound, Ort, Profil, Stichwort) und ein Feld mit
 * Vorschlägen aus echten Daten (gemeinsam/lenkung.js `vorschlaege`), je
 * Vorschlag „Mehr davon" / „Weniger davon". Darunter alle Einträge,
 * „Kein Interesse" (Schema 55) zum Zurücknehmen und „Feed zurücksetzen".
 *
 * Gespeichert in feed_lenkung (Schema 82, lib/lenkung.ts); gewichtet beim
 * nächsten Laden des Feeds (lib/daten.ts → gemeinsam/rang.js). Deshalb ruft
 * jede Änderung `neuLaden()` — sonst stünde der Feed bis zum nächsten Start
 * in der alten Reihenfolge, und die Einstellung sähe wirkungslos aus.
 *
 * Gegenstück: openLenkung() in web/public/app.js — gleiche Texte (aus
 * gemeinsam/lenkung.js), gleiche Stufen, dieselbe Tabelle.
 *
 * Meldungen stehen IM Blatt: der Toast sitzt in Root und läge hinter dem
 * Modal (Erfahrung vom 28.09.2026).
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { Druck } from './Druck';
import { SearchBar } from './SearchBar';
import { SheetRahmen } from './SheetRahmen';
import { radius, spacing, themenStyles, typography } from '../constants/design';
import { useDaten } from '../contexts/DatenContext';
import { useSupabase } from '../contexts/SupabaseContext';
import {
  feedZuruecksetzen,
  keinInteresseZuruecknehmen,
  lenkungEntfernen,
  lenkungSetzen,
  lenkungStand,
  LenkungStand,
} from '../lib/lenkung';
import type { LenkungArt, LenkungRichtung, LenkungVorschlag } from '../../gemeinsam/lenkung';

const Lenkung = require('../../gemeinsam/lenkung') as typeof import('../../gemeinsam/lenkung');

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const FeedLenkenSheet = ({ visible, onClose }: Props) => {
  const { hashtags, sounds, places, users, posts, videos, clips, ichId, neuLaden } = useDaten();
  const { supabase } = useSupabase();

  const [art, setArt] = useState<LenkungArt>('hashtag');
  const [eingabe, setEingabe] = useState('');
  // null = noch nicht geladen; unterscheidbar von „geladen, leer".
  const [stand, setStand] = useState<LenkungStand | null>(null);
  const [ladeFehler, setLadeFehler] = useState('');
  const [meldung, setMeldung] = useState<{ text: string; gut: boolean } | null>(null);
  const [beschaeftigt, setBeschaeftigt] = useState(false);

  const laden = useCallback(async () => {
    if (!supabase || !ichId) return;
    try {
      setStand(await lenkungStand(supabase, ichId));
      setLadeFehler('');
    } catch (e: any) {
      console.error('Feed steuern laden fehlgeschlagen:', e?.message ?? e);
      setLadeFehler('Deine Einträge konnten nicht geladen werden.');
    }
  }, [supabase, ichId]);

  // Bei jedem Öffnen frisch — wer im Feed „Kein Interesse" gewählt hat, soll
  // es hier sehen, ohne die App neu zu starten.
  useEffect(() => {
    if (visible) {
      setMeldung(null);
      void laden();
    }
  }, [visible, laden]);

  /** Schreiben, neu laden, Feed neu ranken — und sagen, was passiert ist. */
  const ausfuehren = async (tun: () => Promise<unknown>, erfolg: string) => {
    if (beschaeftigt || !supabase || !ichId) {
      if (!supabase || !ichId) setMeldung({ text: 'Dafür musst du angemeldet sein', gut: false });
      return;
    }
    setBeschaeftigt(true);
    setMeldung(null);
    try {
      await tun();
      await laden();
      setMeldung({ text: erfolg, gut: true });
      await neuLaden();
    } catch (e: any) {
      console.error('Feed steuern fehlgeschlagen:', e?.message ?? e);
      setMeldung({ text: e?.message || 'Das hat nicht geklappt', gut: false });
    } finally {
      setBeschaeftigt(false);
    }
  };

  const vorschlaege = useMemo<LenkungVorschlag[]>(() => {
    if (!eingabe.trim() && art !== 'sound' && art !== 'profil') return [];
    return Lenkung.vorschlaege(art, eingabe, {
      hashtags,
      sounds,
      places,
      users,
      beitraege: [...posts, ...videos, ...clips],
      ich: [ichId, 'me'],
    });
  }, [art, eingabe, hashtags, sounds, places, users, posts, videos, clips, ichId]);

  const eintraege = stand?.eintraege ?? [];
  const keinListe = stand?.keinInteresse ?? [];
  const richtungVon = (a: string, wert: string) =>
    eintraege.find((e) => e.art === a && e.wert === wert)?.richtung ?? null;

  const setzen = (v: { art: LenkungArt; wert: string; anzeige?: string }, richtung: LenkungRichtung, text: string) => {
    if (eintraege.length >= Lenkung.HOECHSTZAHL && !richtungVon(v.art, v.wert)) {
      setMeldung({ text: `Höchstens ${Lenkung.HOECHSTZAHL} Einträge — entferne erst einen.`, gut: false });
      return;
    }
    void ausfuehren(
      () => lenkungSetzen(supabase!, ichId, { art: v.art, wert: v.wert, anzeige: v.anzeige, richtung }),
      `${text}: ${Lenkung.richtungText(richtung)}`
    );
  };

  const zuruecksetzen = () =>
    Alert.alert(`${Lenkung.RESET_TITEL}?`, Lenkung.RESET_TEXT, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Zurücksetzen',
        style: 'destructive',
        onPress: () =>
          void ausfuehren(() => feedZuruecksetzen(supabase!), 'Dein Feed ist zurückgesetzt und lernt ab jetzt neu'),
      },
    ]);

  const platzhalter = Lenkung.ARTEN.find((a) => a.key === art)?.platzhalter ?? '';

  return (
    <SheetRahmen visible={visible} title={Lenkung.TITEL} onClose={onClose} hoch>
      <ScrollView contentContainerStyle={styles.inhalt} keyboardShouldPersistTaps="handled">
        <Text style={styles.hinweis}>{Lenkung.HINWEIS}</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.arten}>
          {Lenkung.ARTEN.map((a) => {
            const an = a.key === art;
            return (
              <Druck
                key={a.key}
                style={[styles.art, an && styles.artAn]}
                onPress={() => setArt(a.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: an }}
              >
                <Text style={[styles.artText, an && styles.artTextAn]}>{a.label}</Text>
              </Druck>
            );
          })}
        </ScrollView>

        <View style={styles.feld}>
          <SearchBar value={eingabe} onChangeText={setEingabe} placeholder={platzhalter} />
        </View>

        {vorschlaege.map((v) => {
          const jetzt = richtungVon(v.art, v.wert);
          return (
            <View key={`${v.art}-${v.wert}`} style={styles.zeile}>
              <View style={styles.zeileText}>
                <Text style={styles.zeileTitel} numberOfLines={1}>{v.anzeige}</Text>
                {!!v.zusatz && <Text style={styles.zeileUnter} numberOfLines={1}>{v.zusatz}</Text>}
              </View>
              <Druck
                style={[styles.pille, jetzt === 'mehr' && styles.pilleAn]}
                onPress={() => setzen(v, 'mehr', v.anzeige)}
                accessibilityLabel={`${v.anzeige}: Mehr davon`}
              >
                <Text style={[styles.pilleText, jetzt === 'mehr' && styles.pilleTextAn]}>Mehr davon</Text>
              </Druck>
              <Druck
                style={[styles.pille, jetzt === 'weniger' && styles.pilleAn]}
                onPress={() => setzen(v, 'weniger', v.anzeige)}
                accessibilityLabel={`${v.anzeige}: Weniger davon`}
              >
                <Text style={[styles.pilleText, jetzt === 'weniger' && styles.pilleTextAn]}>Weniger davon</Text>
              </Druck>
            </View>
          );
        })}
        {vorschlaege.length === 0 && !!eingabe.trim() && (
          <Text style={styles.leer}>
            Für „{eingabe.trim()}" gibt es keinen {Lenkung.artName(art)}-Vorschlag.
          </Text>
        )}

        {!!meldung && (
          <Text style={[styles.meldung, meldung.gut && styles.meldungGut]} accessibilityLiveRegion="polite">
            {meldung.text}
          </Text>
        )}

        <Text style={styles.kopf}>
          Deine Einträge{eintraege.length ? `  ·  ${eintraege.length}` : ''}
        </Text>
        {ladeFehler ? (
          <Text style={styles.leer}>{ladeFehler}</Text>
        ) : !stand ? (
          <Text style={styles.leer}>Wird geladen …</Text>
        ) : eintraege.length === 0 ? (
          <Text style={styles.leer}>{Lenkung.LEER}</Text>
        ) : (
          eintraege.map((e) => {
            const andere: LenkungRichtung = e.richtung === 'mehr' ? 'weniger' : 'mehr';
            const text = Lenkung.eintragText(e);
            return (
              <View key={e.id} style={styles.zeile}>
                <View style={styles.zeileText}>
                  <Text style={styles.zeileTitel} numberOfLines={1}>{text}</Text>
                  <Text style={[styles.zeileUnter, e.richtung === 'mehr' ? styles.mehr : styles.weniger]}>
                    {Lenkung.richtungText(e.richtung)}
                  </Text>
                </View>
                <Druck style={styles.pille} onPress={() => setzen(e, andere, text)} accessibilityLabel={`${text}: ${Lenkung.richtungText(andere)}`}>
                  <Text style={styles.pilleText}>{Lenkung.richtungText(andere)}</Text>
                </Druck>
                <Druck
                  style={styles.pille}
                  onPress={() => void ausfuehren(() => lenkungEntfernen(supabase!, ichId, e.id), `${text} entfernt`)}
                  accessibilityLabel={`${text} entfernen`}
                >
                  <Text style={styles.pilleText}>Entfernen</Text>
                </Druck>
              </View>
            );
          })
        )}

        <Text style={styles.kopf}>
          {Lenkung.KEIN_INTERESSE_TITEL}{keinListe.length ? `  ·  ${keinListe.length}` : ''}
        </Text>
        {stand && keinListe.length === 0 && <Text style={styles.leer}>{Lenkung.KEIN_INTERESSE_LEER}</Text>}
        {keinListe.map((k) => (
          <View key={k.postId} style={styles.zeile}>
            <View style={styles.zeileText}>
              <Text style={styles.zeileTitel} numberOfLines={1}>{k.titel}</Text>
              {!!users[k.verfasser]?.name && (
                <Text style={styles.zeileUnter} numberOfLines={1}>{users[k.verfasser]!.name}</Text>
              )}
            </View>
            <Druck
              style={styles.pille}
              onPress={() =>
                void ausfuehren(
                  () => keinInteresseZuruecknehmen(supabase!, ichId, k.postId),
                  'Der Beitrag darf wieder in deinen Feed'
                )
              }
              accessibilityLabel={`Kein Interesse an „${k.titel}" zurücknehmen`}
            >
              <Text style={styles.pilleText}>Zurücknehmen</Text>
            </Druck>
          </View>
        ))}

        <Text style={styles.kopf}>{Lenkung.RESET_TITEL}</Text>
        <Text style={styles.hinweis}>{Lenkung.RESET_TEXT}</Text>
        <Druck style={styles.reset} onPress={zuruecksetzen} accessibilityRole="button">
          <Text style={styles.resetText}>{Lenkung.RESET_TITEL}</Text>
        </Druck>
      </ScrollView>
    </SheetRahmen>
  );
};

const styles = themenStyles((colors) => ({
  inhalt: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  hinweis: { ...typography.small, color: colors.text2, lineHeight: 19, paddingBottom: spacing.sm },
  arten: { gap: spacing.sm, paddingVertical: spacing.xs },
  art: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  artAn: { backgroundColor: colors.brand, borderColor: colors.brand },
  artText: { ...typography.small, fontWeight: '600', color: colors.text2 },
  artTextAn: { color: '#fff' },
  feld: { marginTop: spacing.sm, marginBottom: spacing.xs },
  zeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  zeileText: { flex: 1, minWidth: 0 },
  zeileTitel: { ...typography.name, color: colors.text },
  zeileUnter: { ...typography.tiny, color: colors.text3 },
  mehr: { color: colors.brand, fontWeight: '600' },
  weniger: { color: colors.danger, fontWeight: '600' },
  pille: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface3,
  },
  pilleAn: { backgroundColor: colors.brand },
  pilleText: { ...typography.tiny, color: colors.text, fontWeight: '600' },
  pilleTextAn: { color: '#fff' },
  leer: { ...typography.small, color: colors.text3, paddingVertical: spacing.xs },
  meldung: { ...typography.small, color: colors.danger, paddingTop: spacing.sm },
  meldungGut: { color: colors.brand },
  kopf: { ...typography.small, color: colors.text2, marginTop: spacing.lg, marginBottom: spacing.xs },
  reset: {
    marginTop: spacing.sm,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
  },
  resetText: { ...typography.name, color: colors.danger },
}));
