import React, { useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View, Animated } from 'react-native';
import { Druck } from './Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from './Avatar';
import { EmptyState } from './EmptyState';
import { colors, radius, sizes, spacing, themenStyles, typography } from '../constants/design';
import { useDaten } from '../contexts/DatenContext';
import { useSupabase } from '../contexts/SupabaseContext';
import { ICH as CURRENT_USER_ID, ladeKommentare } from '../lib/daten';
import { useZiehenZumSchliessen } from '../lib/ziehen';
import { Comment } from '../types';
import * as Aktion from '../lib/aktionen';
import { useAktionen } from '../lib/useAktionen';

interface Props {
  targetId: string | null;
  onClose: () => void;
  onCountChange?: (targetId: string, count: number) => void;
  /** Fuer die Rueckmeldung des Wortfilters. */
  onNotice?: (text: string) => void;
}

export const CommentSheet = ({ targetId, onClose, onCountChange, onNotice }: Props) => {
  const { users: alleNutzer, ichId } = useDaten();
  const { supabase } = useSupabase();
  const aktionen = useAktionen(onNotice);
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');

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
    ladeKommentare(supabase, ichId, targetId)
      .then((geladen) => {
        if (!abgebrochen) setComments(geladen);
      })
      .catch((e) => console.error('Kommentare laden fehlgeschlagen:', e?.message ?? e));
    return () => {
      abgebrochen = true;
    };
  }, [targetId, supabase, ichId]);

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
      onNotice?.(`„${treffer.wort}" geht hier nicht. Formuliere es bitte anders.`);
      return;
    }

    setDraft('');

    let data;
    try {
      data = await Aktion.kommentarAnlegen(supabase, ichId, targetId, text);
    } catch (e: any) {
      console.error('Kommentar senden fehlgeschlagen:', e?.message ?? e);
      setDraft(text);
      return;
    }

    const comment: Comment = {
      id: data.id,
      userId: CURRENT_USER_ID,
      text,
      time: new Date(data.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
      likes: 0,
      liked: false,
    };
    const next = [...comments, comment];
    setComments(next);
    onCountChange?.(targetId, next.length);
  };

  const { griff, ziehStil } = useZiehenZumSchliessen(onClose);

  const renderComment = ({ item }: { item: Comment }) => {
    const author = alleNutzer[item.userId];
    return (
      <View style={styles.comment}>
        <Avatar id={item.userId} name={author?.name ?? ''} size={sizes.avatarSm} />
        <View style={styles.commentBody}>
          <Text style={styles.commentText}>
            <Text style={styles.bold}>{author?.name}</Text> {item.text}
          </Text>
          <Text style={styles.commentMeta}>{item.time}</Text>
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
          data={comments}
          renderItem={renderComment}
          keyExtractor={(item) => item.id}
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

        <View style={styles.composer}>
          <Avatar id={CURRENT_USER_ID} name={alleNutzer[CURRENT_USER_ID]?.name ?? ""} size={sizes.avatarSm} />
          <View style={styles.field}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Kommentar hinzufügen"
              placeholderTextColor={colors.text3}
              multiline
            />
          </View>
          <Druck
            style={[styles.send, !draft.trim() && styles.sendDisabled]}
            onPress={send}
            disabled={!draft.trim()}
          >
            <Ionicons name="send" size={17} color={colors.white} />
          </Druck>
        </View>
      </KeyboardAvoidingView>
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
  commentMeta: { marginTop: 3, color: colors.text3, ...typography.small },
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
}));
