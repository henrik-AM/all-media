import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Druck } from '../../components/Druck';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar } from '../../components/Avatar';
import { EinstellungSheet, ListenZeile } from '../../components/EinstellungSheet';
import { FormularSheet } from '../../components/FormularSheet';
import { SheetRahmen } from '../../components/SheetRahmen';
import { useProfil } from '../../contexts/ProfilContext';
import { colors, radius, spacing, typography } from '../../constants/design';
import { mockProfiles, mockUsers } from '../../mocks';
import { Chat, Message } from '../../types';

interface Props {
  userId: string;
  onBack: () => void;
  onMessage: (userId: string) => void;
  onCall: (userId: string, art: 'audio' | 'video') => void;
  /** Der gemeinsame Chat, falls es einen gibt. */
  chat?: Chat;
  /** Seine Nachrichten - fuer Medien, Markiertes und die Suche. */
  nachrichten?: Message[];
  /** Gemeinsame Gruppen. */
  gruppen?: Chat[];
  onOpenChat?: (chat: Chat) => void;
  onOpenPublicProfile?: (userId: string) => void;
  onNotice: (message: string) => void;
}

type Offen =
  | { art: 'liste'; titel: string; zeilen: ListenZeile[]; leer: string }
  | { art: 'wahl'; label: string; wahl: string[]; standard: string }
  | { art: 'info'; titel: string; text: string }
  | { art: 'melden' }
  | { art: 'suche' }
  | { art: 'bearbeiten' }
  | null;

const GRUENDE = [
  'Spam oder Werbung',
  'Beleidigung oder Hass',
  'Gefälschtes Profil',
  'Nicht jugendfreie Inhalte',
  'Etwas anderes',
];

/**
 * Kontaktinfo nach dem Prototyp-Frame "MC + Kontakteinstellungen":
 * Bearbeiten oben rechts, Name mit Nummer und Biografie, die beiden anderen
 * Profile der Person, drei Knöpfe und darunter die Gruppen aus dem Frame.
 *
 * Bewusst getrennt vom Profil im Bereich Videos: aus einem Chat heraus will
 * man Nummer, Medien und Stummschalten sehen, keine Beitragsstatistik.
 */
