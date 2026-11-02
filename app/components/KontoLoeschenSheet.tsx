/**
 * Konto löschen — echt.
 *
 * WARUM ES DAS GIBT
 *
 * Kasten RS 2 (rechtliche Prüfung 21.10.2026). Bis zum 25.10.2026 zeigte
 * „Konto löschen" nur „Löschauftrag vorgemerkt" und löschte nichts. DSGVO
 * Art. 17 verlangt das Löschen, Apple (5.1.1 v) und Google Play verlangen es
 * in der App selbst.
 *
 * Ablauf, Texte und Gründe stehen in gemeinsam/konto-loeschen.js (Passwort →
 * Dateien → Konto → Abmelden). Fehlt Schema 103 noch, bricht der Ablauf ab,
 * bevor irgendetwas gelöscht ist, und sagt das. Fehler stehen IM Blatt (ein
 * Hinweis läge unter dem Modal, siehe CommentSheet 28.09.2026).
 *
 * Gegenstück auf der Website: openKontoLoeschen in web/public/app.js.
 */
import React, { useContext, useEffect, useState } from 'react';
import { ScrollView, Text, TextInput } from 'react-native';
import { Druck } from './Druck';
import { SheetRahmen } from './SheetRahmen';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';
import { AuthContext } from '../contexts/AuthContext';
import { useSupabase } from '../contexts/SupabaseContext';

const KontoLoeschen = require('../../gemeinsam/konto-loeschen') as typeof import('../../gemeinsam/konto-loeschen');

interface Props {
  visible: boolean;
  onClose: () => void;
  /** „Meine Daten herunterladen" — vor dem Löschen anbieten (Art. 20 DSGVO). */
  onDatenauskunft: () => void;
  /** Nach dem Löschen. Das Konto ist dann schon abgemeldet. */
  onGeloescht: () => void;
}

export const KontoLoeschenSheet = ({ visible, onClose, onDatenauskunft, onGeloescht }: Props) => {
  const { supabase } = useSupabase();
  const { user, logout, frueheresVergessen } = useContext(AuthContext);
  const [passwort, setPasswort] = useState('');
  const [fehler, setFehler] = useState('');
  const [laeuft, setLaeuft] = useState(false);

  // Jedes Öffnen fängt leer an — kein Passwort bleibt im Speicher stehen.
  useEffect(() => {
    if (visible) return;
    setPasswort('');
    setFehler('');
    setLaeuft(false);
  }, [visible]);

  const loeschen = async () => {
    if (laeuft) return;
    if (!supabase || !user) return setFehler(KontoLoeschen.grundText('nicht_angemeldet'));
    setFehler('');
    setLaeuft(true);
    const id = user.id;
    const r = await KontoLoeschen.ablauf(
      passwort,
      KontoLoeschen.schritteFuer(supabase, user.email, async () => {
        await logout();
        // logout() merkt sich das Konto unter „Frühere Konten" — ein gelöschtes gehört da nicht hin.
        frueheresVergessen(id);
      })
    );
    if (r.ok) return onGeloescht();
    setLaeuft(false);
    setFehler(r.text);
  };

  const fuss = (
    <Druck
      style={[styles.knopf, laeuft && styles.knopfAus]}
      onPress={loeschen}
      disabled={laeuft}
      accessibilityRole="button"
      testID="konto-loeschen-ja"
    >
      <Text style={styles.knopfText}>{laeuft ? 'Wird gelöscht …' : 'Konto endgültig löschen'}</Text>
    </Druck>
  );

  return (
    <SheetRahmen visible={visible} title="Konto löschen" onClose={onClose} hoch fuss={fuss}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.inhalt}>
        <Text style={styles.text}>{KontoLoeschen.HINWEIS}</Text>
        <Druck style={styles.link} onPress={onDatenauskunft} accessibilityRole="button" testID="konto-loeschen-daten">
          <Text style={styles.linkText}>Meine Daten herunterladen</Text>
        </Druck>
        <Text style={styles.label}>Zur Sicherheit: dein Passwort</Text>
        <TextInput
          style={styles.eingabe}
          value={passwort}
          onChangeText={(t) => {
            setPasswort(t);
            if (fehler) setFehler('');
          }}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          placeholder="Passwort"
          placeholderTextColor={colors.text3}
          editable={!laeuft}
          testID="konto-loeschen-passwort"
        />
        {!!fehler && (
          <Text style={styles.fehler} accessibilityRole="alert" testID="konto-loeschen-fehler">
            {fehler}
          </Text>
        )}
      </ScrollView>
    </SheetRahmen>
  );
};

const styles = themenStyles((colors) => ({
  inhalt: { paddingBottom: spacing.lg },
  text: { ...typography.body, color: colors.text, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  link: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  linkText: { ...typography.body, fontWeight: '700', color: colors.brand },
  label: { ...typography.small, color: colors.text2, paddingHorizontal: spacing.lg, marginBottom: 6 },
  eingabe: {
    marginHorizontal: spacing.lg,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    paddingHorizontal: spacing.md,
    color: colors.text,
    ...typography.body,
  },
  fehler: { ...typography.small, fontWeight: '600', color: colors.danger, paddingHorizontal: spacing.lg, paddingTop: 6 },
  knopf: {
    height: 44,
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knopfAus: { opacity: 0.6 },
  knopfText: { ...typography.name, color: colors.white },
}));
