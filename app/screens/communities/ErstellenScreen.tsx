import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ExpoCrypto from 'expo-crypto';
import { Druck } from '../../components/Druck';
import { ActionSheet } from '../../components/ActionSheet';
import { QrCode } from '../../components/QrCode';
import { useSupabase } from '../../contexts/SupabaseContext';
import { fotoHochladen } from '../../lib/profilbild';
import { SUPABASE_CONFIG } from '../../constants/supabase';
import { colors, radius, spacing, themenStyles, typography } from '../../constants/design';

// Felder, Grenzen, Texte und Einladungslink — dieselbe Datei liest die Website.
const Erstellen = require('../../../gemeinsam/erstellen') as typeof import('../../../gemeinsam/erstellen');
const T = Erstellen.TEXTE;

type Ergebnis = { fehler?: string; hinweis?: string };

interface Props {
  art: 'community' | 'unterthema';
  /** Bei einem Unterthema: wie die Community heißt (für den Teilen-Text). */
  communityName?: string;
  onClose: () => void;
  /** Gespeichert — `meldung` steht danach als Hinweis. */
  onFertig: (meldung: string) => void;
  absenden: (werte: any, bildUrl: string | null, code: string) => Promise<Ergebnis>;
}

/**
 * „Community erstellen“ und „Unterthema erstellen“ nach dem Figma-Prototyp
 * (Kästen 28/10.2 und 16).
 *
 * Henrik am 28.09.2026: „…halte dich, wenn ich auf Neues Unterthema
 * erstellen drücke, explizit an meinen Figma Prototypen. Deine Seite weicht
 * meinem Prototypen sehr ab." Vorher waren beide ein kleines Formularblatt
 * mit einem bzw. zwei Feldern.
 *
 * Aufbau wie die Frames „CC + Unterthema erstellen“ (928:13446) und
 * „CP + Kanal erstellen“ (942:15097): X oben links, „✳ Pflichtfeld“, das
 * große Namensfeld, (Bild), Biografie, Link, (Unterthemen) bzw. Schalter
 * „Privates Unterthema“, „Einladungslink senden“, QR-Code, unten „fertig“.
 *
 * Steht in einem eigenen Modal (App.tsx), damit sie vor jeder Vollbildansicht
 * liegt — Kasten 10.1 war genau das: Die Seite öffnete hinter der
 * Community-Homeseite.
 *
 * Gegenstück: openErstellenSeite() in web/public/app.js.
 */
