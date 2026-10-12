import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Druck } from '../../components/Druck';
import { Avatar } from '../../components/Avatar';
import { EinstellungSheet, ListenZeile } from '../../components/EinstellungSheet';
import { SheetRahmen } from '../../components/SheetRahmen';
import { ActionSheet } from '../../components/ActionSheet';
import { colors, radius, spacing, themenStyles, typography } from '../../constants/design';
import { useDaten } from '../../contexts/DatenContext';
import { useSupabase } from '../../contexts/SupabaseContext';
import { useProfil } from '../../contexts/ProfilContext';
import { useImMessenger } from '../../contexts/KontaktBildContext';
import { ladeNachrichten } from '../../lib/daten';
import * as Aktion from '../../lib/aktionen';
import { Chat, Message } from '../../types';

const Gruppe = require('../../../gemeinsam/gruppe') as typeof import('../../../gemeinsam/gruppe');
const Kontaktbild = require('../../../gemeinsam/kontaktbild') as typeof import('../../../gemeinsam/kontaktbild');

interface Props {
  chat: Chat;
  onBack: () => void;
  /** Gruppenanruf — derselbe Weg wie der Hörer im Chatkopf. */
  onCall: (art: 'audio' | 'video') => void;
  /** Ein Mitglied antippen: Kontaktprofil (Messenger-Kontakt) oder öffentliches Profil. */
  onOpenMitglied: (userId: string, ziel: 'kontakt' | 'oeffentlich') => void;
  /** Nach dem Verlassen: zurück in die Chatliste. */
  onVerlassen: () => void;
  onNotice: (message: string) => void;
}

type Offen =
  | { art: 'liste'; titel: string; zeilen: ListenZeile[]; leer: string }
  | { art: 'suche' }
  | { art: 'verlassen' }
  | null;

/**
 * Gruppeninfo (Nachtrag 12.10.2026 (3), Kasten 28/7.9 und 7.10).
 *
 * Aufbau nach dem Prototyp-Frame „MC + Kontakteinstellungen" (560-1471),
 * angepasst an Gruppen: großes Bild, Name, „N Mitglieder", die Kacheln
 * Audio/Video/Suchen, gruppierte Zeilen, die Mitgliederliste und unten rot
 * „Gruppe verlassen". Nur, was es wirklich gibt — kein Gruppenbild-Upload,
 * keine Admins, kein Umbenennen (dafür fehlt jede Regel in der Datenbank).
 *
 * Name und Bild jedes Mitglieds kommen aus gemeinsam/gruppe.js →
 * Kontaktbild.anzeigeFuer: in einer Messenger-Gruppe mein Spitzname und mein
 * eigenes Kontaktbild (7.10), in einer Community-Gruppe das Profil. Avatar.tsx
 * fragt denselben Kontext (KontaktBildBereich), App.tsx setzt ihn für diese
 * Ansicht genau wie für den Chat selbst.
 *
 * Gleicher Aufbau auf der Website: openGruppenInfo in web/public/app.js.
 */
