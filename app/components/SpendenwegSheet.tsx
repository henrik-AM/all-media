/**
 * Das Blatt zum Spendenweg (Kasten 13.2/13.3). Gesteuert von
 * SpendenwegContext — siehe dort, warum jede Spende hier durchläuft.
 *
 * Ansichten:
 *   laden        Status und Methoden holen
 *   methode      neue Zahlungsmethode anlegen
 *   code         Spendencode festlegen (erstes Mal)
 *   aendern      Spendencode ändern (bisheriger Code nötig)
 *   vergessen    Spendencode neu setzen nach Passwort
 *   bestaetigen  Spende: Methode wählen, Code eingeben, absenden
 *   uebersicht   aus den Einstellungen: Code und Methoden verwalten
 *
 * Gespeichert werden nie Kartennummer oder CVC (Vorbehalt 13.2 vom
 * 24.09.2026): gefragt wird nur nach den letzten vier Ziffern und dem
 * Ablaufdatum, bei PayPal nach der Adresse, die sofort maskiert wird.
 */
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Druck } from './Druck';
import { SheetRahmen } from './SheetRahmen';
import { colors, radius, spacing, themenStyles, typography } from '../constants/design';
import { useSupabase } from '../contexts/SupabaseContext';
import { AuthContext } from '../contexts/AuthContext';
import * as A from '../lib/aktionen';
import type { SpendenAnfrage, Verwaltung } from '../contexts/SpendenwegContext';

const Zahlung = require('../../gemeinsam/zahlung') as typeof import('../../gemeinsam/zahlung');
type Umgebung = import('../../gemeinsam/zahlung').Umgebung;
type AnbieterId = import('../../gemeinsam/zahlung').AnbieterId;

type Ansicht = 'laden' | 'methode' | 'code' | 'aendern' | 'vergessen' | 'bestaetigen' | 'uebersicht';

/** Wo läuft die App? Apple Pay nur auf iOS/Safari, Google Pay nur auf Android/Chrome. */
function umgebung(): Umgebung {
  if (Platform.OS === 'ios') return { os: 'ios' };
  if (Platform.OS === 'android') return { os: 'android' };
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  return { os: 'web', browser: Zahlung.browserErkennen(ua) };
}

/*
 * Außerhalb des Blatts, sonst wäre es bei jedem Tastendruck eine neue
 * Komponente — und das Eingabefeld verlöre nach jedem Buchstaben den Fokus.
 */
const Feld = (p: {
  label: string;
  wert: string;
  setzen: (t: string) => void;
  geheim?: boolean;
  platzhalter?: string;
  tastatur?: 'default' | 'number-pad' | 'email-address';
  laenge?: number;
  kennung: string;
}) => (
  <View style={styles.feld}>
    <Text style={styles.label}>{p.label}</Text>
    <TextInput
      style={styles.input}
      value={p.wert}
      onChangeText={p.setzen}
      placeholder={p.platzhalter}
      placeholderTextColor={colors.text3}
      secureTextEntry={p.geheim}
      autoCapitalize={p.geheim || p.tastatur === 'email-address' ? 'none' : 'characters'}
      autoCorrect={false}
      keyboardType={p.tastatur || 'default'}
      maxLength={p.laenge}
      accessibilityLabel={p.label}
      testID={p.kennung}
    />
  </View>
);


interface Props {
  visible: boolean;
  anfrage?: SpendenAnfrage;
  bereich?: Verwaltung;
  onFertig: (ok: boolean) => void;
}

