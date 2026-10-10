import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Druck } from '../../components/Druck';
import { Avatar } from '../../components/Avatar';
import { ActionSheet } from '../../components/ActionSheet';
import { useProfilbild } from '../../components/ProfilbildWahl';
import { useProfil } from '../../contexts/ProfilContext';
import { useDaten } from '../../contexts/DatenContext';
import { useSupabase } from '../../contexts/SupabaseContext';
import { namensZeile, useNamensStand } from '../../lib/registrierung';
import * as Aktion from '../../lib/aktionen';
import { colors, radius, spacing, themenStyles, typography } from '../../constants/design';

// Grenzen, Link-Regel und Texte — dieselbe Datei liest die Website.
const Profilfelder = require('../../../gemeinsam/profilfelder') as typeof import('../../../gemeinsam/profilfelder');
const Benutzername = require('../../../gemeinsam/benutzername') as typeof import('../../../gemeinsam/benutzername');
const T = Profilfelder.TEXTE;
const G = Profilfelder.GRENZEN;

type Feld = 'name' | 'benutzername' | 'pronomen' | 'bio' | 'links';

interface Props {
  onBack: () => void;
  onNotice: (text: string) => void;
}

/**
 * Die Seite „Profil bearbeiten“ (Kasten 1.3, Nachtrag 10.10.2026).
 *
 * Henrik: „deutlich mehr Freiraum“ als das kleine Blatt, „orientiere dich an
 * Instagram und entscheide selbst“. Also wie dort: oben das große Bild mit
 * „Bild bearbeiten“, darunter Zeilen — Beschriftung links, Wert rechts. Jede
 * Zeile öffnet eine eigene Unterseite mit großem Eingabefeld und
 * Abbrechen/Fertig. Fehler stehen auf der Seite, nicht in einer Meldung
 * hinter ihr.
 *
 * Erreichbar über den Hinweis „Weitere Bearbeitungen unter Einstellungen“ im
 * kleinen Blatt (alle drei Profile) und Einstellungen → Konto → „Profil
 * bearbeiten“. Gegenstück auf der Website: renderProfilSeite() in
 * web/public/app.js — gleiche Texte aus gemeinsam/profilfelder.js.
 *
 * Bewusst nicht: Geschlecht (Datensparsamkeit, Kinderkonten).
 */
