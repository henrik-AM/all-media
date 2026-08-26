import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Motiv } from '../../components/Motiv';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { colors, radius, sizes, spacing, themenStyles, typography } from '../../constants/design';
import { mockUsers } from '../../mocks';
import { useProfil } from '../../contexts/ProfilContext';
import { useReposts } from '../../contexts/RepostContext';
import { Clip } from '../../types';
import { ExplorerZiel } from './ExplorerScreen';

interface Props {
  clipId: string;
  onBack: () => void;
  onOpenProfile: (userId: string) => void;
  onOpenExplorer: (ziel: ExplorerZiel) => void;
  onShare: (clip: Clip) => void;
  onNotice: (message: string) => void;
}

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',')}k` : String(n);

const sekundenVon = (dauer: string) => {
  const [min, sek] = String(dauer).split(':').map(Number);
  return min * 60 + sek;
};

const zeitText = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/**
 * Prototyp-Frame "VQ + Video": Zurück-Pfeil, Videofläche im Querformat,
 * darunter Überschrift mit Aufrufen und Datum und die Reihe aus Like,
 * Kommentar, Senden, Repost und Merken.
 *
 * Vorher ließ sich ein Querformat-Video gar nicht öffnen — es kam nur
 * „Wiedergabe folgt mit dem Backend".
 */
export const ClipPlayerScreen = ({ clipId, onBack, onOpenProfile, onOpenExplorer, onShare, onNotice }: Props) => {
  const insets = useSafeAreaInsets();
  const { clips, clipUmschalten, raster } = useProfil();
  const { istRepostet, umschalten } = useReposts();

  const [offen, setOffen] = useState(clipId);
  const [laeuft, setLaeuft] = useState(false);
  const [bei, setBei] = useState(0);
  const stand = useRef(0);

  const clip = clips.find((c) => c.id === offen);
  const gesamt = clip ? sekundenVon(clip.duration) : 0;

  useEffect(() => {
    if (!laeuft || !gesamt) return;
    const uhr = setInterval(() => {
      stand.current = Math.min(gesamt, stand.current + 1);
      setBei(stand.current);
      if (stand.current >= gesamt) setLaeuft(false);
    }, 1000);
    return () => clearInterval(uhr);
  }, [laeuft, gesamt]);

  if (!clip) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Druck style={styles.bar} onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Druck>
        <Text style={styles.leer}>Dieses Video gibt es nicht mehr.</Text>
      </View>
    );
  }

  const autor = mockUsers[clip.userId];
  const eigenesBild = raster.find((r) => r.id === clip.id)?.mediaUri;
  const aehnlich = clips.filter((c) => c.id !== clip.id).slice(0, 4);

  const wechseln = (id: string) => {
    stand.current = 0;
    setBei(0);
    setLaeuft(false);
    setOffen(id);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Druck onPress={onBack} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Druck>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
        <Druck style={styles.buehne} onPress={() => setLaeuft((v) => !v)}>
          {eigenesBild ? (
            <Image source={{ uri: eigenesBild }} style={styles.voll} />
          ) : (
            <Motiv id={clip.id} icon="tv-outline" iconSize={48} dunkel style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
          )}
          <View style={[styles.play, laeuft && styles.playAus]}>
            <Ionicons name={laeuft ? 'pause' : 'play'} size={26} color={colors.white} />
          </View>
        </Druck>

        <View style={styles.leiste}>
          <Text style={styles.zeit}>{zeitText(bei)}</Text>
          <View style={styles.balken}>
            <View style={[styles.fortschritt, { width: `${gesamt ? (bei / gesamt) * 100 : 0}%` }]} />
          </View>
          <Text style={styles.zeit}>{clip.duration}</Text>
        </View>

        <View style={styles.kopf}>
          <Text style={styles.titel}>{clip.title}</Text>
          <Text style={styles.sub}>
            {compact(clip.views)} Aufrufe · {clip.age}
          </Text>
        </View>

        <View style={styles.autor}>
          <Druck onPress={() => onOpenProfile(clip.userId)}>
            <Avatar id={clip.userId} name={autor.name} size={sizes.avatarMd} />
          </Druck>
          <Druck style={styles.autorText} onPress={() => onOpenProfile(clip.userId)}>
            <Text style={styles.autorName}>{autor.name}</Text>
            <Text style={styles.autorSub}>{autor.handle}</Text>
          </Druck>
        </View>

        <View style={styles.aktionen}>
          <Druck style={styles.aktion} onPress={() => clipUmschalten(clip.id, 'like')}>
            <Ionicons
              name={clip.liked ? 'heart' : 'heart-outline'}
              size={24}
              color={clip.liked ? colors.danger : colors.text}
            />
            <Text style={styles.aktionZahl}>{compact(clip.likes ?? 0)}</Text>
          </Druck>

          <Druck style={styles.aktion} onPress={() => onNotice(`${clip.comments ?? 0} Kommentare`)}>
            <Ionicons name="chatbubble-outline" size={22} color={colors.text} />
            <Text style={styles.aktionZahl}>{compact(clip.comments ?? 0)}</Text>
          </Druck>

          <Druck style={styles.aktion} onPress={() => onShare(clip)}>
            <Ionicons name="paper-plane-outline" size={22} color={colors.text} />
          </Druck>

          <Druck
            style={styles.aktion}
            onPress={() => {
              clipUmschalten(clip.id, 'repost');
              const jetzt = umschalten('video', clip.id, clip.title);
              onNotice(jetzt ? 'Repostet' : 'Repost zurückgenommen');
            }}
          >
            <Ionicons
              name="repeat"
              size={24}
              color={istRepostet('video', clip.id) ? colors.success : colors.text}
            />
          </Druck>

          <Druck
            style={[styles.aktion, styles.aktionEnde]}
            onPress={() => {
              clipUmschalten(clip.id, 'save');
              onNotice(clip.saved ? 'Nicht mehr gemerkt' : 'Gemerkt');
            }}
          >
            <Ionicons name={clip.saved ? 'bookmark' : 'bookmark-outline'} size={22} color={colors.text} />
          </Druck>
        </View>

        {!!clip.description && <Text style={styles.text}>{clip.description}</Text>}

        {!!clip.tags?.length && (
          <View style={styles.tags}>
            {clip.tags.map((t) => (
              <Druck key={t} style={styles.tag} onPress={() => onOpenExplorer({ art: 'hashtag', wert: t })}>
                <Text style={styles.tagText}>{t}</Text>
              </Druck>
            ))}
          </View>
        )}

        <Text style={styles.abschnitt}>Ähnliche Videos →</Text>
        {aehnlich.map((c) => (
          <Druck key={c.id} style={styles.clip} onPress={() => wechseln(c.id)}>
            <View style={styles.clipBild}>
              <Motiv id={c.id} icon="tv-outline" iconSize={26} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
              <View style={styles.clipZeit}>
                <Text style={styles.clipZeitText}>{c.duration}</Text>
              </View>
            </View>
            <View style={styles.clipMeta}>
              <Avatar id={c.userId} name={mockUsers[c.userId].name} size={sizes.avatarSm} />
              <View style={styles.clipTexte}>
                <Text style={styles.clipTitel} numberOfLines={2}>
                  {c.title}
                </Text>
                <Text style={styles.clipSub}>
                  {mockUsers[c.userId].name} · {compact(c.views)} Aufrufe
                </Text>
              </View>
            </View>
          </Druck>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = themenStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  bar: {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  leer: { ...typography.message, color: colors.text2, padding: spacing.lg },

  buehne: {
    aspectRatio: 16 / 9,
    backgroundColor: '#12161B',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  voll: { width: '100%', height: '100%' },
  play: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playAus: { opacity: 0 },
  leiste: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.md, paddingVertical: 8, backgroundColor: colors.black },
  zeit: { ...typography.tiny, color: '#B9BDC6', fontVariant: ['tabular-nums'] },
  balken: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' },
  fortschritt: { height: '100%', backgroundColor: colors.danger },

  kopf: { paddingHorizontal: spacing.lg, paddingTop: 14, paddingBottom: 6 },
  titel: { fontSize: 17, fontWeight: '700', color: colors.text, lineHeight: 22 },
  sub: { ...typography.small, color: colors.text2, marginTop: 3 },

  autor: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 8 },
  autorText: { flex: 1 },
  autorName: { ...typography.name, color: colors.text },
  autorSub: { ...typography.small, color: colors.text3 },

  aktionen: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  aktion: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  aktionEnde: { marginLeft: 'auto' },
  aktionZahl: { ...typography.small, color: colors.text2 },

  text: { ...typography.message, color: colors.text, paddingHorizontal: spacing.lg, paddingBottom: 10, lineHeight: 20 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: spacing.lg, paddingBottom: 10 },
  tag: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.brandSoft },
  tagText: { ...typography.small, fontWeight: '600', color: colors.brand },

  abschnitt: { ...typography.h3, color: colors.text, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  clip: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  clipBild: { height: 150, borderRadius: radius.md, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  clipZeit: { position: 'absolute', right: 8, bottom: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.7)' },
  clipZeitText: { ...typography.tiny, color: colors.white },
  clipMeta: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  clipTexte: { flex: 1 },
  clipTitel: { ...typography.name, color: colors.text },
  clipSub: { ...typography.small, color: colors.text2, marginTop: 2 },
}));
