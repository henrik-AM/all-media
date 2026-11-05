import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View, Animated } from 'react-native';
import { ZiehZumAntworten } from './ZiehZumAntworten';
import { Druck } from './Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from './Avatar';
import { StoryAvatar } from './StoryAvatar';
import { EmptyState } from './EmptyState';
import { colors, radius, sizes, spacing, themenStyles, typography } from '../constants/design';
import { useDaten } from '../contexts/DatenContext';
import { useSupabase } from '../contexts/SupabaseContext';
import { ICH as CURRENT_USER_ID, ladeKommentare } from '../lib/daten';
import { useZiehenZumSchliessen } from '../lib/ziehen';
import { Comment } from '../types';
import * as Aktion from '../lib/aktionen';
import { useAktionen } from '../lib/useAktionen';

import { FarbfilterSchicht } from './Farbfilter';
import { MarkierterText } from './MarkierterText';
import { MarkierungsEingabe } from './MarkierungsEingabe';
import { MeldenSheet } from './MeldenSheet';

// Nachtrag 4.3b: Fäden, „@name", Klappknopf — dieselben Regeln wie die Website.
const Kommentar = require('../../gemeinsam/kommentar') as typeof import('../../gemeinsam/kommentar');

interface Props {
  targetId: string | null;
  onClose: () => void;
  onCountChange?: (targetId: string, count: number) => void;
  /** Wird nicht mehr genutzt: Meldungen stehen seit 28.09.2026 im Blatt. */
  onNotice?: (text: string) => void;
  /**
   * Nachtrag 4.3 (12.10.2026): Kommentar aus einer Mitteilung — Faden
   * aufklappen, hinrollen, kurz hervorheben. Gleich auf der Website
   * (openComments, springeZu).
   */
  springeZu?: string | null;
}