export const ErstellenScreen = ({ art, communityName, onClose, onFertig, absenden }: Props) => {
  const insets = useSafeAreaInsets();
  const { supabase } = useSupabase();
  const istCommunity = art === 'community';

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [link, setLink] = useState('');
  const [privat, setPrivat] = useState(false);
  const [unterthemen, setUnterthemen] = useState<string[]>([]);
  const [bild, setBild] = useState<{ url: string; anzeige: string | null } | null>(null);
  const [bildWahl, setBildWahl] = useState(false);
  const [bildLaedt, setBildLaedt] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  // Fehler stehen auf der Seite, nicht in einer Meldung hinter ihr.
  const [meldung, setMeldung] = useState<string | null>(null);

  // Der Code entsteht hier, damit Link und QR-Code schon jetzt dastehen
  // (wie im Prototyp). Gültig wird er mit „fertig“.
  const code = useMemo(() => Erstellen.neuerCode(ExpoCrypto.getRandomBytes(Erstellen.CODE_LAENGE)), []);
  const einladung = Erstellen.link(code, SUPABASE_CONFIG.redirectUrl);

  const bildHolen = async (quelle: 'galerie' | 'kamera') => {
    setBildLaedt(true);
    setMeldung(null);
    try {
      const foto = await fotoHochladen(supabase, quelle, 'avatars', `community-${Date.now()}.jpg`, setMeldung);
      if (foto) setBild(foto);
    } finally {
      setBildLaedt(false);
    }
  };

  const teilen = async () => {
    const wie = name.trim() || (istCommunity ? 'meine Community' : 'mein Unterthema');
    const zusatz = istCommunity || !communityName ? '' : ` (${communityName})`;
    try {
      await Share.share({ message: Erstellen.teilenText(art, wie + zusatz, code, SUPABASE_CONFIG.redirectUrl) });
    } catch {
      setMeldung('Teilen ist gerade nicht möglich');
    }
  };

  const fertig = async () => {
    if (laeuft || bildLaedt) return;
    const geprueft = istCommunity
      ? Erstellen.pruefeCommunity({ name, bild: !!bild, bio, link, unterthemen, privat })
      : Erstellen.pruefeUnterthema({ name, bio, link, privat });
    if (geprueft.fehler) return setMeldung(geprueft.fehler);
    setLaeuft(true);
    setMeldung(null);
    try {
      const e = await absenden(geprueft.werte, bild?.url ?? null, code);
      if (e.fehler) return setMeldung(e.fehler);
      const fertigText = `„${geprueft.werte!.name}“ erstellt`;
      onFertig(e.hinweis ? `${fertigText} · ${e.hinweis}` : fertigText);
    } finally {
      setLaeuft(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.seite}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID={istCommunity ? 'community-erstellen' : 'unterthema-erstellen'}
    >
      <View style={[styles.kopf, { paddingTop: insets.top + spacing.sm }]}>
        <Druck onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={T.schliessen} testID="erstellen-zu">
          <Ionicons name="close" size={30} color={colors.text} />
        </Druck>
      </View>

      <ScrollView contentContainerStyle={styles.inhalt} keyboardShouldPersistTaps="handled">
        <View style={styles.pflichtZeile}>
          <Text style={styles.stern}>✳</Text>
          <Text style={styles.pflichtText}>{T.pflichtfeld}</Text>
        </View>

        <View style={styles.nameFeld}>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={istCommunity ? T.communityName : T.unterthemaName}
            placeholderTextColor={colors.text2}
            style={styles.nameEingabe}
            maxLength={Erstellen.NAME_MAX}
            accessibilityLabel={istCommunity ? T.communityName : T.unterthemaName}
            testID="erstellen-name"
          />
          <Text style={[styles.stern, styles.sternEcke]}>✳</Text>
        </View>

        {istCommunity && (
          <Druck
            style={styles.bildFeld}
            onPress={() => setBildWahl(true)}
            disabled={bildLaedt}
            accessibilityRole="button"
            accessibilityLabel={bild ? T.bildAendern : T.bild}
            testID="erstellen-bild"
          >
            {bild?.anzeige ? (
              <>
                <Image source={{ uri: bild.anzeige }} style={styles.bildVorschau} />
                <View style={styles.bildMarke}>
                  <Text style={styles.bildMarkeText}>{T.bildAendern}</Text>
                </View>
              </>
            ) : (
              <>
                <Ionicons name="image-outline" size={86} color={colors.text} />
                <Text style={styles.bildText}>{T.bild}</Text>
              </>
            )}
            {bildLaedt && (
              <View style={styles.bildLaedt}>
                <ActivityIndicator color={colors.white} />
              </View>
            )}
            <Text style={[styles.stern, styles.sternEcke]}>✳</Text>
          </Druck>
        )}

        <TextInput
          value={bio}
          onChangeText={setBio}
          placeholder={T.bio}
          placeholderTextColor={colors.text2}
          style={[styles.feld, styles.feldAbstand]}
          multiline
          maxLength={Erstellen.BIO_MAX}
          accessibilityLabel={T.bio}
          testID="erstellen-bio"
        />
        <TextInput
          value={link}
          onChangeText={setLink}
          placeholder={T.link}
          placeholderTextColor={colors.text2}
          style={styles.feld}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          maxLength={Erstellen.LINK_MAX}
          accessibilityLabel={T.link}
          testID="erstellen-link"
        />

        {istCommunity ? (
          <>
            <View style={styles.strich} />
            {unterthemen.map((u, i) => (
              <View key={i} style={styles.unterthemaZeile}>
                <Text style={styles.raute}>#</Text>
                <TextInput
                  value={u}
                  onChangeText={(t) => setUnterthemen((alt) => alt.map((x, j) => (j === i ? t : x)))}
                  placeholder={T.unterthemaPlatzhalter}
                  placeholderTextColor={colors.text3}
                  style={styles.unterthemaEingabe}
                  maxLength={Erstellen.NAME_MAX}
                  autoFocus={!u}
                  accessibilityLabel={`${T.unterthemaPlatzhalter} ${i + 1}`}
                  testID={`erstellen-unterthema-${i}`}
                />
                <Druck
                  onPress={() => setUnterthemen((alt) => alt.filter((_, j) => j !== i))}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Unterthema ${i + 1} entfernen`}
                >
                  <Ionicons name="close-circle" size={20} color={colors.text3} />
                </Druck>
              </View>
            ))}
            {unterthemen.length < Erstellen.UNTERTHEMEN_MAX && (
              <Druck
                style={styles.unterthemaKnopf}
                onPress={() => setUnterthemen((alt) => [...alt, ''])}
                accessibilityRole="button"
                accessibilityLabel={T.unterthemen}
                testID="erstellen-unterthemen"
              >
                <View style={styles.plus}>
                  <Ionicons name="add" size={22} color={colors.white} />
                </View>
                <Text style={styles.unterthemaKnopfText}>{T.unterthemen}</Text>
              </Druck>
            )}
            <View style={styles.strich} />
          </>
        ) : null}

        <View style={styles.schalterZeile}>
          <View style={{ flex: 1 }}>
            <Text style={styles.schalterTitel}>{istCommunity ? T.privatCommunity : T.privatUnterthema}</Text>
            <Text style={styles.schalterSub}>{istCommunity ? T.privatCommunitySub : T.privatUnterthemaSub}</Text>
          </View>
          {/* Markenfarbe wie in den Einstellungen. */}
          <Switch
            value={privat}
            onValueChange={setPrivat}
            trackColor={{ true: colors.brand, false: colors.surface3 }}
            accessibilityLabel={istCommunity ? T.privatCommunity : T.privatUnterthema}
            testID="erstellen-privat"
          />
        </View>

        <Druck style={styles.einladen} onPress={teilen} accessibilityRole="button" accessibilityLabel={T.einladen} testID="erstellen-einladen">
          <Text style={styles.einladenText}>{T.einladen}</Text>
        </Druck>
        <Text style={styles.qrText}>{T.qr}</Text>
        <View style={styles.qr} accessibilityLabel={`QR-Code: ${einladung}`} testID="erstellen-qr">
          <QrCode text={einladung} groesse={200} />
        </View>
        <Text style={styles.qrHinweis}>{T.qrHinweis}</Text>
      </ScrollView>

      <View style={[styles.fuss, { paddingBottom: insets.bottom + spacing.md }]}>
        {!!meldung && (
          <Text style={styles.meldung} testID="erstellen-meldung">
            {meldung}
          </Text>
        )}
        <Druck
          style={[styles.fertig, (laeuft || bildLaedt) && { opacity: 0.6 }]}
          onPress={fertig}
          disabled={laeuft || bildLaedt}
          accessibilityRole="button"
          accessibilityLabel={T.fertig}
          testID="erstellen-fertig"
        >
          {laeuft ? <ActivityIndicator color={colors.white} /> : <Text style={styles.fertigText}>{T.fertig}</Text>}
        </Druck>
      </View>

      <ActionSheet
        visible={bildWahl}
        title={T.bild}
        items={[
          { key: 'galerie', label: 'Foto aus Mediathek', icon: 'images-outline' },
          { key: 'kamera', label: 'Foto aufnehmen', icon: 'camera-outline' },
        ]}
        onSelect={(k) => {
          setBildWahl(false);
          void bildHolen(k as 'galerie' | 'kamera');
        }}
        onClose={() => setBildWahl(false)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = themenStyles((c) => ({
  seite: { flex: 1, backgroundColor: c.surface },
  kopf: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  inhalt: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  pflichtZeile: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.sm, marginBottom: spacing.lg },
  stern: { color: c.danger, fontSize: 16 },
  sternEcke: { position: 'absolute' as const, top: 8, right: 12 },
  pflichtText: { ...typography.small, color: c.text },
  nameFeld: {
    borderWidth: 1.5,
    borderColor: c.text,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    minHeight: 68,
    justifyContent: 'center' as const,
  },
  nameEingabe: { fontSize: 20, fontWeight: '700' as const, color: c.text, paddingVertical: spacing.md },
  bildFeld: {
    marginTop: spacing.xl,
    marginHorizontal: spacing.sm,
    aspectRatio: 1.35,
    borderWidth: 1.5,
    borderColor: c.text,
    borderRadius: radius.xl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
  },
  bildText: { ...typography.h2, color: c.text2, marginTop: spacing.xs },
  bildVorschau: { ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const) },
  bildMarke: {
    position: 'absolute' as const,
    bottom: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  bildMarkeText: { ...typography.small, color: c.white },
  bildLaedt: {
    ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const),
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  feld: {
    borderWidth: 1.5,
    borderColor: c.text,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 50,
    fontSize: 17,
    color: c.text,
    marginTop: spacing.sm,
  },
  feldAbstand: { marginTop: spacing.xl },
  strich: { borderTopWidth: 1, borderColor: c.text2, borderStyle: 'dashed' as const, marginVertical: spacing.lg },
  unterthemaZeile: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  raute: { ...typography.h3, color: c.text2 },
  unterthemaEingabe: { flex: 1, fontSize: 16, color: c.text, paddingVertical: spacing.md },
  unterthemaKnopf: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.md,
    borderWidth: 1.5,
    borderColor: c.text,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  plus: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1D7FF2',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  unterthemaKnopfText: { ...typography.body, color: c.text },
  schalterZeile: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: spacing.xl,
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: c.text,
  },
  schalterTitel: { fontSize: 19, color: c.text },
  schalterSub: { ...typography.small, color: c.text, fontWeight: '400' as const },
  einladen: {
    marginTop: spacing.xl,
    borderWidth: 1.5,
    borderColor: c.text,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  einladenText: { fontSize: 17, color: c.text },
  qrText: { ...typography.body, color: c.text, marginTop: spacing.md, marginLeft: spacing.xl },
  qr: { alignItems: 'center' as const, marginTop: spacing.lg },
  qrHinweis: { ...typography.small, color: c.text3, textAlign: 'center' as const, marginTop: spacing.sm },
  fuss: {
    borderTopWidth: 1,
    borderColor: c.border,
    paddingTop: spacing.md,
    alignItems: 'center' as const,
    backgroundColor: c.surface,
  },
  meldung: { ...typography.preview, color: c.danger, marginBottom: spacing.sm, paddingHorizontal: spacing.lg, textAlign: 'center' as const },
  fertig: {
    backgroundColor: '#0A7CEB',
    borderRadius: radius.md,
    minWidth: 140,
    paddingVertical: spacing.md,
    alignItems: 'center' as const,
  },
  fertigText: { fontSize: 17, color: c.white },
}));