export const ProfilBearbeitenScreen = ({ onBack, onNotice }: Props) => {
  const insets = useSafeAreaInsets();
  const { eigenesProfil } = useProfil();
  const daten = useDaten();
  const [feld, setFeld] = useState<Feld | null>(null);
  const [bildOffen, setBildOffen] = useState(false);
  // Meldungen zum Bild stehen unter dem Bild, nicht hinter der Seite.
  const [bildMeldung, setBildMeldung] = useState<string | null>(null);
  const bild = useProfilbild((text) => setBildMeldung(text));

  const handle = daten.users?.me?.handle ?? '';
  const links = eigenesProfil.links?.length
    ? eigenesProfil.links
    : Profilfelder.linksAus({ link: eigenesProfil.link });

  if (feld) {
    return (
      <FeldSeite
        feld={feld}
        handle={handle}
        onFertig={(meldung) => {
          setFeld(null);
          if (meldung) onNotice(meldung);
        }}
      />
    );
  }

  const zeilen: { feld: Feld; label: string; wert: string; leer: string }[] = [
    { feld: 'name', label: T.name, wert: eigenesProfil.name, leer: T.leer.name },
    { feld: 'benutzername', label: T.benutzername, wert: handle, leer: T.leer.benutzername },
    { feld: 'pronomen', label: T.pronomen, wert: eigenesProfil.pronomen ?? '', leer: T.leer.pronomen },
    { feld: 'bio', label: T.bio, wert: eigenesProfil.bio, leer: T.leer.bio },
    { feld: 'links', label: T.links, wert: Profilfelder.linksZeile(links), leer: T.leer.links },
  ];

  return (
    <View style={[styles.seite, { paddingTop: insets.top }]} testID="profilseite">
      <View style={styles.kopf}>
        <Druck onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel={T.zurueck} testID="profilseite-zurueck">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Druck>
        <Text style={styles.kopfTitel}>{T.seite}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl + insets.bottom }}>
        <View style={styles.bildBlock}>
          <View>
            <Avatar id="me" name={eigenesProfil.name} size={96} bild={bild.vorschau} />
            {bild.laedt && (
              <View style={styles.bildLaedt}>
                <ActivityIndicator color={colors.white} />
              </View>
            )}
          </View>
          <Druck
            onPress={() => {
              setBildMeldung(null);
              setBildOffen(true);
            }}
            disabled={bild.laedt}
            accessibilityRole="button"
            accessibilityLabel={T.bildBearbeiten}
            testID="profilseite-bild"
          >
            <Text style={styles.bildKnopf}>{T.bildBearbeiten}</Text>
          </Druck>
          {!!bildMeldung && <Text style={styles.bildMeldung}>{bildMeldung}</Text>}
        </View>

        <View style={styles.liste}>
          {zeilen.map((z) => (
            <Druck
              key={z.feld}
              style={styles.zeile}
              onPress={() => setFeld(z.feld)}
              accessibilityRole="button"
              accessibilityLabel={`${z.label} bearbeiten`}
              testID={`profilseite-${z.feld}`}
            >
              <Text style={styles.zeileLabel}>{z.label}</Text>
              <Text style={[styles.zeileWert, !z.wert && styles.zeileLeer]} numberOfLines={1}>
                {z.wert || z.leer}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text3} />
            </Druck>
          ))}
        </View>
      </ScrollView>

      <ActionSheet
        visible={bildOffen}
        title={T.bildBearbeiten}
        items={[
          { key: 'galerie', label: T.bildWaehlen, icon: 'images-outline' },
          { key: 'kamera', label: T.bildAufnehmen, icon: 'camera-outline' },
          ...(bild.hatBild ? [{ key: 'entfernen', label: T.bildEntfernen, icon: 'trash-outline' as const, gefahr: true }] : []),
        ]}
        onSelect={(key) => {
          setBildOffen(false);
          void bild.aendern(key as 'galerie' | 'kamera' | 'entfernen');
        }}
        onClose={() => setBildOffen(false)}
      />
    </View>
  );
};

/* ------------------------------------------------------------------------ */
/* Unterseite je Feld                                                        */
/* ------------------------------------------------------------------------ */