export const ContactProfileScreen = ({
  userId,
  onBack,
  onMessage,
  onCall,
  chat,
  nachrichten = [],
  gruppen = [],
  onOpenChat,
  onOpenPublicProfile,
  onNotice,
}: Props) => {
  const insets = useSafeAreaInsets();
  const {
    markierte,
    favoriten,
    favoritUmschalten,
    chatStumm,
    chatStummUmschalten,
    chatLeeren,
    geleerteChats,
    istBlockiert,
    blockieren,
    melden,
  } = useProfil();

  const [offen, setOffen] = useState<Offen>(null);
  const [gesperrt, setGesperrt] = useState(false);
  const [wahlen, setWahlen] = useState<Record<string, string>>({});
  const [angezeigterName, setAngezeigterName] = useState<string | null>(null);
  const [suche, setSuche] = useState('');

  const person = mockUsers[userId];

  if (!person) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Druck onPress={onBack} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Druck>
        </View>
        <Text style={styles.leer}>Diese Person gibt es nicht.</Text>
      </View>
    );
  }

  const name = angezeigterName ?? person.name;
  const bio = mockProfiles[userId]?.bio;
  const geleert = !!chat && geleerteChats.includes(chat.id);
  const verlauf = geleert ? [] : nachrichten;
  const medien = verlauf.filter((m) => m.media || m.geteilt || m.standort || m.kontakt);
  const mitStern = verlauf.filter((m) => markierte.includes(m.id));
  const stumm = !!chat && chatStumm.includes(chat.id);
  const favorit = favoriten.includes(userId);

  const wert = (label: string, standard: string) => wahlen[label] ?? standard;
  const setzeWahl = (label: string, w: string) => setWahlen((prev) => ({ ...prev, [label]: w }));

  const beschreibung = (m: Message) =>
    m.geteilt ? `${m.geteilt.autor}: ${m.geteilt.titel}` : m.standort ? m.standort.name : m.kontakt ? m.kontakt.name : m.text || 'Foto';

  const zeile = (label: string, neben: string, onPress: () => void, art?: 'gruen' | 'gefahr') => (
    <Druck key={label} style={({ pressed }) => [styles.zeile, pressed && styles.gedrueckt]} onPress={onPress}>
      <Text style={[styles.zeileText, art === 'gruen' && styles.gruen, art === 'gefahr' && styles.gefahrText]}>{label}</Text>
      {!!neben && <Text style={styles.zeileWert}>{neben}</Text>}
      {!art && <Ionicons name="chevron-forward" size={17} color={colors.text3} />}
    </Druck>
  );

  const treffer = suche.trim()
    ? verlauf.filter((m) => (m.text ?? '').toLowerCase().includes(suche.trim().toLowerCase()))
    : [];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Druck onPress={onBack} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Druck>
        <Text style={styles.headerTitel}>Kontaktinfo</Text>
        <Druck onPress={() => setOffen({ art: 'bearbeiten' })} hitSlop={8}>
          <Text style={styles.bearbeiten}>Bearbeiten</Text>
        </Druck>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl + insets.bottom }}>
        <View style={styles.kopf}>
          <Avatar id={person.id} name={name} size={104} />
          <Text style={styles.name}>{name}</Text>
          {!!person.phone && <Text style={styles.nummer}>{person.phone}</Text>}
        </View>

        {!!bio && <Text style={styles.bio}>{bio}</Text>}

        <View style={styles.profile}>
          <Druck style={styles.profilKnopf} onPress={() => onOpenPublicProfile?.(userId)}>
            <Text style={styles.profilText} numberOfLines={1}>
              {person.handle} · Videos
            </Text>
          </Druck>
          <Druck style={styles.profilKnopf} onPress={() => onOpenPublicProfile?.(userId)}>
            <Text style={styles.profilText} numberOfLines={1}>
              {person.handle} · Communitys
            </Text>
          </Druck>
        </View>

        <View style={styles.aktionen}>
          <Druck style={styles.aktion} onPress={() => onCall(userId, 'audio')}>
            <Ionicons name="call-outline" size={21} color={colors.brand} />
            <Text style={styles.aktionText}>Audioanruf</Text>
          </Druck>
          <Druck style={styles.aktion} onPress={() => onCall(userId, 'video')}>
            <Ionicons name="videocam-outline" size={21} color={colors.brand} />
            <Text style={styles.aktionText}>Videoanruf</Text>
          </Druck>
          <Druck style={styles.aktion} onPress={() => setOffen({ art: 'suche' })}>
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
              leer: 'In diesem Chat liegen noch keine Medien.',
            })
          )}
          {zeile('Speicher verwalten', `${verlauf.length} Nachrichten`, () =>
            setOffen({
              art: 'liste',
              titel: 'Speicher in diesem Chat',
              zeilen: [
                { text: 'Nachrichten', neben: String(verlauf.length) },
                { text: 'Medien', neben: String(medien.length) },
                { text: 'Markiert', neben: String(mitStern.length) },
              ],
              leer: '',
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
            if (!chat) return onNotice('Noch kein Chat mit dieser Person');
            const jetzt = chatStummUmschalten(chat.id);
            onNotice(jetzt ? 'Benachrichtigungen aus' : 'Benachrichtigungen an');
          })}
          {zeile('Chatdesign', wert('Chat-Hintergrund', 'Hell'), () =>
            setOffen({ art: 'wahl', label: 'Chat-Hintergrund', wahl: ['Hell', 'Dunkel', 'Farbverlauf'], standard: 'Hell' })
          )}
          {zeile('In Fotos speichern', wert('In Fotos speichern', 'Aus'), () =>
            setOffen({ art: 'wahl', label: 'In Fotos speichern', wahl: ['An', 'Aus'], standard: 'Aus' })
          )}
        </View>

        <View style={styles.liste}>
          {zeile('Selbstlöschende Nachrichten', wert('Selbstlöschende Nachrichten', 'Aus'), () =>
            setOffen({
              art: 'wahl',
              label: 'Selbstlöschende Nachrichten',
              wahl: ['Aus', 'Nach 24 Stunden', 'Nach 7 Tagen'],
              standard: 'Aus',
            })
          )}
          <View style={styles.zeile}>
            <Text style={styles.zeileText}>Chat sperren</Text>
            <Druck
              style={[styles.schalter, gesperrt && styles.schalterAn]}
              onPress={() => {
                setGesperrt((v) => !v);
                onNotice(gesperrt ? 'Chatsperre aufgehoben' : 'Chat gesperrt');
              }}
            >
              <View style={[styles.knopf, gesperrt && styles.knopfAn]} />
            </Druck>
          </View>
          {zeile('Erweiterter Chat-Datenschutz', wert('Erweiterter Chat-Datenschutz', 'Aus'), () =>
            setOffen({ art: 'wahl', label: 'Erweiterter Chat-Datenschutz', wahl: ['Aus', 'An'], standard: 'Aus' })
          )}
          {zeile('Verschlüsselung', 'Ende-zu-Ende', () =>
            setOffen({
              art: 'info',
              titel: 'Verschlüsselung',
              text: 'Nachrichten in diesem Chat sind Ende-zu-Ende verschlüsselt. Niemand außer euch beiden kann sie lesen — auch All Media nicht.',
            })
          )}
        </View>

        <View style={styles.liste}>
          {zeile('Kontaktdetails', person.handle, () =>
            setOffen({
              art: 'liste',
              titel: 'Kontaktdetails',
              zeilen: [
                { text: 'Benutzername', neben: person.handle },
                { text: 'Telefonnummer', neben: person.phone ?? 'nicht hinterlegt' },
              ],
              leer: '',
            })
          )}
        </View>

        <Text style={styles.gruppenKopf}>
          {gruppen.length} gemeinsame {gruppen.length === 1 ? 'Gruppe' : 'Gruppen'}
        </Text>
        {gruppen.length === 0 ? (
          <Text style={styles.hinweis}>Ihr seid in keiner gemeinsamen Gruppe.</Text>
        ) : (
          <View style={styles.liste}>
            {gruppen.map((g) => (
              <Druck key={g.id} style={styles.zeile} onPress={() => onOpenChat?.(g)}>
                <Avatar id={g.id} name={g.name} size={40} />
                <Text style={styles.zeileText}>{g.name}</Text>
                <Ionicons name="chevron-forward" size={17} color={colors.text3} />
              </Druck>
            ))}
          </View>
        )}

        <View style={styles.liste}>
          {zeile('Kontakt teilen', '', () => onNotice(`all-media.app/${person.handle.replace('@', '')}`), 'gruen')}
          {zeile(
            favorit ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen',
            '',
            () => {
              const jetzt = favoritUmschalten(userId);
              onNotice(jetzt ? `${name} ist jetzt ein Favorit` : 'Aus den Favoriten entfernt');
            },
            'gruen'
          )}
          {zeile(
            'Chat exportieren',
            '',
            () => onNotice(`${verlauf.length} Nachrichten gesichert`),
            'gruen'
          )}
          {zeile(
            'Chat leeren',
            '',
            () => {
              if (!chat) return onNotice('Noch kein Chat mit dieser Person');
              chatLeeren(chat.id);
              onNotice('Chat geleert');
            },
            'gefahr'
          )}
        </View>

        <View style={styles.liste}>
          {zeile(
            istBlockiert(userId) ? `„${name}" entsperren` : `„${name}" blockieren`,
            '',
            () => {
              const jetzt = blockieren(userId);
              onNotice(jetzt ? `${name} blockiert` : 'Blockierung aufgehoben');
            },
            'gefahr'
          )}
          {zeile(`„${name}" melden`, '', () => setOffen({ art: 'melden' }), 'gefahr')}
        </View>
      </ScrollView>

      {offen?.art === 'liste' && (
        <EinstellungSheet titel={offen.titel} zeilen={offen.zeilen} leer={offen.leer} onClose={() => setOffen(null)} />
      )}

      {offen?.art === 'wahl' && (
        <EinstellungSheet
          titel={offen.label}
          wahl={offen.wahl}
          aktuell={wert(offen.label, offen.standard)}
          onWahl={(w) => {
            setzeWahl(offen.label, w);
            setOffen(null);
            onNotice(`${offen.label}: ${w}`);
          }}
          onClose={() => setOffen(null)}
        />
      )}

      {offen?.art === 'info' && (
        <EinstellungSheet titel={offen.titel} info={offen.text} onClose={() => setOffen(null)} />
      )}

      {offen?.art === 'melden' && (
        <EinstellungSheet
          titel="Kontakt melden"
          wahl={GRUENDE}
          onWahl={(grund) => {
            melden(userId, grund);
            setOffen(null);
            onNotice('Danke, wir sehen uns das an');
          }}
          onClose={() => setOffen(null)}
        />
      )}

      {offen?.art === 'bearbeiten' && (
        <FormularSheet
          visible
          title="Kontakt bearbeiten"
          felder={[
            { key: 'name', label: 'Angezeigter Name', platzhalter: name, pflicht: true },
            { key: 'notiz', label: 'Notiz (nur für dich)' },
          ]}
          knopf="Speichern"
          onClose={() => setOffen(null)}
          onSubmit={({ name: neu }) => {
            // Nur der angezeigte Name - das Profil der anderen Person bleibt.
            setAngezeigterName(neu);
            onNotice('Kontakt gespeichert');
            return null;
          }}
          onNotice={onNotice}
        />
      )}

      {offen?.art === 'suche' && (
        <SheetRahmen visible title="Im Chat suchen" onClose={() => { setSuche(''); setOffen(null); }} hoch>
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
              <Text style={styles.hinweis}>{verlauf.length} Nachrichten in diesem Chat.</Text>
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

const styles = StyleSheet.create({
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
  bearbeiten: { ...typography.body, fontWeight: '600', color: colors.brand },
  leer: { padding: spacing.lg, color: colors.text2, ...typography.body },

  kopf: { alignItems: 'center', paddingVertical: spacing.xl, backgroundColor: colors.surface, gap: 4 },
  name: { marginTop: spacing.md, color: colors.text, ...typography.h2 },
  nummer: { marginTop: 2, color: colors.text2, ...typography.body },
  bio: { backgroundColor: colors.surface, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, color: colors.text, ...typography.message, lineHeight: 20 },

  profile: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: colors.surface },
  profilKnopf: { flex: 1, paddingVertical: 9, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface2, alignItems: 'center' },
  profilText: { ...typography.small, fontWeight: '600', color: colors.text },

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
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  gedrueckt: { backgroundColor: colors.surface2 },
  zeileText: { flex: 1, color: colors.text, ...typography.body },
  zeileWert: { color: colors.text3, ...typography.small },
  gruen: { color: colors.success },
  gefahrText: { color: colors.danger },

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
});