export const SpendenwegSheet = ({ visible, anfrage, bereich, onFertig }: Props) => {
  const { supabase } = useSupabase();
  const { user } = useContext(AuthContext);
  const [ansicht, setAnsicht] = useState<Ansicht>('laden');
  const [status, setStatus] = useState<A.SpendenStatus | null>(null);
  const [methoden, setMethoden] = useState<A.Zahlungsmethode[]>([]);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [meldung, setMeldung] = useState('');
  const [erfolg, setErfolg] = useState('');
  const [arbeitet, setArbeitet] = useState(false);
  const [loeschFrage, setLoeschFrage] = useState<string | null>(null);

  // Eingaben
  const [code, setCode] = useState('');
  const [neu, setNeu] = useState('');
  const [neu2, setNeu2] = useState('');
  const [bisher, setBisher] = useState('');
  const [passwort, setPasswort] = useState('');
  const [anbieter, setAnbieter] = useState<AnbieterId | null>(null);
  const [name, setName] = useState('');
  const [mail, setMail] = useState('');
  const [letzte4, setLetzte4] = useState('');
  const [ablauf, setAblauf] = useState('');

  const umg = useMemo(umgebung, []);
  const moeglich = useMemo(() => Zahlung.anbieterFuer(umg), [umg]);

  /** Nach dem Laden: was fehlt als Nächstes? */
  const weiter = useCallback(
    (st: A.SpendenStatus, liste: A.Zahlungsmethode[]) => {
      if (!anfrage) {
        setAnsicht('uebersicht');
        return;
      }
      if (liste.length === 0) setAnsicht('methode');
      else if (!st.gesetzt) setAnsicht('code');
      else setAnsicht('bestaetigen');
    },
    [anfrage]
  );

  const laden = useCallback(
    async (danach = true) => {
      if (!supabase) {
        setMeldung(Zahlung.grundText('nicht_angemeldet'));
        return;
      }
      try {
        const [st, liste] = await Promise.all([A.spendenStatus(supabase), A.zahlungsmethoden(supabase)]);
        setStatus(st);
        setMethoden(liste);
        setGewaehlt((alt) => (alt && liste.some((m) => m.id === alt) ? alt : liste.find((m) => m.standard)?.id ?? liste[0]?.id ?? null));
        if (danach) weiter(st, liste);
      } catch (e: any) {
        setMeldung(e?.message || 'Laden hat nicht geklappt');
      }
    },
    [supabase, weiter]
  );

  useEffect(() => {
    if (!visible) return;
    setAnsicht('laden');
    laden(true).then(() => {
      if (!anfrage && bereich === 'code') setAnsicht('uebersicht');
    });
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const zu = (ansichtNeu: Ansicht) => {
    setMeldung('');
    setErfolg('');
    setLoeschFrage(null);
    setAnsicht(ansichtNeu);
  };

  // ------------------------------------------------------------- Aktionen --

  const methodeSpeichern = async () => {
    if (!supabase || !anbieter) return setMeldung('Bitte eine Zahlungsart wählen');
    setArbeitet(true);
    setMeldung('');
    try {
      const m = await A.zahlungsmethodeAnlegen(
        supabase,
        anbieter,
        { anzeigename: name, email: mail, letzte4, ablauf },
        umg,
        methoden.length === 0
      );
      // Die volle PayPal-Adresse wird nicht aufbewahrt.
      setMail('');
      setLetzte4('');
      setAblauf('');
      setName('');
      setAnbieter(null);
      setGewaehlt(m.id);
      await laden(false);
      if (anfrage) {
        const st = status ?? (await A.spendenStatus(supabase));
        zu(st.gesetzt ? 'bestaetigen' : 'code');
      } else {
        zu('uebersicht');
        setErfolg(`${Zahlung.methodeText(m)} hinterlegt`);
      }
    } catch (e: any) {
      setMeldung(e?.message || 'Speichern hat nicht geklappt');
    } finally {
      setArbeitet(false);
    }
  };

  const codeFestlegen = async (mitBisher: boolean) => {
    if (!supabase) return;
    const regel = Zahlung.codePruefe(neu);
    if (regel) return setMeldung(regel);
    if (Zahlung.codeNormal(neu) !== Zahlung.codeNormal(neu2)) return setMeldung('Die beiden Codes sind nicht gleich');
    setArbeitet(true);
    setMeldung('');
    try {
      await A.spendencodeSetzen(supabase, neu, mitBisher ? bisher : null);
      const gesetzt = neu;
      setNeu('');
      setNeu2('');
      setBisher('');
      await laden(false);
      if (anfrage) {
        // Gleich weiter mit der Spende — der Code steht schon drin.
        setCode(gesetzt);
        zu('bestaetigen');
      } else {
        zu('uebersicht');
        setErfolg('Spendencode gespeichert');
      }
    } catch (e: any) {
      setMeldung(e?.message || 'Speichern hat nicht geklappt');
    } finally {
      setArbeitet(false);
    }
  };

  const codeMitPasswort = async () => {
    if (!supabase || !user?.email) return setMeldung(Zahlung.grundText('nicht_angemeldet'));
    const regel = Zahlung.codePruefe(neu);
    if (regel) return setMeldung(regel);
    if (Zahlung.codeNormal(neu) !== Zahlung.codeNormal(neu2)) return setMeldung('Die beiden Codes sind nicht gleich');
    if (!passwort) return setMeldung('Bitte dein Passwort eingeben');
    setArbeitet(true);
    setMeldung('');
    try {
      await A.spendencodeMitPasswort(supabase, user.email, passwort, neu);
      const gesetzt = neu;
      setPasswort('');
      setNeu('');
      setNeu2('');
      await laden(false);
      if (anfrage) {
        setCode(gesetzt);
        zu('bestaetigen');
      } else {
        zu('uebersicht');
        setErfolg('Neuer Spendencode gespeichert');
      }
    } catch (e: any) {
      setMeldung(e?.message || 'Das hat nicht geklappt');
    } finally {
      setArbeitet(false);
    }
  };

  const codeEntfernen = async () => {
    if (!supabase) return;
    if (!bisher) return setMeldung('Bitte deinen bisherigen Code eingeben');
    setArbeitet(true);
    try {
      await A.spendencodeEntfernen(supabase, bisher);
      setBisher('');
      await laden(false);
      zu('uebersicht');
      setErfolg('Spendencode entfernt');
    } catch (e: any) {
      setMeldung(e?.message || 'Das hat nicht geklappt');
    } finally {
      setArbeitet(false);
    }
  };

  const standardSetzen = async (id: string) => {
    if (!supabase) return;
    try {
      await A.zahlungsmethodeStandard(supabase, id);
      await laden(false);
      setErfolg('Standard geändert');
    } catch (e: any) {
      setMeldung(e?.message || 'Das hat nicht geklappt');
    }
  };

  const loeschen = async (id: string) => {
    if (!supabase) return;
    if (loeschFrage !== id) {
      setLoeschFrage(id);
      return;
    }
    setLoeschFrage(null);
    try {
      await A.zahlungsmethodeLoeschen(supabase, id);
      await laden(false);
      setErfolg('Zahlungsmethode gelöscht');
    } catch (e: any) {
      setMeldung(e?.message || 'Löschen hat nicht geklappt');
    }
  };

  const absenden = async () => {
    if (!anfrage) return;
    if (!code.trim()) return setMeldung('Bitte deinen Spendencode eingeben');
    setArbeitet(true);
    setMeldung('');
    try {
      await anfrage.ausfuehren({ code, methodeId: gewaehlt });
      setCode('');
      onFertig(true);
    } catch (e: any) {
      const grund = e?.grund as string | undefined;
      setCode('');
      if (grund === 'kein_code') {
        await laden(false);
        zu('code');
      } else if (grund === 'keine_zahlungsmethode' || grund === 'methode_unbekannt') {
        await laden(false);
        zu('methode');
      }
      setMeldung(e?.message || 'Die Spende hat nicht geklappt');
    } finally {
      setArbeitet(false);
    }
  };

  // --------------------------------------------------------------- Teile --

  const Knopf = ({ text, onPress, kennung, leise }: { text: string; onPress: () => void; kennung: string; leise?: boolean }) => (
    <Druck
      style={[leise ? styles.knopfLeise : styles.knopf, arbeitet && !leise && styles.knopfAus]}
      onPress={arbeitet ? undefined : onPress}
      accessibilityLabel={text}
      testID={kennung}
    >
      {arbeitet && !leise ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <Text style={leise ? styles.knopfLeiseText : styles.knopfText}>{text}</Text>
      )}
    </Druck>
  );

  const Methodenliste = ({ waehlen }: { waehlen: boolean }) => (
    <View>
      {methoden.map((m) => {
        const aktiv = waehlen ? gewaehlt === m.id : m.standard;
        const alt = m.anbieter === 'karte' && m.ablauf_monat && m.ablauf_jahr && Zahlung.abgelaufen(m.ablauf_monat, m.ablauf_jahr);
        return (
          <View key={m.id} style={styles.zeile}>
            <Druck
              style={styles.zeileHaupt}
              onPress={() => (waehlen ? setGewaehlt(m.id) : standardSetzen(m.id))}
              accessibilityLabel={`${Zahlung.methodeText(m)}${aktiv ? ', gewählt' : ''}`}
              testID={`methode-${m.id}`}
            >
              <Ionicons name={aktiv ? 'radio-button-on' : 'radio-button-off'} size={20} color={aktiv ? colors.brand : colors.text3} />
              <View style={styles.zeileText}>
                <Text style={styles.zeileName} numberOfLines={1}>{Zahlung.methodeText(m)}</Text>
                <Text style={[styles.zeileSub, alt ? styles.warnung : null]}>
                  {alt ? 'Abgelaufen' : m.standard ? 'Standard' : waehlen ? '' : 'Tippen, um Standard zu machen'}
                </Text>
              </View>
            </Druck>
            {!waehlen && (
              <Druck
                onPress={() => loeschen(m.id)}
                hitSlop={8}
                accessibilityLabel={loeschFrage === m.id ? 'Wirklich löschen' : `${Zahlung.methodeText(m)} löschen`}
                testID={`methode-loeschen-${m.id}`}
              >
                {loeschFrage === m.id ? (
                  <Text style={styles.warnung}>Wirklich löschen?</Text>
                ) : (
                  <Ionicons name="trash-outline" size={20} color={colors.text3} />
                )}
              </Druck>
            )}
          </View>
        );
      })}
    </View>
  );

  // ------------------------------------------------------------ Ansichten --

  const betragText = anfrage ? Zahlung.euro(anfrage.betragCent) : '';
  const titel = anfrage
    ? `${betragText} an ${anfrage.empfaengerName || 'dieses Profil'}`
    : bereich === 'methoden'
      ? 'Zahlungsmethoden'
      : 'Spendencode';

  let inhalt: React.ReactNode = null;

  if (ansicht === 'laden') {
    inhalt = <ActivityIndicator style={{ margin: spacing.xl }} color={colors.brand} />;
  }

  if (ansicht === 'methode') {
    inhalt = (
      <View>
        <Text style={styles.text}>
          {anfrage && methoden.length === 0
            ? 'Für deine erste Spende brauchst du eine Zahlungsmethode.'
            : 'Neue Zahlungsmethode'}
        </Text>
        <View style={styles.chips}>
          {moeglich.map((a) => (
            <Druck
              key={a.id}
              style={[styles.chip, anbieter === a.id && styles.chipAn]}
              onPress={() => setAnbieter(a.id)}
              accessibilityLabel={a.name}
              testID={`anbieter-${a.id}`}
            >
              <Text style={[styles.chipText, anbieter === a.id && styles.chipTextAn]}>{a.name}</Text>
            </Druck>
          ))}
        </View>
        {anbieter === 'paypal' && (
          <Feld label="E-Mail deines PayPal-Kontos" wert={mail} setzen={setMail} tastatur="email-address" platzhalter="name@beispiel.de" kennung="methode-mail" geheim={false} />
        )}
        {anbieter === 'karte' && (
          <>
            <Feld label="Letzte vier Ziffern der Karte" wert={letzte4} setzen={(t) => setLetzte4(t.replace(/\D/g, ''))} tastatur="number-pad" laenge={4} platzhalter="4242" kennung="methode-letzte4" />
            <Feld label="Gültig bis (MM/JJ)" wert={ablauf} setzen={setAblauf} platzhalter="08/28" laenge={7} kennung="methode-ablauf" />
          </>
        )}
        {anbieter && (
          <Feld label="Name (freiwillig)" wert={name} setzen={setName} platzhalter="z. B. Privatkonto" laenge={40} kennung="methode-name" />
        )}
        <Text style={styles.hinweis}>
          Gespeichert werden nur Art, Name{anbieter === 'karte' ? ', die letzten vier Ziffern und das Ablaufdatum' : ''}
          {anbieter === 'paypal' ? ' und die gekürzte Adresse' : ''}. Keine Kartennummer, kein Prüfcode.
        </Text>
        <View style={styles.fuss}>
          <Knopf text="Speichern" onPress={methodeSpeichern} kennung="methode-speichern" />
          {methoden.length > 0 && (
            <Knopf leise text="Zurück" onPress={() => zu(anfrage ? 'bestaetigen' : 'uebersicht')} kennung="methode-zurueck" />
          )}
        </View>
      </View>
    );
  }

  if (ansicht === 'code') {
    inhalt = (
      <View>
        <Text style={styles.text}>
          {anfrage
            ? 'Leg deinen persönlichen Spendencode fest. Du gibst ihn bei jeder Spende ein — so kann niemand ohne dich spenden.'
            : 'Leg deinen persönlichen Spendencode fest.'}
        </Text>
        <Feld label="Spendencode" wert={neu} setzen={setNeu} geheim platzhalter="z. B. HENRIK2026" laenge={24} kennung="code-neu" />
        <Feld label="Spendencode wiederholen" wert={neu2} setzen={setNeu2} geheim laenge={24} kennung="code-neu2" />
        <Text style={styles.hinweis}>{Zahlung.CODE_REGEL_TEXT}</Text>
        <View style={styles.fuss}>
          <Knopf text={anfrage ? 'Festlegen und weiter' : 'Festlegen'} onPress={() => codeFestlegen(false)} kennung="code-festlegen" />
          {!anfrage && <Knopf leise text="Zurück" onPress={() => zu('uebersicht')} kennung="code-zurueck" />}
        </View>
      </View>
    );
  }

  if (ansicht === 'aendern') {
    inhalt = (
      <View>
        <Feld label="Bisheriger Spendencode" wert={bisher} setzen={setBisher} geheim laenge={24} kennung="code-bisher" />
        <Feld label="Neuer Spendencode" wert={neu} setzen={setNeu} geheim laenge={24} kennung="code-neu" />
        <Feld label="Neuen Spendencode wiederholen" wert={neu2} setzen={setNeu2} geheim laenge={24} kennung="code-neu2" />
        <Text style={styles.hinweis}>{Zahlung.CODE_REGEL_TEXT}</Text>
        <View style={styles.fuss}>
          <Knopf text="Ändern" onPress={() => codeFestlegen(true)} kennung="code-aendern" />
          <Knopf leise text="Code vergessen?" onPress={() => zu('vergessen')} kennung="code-vergessen" />
          <Knopf leise text="Code entfernen" onPress={codeEntfernen} kennung="code-entfernen" />
          <Knopf leise text="Zurück" onPress={() => zu('uebersicht')} kennung="code-zurueck" />
        </View>
      </View>
    );
  }

  if (ansicht === 'vergessen') {
    inhalt = (
      <View>
        <Text style={styles.text}>Bestätige dein Passwort, dann kannst du einen neuen Spendencode festlegen.</Text>
        <Feld label="Passwort" wert={passwort} setzen={setPasswort} geheim kennung="code-passwort" />
        <Feld label="Neuer Spendencode" wert={neu} setzen={setNeu} geheim laenge={24} kennung="code-neu" />
        <Feld label="Neuen Spendencode wiederholen" wert={neu2} setzen={setNeu2} geheim laenge={24} kennung="code-neu2" />
        <Text style={styles.hinweis}>{Zahlung.CODE_REGEL_TEXT}</Text>
        <View style={styles.fuss}>
          <Knopf text="Neuen Code speichern" onPress={codeMitPasswort} kennung="code-mit-passwort" />
          <Knopf leise text="Zurück" onPress={() => zu(anfrage ? 'bestaetigen' : 'uebersicht')} kennung="code-zurueck" />
        </View>
      </View>
    );
  }

  if (ansicht === 'bestaetigen' && anfrage) {
    inhalt = (
      <View>
        <Text style={styles.gruppe}>BEZAHLEN MIT</Text>
        <Methodenliste waehlen />
        <Druck style={styles.zeile} onPress={() => zu('methode')} accessibilityLabel="Zahlungsmethode hinzufügen" testID="methode-neu">
          <Ionicons name="add-circle-outline" size={20} color={colors.brand} />
          <Text style={styles.link}>Zahlungsmethode hinzufügen</Text>
        </Druck>
        {status?.gesperrt ? (
          <Text style={styles.fehler}>{Zahlung.grundText('gesperrt')}</Text>
        ) : (
          <Feld label="Dein Spendencode" wert={code} setzen={setCode} geheim laenge={24} kennung="spende-code" />
        )}
        <Text style={styles.hinweis}>
          Die Spende wird vorgemerkt. Abgebucht wird erst, sobald ein Zahlungsdienst angeschlossen ist.
        </Text>
        <View style={styles.fuss}>
          <Knopf text={`${betragText} spenden`} onPress={absenden} kennung="spende-senden" />
          <Knopf leise text="Code vergessen?" onPress={() => zu('vergessen')} kennung="code-vergessen" />
        </View>
      </View>
    );
  }

  if (ansicht === 'uebersicht') {
    inhalt = (
      <View>
        <Text style={styles.gruppe}>SPENDENCODE</Text>
        <View style={styles.zeile}>
          <Ionicons name={status?.gesetzt ? 'lock-closed' : 'lock-open-outline'} size={20} color={colors.text2} />
          <View style={styles.zeileText}>
            <Text style={styles.zeileName}>{status?.gesetzt ? 'Festgelegt' : 'Noch nicht festgelegt'}</Text>
            <Text style={styles.zeileSub}>Wird vor jeder Spende abgefragt — bei Spendenzielen und im Livestream.</Text>
          </View>
        </View>
        <View style={styles.fussEng}>
          <Knopf
            leise
            text={status?.gesetzt ? 'Spendencode ändern' : 'Spendencode festlegen'}
            onPress={() => zu(status?.gesetzt ? 'aendern' : 'code')}
            kennung="code-bearbeiten"
          />
        </View>

        <Text style={styles.gruppe}>ZAHLUNGSMETHODEN</Text>
        {methoden.length === 0 && <Text style={styles.text}>Noch keine Zahlungsmethode hinterlegt.</Text>}
        <Methodenliste waehlen={false} />
        <Druck style={styles.zeile} onPress={() => zu('methode')} accessibilityLabel="Zahlungsmethode hinzufügen" testID="methode-neu">
          <Ionicons name="add-circle-outline" size={20} color={colors.brand} />
          <Text style={styles.link}>Zahlungsmethode hinzufügen</Text>
        </Druck>
      </View>
    );
  }

  return (
    <SheetRahmen visible={visible} title={titel} onClose={() => onFertig(false)} hoch={ansicht === 'uebersicht'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.inhalt}>
        {inhalt}
        {!!meldung && <Text style={styles.fehler} testID="spendenweg-meldung">{meldung}</Text>}
        {!!erfolg && <Text style={styles.erfolg} testID="spendenweg-erfolg">{erfolg}</Text>}
      </ScrollView>
    </SheetRahmen>
  );
};

const styles = themenStyles((colors) => ({
  inhalt: { paddingBottom: spacing.lg },
  text: { color: colors.text2, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, ...typography.preview },
  gruppe: {
    ...typography.overline,
    color: colors.text3,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  zeile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  zeileHaupt: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  zeileText: { flex: 1, minWidth: 0 },
  zeileName: { color: colors.text, ...typography.name },
  zeileSub: { color: colors.text3, marginTop: 2, ...typography.small },
  link: { color: colors.brand, ...typography.name },
  warnung: { color: colors.danger, ...typography.small },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface3,
  },
  chipAn: { backgroundColor: colors.brand },
  chipText: { color: colors.text, ...typography.small },
  chipTextAn: { color: colors.white },
  feld: { paddingTop: spacing.md, paddingHorizontal: spacing.lg },
  label: { color: colors.text2, marginBottom: 6, ...typography.small },
  input: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface3,
    color: colors.text,
    ...typography.body,
  },
  hinweis: { color: colors.text3, paddingHorizontal: spacing.lg, marginTop: spacing.sm, ...typography.small },
  fehler: { color: colors.danger, textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.lg, ...typography.small },
  erfolg: { color: colors.brand, textAlign: 'center', marginTop: spacing.sm, ...typography.small },
  fuss: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.sm },
  fussEng: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  knopf: {
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knopfAus: { opacity: 0.6 },
  knopfText: { color: colors.white, ...typography.h3 },
  knopfLeise: { height: 40, alignItems: 'center', justifyContent: 'center' },
  knopfLeiseText: { color: colors.brand, ...typography.name },
}));