export const GroupSettingsScreen = ({ chat, onBack, onCall, onOpenMitglied, onVerlassen, onNotice }: Props) => {
  const { users, contacts, kontaktBilder, ichId, chatsNeuLaden } = useDaten();
  const { supabase } = useSupabase();
  const insets = useSafeAreaInsets();
  const imMessenger = useImMessenger();
  const { markierte, chatStumm, chatStummUmschalten, chatLeeren, geleerteChats } = useProfil();

  const [offen, setOffen] = useState<Offen>(null);
  const [suche, setSuche] = useState('');
  const [geladen, setGeladen] = useState<Message[]>([]);
  const [gesperrt, setGesperrt] = useState(Boolean(chat.gesperrt));
  const [verlaesst, setVerlaesst] = useState(false);

  // Der Verlauf für Medien, Markiertes und die Suche — wie im Kontaktprofil.
  useEffect(() => {
    if (!supabase || !ichId) return;
    let abgebrochen = false;
    ladeNachrichten(supabase, chat.id, ichId)
      .then((m) => { if (!abgebrochen) setGeladen(m); })
      .catch((e) => console.error('Verlauf laden fehlgeschlagen:', e?.message ?? e));
    return () => { abgebrochen = true; };
  }, [supabase, ichId, chat.id]);

  /*
   * Kasten 7.10: der Spitzname steht in contacts (Schema 33). `users[id].name`
   * trägt ihn schon (daten.ts setzt ihn ein); hier geht er trotzdem
   * ausdrücklich über anzeigeFuer, damit die Regel an einer Stelle steht —
   * dieselbe wie auf der Website.
   */
  const spitznamen = useMemo(() => {
    const karte: Record<string, string> = {};
    for (const k of contacts) if (k.name) karte[k.id] = k.name;
    return karte;
  }, [contacts]);

  const liste = useMemo(
    () =>
      Gruppe.mitglieder({
        andere: chat.memberIds ?? [],
        ich: { name: users.me?.name, bild: users.me?.avatar },
        profil: (id) => users[id],
        kontaktBilder,
        spitznamen,
        messenger: imMessenger,
        kontaktbild: Kontaktbild,
      }),
    [chat.memberIds, users, kontaktBilder, spitznamen, imMessenger]
  );

  const geleert = geleerteChats.includes(chat.id);
  const verlauf = geleert ? [] : geladen;
  const medien = verlauf.filter((m) => m.media || m.geteilt || m.standort || m.kontakt);
  const mitStern = verlauf.filter((m) => markierte.includes(m.id));
  const stumm = chatStumm.includes(chat.id) ? !chat.muted : Boolean(chat.muted);
  const beschreibung = (m: Message) =>
    m.geteilt
      ? m.geteilt.weg ? 'Beitrag nicht mehr verfügbar' : `${m.geteilt.autor}: ${m.geteilt.titel || m.geteilt.beschreibung || ''}`
      : m.standort ? m.standort.name : m.kontakt ? m.kontakt.name : m.text || 'Foto';
  const treffer = suche.trim()
    ? verlauf.filter((m) => (m.text ?? '').toLowerCase().includes(suche.trim().toLowerCase()))
    : [];

  const zeile = (label: string, neben: string, onPress: () => void, art?: 'gefahr') => (
    <Druck
      key={label}
      style={({ pressed }) => [styles.zeile, pressed && styles.gedrueckt]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.zeileText, art === 'gefahr' && styles.gefahrText]}>{label}</Text>
      {!!neben && <Text style={styles.zeileWert}>{neben}</Text>}
      {!art && <Ionicons name="chevron-forward" size={17} color={colors.text3} />}
    </Druck>
  );

  const verlassen = async () => {
    setOffen(null);
    if (!supabase || !ichId) return onNotice('Dafür musst du angemeldet sein');
    setVerlaesst(true);
    try {
      // Dieselbe Aktion wie „Chat löschen": die eigene Mitgliedschaft geht
      // (Regel „Eigene Mitgliedschaft beenden", Schema 9), die Gruppe bleibt.
      await Aktion.chatVerlassen(supabase, ichId, chat.id);
      onNotice(Gruppe.VERLASSEN_OK);
      await chatsNeuLaden();
      onVerlassen();
    } catch (e: any) {
      onNotice(e?.message ?? Gruppe.VERLASSEN_FEHLER);
    } finally {
      setVerlaesst(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Druck onPress={onBack} hitSlop={8} accessibilityLabel="Zurück">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Druck>
        <Text style={styles.headerTitel}>{Gruppe.TITEL}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl + insets.bottom }}>
        <View style={styles.kopf}>
          <Avatar id={chat.id} name={chat.name} size={112} group />
          <Text style={styles.name} numberOfLines={2}>{chat.name}</Text>
          <Text style={styles.anzahl} testID="gruppe-anzahl">{Gruppe.anzahlText(chat.memberIds)}</Text>
        </View>

        <View style={styles.aktionen}>
          <Druck style={styles.aktion} onPress={() => onCall('audio')} accessibilityLabel="Audioanruf">
            <Ionicons name="call-outline" size={21} color={colors.brand} />
            <Text style={styles.aktionText}>Audioanruf</Text>
          </Druck>
          <Druck style={styles.aktion} onPress={() => onCall('video')} accessibilityLabel="Videoanruf">
            <Ionicons name="videocam-outline" size={21} color={colors.brand} />
            <Text style={styles.aktionText}>Videoanruf</Text>
          </Druck>
          <Druck style={styles.aktion} onPress={() => setOffen({ art: 'suche' })} accessibilityLabel="Suchen">
            <Ionicons name="search-outline" size={21} color={colors.brand} />
            <Text style={styles.aktionText}>Suchen</Text>
          </Druck>
        </View>

        <View style={styles.liste}>
          {zeile('Medien, Links, Doks', String(medien.length), () =>
            setOffen({
              art: 'liste',
              titel: 'Medien, Links, Doks',
              zeilen: medien.map((m) => ({ text: beschreibung(m), neben: m.time })),
              leer: 'In dieser Gruppe liegen noch keine Medien.',
            })
          )}
          {zeile('Mit Stern markiert', String(mitStern.length), () =>
            setOffen({
              art: 'liste',
              titel: 'Mit Stern markiert',
              zeilen: mitStern.map((m) => ({ text: beschreibung(m), neben: m.time })),
              leer: 'Noch nichts markiert. Halte eine Nachricht im Chat gedrückt, um sie zu markieren.',
            })
          )}
        </View>

        <View style={styles.liste}>
          {zeile('Benachrichtigungen', stumm ? 'Aus' : 'An', () => {
            const jetzt = !stumm;
            chatStummUmschalten(chat.id);
            onNotice(jetzt ? 'Benachrichtigungen aus' : 'Benachrichtigungen an');
          })}
          <View style={styles.zeile}>
            <Text style={styles.zeileText}>Chat sperren</Text>
            <Druck
              style={[styles.schalter, gesperrt && styles.schalterAn]}
              accessibilityRole="switch"
              accessibilityLabel="Chat sperren"
              accessibilityState={{ checked: gesperrt }}
              onPress={() => {
                if (!supabase || !ichId) return onNotice('Dafür musst du angemeldet sein');
                const jetzt = !gesperrt;
                setGesperrt(jetzt);
                onNotice(jetzt ? 'Chat gesperrt' : 'Chatsperre aufgehoben');
                Aktion.chatEinstellung(supabase, ichId, chat.id, 'sperren', jetzt).catch((e: any) => {
                  console.error('Die Chatsperre fehlgeschlagen:', e?.message ?? e);
                  setGesperrt(!jetzt);
                  onNotice('Die Chatsperre hat nicht geklappt');
                });
              }}
            >
              <View style={[styles.knopf, gesperrt && styles.knopfAn]} />
            </Druck>
          </View>
        </View>

        <Text style={styles.gruppenKopf} testID="gruppe-mitglieder-kopf">
          {Gruppe.anzahlText(chat.memberIds)}
        </Text>
        <View style={styles.liste}>
          {liste.map((m) => {
            const kontakt = contacts.some((k) => k.id === m.id && k.status === 'friend');
            const ziel = Gruppe.ziel(m.id, { messenger: imMessenger, istKontakt: kontakt });
            return (
              <Druck
                key={m.id}
                style={({ pressed }) => [styles.zeile, pressed && ziel !== 'selbst' && styles.gedrueckt]}
                disabled={ziel === 'selbst'}
                onPress={() => ziel !== 'selbst' && onOpenMitglied(m.id, ziel)}
                accessibilityRole="button"
                accessibilityLabel={m.ich ? `${m.name} (${Gruppe.DU})` : m.name}
                testID={`gruppe-mitglied-${m.id}`}
              >
                {/* Avatar löst das Bild selbst über anzeigeFuer auf (Kontext). */}
                <Avatar id={m.id} name={m.name} size={40} />
                <Text style={styles.zeileText} numberOfLines={1}>{m.name}</Text>
                {m.ich ? (
                  <Text style={styles.du}>{Gruppe.DU}</Text>
                ) : (
                  <Ionicons name="chevron-forward" size={17} color={colors.text3} />
                )}
              </Druck>
            );
          })}
        </View>

        <View style={styles.liste}>
          {zeile('Chat leeren', '', () => {
            chatLeeren(chat.id);
            onNotice('Chat geleert');
          }, 'gefahr')}
          {zeile(verlaesst ? 'Wird verlassen …' : Gruppe.VERLASSEN, '', () => {
            if (!verlaesst) setOffen({ art: 'verlassen' });
          }, 'gefahr')}
        </View>
      </ScrollView>

      {offen?.art === 'liste' && (
        <EinstellungSheet titel={offen.titel} zeilen={offen.zeilen} leer={offen.leer} onClose={() => setOffen(null)} />
      )}

      <ActionSheet
        visible={offen?.art === 'verlassen'}
        title={Gruppe.VERLASSEN}
        untertitel={Gruppe.VERLASSEN_FRAGE}
        items={[{ key: 'verlassen', label: Gruppe.VERLASSEN, icon: 'exit-outline', gefahr: true }]}
        onSelect={() => void verlassen()}
        onClose={() => setOffen(null)}
      />

      {offen?.art === 'suche' && (
        <SheetRahmen visible title="In der Gruppe suchen" onClose={() => { setSuche(''); setOffen(null); }} hoch>
          <View style={styles.sucheFeld}>
            <TextInput
              style={styles.sucheEingabe}
              value={suche}
              onChangeText={setSuche}
              placeholder="Wonach suchst du?"
              placeholderTextColor={colors.text3}
              autoFocus
            />
          </View>
          <ScrollView>
            {!suche.trim() ? (
              <Text style={styles.hinweis}>{verlauf.length} Nachrichten in dieser Gruppe.</Text>
            ) : treffer.length === 0 ? (
              <Text style={styles.hinweis}>Nichts gefunden.</Text>
            ) : (
              treffer.map((m) => (
                <View key={m.id} style={styles.zeile}>
                  <Text style={styles.zeileText}>{m.text}</Text>
                  <Text style={styles.zeileWert}>{m.time}</Text>
                </View>
              ))
            )}
          </ScrollView>
        </SheetRahmen>
      )}
    </View>
  );
};

