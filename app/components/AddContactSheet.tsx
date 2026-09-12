import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Druck } from './Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';
import { useDaten } from '../contexts/DatenContext';
import { useAktionen } from '../lib/useAktionen';
import { QrCode } from './QrCode';
import { QrScanner } from './QrScanner';
import { ICH } from '../lib/daten';
import { Contact } from '../types';

// Dieselbe Regel und dieselbe Schreibweise wie auf der Website.
const Telefon = require('../../gemeinsam/telefon') as typeof import('../../gemeinsam/telefon');
const QrKontakt = require('../../gemeinsam/qr') as typeof import('../../gemeinsam/qr');

/*
 * Kontakt hinzufuegen — Telefonnummer oder QR-Code.
 *
 * Henrik am 07.09.2026: „Kontakt hinzufügen nur über Telefonnummer/QR-Code,
 * nicht Username."
 *
 * WARUM DER BENUTZERNAME RAUS IST
 *
 * Er stand bis dahin gleichberechtigt daneben („@greta"). Beides zugleich
 * heisst: jeder ist ueber einen Namen auffindbar, den er sich selbst gibt und
 * der in seinem Profil steht. Eine Nummer kennt nur, wem man sie gegeben hat.
 * Genau darin liegt der Unterschied, und deshalb ist der Benutzername hier
 * nicht nur ausgeblendet, sondern als Weg entfernt: `personPerNummer` fragt
 * die Datenbank ausschliesslich nach Nummern.
 *
 * Gefunden wird ueber `finde_per_nummer` (Schema 24), nicht in der geladenen
 * Liste — Begruendung in lib/aktionen.ts.
 *
 * Gleiche Regel auf der Website: `openAddContact` in web/public/app.js.
 */

interface Props {
  visible: boolean;
  contacts: Contact[];
  onClose: () => void;
  onAdd: (contact: Contact, nachricht: string) => void;
  onNotice: (message: string) => void;
}