export const CommentSheet = ({ targetId, onClose, onCountChange, springeZu }: Props) => {
  const { users: alleNutzer, ichId } = useDaten();
  const { supabase } = useSupabase();
  /*
   * Meldungen erscheinen im Blatt selbst. `onNotice` zeichnet den Toast unter
   * das Modal: wer ein gesperrtes Wort schrieb oder ohne Netz sendete, sah
   * bis zum 28.09.2026 gar nichts - der Senden-Knopf wirkte kaputt.
   */
  const [hinweis, setHinweis] = useState('');
  const aktionen = useAktionen(setHinweis);
  const [comments, setComments] = useState<Comment[]>([]);
  /*
   * Kasten RS 3: fremde Kommentare lassen sich melden (art 'comment',
   * Schema 102). Bis zum 22.10.2026 gab es dafür keinen Weg. Gleich auf der
   * Website (commentRow, data-kmelden).
   */
  const [meldeKommentar, setMeldeKommentar] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  /*
   * Nachtrag 4.3b (Henrik, 11.10.2026): auf einen Kommentar antworten — per
   * „Antworten" unter dem Kommentar oder nach rechts ziehen. `antwort` ist
   * der angesprochene Kommentar; die Wurzel rechnet Kommentar.antwortZiel.
   */
  const [antwort, setAntwort] = useState<Comment | null>(null);
  /** Aufgeklappte Fäden („N Antworten ansehen"). */
  const [offen, setOffen] = useState<Set<string>>(new Set());
  // Nachtrag 4.3: der Kommentar aus einer Mitteilung leuchtet kurz auf.
  const [markiert, setMarkiert] = useState<string | null>(null);
  const liste = useRef<FlatList<{ kommentar: Comment; antworten: Comment[] }>>(null);
  const feldRef = useRef<TextInput>(null);
  const faeden = useMemo(() => Kommentar.faeden(comments), [comments]);
  const insets = useSafeAreaInsets();
  /*
   * Mit offener Tastatur liegt die Home-Leiste unter der Tastatur. Ihr
   * Abstand blieb trotzdem stehen und liess eine leere Lücke zwischen
   * Eingabezeile und Tastatur (28.09.2026).
   */
  const [tastatur, setTastatur] = useState(false);
  useEffect(() => {
    const an = Keyboard.addListener('keyboardWillShow', () => setTastatur(true));
    const aus = Keyboard.addListener('keyboardWillHide', () => setTastatur(false));
    return () => {
      an.remove();
      aus.remove();
    };
  }, []);

  /*
   * Kommentare werden zu dem Beitrag geholt, der gerade offen ist — nicht
   * beim Start für alle Beiträge auf einmal. Bei zweihundert Beiträgen wäre
   * das ein Vielfaches an Daten für etwas, das man meistens nie aufklappt.
   */
  useEffect(() => {
    if (!targetId || !supabase || !ichId) {
      setComments([]);
      return;
    }
    let abgebrochen = false;
    setDraft('');
    setHinweis('');
    setAntwort(null);
    setOffen(new Set());
    ladeKommentare(supabase, ichId, targetId)
      .then((geladen) => {
        if (abgebrochen) return;
        setComments(geladen);
        if (!springeZu) return;
        const ziel = geladen.find((c) => c.id === springeZu);
        if (!ziel) return setHinweis('Dieser Kommentar ist nicht mehr da');
        const wurzel = ziel.antwortAuf ?? ziel.id;
        setOffen(new Set([wurzel]));
        setMarkiert(ziel.id);
        setTimeout(() => setMarkiert(null), 2500);
        const platz = Kommentar.faeden(geladen).findIndex((f) => f.kommentar.id === wurzel);
        if (platz >= 0) setTimeout(() => liste.current?.scrollToIndex({ index: platz, viewPosition: 0.3, animated: true }), 350);
      })
      .catch((e) => console.error('Kommentare laden fehlgeschlagen:', e?.message ?? e));
    return () => {
      abgebrochen = true;
    };
  }, [targetId, supabase, ichId, springeZu]);

  const toggleLike = async (comment: Comment) => {
    // Erst anzeigen, dann speichern: ein Herz, das eine halbe Sekunde
    // nachhinkt, fühlt sich kaputt an.
    const setzen = (liked: boolean, likes: number) =>
      setComments((prev) =>
        prev.map((c) => (c.id === comment.id ? { ...c, liked, likes } : c))
      );

    setzen(!comment.liked, comment.likes + (comment.liked ? -1 : 1));
    if (!supabase || !ichId) return;

    /*
     * Das Ergebnis wurde vorher gar nicht angesehen. Scheiterte das
     * Schreiben — abgelaufene Anmeldung, keine Verbindung —, blieb das Herz
     * trotzdem rot und behauptete etwas, das nirgends stand.
     */
    try {
      await Aktion.kommentarLike(supabase, ichId, comment.id);
    } catch (e: any) {
      console.error('Kommentar-Like fehlgeschlagen:', e?.message ?? e);
      setzen(comment.liked, comment.likes);
    }
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || !targetId || !supabase || !ichId) return;

    /*
     * Der Kommentarfilter aus dem Handbuch ("Inhalts-/Kommentarfilter").
     *
     * Er greift vor dem Absenden und nicht danach: einen Kommentar erst zu
     * veroeffentlichen und dann wieder zu entfernen hiesse, dass ihn in der
     * Zwischenzeit jemand gelesen hat. Der Entwurf bleibt stehen, damit man
     * ihn umformulieren kann, statt ihn neu zu tippen.
     *
     * Geprueft wird auf Wortgrenzen — sonst waere "Spastik" ein Verstoss.
     */
    const treffer = await aktionen.wortfilter(text);
    if (treffer) {
      setHinweis(`„${treffer.wort}" geht hier nicht. Formuliere es bitte anders.`);
      return;
    }

    setHinweis('');
    setDraft('');

    const ziel = antwort ? Kommentar.antwortZiel(antwort) : null;
    let data;
    try {
      data = await Aktion.kommentarAnlegen(supabase, ichId, targetId, text, ziel);
    } catch (e: any) {
      console.error('Kommentar senden fehlgeschlagen:', e?.message ?? e);
      setDraft(text);
      setHinweis('Der Kommentar ging nicht durch. Versuch es noch einmal.');
      return;
    }

    const imFaden = !!ziel && !data.ohneFaden;
    if (data.ohneFaden) setHinweis(Kommentar.OHNE_FADEN);
    const comment: Comment = {
      id: data.id,
      userId: CURRENT_USER_ID,
      text,
      time: new Date(data.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      likes: 0,
      liked: false,
      antwortAuf: imFaden ? ziel!.antwortAuf : null,
      antwortAn: imFaden ? ziel!.antwortAn : null,
    };
    const next = [...comments, comment];
    setComments(next);
    // Die eigene Antwort soll man sehen: ihren Faden aufklappen.
    if (imFaden && ziel!.antwortAuf) setOffen((o) => new Set(o).add(ziel!.antwortAuf!));
    setAntwort(null);
    onCountChange?.(targetId, next.length);
  };

  /** „Antworten" unter dem Kommentar oder nach rechts gezogen. */
  const antworten = (k: Comment) => {
    const eigen = k.userId === CURRENT_USER_ID;
    const vor = Kommentar.vorbelegung(alleNutzer[k.userId]?.handle, eigen);
    setAntwort(k);
    setHinweis('');
    // Einen schon getippten Text nicht überschreiben — nur das @ davor.
    setDraft((d) => (vor && !d.startsWith(vor) ? vor + d.replace(/^@\S+\s/, '') : d));
    setTimeout(() => feldRef.current?.focus(), 50);
  };

  const umklappen = (wurzel: string) =>
    setOffen((o) => {
      const n = new Set(o);
      if (n.has(wurzel)) n.delete(wurzel);
      else n.add(wurzel);
      return n;
    });

  const { griff, ziehStil } = useZiehenZumSchliessen(onClose);

  const kommentarZeile = (item: Comment, alsAntwort: boolean) => {
    const author = alleNutzer[item.userId];
    return (
      /*
       * Nachtrag 4.3b: nach rechts ziehen → antworten. Dieselbe Geste wie in
       * der Chatblase (ZiehZumAntworten, Schwelle aus gemeinsam/chatblase.js).
       */
      <ZiehZumAntworten aktiv onAntworten={() => antworten(item)} testID={`kommentar-${item.id}`}>
      <View style={[styles.comment, alsAntwort && styles.commentAntwort, markiert === item.id && styles.commentMarkiert]}>
        {/* Kasten 11.1: Ring an der Person, die kommentiert hat. */}
        <StoryAvatar
          id={item.userId}
          name={author?.name ?? ''}
          size={alsAntwort ? sizes.avatarSm - 6 : sizes.avatarSm + 4}
          bereich="videos"
        />
        <View style={styles.commentBody}>
          {/* Kasten 25.3: @-Namen im Kommentar führen zum Profil. */}
          <MarkierterText
            style={styles.commentText}
            davor={<><Text style={styles.bold}>{author?.name}</Text>{' '}</>}
            text={item.text}
          />
          <View style={styles.metaZeile}>
            <Text style={styles.commentMeta}>{item.time}</Text>
            {/* Wie Instagram/TikTok: „Antworten" direkt unter dem Kommentar. */}
            <Druck
              onPress={() => antworten(item)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Antworten an ${author?.name ?? 'Kommentar'}`}
              testID={`kommentar-antworten-${item.id}`}
            >
              <Text style={styles.antwortenKnopf}>Antworten</Text>
            </Druck>
            {item.userId !== CURRENT_USER_ID && item.userId !== ichId && (
              <Druck
                onPress={() => setMeldeKommentar(item.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Kommentar von ${author?.name ?? 'jemandem'} melden`}
                testID={`kommentar-melden-${item.id}`}
              >
                <Text style={styles.meldenKnopf}>Melden</Text>
              </Druck>
            )}
          </View>
        </View>
        {/*
          Herz und Zahl untereinander. Henrik am 26.08.2026, Punkt 24: "Keine
          Anzahl der Likes unter Kommentaren." Sie stand in der Metazeile
          ("14:02 · 3 Gefällt mir") und nur, wenn es ueberhaupt Likes gab -
          dort sucht sie niemand. Jetzt steht sie unter dem Herz, also direkt
          unter dem Knopf, der sie veraendert.
        */}
        <Druck style={styles.likeSpalte} onPress={() => toggleLike(item)} hitSlop={8}>
          <Ionicons
            name={item.liked ? 'heart' : 'heart-outline'}
            size={17}
            color={item.liked ? '#FF3040' : colors.text3}
          />
          <Text style={[styles.likeZahl, item.liked && styles.likeZahlAn]}>
            {item.likes > 0 ? item.likes : ''}
          </Text>
        </Druck>
      </View>
      </ZiehZumAntworten>
    );
  };

  /** Ein Kommentar oben, darunter eingerückt seine Antworten (aufklappbar). */
  const renderFaden = ({ item }: { item: { kommentar: Comment; antworten: Comment[] } }) => {
    const auf = offen.has(item.kommentar.id);
    const klapp = Kommentar.klappText(item.antworten.length, auf);
    return (
      <View>
        {kommentarZeile(item.kommentar, false)}
        {klapp ? (
          <Druck
            style={styles.klapp}
            onPress={() => umklappen(item.kommentar.id)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={klapp}
            testID={`kommentar-klapp-${item.kommentar.id}`}
          >
            <View style={styles.klappStrich} />
            <Text style={styles.klappText}>{klapp}</Text>
          </Druck>
        ) : null}
        {auf ? item.antworten.map((a) => <React.Fragment key={a.id}>{kommentarZeile(a, true)}</React.Fragment>) : null}
      </View>
    );
  };

  return (
    <Modal visible={!!targetId} transparent animationType="slide" onRequestClose={onClose}>
      <Druck style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        style={styles.sheet}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/*
          Punkt 23: nach unten ziehen schliesst das Blatt. Der Griff nimmt
          den Zug entgegen, nicht die Liste - sonst liesse sich in den
          Kommentaren nicht mehr blaettern.
        */}
        <Animated.View {...griff} style={[styles.griffFeld, ziehStil]}>
          <View style={styles.handle} />
        </Animated.View>
        <Text style={styles.title}>
          {comments.length} {comments.length === 1 ? 'Kommentar' : 'Kommentare'}
        </Text>

        <FlatList
          data={faeden}
          renderItem={renderFaden}
          keyExtractor={(item) => item.kommentar.id}
          ref={liste}
          extraData={[offen, markiert]}
          onScrollToIndexFailed={() => {}}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptyState
              icon="chatbubble-outline"
              title="Noch keine Kommentare"
              text="Schreib den ersten."
            />
          }
        />

        {hinweis ? (
          <Text style={styles.fehler} accessibilityLiveRegion="polite">
            {hinweis}
          </Text>
        ) : null}
        {/*
          Henrik am 21.09.2026: Eingabefeld, Senden-Knopf und Profilbild
          sassen zu weit unten und waren nur halb zu sehen. Das Blatt reicht
          bis an den Bildschirmrand, und dort liegt beim iPhone die
          Home-Leiste — ohne diesen Abstand verschwand die Zeile darunter.
        */}
        {/* Nachtrag 4.3b: wem man gerade antwortet — × bricht ab. */}
        {antwort ? (
          <View style={styles.antwortLeiste}>
            <Text style={styles.antwortLeisteText} numberOfLines={1}>
              {Kommentar.leistenText(
                antwort.userId === CURRENT_USER_ID ? 'dich selbst' : alleNutzer[antwort.userId]?.name
              )}
            </Text>
            <Druck
              hitSlop={8}
              onPress={() => {
                const vor = Kommentar.vorbelegung(
                  alleNutzer[antwort.userId]?.handle,
                  antwort.userId === CURRENT_USER_ID
                );
                setAntwort(null);
                if (vor) setDraft((d) => (d.startsWith(vor) ? d.slice(vor.length) : d));
              }}
              accessibilityLabel="Antworten abbrechen"
            >
              <Ionicons name="close" size={18} color={colors.text2} />
            </Druck>
          </View>
        ) : null}
        <View style={[styles.composer, { paddingBottom: 9 + (tastatur ? 0 : insets.bottom) }]}>
          <Avatar id={CURRENT_USER_ID} name={alleNutzer[CURRENT_USER_ID]?.name ?? ""} size={sizes.avatarSm} />
          <View style={styles.field}>
            {/* Kasten 25.1: @ schlägt Personen vor. */}
            <MarkierungsEingabe
              ref={feldRef}
              style={styles.input}
              value={draft}
              onChangeText={(t) => {
                setDraft(t);
                if (hinweis) setHinweis('');
              }}
              placeholder={antwort ? Kommentar.PLATZHALTER_ANTWORT : 'Kommentar hinzufügen'}
              placeholderTextColor={colors.text3}
              multiline
            />
          </View>
          <Druck
            style={[styles.send, !draft.trim() && styles.sendDisabled]}
            onPress={send}
            disabled={!draft.trim()}
            accessibilityLabel="Senden"
          >
            <Ionicons name="send" size={17} color={colors.white} />
          </Druck>
        </View>
        {/* Kasten 21: Farbfilter auch in diesem Fenster (eigenes Fenster = eigene Fläche). */}
        <FarbfilterSchicht radius={20} />
      </KeyboardAvoidingView>
      <MeldenSheet
        ziel={meldeKommentar ? { art: 'comment', id: meldeKommentar } : null}
        onClose={() => setMeldeKommentar(null)}
      />
    </Modal>
  );
};

