import React, { useContext, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Avatar } from './Avatar';
import { ActionSheet } from './ActionSheet';
import { Druck } from './Druck';
import { AuthContext } from '../contexts/AuthContext';
import { useSupabase } from '../contexts/SupabaseContext';
import { useDaten } from '../contexts/DatenContext';
import { fotoHochladen } from '../lib/profilbild';
import * as Aktion from '../lib/aktionen';
import { colors, spacing, themenStyles, typography } from '../constants/design';

/**
 * Das eigene Profilbild ändern (Kasten 12.5).
 *
 * Henrik am 21.09.2026: „‚Profil bearbeiten' braucht die Funktion, ein neues
 * Profilbild hinzuzufügen." Bis dahin hatte die App gar keins — jeder Avatar
 * waren Initialen auf Farbe; die Website hielt ein Bild nur im Browser
 * (localStorage), andere sahen es nie.
 *
 * Jetzt: Foto aus der Mediathek (oder Kamera) → Eimer `media`, Ordner
 * `avatars` → `profiles.avatar_url` (SUPABASE_SCHEMA_69_profilbild.sql).
 * Gezeigt wird es überall, wo `Avatar` steht, weil ladeNutzer die Adresse
 * an jeden Nutzer hängt und ladeAlles sie unterschreibt.
 *
 * Die Kamera-Berechtigung selbst ist Sache von Kasten 11.7; hier wird nur
 * dieselbe Abfrage von expo-image-picker gestellt.
 */
export function useProfilbild(onNotice: (text: string) => void) {
  const { supabase } = useSupabase();
  const { user } = useContext(AuthContext);
  const daten = useDaten();
  const [laedt, setLaedt] = useState(false);
  /** Sofort anzeigen, bevor neuLaden durch ist. */
  const [vorschau, setVorschau] = useState<string | null | undefined>(undefined);

  const aendern = async (quelle: 'galerie' | 'kamera' | 'entfernen') => {
    if (!supabase || !user?.id) return onNotice('Dafür musst du angemeldet sein');
    setLaedt(true);
    try {
      if (quelle === 'entfernen') {
        await Aktion.profilbildSetzen(supabase, user.id, null);
        setVorschau(null);
        onNotice('Profilbild entfernt');
      } else {
        const foto = await fotoHochladen(supabase, quelle, 'avatars', `${user.id}.jpg`, onNotice);
        if (!foto) return;
        await Aktion.profilbildSetzen(supabase, user.id, foto.url);
        setVorschau(foto.anzeige ?? undefined);
        onNotice('Profilbild gespeichert');
      }
      void daten.neuLaden();
    } catch (e: any) {
      onNotice(e?.message ?? 'Das Profilbild ließ sich nicht speichern');
    } finally {
      setLaedt(false);
    }
  };

  const hatBild = vorschau === undefined ? Boolean(daten.users?.me?.avatar) : Boolean(vorschau);
  return { aendern, laedt, vorschau, hatBild };
}

/** Die drei Wege als Blatt — beim Antippen des Profilbilds im Video-Profil. */
export const ProfilbildSheet = ({
  visible,
  onClose,
  onNotice,
}: {
  visible: boolean;
  onClose: () => void;
  onNotice: (text: string) => void;
}) => {
  const { aendern, hatBild } = useProfilbild(onNotice);
  return (
    <ActionSheet
      visible={visible}
      title="Profilbild"
      items={[
        { key: 'galerie', label: 'Foto aus Mediathek', icon: 'images-outline' },
        { key: 'kamera', label: 'Foto aufnehmen', icon: 'camera-outline' },
        ...(hatBild ? [{ key: 'entfernen', label: 'Profilbild entfernen', icon: 'trash-outline' as const, gefahr: true }] : []),
      ]}
      onSelect={(key) => {
        onClose();
        void aendern(key as 'galerie' | 'kamera' | 'entfernen');
      }}
      onClose={onClose}
    />
  );
};

/**
 * Kopf im Blatt „Profil bearbeiten": Bild plus Knöpfe.
 *
 * Knöpfe statt eines zweiten Blatts, weil zwei Modals übereinander auf iOS
 * nicht verlässlich erscheinen — die Mediathek selbst öffnet expo-image-picker
 * über dem Formular.
 */
export const ProfilbildKopf = ({ name, onNotice }: { name: string; onNotice: (text: string) => void }) => {
  const { aendern, laedt, vorschau, hatBild } = useProfilbild(onNotice);
  return (
    <View style={styles.kopf} testID="profilbild-kopf">
      <View>
        <Avatar id="me" name={name} size={72} bild={vorschau} />
        {laedt && (
          <View style={styles.laedt}>
            <ActivityIndicator color={colors.white} />
          </View>
        )}
      </View>
      <View style={styles.knoepfe}>
        <Druck style={styles.knopf} disabled={laedt} onPress={() => aendern('galerie')} testID="profilbild-mediathek">
          <Text style={styles.knopfText}>Profilbild ändern</Text>
        </Druck>
        <Druck style={styles.knopf} disabled={laedt} onPress={() => aendern('kamera')} testID="profilbild-kamera">
          <Text style={styles.knopfText}>Foto aufnehmen</Text>
        </Druck>
        {hatBild && (
          <Druck style={styles.knopf} disabled={laedt} onPress={() => aendern('entfernen')} testID="profilbild-entfernen">
            <Text style={[styles.knopfText, styles.gefahr]}>Entfernen</Text>
          </Druck>
        )}
      </View>
    </View>
  );
};

const styles = themenStyles((colors) => ({
  kopf: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  laedt: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  knoepfe: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md },
  knopf: { paddingVertical: 6, paddingHorizontal: 4 },
  knopfText: { ...typography.message, color: colors.brand, fontWeight: '600' },
  gefahr: { color: colors.danger },
}));