const styles = themenStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitel: { flex: 1, color: colors.text, ...typography.h3 },

  kopf: { alignItems: 'center', paddingVertical: spacing.xl, backgroundColor: colors.surface, gap: 4 },
  name: { marginTop: spacing.md, color: colors.text, textAlign: 'center', paddingHorizontal: spacing.lg, ...typography.h2 },
  anzahl: { marginTop: 2, color: colors.text2, ...typography.body },

  aktionen: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  aktion: { flex: 1, alignItems: 'center', gap: 5 },
  aktionText: { color: colors.brand, ...typography.small },

  liste: { backgroundColor: colors.surface, marginBottom: spacing.sm },
  zeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  gedrueckt: { backgroundColor: colors.surface2 },
  zeileText: { flex: 1, color: colors.text, ...typography.body },
  zeileWert: { color: colors.text3, ...typography.small },
  gefahrText: { color: colors.danger },
  du: { color: colors.text3, ...typography.small, fontWeight: '600' },

  schalter: { width: 44, height: 26, borderRadius: 13, backgroundColor: colors.surface3, justifyContent: 'center', paddingHorizontal: 3 },
  schalterAn: { backgroundColor: colors.brand },
  knopf: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white },
  knopfAn: { alignSelf: 'flex-end' },

  gruppenKopf: { ...typography.small, fontWeight: '600', color: colors.text2, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 6 },
  hinweis: { ...typography.message, color: colors.text2, padding: spacing.lg },

  sucheFeld: { padding: spacing.lg, paddingBottom: spacing.sm },
  sucheEingabe: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    paddingHorizontal: spacing.md,
    color: colors.text,
    ...typography.body,
  },
}));
