/**
 * Einen eigenen Beitrag einer Playlist zuordnen — oder eine eigene Story
 * einem Highlight (Kasten 17.3).
 *
 * Henrik am 01.10.2026: „Der Nutzer des Accounts muss dann jedes Video
 * selbst einordnen." Bis dahin gab es in der App KEINEN Weg dorthin: der
 * Leertext der Playlist sprach vom „Drei-Punkte-Menü an einem Beitrag",
 * aber dieses Menü kannte nur Link, Herunterladen und Story. `inSammlung`
 * und `ausSammlung` standen in lib/aktionen.ts und wurden nirgends gerufen.
 *
 * Eine Liste der eigenen Playlists bzw. Highlights mit Häkchen: Tippen legt
 * hinein oder nimmt wieder heraus. Darunter „Neue Playlist" mit Namensfeld —
 * im selben Blatt, weil iOS zwei Modals, die sich ablösen, nicht
 * zuverlässig zeigt.
 *
 * Kein eigenes Modal: der Inhalt sitzt im Blatt des Aufrufers
 * (OptionenKacheln beim Beitrag, SheetRahmen bei der Story).
 *
 * Gegenstück auf der Website: openZuordnen() in web/public/app.js.
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Druck } from './Druck';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';
import { useDaten } from '../contexts/DatenContext';
import { useSupabase } from '../contexts/SupabaseContext';
import { useProfil } from '../contexts/ProfilContext';
import * as Aktion from '../lib/aktionen';

const SammlungRegel = require('../../gemeinsam/sammlungen') as typeof import('../../gemeinsam/sammlungen');

interface Props {
  art: 'playlist' | 'highlight';
  stueck: { postId?: string; storyId?: string };
  onNotice: (message: string) => void;
}

export const SammlungZuordnen = ({ art, stueck, onNotice }: Props) => {
  const { ichId } = useDaten();
  const { supabase } = useSupabase();
  const { sammlungenNeu } = useProfil();
  const [liste, setListe] = useState<{ id: string; name: string; enthalten: boolean }[] | null>(null);
  const [neu, setNeu] = useState('');
  const [beschaeftigt, setBeschaeftigt] = useState<string | null>(null);
  // Fehler im Blatt, nicht als Hinweis dahinter (Kasten 6.5): der Toast liegt
  // unter dem Modal und wäre nicht zu sehen.
  const [fehler, setFehler] = useState<string | null>(null);

  const istPlaylist = art === 'playlist';
  const farbe = SammlungRegel.ringfarbe(art);

  useEffect(() => {
    if (!supabase || !ichId) return;
    let abgebrochen = false;
    Aktion.sammlungenFuerStueck(supabase, ichId, art, stueck)
      .then((l) => !abgebrochen && setListe(l))
      .catch((e: any) => {
        if (abgebrochen) return;
        setListe([]);
        setFehler(e?.message ?? 'Das ließ sich nicht laden');
      });
    return () => {
      abgebrochen = true;
    };
    // stueck ist bei jedem Aufbau ein neues Objekt — die Kennungen reichen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, ichId, art, stueck.postId, stueck.storyId]);

  const umschalten = async (s: { id: string; name: string; enthalten: boolean }) => {
    if (!supabase || beschaeftigt) return;
    setBeschaeftigt(s.id);
    setFehler(null);
    try {
      if (s.enthalten) await Aktion.ausSammlung(supabase, s.id, stueck);
      else await Aktion.inSammlung(supabase, s.id, stueck);
      setListe((l) => (l ?? []).map((x) => (x.id === s.id ? { ...x, enthalten: !s.enthalten } : x)));
      onNotice(s.enthalten ? `Aus „${s.name}" entfernt` : `Zu „${s.name}" hinzugefügt`);
      sammlungenNeu();
    } catch (e: any) {
      setFehler(e?.message ?? 'Das ging nicht durch');
    } finally {
      setBeschaeftigt(null);
    }
  };

  const anlegen = async () => {
    const name = neu.trim();
    if (!name) return setFehler('Bitte einen Namen eingeben');
    if (!supabase || !ichId || beschaeftigt) return;
    if ((liste ?? []).some((s) => s.name === name)) {
      return setFehler(istPlaylist ? 'Diese Playlist gibt es schon' : 'Dieses Highlight gibt es schon');
    }
    setBeschaeftigt('neu');
    setFehler(null);
    try {
      const s = await Aktion.neueSammlungMit(supabase, ichId, art, name, stueck);
      setListe((l) => [...(l ?? []), { id: s.id, name: s.name, enthalten: true }]);
      setNeu('');
      onNotice(`„${s.name}" angelegt und hinzugefügt`);
      sammlungenNeu();
    } catch (e: any) {
      setFehler(e?.message ?? 'Das ließ sich nicht anlegen');
    } finally {
      setBeschaeftigt(null);
    }
  };

  return (
    <View testID="sammlung-zuordnen">
      {liste === null ? (
        <ActivityIndicator style={{ padding: spacing.lg }} color={colors.text2} />
      ) : liste.length === 0 ? (
        <Text style={styles.hinweis}>
          {istPlaylist ? 'Du hast noch keine Playlist. Leg unten eine an.' : 'Du hast noch kein Highlight. Leg unten eins an.'}
        </Text>
      ) : (
        liste.map((s) => (
          <Druck
            key={s.id}
            style={({ pressed }) => [styles.zeile, pressed && styles.gedrueckt]}
            onPress={() => void umschalten(s)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: s.enthalten }}
            accessibilityLabel={s.name}
          >
            <View style={[styles.kreis, { borderColor: farbe }]}>
              <Ionicons name={istPlaylist ? 'play' : 'star'} size={13} color={farbe} />
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {s.name}
            </Text>
            {beschaeftigt === s.id ? (
              <ActivityIndicator color={colors.text2} />
            ) : (
              <Ionicons
                name={s.enthalten ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={s.enthalten ? colors.brand : colors.text3}
              />
            )}
          </Druck>
        ))
      )}

      <View style={styles.neuZeile}>
        <TextInput
          style={styles.eingabe}
          value={neu}
          onChangeText={(t) => {
            setNeu(t);
            if (fehler) setFehler(null);
          }}
          placeholder={istPlaylist ? 'Neue Playlist, z. B. Gaming' : 'Neues Highlight, z. B. Sommer'}
          placeholderTextColor={colors.text3}
          maxLength={60}
          returnKeyType="done"
          onSubmitEditing={() => void anlegen()}
          accessibilityLabel={istPlaylist ? 'Name der neuen Playlist' : 'Name des neuen Highlights'}
        />
        <Druck
          style={[styles.anlegen, !neu.trim() && styles.anlegenAus]}
          onPress={() => void anlegen()}
          disabled={!neu.trim() || beschaeftigt !== null}
          accessibilityLabel={istPlaylist ? 'Neue Playlist' : 'Neues Highlight'}
        >
          {beschaeftigt === 'neu' ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Ionicons name="add" size={20} color={colors.white} />
          )}
        </Druck>
      </View>
      {fehler ? <Text style={styles.fehler}>{fehler}</Text> : null}
    </View>
  );
};

const styles = themenStyles((colors) => ({
  zeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  gedrueckt: { backgroundColor: colors.surface2 },
  kreis: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, ...typography.body, color: colors.text },
  hinweis: { ...typography.message, color: colors.text2, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  neuZeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  eingabe: {
    flex: 1,
    height: 42,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    color: colors.text,
    ...typography.body,
  },
  anlegen: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anlegenAus: { opacity: 0.4 },
  fehler: { ...typography.small, color: colors.danger, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
}));