export const AddContactSheet = ({ visible, contacts, onClose, onAdd, onNotice }: Props) => {
  const { users } = useDaten();
  const aktionen = useAktionen(onNotice);
  const insets = useSafeAreaInsets();
  const [eingabe, setEingabe] = useState('');
  // Die eine Nachricht, die schon mit der Anfrage rausgeht. Auf der Website
  // gab es sie seit jeher, in der App nicht — siehe den Hinweis unten.
  const [nachricht, setNachricht] = useState('');
  const [laeuft, setLaeuft] = useState(false);
  const [scannen, setScannen] = useState(false);
  const [eigenerCode, setEigenerCode] = useState(false);

  const eigeneNummer = users[ICH]?.phone ?? '';

  /*
   * Ein Weg fuer beide Eingaben: getippte Nummer und gescannter Code enden
   * hier. Sonst gaebe es zwei Fassungen derselben Pruefung, und eine davon
   * wuerde irgendwann anders entscheiden als die andere.
   */
  const suchen = async (nummer: string) => {
    const roh = nummer.trim();
    if (!roh) return onNotice('Bitte eine Telefonnummer eingeben');

    const grund = Telefon.pruefe(roh);
    if (grund) return onNotice(grund);

    setLaeuft(true);
    const person = await aktionen.personPerNummer(roh);
    setLaeuft(false);
    if (!person) return onNotice('Zu dieser Nummer gibt es noch kein Konto');

    if (contacts.some((c) => c.id === person.id)) {
      return onNotice(`${person.name} ist bereits in deinen Kontakten`);
    }

    onAdd({
      id: person.id,
      name: person.name,
      status: person.privat ? 'pending' : 'friend',
      about: person.privat ? 'Anfrage gesendet' : 'Kontakt',
      // Die Nummer kommt aus der Eingabe, nicht aus der Antwort: die Suche
      // gibt keine fremden Nummern heraus (Fund 1).
      phone: Telefon.speicherform(roh),
    }, nachricht.trim());
    setEingabe('');
    setNachricht('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/*
        Die Tastatur hat frueher das Eingabefeld verdeckt. Ursache: das
        KeyboardAvoidingView umschloss nur das Blatt selbst. Es muss den
        ganzen Bildschirm umfassen, damit es das Blatt anheben kann.
      */}
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Druck style={styles.backdrop} onPress={onClose} />

        <View style={[styles.sheet, { paddingBottom: spacing.md + insets.bottom }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Kontakt hinzufügen</Text>

          <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
            <View style={styles.field}>
              <TextInput
                style={styles.input}
                value={eingabe}
                onChangeText={setEingabe}
                placeholder="Telefonnummer"
                placeholderTextColor={colors.text3}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="phone-pad"
                returnKeyType="done"
                onSubmitEditing={() => suchen(eingabe)}
              />
              <Text style={styles.hint}>{Telefon.REGEL_TEXT}</Text>

              {/*
                Der zweite Weg. „Mein Code" und „Scannen" stehen nebeneinander,
                weil sie zusammengehoeren: einer zeigt, einer liest.
              */}
              <View style={styles.qrReihe}>
                <Druck
                  style={styles.qrKnopf}
                  onPress={() => {
                    if (!eigeneNummer) {
                      return onNotice('Für deinen Code brauchst du erst eine eigene Telefonnummer');
                    }
                    setEigenerCode((a) => !a);
                  }}
                >
                  <Ionicons name="qr-code-outline" size={18} color={colors.text} />
                  <Text style={styles.qrText}>{eigenerCode ? 'Code ausblenden' : 'Mein Code'}</Text>
                </Druck>
                <Druck style={styles.qrKnopf} onPress={() => setScannen(true)}>
                  <Ionicons name="scan-outline" size={18} color={colors.text} />
                  <Text style={styles.qrText}>Code scannen</Text>
                </Druck>
              </View>

              {eigenerCode && eigeneNummer ? (
                <View style={styles.qrFlaeche}>
                  <QrCode text={QrKontakt.link(eigeneNummer)} groesse={200} />
                  <Text style={styles.qrNummer}>{eigeneNummer}</Text>
                </View>
              ) : null}

              {/*
                Wortgleich mit `openAddContact` in web/public/app.js. Bis zum
                13.09.2026 fragte nur die Website danach — die App legte den
                Kontakt stumm an, obwohl `kontaktHinzufuegen` die Nachricht
                schon immer entgegennahm und in den Chat schrieb.
              */}
              <Text style={styles.label}>Nachricht (freiwillig)</Text>
              <TextInput
                style={styles.textarea}
                value={nachricht}
                onChangeText={setNachricht}
                placeholder="Kurz schreiben, wer du bist …"
                placeholderTextColor={colors.text3}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <Text style={styles.hint}>
                Diese eine Nachricht geht schon mit der Anfrage raus. Weitere erst,
                wenn die Anfrage angenommen wurde.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Druck style={styles.button} onPress={() => suchen(eingabe)} disabled={laeuft}>
              <Text style={styles.buttonText}>{laeuft ? 'Wird gesucht …' : 'Anfrage senden'}</Text>
            </Druck>
          </View>
        </View>
      </KeyboardAvoidingView>

      <QrScanner
        visible={scannen}
        onClose={() => setScannen(false)}
        onCode={(text) => {
          setScannen(false);
          const nummer = QrKontakt.nummerAus(text);
          // Ein fremder Code — Fahrkarte, Werbeplakat — ist kein Fehler des
          // Nutzers, nur der falsche Code. Deshalb ein Satz und kein Alarm.
          if (!nummer) return onNotice('Das ist kein All-Media-Code');
          setEingabe(nummer);
          void suchen(nummer);
        }}
      />
    </Modal>
  );
};

const styles = themenStyles((colors) => ({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(6,8,12,0.52)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
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

  field: { paddingTop: spacing.md, paddingHorizontal: spacing.lg },
  input: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface3,
    color: colors.text,
    ...typography.body,
  },
  hint: { paddingTop: 6, color: colors.text3, ...typography.small },
  label: { paddingTop: spacing.md, paddingBottom: 6, color: colors.text2, ...typography.small },
  textarea: {
    minHeight: 76,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surface3,
    color: colors.text,
    ...typography.body,
  },

  qrReihe: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.md },
  qrKnopf: {
    flex: 1,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: radius.md,
    backgroundColor: colors.surface3,
  },
  qrText: { color: colors.text, ...typography.small, fontWeight: '600' },
  qrFlaeche: { alignItems: 'center', gap: 8, paddingTop: spacing.md },
  qrNummer: { color: colors.text2, ...typography.small },

  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  button: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: colors.white, ...typography.h3 },
}));