const styles = themenStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(6,8,12,0.52)' },
  sheet: {
    height: '74%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  title: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    color: colors.text,
    ...typography.h3,
  },

  list: { flex: 1 },
  comment: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: spacing.lg, paddingVertical: 9 },
  commentBody: { flex: 1, minWidth: 0 },
  commentText: { color: colors.text, ...typography.message, lineHeight: 20 },
  /* Flaeche um den Griff - sie ist der Anfasspunkt zum Wegziehen. */
  griffFeld: { paddingTop: 6, paddingBottom: 4, alignItems: 'center' },
  likeSpalte: { alignItems: 'center', gap: 2, minWidth: 26 },
  likeZahl: { fontSize: 11, fontWeight: '600', lineHeight: 13, color: colors.text3 },
  likeZahlAn: { color: '#FF3040' },
  commentMeta: { color: colors.text3, ...typography.small },
  /* Nachtrag 4.3b: Antworten eingerückt unter dem Kommentar (Avatar-Breite). */
  commentAntwort: { paddingLeft: spacing.lg + sizes.avatarSm + 4 + 11, paddingVertical: 6 },
  commentMarkiert: { backgroundColor: colors.surface3, borderRadius: 12 },
  metaZeile: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 3 },
  antwortenKnopf: { color: colors.text2, ...typography.small, fontWeight: '700' },
  klapp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: spacing.lg + sizes.avatarSm + 4 + 11,
    paddingVertical: 4,
  },
  klappStrich: { width: 24, height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.text3 },
  klappText: { color: colors.text2, ...typography.small, fontWeight: '600' },
  antwortLeiste: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    backgroundColor: colors.surface3,
  },
  antwortLeisteText: { flex: 1, color: colors.text2, ...typography.small },
  meldenKnopf: { color: colors.text3, ...typography.small, fontWeight: '700' },
  bold: { fontWeight: '700' },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  field: {
    flex: 1,
    borderRadius: radius.xl,
    backgroundColor: colors.surface3,
    paddingHorizontal: 14,
  },
  input: { maxHeight: 108, paddingVertical: 10, color: colors.text, ...typography.body },
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: { opacity: 0.4 },
  fehler: {
    paddingHorizontal: spacing.lg,
    paddingTop: 8,
    color: colors.danger,
    ...typography.small,
    fontWeight: '600',
  },
}));
