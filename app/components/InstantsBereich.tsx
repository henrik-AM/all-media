import React, { useEffect, useRef, useState } from 'react';
import { AppState, Image, ScrollView, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Druck } from './Druck';
import { SheetRahmen } from './SheetRahmen';
import { useSupabase } from '../contexts/SupabaseContext';
import { useDaten } from '../contexts/DatenContext';
import { D, instantBild, instantSenden } from '../lib/instants';
import * as I from '../../gemeinsam/instants';
import { Person, Instant } from '../../gemeinsam/instantsdaten';
import { colors } from '../constants/design';
const feld = { borderWidth: 1, borderColor: '#bbb', borderRadius: 8, padding: 12, marginVertical: 8, color: colors.text };
const knopf = { padding: 12, backgroundColor: colors.surface2, borderRadius: 8, marginVertical: 4 };
export function EngeFreundeSheet({ visible, onClose }: {
    visible: boolean;
    onClose: () => void;
}) {
    const { supabase } = useSupabase();
    const { ichId } = useDaten();
    const [suche, setSuche] = useState('');
    const [daten, setDaten] = useState<{
        freunde: Person[];
        vorschlaege: Person[];
    }>({ freunde: [], vorschlaege: [] });
    const [fehler, setFehler] = useState('');
    const [laden, setLaden] = useState(false);
    const [version, setVersion] = useState(0);
    useEffect(() => {
        if (!visible || !supabase || !ichId)
            return;
        let aktiv = true;
        setLaden(true);
        const t = setTimeout(() => { D.freunde(supabase, ichId, suche).then(d => { if (aktiv) {
            setDaten(d);
            setFehler('');
        } }, () => { if (aktiv)
            setFehler('Enge Freunde konnten nicht geladen werden.'); }).finally(() => { if (aktiv)
            setLaden(false); }); }, 200);
        return () => { aktiv = false; clearTimeout(t); };
    }, [visible, supabase, ichId, suche, version]);
    const setzen = async (id: string, an: boolean) => { if (!supabase || laden)
        return; setLaden(true); try {
        await D.freund(supabase, ichId, id, an);
        setVersion(v => v + 1);
    }
    catch {
        setFehler('Die Liste konnte nicht gespeichert werden.');
        setLaden(false);
    } };
    const ids = new Set(daten.freunde.map(p => p.id));
    return <SheetRahmen visible={visible} title="Enge Freunde" onClose={onClose} hoch>
  <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
   <Text style={{ color: colors.text }}>Deine Liste ist privat · {daten.freunde.length} Personen</Text>
   <TextInput style={feld} value={suche} onChangeText={setSuche} placeholder="Nach Namen suchen (mindestens 2 Zeichen)" accessibilityLabel="Enge Freunde suchen"/>
   {!!fehler && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{fehler}</Text>}
   {laden && <Text style={{ color: colors.text }}>Wird geladen …</Text>}
   {daten.freunde.map(p => <Druck key={p.id} disabled={laden} style={knopf} onPress={() => setzen(p.id, false)} accessibilityLabel={`${p.name} entfernen`}><Text style={{ color: colors.text }}>{p.name} · Entfernen</Text></Druck>)}
   {daten.vorschlaege.filter(p => !ids.has(p.id)).map(p => <Druck key={p.id} disabled={laden} style={knopf} onPress={() => setzen(p.id, true)} accessibilityLabel={`${p.name} hinzufügen`}><Text style={{ color: colors.text }}>{p.name} · Hinzufügen</Text></Druck>)}
  </ScrollView>
 </SheetRahmen>;
}
export function InstantsBereich() {
    const { supabase } = useSupabase();
    const { ichId } = useDaten();
    const [offen, setOffen] = useState(false), [freunde, setFreunde] = useState(false), [kamera, setKamera] = useState(false);
    const [postfach, setPostfach] = useState<Instant[]>([]), [eigene, setEigene] = useState<Instant[]>([]), [anzahl, setAnzahl] = useState(0);
    const [foto, setFoto] = useState<string | null>(null), [text, setText] = useState(''), [fehler, setFehler] = useState(''), [busy, setBusy] = useState(false);
    const [bild, setBild] = useState<{
        id: string;
        uri: string;
        text: string;
    } | null>(null);
    const [permission, anfragen] = useCameraPermissions();
    const cam = useRef<CameraView>(null);
    const [groesse, setGroesse] = useState<string | null>(null);
    const laden = async () => { if (!supabase || !ichId)
        return; try {
        const [p, e, z] = await Promise.all([D.postfach(supabase), D.eigene(supabase, ichId), D.empfaengerzahl(supabase)]);
        setPostfach(p || []);
        setEigene(e || []);
        setAnzahl(z);
        setFehler('');
    }
    catch {
        setFehler('Instants konnten nicht geladen werden.');
    } };
    useEffect(() => { void laden(); const t = setInterval(() => { if (AppState.currentState === 'active')
        void laden(); }, 30000); const a = AppState.addEventListener('change', s => { if (s === 'active')
        void laden(); }); return () => { clearInterval(t); a.remove(); }; }, [supabase, ichId]);
    const schliessen = () => { setKamera(false); setFoto(null); setBild(null); setOffen(false); void laden(); };
    const aufnehmen = async () => { if (!permission?.granted) {
        const p = await anfragen();
        if (!p.granted) {
            setFehler('Kamerazugriff wurde nicht erlaubt.');
            return;
        }
    } setFoto(null); setGroesse(null); setKamera(true); };
    const knipsen = async () => { if (!cam.current || !groesse)
        return; setBusy(true); try {
        const f = await cam.current.takePictureAsync({ quality: .7, skipProcessing: false });
        if (!f || Math.max(f.width, f.height) > I.SEITE_MAX)
            throw new Error('Kameraauflösung nicht unterstützt.');
        setFoto(f.uri);
        setKamera(false);
    }
    catch (e: any) {
        setFehler(e.message || 'Aufnahme fehlgeschlagen.');
    }
    finally {
        setBusy(false);
    } };
    const senden = async () => { if (!supabase || !foto)
        return; setBusy(true); try {
        await instantSenden(supabase, ichId, foto, text, anzahl);
        setFoto(null);
        setText('');
        await laden();
    }
    catch (e: any) {
        setFehler(e.message || 'Senden fehlgeschlagen.');
    }
    finally {
        setBusy(false);
    } };
    const ansehen = async (i: Instant) => { if (!supabase)
        return; setBusy(true); try {
        const b = await instantBild(supabase, i.id);
        setBild({ id: i.id, ...b });
    }
    catch {
        setFehler('Instant nicht mehr verfügbar.');
    }
    finally {
        setBusy(false);
    } };
    const konsumiert = useRef(new Set<string>());
    const gesehen = async () => { if (!supabase || !bild || konsumiert.current.has(bild.id))
        return; konsumiert.current.add(bild.id); try {
        if (!await D.oeffnen(supabase, bild.id))
            throw new Error();
        await laden();
    }
    catch {
        setBild(null);
        setFehler('Instant konnte nicht als geöffnet bestätigt werden.');
    } };
    return <View style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
  <Druck style={knopf} onPress={() => { setOffen(true); void laden(); }} accessibilityLabel="Instants öffnen"><Text style={{ color: colors.text }}>Instants · {postfach.length} ungeöffnet</Text></Druck>
  <SheetRahmen visible={offen} title="Instants" onClose={schliessen} hoch>
   <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
    <Text style={{ color: colors.text }}>{I.HINWEIS}</Text>
    {!!fehler && <Text accessibilityRole="alert" style={{ color: colors.danger }}>{fehler}</Text>}
    {bild ? <><Image source={{ uri: bild.uri }} style={{ height: 420, width: '100%' }} resizeMode="contain" onLoad={() => void gesehen()} onError={() => { setBild(null); setFehler('Das Foto konnte nicht geladen werden.'); }}/><Text style={{ color: colors.text }}>{bild.text}</Text><Druck style={knopf} onPress={() => setBild(null)}><Text style={{ color: colors.text }}>Bild schließen</Text></Druck></> : <>
     <Druck style={knopf} onPress={() => setFreunde(true)}><Text style={{ color: colors.text }}>Enge Freunde bearbeiten · {anzahl}</Text></Druck>
     <Text style={{ color: colors.text }}>An deine Liste · {anzahl} {anzahl === 1 ? 'Person' : 'Personen'}</Text>
     {kamera ? <><CameraView ref={cam} style={{ height: 320 }} pictureSize={groesse || undefined} onCameraReady={async () => { const g = I.kameragroesse(await cam.current?.getAvailablePictureSizesAsync() || []); setGroesse(g); if (!g)
            setFehler('Keine Kameraauflösung bis 1080 Pixel verfügbar.'); }}/><Druck disabled={busy || !groesse} style={knopf} onPress={() => void knipsen()}><Text style={{ color: colors.text }}>Foto aufnehmen</Text></Druck></> : foto ? <><Image source={{ uri: foto }} style={{ height: 240, width: '100%' }} resizeMode="contain"/><TextInput style={feld} value={text} onChangeText={setText} maxLength={I.TEXT_MAX} placeholder="Bildunterschrift (freiwillig)"/><Druck disabled={busy} style={knopf} onPress={() => void senden()}><Text style={{ color: colors.text }}>Instant senden</Text></Druck><Druck style={knopf} onPress={() => void aufnehmen()}><Text style={{ color: colors.text }}>Neu aufnehmen</Text></Druck></> : <Druck disabled={anzahl < 1 || busy} style={knopf} onPress={() => void aufnehmen()}><Text style={{ color: colors.text }}>Instant aufnehmen</Text></Druck>}
     {postfach.map(i => <Druck key={i.id} disabled={busy} style={knopf} onPress={() => void ansehen(i)}><Text style={{ color: colors.text }}>{i.name} · Einmal ansehen</Text></Druck>)}
     {!postfach.length && <Text style={{ color: colors.text }}>Keine ungeöffneten Instants.</Text>}
     {eigene.map(i => <Druck key={i.id} disabled={busy} style={knopf} onPress={async () => { if (supabase) {
            try {
                await D.zurueckziehen(supabase, i.id);
                await laden();
            }
            catch {
                setFehler('Zurückziehen fehlgeschlagen.');
            }
        } }}><Text style={{ color: colors.text }}>Gesendet: {i.text || 'Foto'} · Zurückziehen</Text></Druck>)}
    </>}
   </ScrollView>
  </SheetRahmen>
  <EngeFreundeSheet visible={freunde} onClose={() => { setFreunde(false); void laden(); }}/>
 </View>;
}