const FeldSeite = ({
  feld,
  handle,
  onFertig,
}: {
  feld: Feld;
  handle: string;
  /** Zurück zur Hauptseite; mit Text nach erfolgreichem Speichern. */
  onFertig: (meldung?: string) => void;
}) => {
  const insets = useSafeAreaInsets();
  const { eigenesProfil, profilSpeichernWarten } = useProfil();
  const daten = useDaten();
  const { supabase } = useSupabase();

  const anfang =
    feld === 'name'
      ? eigenesProfil.name
      : feld === 'benutzername'
      ? Benutzername.normal(handle)
      : feld === 'pronomen'
      ? eigenesProfil.pronomen ?? ''
      : feld === 'bio'
      ? eigenesProfil.bio
      : '';
  const [wert, setWert] = useState(anfang);
  const [links, setLinks] = useState<{ url: string; titel: string }[]>(() => {
    const l = eigenesProfil.links?.length ? eigenesProfil.links : Profilfelder.linksAus({ link: eigenesProfil.link });
    return l.map((x) => ({ ...x }));
  });
  const [fehler, setFehler] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);

  // Benutzername: live wie bei der Registrierung — nur fragen, wenn er sich geändert hat.
  const eigenerName = feld === 'benutzername' && Benutzername.normal(wert) === Benutzername.normal(handle);
  const namensStand = useNamensStand(supabase, feld === 'benutzername' && !eigenerName ? wert : '');
  const namensHinweis = eigenerName ? { text: T.eigenerName, gut: true } : namensZeile(namensStand);

  const titel: Record<Feld, string> = {
    name: T.name,
    benutzername: T.benutzername,
    pronomen: T.pronomen,
    bio: T.bio,
    links: T.links,
  };

  const fertig = async () => {
    setFehler(null);
    if (feld === 'benutzername') {
      if (eigenerName) return onFertig();
      const form = Benutzername.pruefe(wert);
      if (form) return setFehler(form);
      if (namensStand.stand === 'vergeben') return setFehler(namensStand.meldung);
      if (!supabase) return setFehler('Dafür musst du angemeldet sein');
      setSpeichert(true);
      const ergebnis = await Aktion.benutzernameAendern(supabase, Benutzername.normal(wert));
      setSpeichert(false);
      if (!ergebnis.ok) return setFehler(ergebnis.meldung);
      void daten.neuLaden();
      return onFertig(T.gespeichert);
    }

    let aenderung: Record<string, unknown>;
    if (feld === 'name') {
      const grund = Profilfelder.namePruefen(wert);
      if (grund) return setFehler(grund);
      aenderung = { name: wert.trim() };
    } else if (feld === 'pronomen') {
      const grund = Profilfelder.pronomenPruefen(wert);
      if (grund) return setFehler(grund);
      aenderung = { pronomen: wert.trim() };
    } else if (feld === 'bio') {
      const grund = Profilfelder.bioPruefen(wert);
      if (grund) return setFehler(grund);
      aenderung = { bio: wert.trim() };
    } else {
      const geprueft = Profilfelder.linksPruefen(links);
      if (geprueft.fehler !== undefined) return setFehler(geprueft.fehler);
      aenderung = { links: geprueft.links };
    }

    setSpeichert(true);
    const grund = await profilSpeichernWarten(aenderung);
    setSpeichert(false);
    if (grund) return setFehler(grund);
    onFertig(T.gespeichert);
  };

  const grenze = feld === 'name' ? G.name : feld === 'pronomen' ? G.pronomen : feld === 'bio' ? G.bio : undefined;
  const erklaerung = T.erklaerung[feld];

  return (
    <KeyboardAvoidingView
      style={[styles.seite, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID={`profilseite-feld-${feld}`}
    >
      <View style={styles.kopf}>
        <Druck onPress={() => onFertig()} hitSlop={10} accessibilityRole="button" accessibilityLabel={T.abbrechen} testID="profilseite-abbrechen">
          <Text style={styles.kopfKnopf}>{T.abbrechen}</Text>
        </Druck>
        <Text style={styles.kopfTitel}>{titel[feld]}</Text>
        <Druck
          onPress={() => void fertig()}
          disabled={speichert}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={T.fertig}
          testID="profilseite-fertig"
        >
          {speichert ? (
            <ActivityIndicator color={colors.brand} />
          ) : (
            <Text style={[styles.kopfKnopf, styles.kopfFertig]}>{T.fertig}</Text>
          )}
        </Druck>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.feldInhalt}>
        {feld !== 'links' ? (
          <>
            <Text style={styles.feldLabel}>{titel[feld]}</Text>
            <View style={styles.eingabeZeile}>
              {feld === 'benutzername' && <Text style={styles.at}>@</Text>}
              <TextInput
                style={[styles.eingabe, feld === 'bio' && styles.eingabeGross]}
                value={wert}
                onChangeText={(t) => {
                  setWert(t);
                  setFehler(null);
                }}
                autoFocus
                multiline={feld === 'bio'}
                maxLength={grenze}
                autoCapitalize={feld === 'benutzername' ? 'none' : 'sentences'}
                autoCorrect={feld !== 'benutzername'}
                placeholder={T.leer[feld]}
                placeholderTextColor={colors.text3}
                accessibilityLabel={`${titel[feld]} eingeben`}
                testID="profilseite-eingabe"
              />
            </View>
            {grenze !== undefined && (
              <Text style={styles.zaehler} testID="profilseite-zaehler">
                {Profilfelder.zaehler(wert, grenze)}
              </Text>
            )}
            {feld === 'benutzername' && !!namensHinweis.text && (
              <Text
                style={[styles.hinweis, namensHinweis.gut ? styles.hinweisGut : styles.hinweisFehler]}
                testID="profilseite-namensstand"
              >
                {namensHinweis.text}
              </Text>
            )}
          </>
        ) : (
          <>
            {links.length === 0 && <Text style={styles.erklaerung}>{T.keineLinks}</Text>}
            {links.map((l, i) => (
              <View key={i} style={styles.linkKarte} testID={`profilseite-link-${i + 1}`}>
                <View style={styles.linkKopf}>
                  <Text style={styles.feldLabel}>Link {i + 1}</Text>
                  <Druck
                    onPress={() => {
                      setLinks((vorher) => vorher.filter((_, j) => j !== i));
                      setFehler(null);
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`${T.linkLoeschen} ${i + 1}`}
                  >
                    <Ionicons name="trash-outline" size={19} color={colors.danger} />
                  </Druck>
                </View>
                <TextInput
                  style={styles.eingabe}
                  value={l.url}
                  onChangeText={(t) => {
                    setLinks((vorher) => vorher.map((x, j) => (j === i ? { ...x, url: t } : x)));
                    setFehler(null);
                  }}
                  autoFocus={i === links.length - 1 && !l.url}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  maxLength={G.adresse}
                  placeholder={T.adresseBeispiel}
                  placeholderTextColor={colors.text3}
                  accessibilityLabel={`${T.adresse} ${i + 1}`}
                />
                <TextInput
                  style={[styles.eingabe, styles.eingabeTitel]}
                  value={l.titel}
                  onChangeText={(t) => setLinks((vorher) => vorher.map((x, j) => (j === i ? { ...x, titel: t } : x)))}
                  maxLength={G.titel}
                  placeholder={T.titel}
                  placeholderTextColor={colors.text3}
                  accessibilityLabel={`${T.titel} ${i + 1}`}
                />
              </View>
            ))}
            {links.length < G.links ? (
              <Druck
                style={styles.linkNeu}
                onPress={() => setLinks((vorher) => [...vorher, { url: '', titel: '' }])}
                accessibilityRole="button"
                accessibilityLabel={T.linkHinzufuegen}
                testID="profilseite-link-neu"
              >
                <Ionicons name="add-circle-outline" size={20} color={colors.brand} />
                <Text style={styles.linkNeuText}>{T.linkHinzufuegen}</Text>
              </Druck>
            ) : (
              <Text style={styles.erklaerung}>{T.linksVoll}</Text>
            )}
          </>
        )}

        {!!fehler && (
          <Text style={[styles.hinweis, styles.hinweisFehler]} testID="profilseite-fehler" accessibilityLiveRegion="polite">
            {fehler}
          </Text>
        )}
        <Text style={styles.erklaerung}>{erklaerung}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = themenStyles((colors) => ({
  seite: { flex: 1, backgroundColor: colors.surface },
  kopf: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 50,
  },
  kopfTitel: { ...typography.name, color: colors.text },
  kopfKnopf: { ...typography.body, color: colors.text },
  kopfFertig: { color: colors.brand, fontWeight: '700' },

  bildBlock: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  bildLaedt: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bildKnopf: { ...typography.body, color: colors.brand, fontWeight: '600', paddingVertical: 4 },
  bildMeldung: { ...typography.small, color: colors.text2, textAlign: 'center', paddingHorizontal: spacing.xl },

  liste: { borderTopWidth: 1, borderTopColor: colors.border },
  zeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  zeileLabel: { ...typography.body, color: colors.text, width: 120 },
  zeileWert: { ...typography.body, color: colors.text, flex: 1, textAlign: 'right' },
  zeileLeer: { color: colors.text3 },

  feldInhalt: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl },
  feldLabel: { ...typography.small, color: colors.text2 },
  eingabeZeile: { flexDirection: 'row', alignItems: 'center' },
  at: { fontSize: 18, color: colors.text2, marginRight: 2 },
  eingabe: {
    flex: 1,
    fontSize: 18,
    color: colors.text,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  eingabeGross: { minHeight: 140, textAlignVertical: 'top' },
  eingabeTitel: { fontSize: 15 },
  zaehler: { ...typography.small, color: colors.text3, textAlign: 'right' },
  hinweis: { ...typography.small, marginTop: spacing.xs },
  hinweisGut: { color: colors.success },
  hinweisFehler: { color: colors.danger },
  erklaerung: { ...typography.small, color: colors.text2, marginTop: spacing.sm },

  linkKarte: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  linkKopf: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkNeu: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  linkNeuText: { ...typography.body, color: colors.brand, fontWeight: '600' },
}));
