import React, { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Druck } from '../../components/Druck';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Motiv } from '../../components/Motiv';
import { EmptyState } from '../../components/EmptyState';
import { OwnProfileHead } from '../../components/OwnProfileHead';
import { SwitchBar } from '../../components/SwitchBar';
import { colors, radius, spacing, themenStyles, typography } from '../../constants/design';
import { AreaKey } from '../../constants/navigation';
import { useDaten } from '../../contexts/DatenContext';
import { useReposts } from '../../contexts/RepostContext';
import { useProfil } from '../../contexts/ProfilContext';
import { oeffneLink } from '../../lib/links';
import { useKachelHoehe } from '../../lib/raster';
import { useSupabase } from '../../contexts/SupabaseContext';
import { AuthContext } from '../../contexts/AuthContext';
import * as Aktion from '../../lib/aktionen';
import { SichtbarkeitSheet } from '../../components/SichtbarkeitSheet';
import { SpendeKarte } from '../../components/SpendeKarte';
import { ActionSheet } from '../../components/ActionSheet';
import { useAktionen } from '../../lib/useAktionen';
import { fotoHochladen } from '../../lib/profilbild';

// Ringfarbe und -staerke je Gattung — gemeinsam mit der Website (Kasten 12.9).
const SammlungRegel = require('../../../gemeinsam/sammlungen') as typeof import('../../../gemeinsam/sammlungen');

type IconName = React.ComponentProps<typeof Ionicons>['name'];
export type ProfilTab = 'grid' | 'repost' | 'tagged' | 'saved';
type Tab = ProfilTab;

/** Durchmesser der Kreise fuer Playlists und Highlights. */
const KREIS = 62;
/** Strichstaerke des Rings und das Bild darin, mit 2 px Luft zum Ring. */
const STRICH = SammlungRegel.ringstaerke(KREIS);
const INNEN = KREIS - 2 * STRICH - 4;

interface Props {
  onSwitchArea: (area: AreaKey) => void;
  /**
   * Kasten 12.1: der Reiter lebt in der Shell (App.tsx), nicht hier. Oeffnet
   * man einen Beitrag, baut die Shell diesen Bildschirm ab — ein lokaler
   * Zustand fiel dabei jedes Mal auf „Posts" zurueck.
   */
  tab?: ProfilTab;
  onTab?: (tab: ProfilTab) => void;
  /**
   * Kasten 12.4: „Profil wechseln" oeffnet die Kontoliste — wie im
   * Messenger-Profil. Bis zum 29.09.2026 fuehrte die Leiste hier in den
   * Messenger (onSwitchArea('messenger')).
   */
  onSwitchAccount?: () => void;
  /** Kasten 12.5: das Profilbild aendern. */
  onProfilbild?: () => void;
  /** Glocke, Plus und Menü oben rechts. */
  onAction: (key: string) => void;
  /** Fuehrt zum Formular, das Name, Info und Link aendert. */
  onBearbeiten: () => void;
  /**
   * Eine Kachel im Raster öffnen — der Beitrag selbst, nicht ein Hinweis
   * darauf. Siehe `kachelOeffnen` in App.tsx.
   */
  onOpenKachel?: (kachel: { id: string; kind?: string }) => void;
  onNotice: (message: string) => void;
  /*
   * Die Zahlen ueber dem Namen gaben bis zum 02.09.2026 nur einen Hinweistext
   * aus ("Deine Follower"), obwohl es die beiden Listenbildschirme laengst
   * gab und die Website sie an derselben Stelle oeffnet.
   */
  onOpenFollowers?: () => void;
  onOpenFollowing?: () => void;
}

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',')}k` : String(n);

const TABS: { key: Tab; icon: IconName }[] = [
  { key: 'grid', icon: 'grid-outline' },
  { key: 'repost', icon: 'repeat-outline' },
  { key: 'tagged', icon: 'person-outline' },
  { key: 'saved', icon: 'bookmark-outline' },
];

/** Prototyp-Frame "Videos - Profil". */
export const VideoProfileScreen = ({ onSwitchArea, tab: tabVonAussen, onTab, onSwitchAccount, onProfilbild, onAction, onBearbeiten, onOpenKachel, onNotice, onOpenFollowers, onOpenFollowing }: Props) => {
  const { profile: alleProfile, users: alleNutzer, sichtbarkeit, neuLaden } = useDaten();
  const kachelHoehe = useKachelHoehe();
  const { reposts } = useReposts();
  const {
    ungelesen,
    highlights,
    playlists,
    sammlungen,
    sammlungOeffnen,
    sammlungLoeschen,
    sammlungenNeu,
    spende,
    raster,
    eigeneBeitraege,
    gefolgt,
    eigenesProfil,
  } = useProfil();
  const [tabHier, setTabHier] = useState<Tab>('grid');
  const tab = tabVonAussen ?? tabHier;
  const setTab = (t: Tab) => (onTab ? onTab(t) : setTabHier(t));
  const me = alleProfile.me;
  const aktionen = useAktionen(onNotice);

  /*
   * Kasten 12.6: der gruene Punkt am Profilbild oeffnet die
   * Online-Sichtbarkeit — dasselbe Blatt und dieselbe Einstellung
   * (`onlinestatus`) wie im Messenger-Profil und in den Einstellungen. Die
   * Wirkung sitzt in der Datenbank: `presence` ist nur lesbar, wenn
   * sichtbar_fuer(…, 'onlinestatus', …) es erlaubt (Schema 20).
   */
  const [onlineOffen, setOnlineOffen] = useState(false);
  const online = sichtbarkeit.onlinestatus || { stufe: 'alle' as Aktion.SichtbarkeitStufe, ausnahmen: [] };

  /*
   * Die Kreise ueber den Registern — Playlists und Highlights.
   *
   * Bis zum 20.09.2026 waren das reine Etiketten: `profiles.playlists` und
   * `profiles.highlights` sind Textlisten, also nur Namen. Ein Vorschaubild
   * konnte es gar nicht geben, weil es nichts gab, wovon es das Bild waere,
   * und Antippen antwortete mit einer Meldung. Seit Schema 46 liegt der
   * Inhalt in `sammlungen` / `sammlung_inhalte`.
   *
   * Die alten Namenslisten bleiben als Rueckfalltuer stehen: kommt die
   * Abfrage nicht durch, stuende das Profil sonst ploetzlich ohne Kreise da
   * — und zwar wortlos. Ein Kreis ohne `id` ist so ein Rueckfall; er laesst
   * sich nicht oeffnen und sagt das auch.
   */
  const kreise = (art: 'playlist' | 'highlight'): Aktion.Sammlung[] => {
    const vorhanden = sammlungen.filter((s) => s.art === art);
    if (vorhanden.length) return vorhanden;
    const namen = art === 'playlist' ? playlists : highlights;
    return namen.map((name) => ({ id: '', art, name, anzahl: 0, bild: null }));
  };

  const [offen, setOffen] = useState<{ sammlung: Aktion.Sammlung; kacheln: Aktion.Rasterkachel[] } | null>(null);
  const [laedt, setLaedt] = useState(false);

  /*
   * Kasten 12.7/12.8: Titelbild waehlen. Im Wahlmodus fuehrt ein Tipp auf
   * eine Kachel nicht zum Beitrag, sondern macht sie zum Titelbild.
   */
  const [waehlen, setWaehlen] = useState(false);
  const [titelMenue, setTitelMenue] = useState(false);

  const titelSetzen = async (wahl: { postId?: string; storyId?: string; bildUrl?: string }) => {
    if (!supabase || !offen) return;
    setLaedt(true);
    try {
      await Aktion.titelbildSetzen(supabase, offen.sammlung.id, wahl);
      onNotice(wahl.postId || wahl.storyId || wahl.bildUrl ? 'Titelbild gespeichert' : 'Titelbild zurückgesetzt');
      setOffen({
        ...offen,
        sammlung: {
          ...offen.sammlung,
          titelPostId: wahl.postId ?? null,
          titelStoryId: wahl.storyId ?? null,
          eigenesTitelbild: Boolean(wahl.bildUrl),
        },
      });
      sammlungenNeu();
    } catch (fehler: any) {
      onNotice(fehler?.message ?? 'Das Titelbild ließ sich nicht speichern');
    } finally {
      setWaehlen(false);
      setLaedt(false);
    }
  };

  const titelFoto = async (quelle: 'galerie' | 'kamera') => {
    if (!offen || !user?.id) return;
    const bild = await fotoHochladen(supabase, quelle, 'stories', `titel-${offen.sammlung.id}-${Date.now()}.jpg`, onNotice);
    if (bild) await titelSetzen({ bildUrl: bild.url });
  };

  const oeffnen = async (s: Aktion.Sammlung) => {
    if (!s.id) return onNotice(`„${s.name}" laesst sich gerade nicht oeffnen`);
    setWaehlen(false);
    setLaedt(true);
    try {
      setOffen({ sammlung: s, kacheln: await sammlungOeffnen(s.id) });
    } catch (fehler: any) {
      onNotice(fehler?.message ?? 'Die Sammlung liess sich nicht laden');
    } finally {
      setLaedt(false);
    }
  };

  /*
   * Loeschen nur mit Rueckfrage — und die Rueckfrage sagt ausdruecklich, was
   * NICHT passiert. Sonst klickt sie niemand weg, der seine Beitraege behalten
   * will, und wer sie wegklickt, hat womoeglich etwas anderes erwartet.
   */
  const loeschenFragen = (s: Aktion.Sammlung) => {
    Alert.alert(
      `„${s.name}" löschen?`,
      s.art === 'playlist'
        ? 'Die Playlist verschwindet. Die Beiträge darin bleiben erhalten — nur die Zuordnung geht weg.'
        : 'Das Highlight verschwindet. Die Storys darin bleiben erhalten — nur die Zuordnung geht weg.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => {
            setOffen(null);
            sammlungLoeschen(s);
          },
        },
      ]
    );
  };

  /*
   * Der Reiter "Markiert" war bei jedem Menschen leer — nicht, weil niemand
   * markiert war, sondern weil es Markierungen ueberhaupt nicht gab. Die
   * Tabelle `post_tags` und die Einstellung "Wer darf mich markieren"
   * stehen seit dem 03.09.2026; markiert wird ueber die @-Namen in der
   * Beschreibung eines Beitrags.
   */
  const { supabase } = useSupabase();
  const { user } = useContext(AuthContext);
  const [markiert, setMarkiert] = useState<Aktion.Rasterkachel[]>([]);

  useEffect(() => {
    if (!supabase || !user?.id || tab !== 'tagged') return;
    let abgebrochen = false;
    Aktion.markierteBeitraege(supabase, user.id)
      .then((liste) => {
        if (!abgebrochen) setMarkiert(liste);
      })
      .catch((e) => console.error('Markierungen laden fehlgeschlagen:', e?.message ?? e));
    return () => {
      abgebrochen = true;
    };
  }, [supabase, user?.id, tab]);

  /*
   * Die eigenen Reposts — aus der Datenbank, nicht aus dem Sitzungsspeicher.
   *
   * `RepostContext` haelt nur fest, was man in DIESER Sitzung umgeschaltet
   * hat. Nach dem Neustart der App war der Reiter darum wieder leer, waehrend
   * die Website an derselben Stelle ueber `/api/reposts` die echten Zeilen
   * zeigte — derselbe Bildschirm, zwei verschiedene Antworten.
   *
   * Der Kontext bleibt trotzdem: er faerbt den Knopf im Feed sofort. Er steht
   * hier nur in der Abhaengigkeitsliste, damit ein Umschalten den Reiter
   * nachzieht.
   */
  const [meineReposts, setMeineReposts] = useState<Aktion.Rasterkachel[]>([]);

  useEffect(() => {
    if (!supabase || !user?.id || tab !== 'repost') return;
    let abgebrochen = false;
    Aktion.repostsVon(supabase, user.id)
      .then((liste) => {
        if (!abgebrochen) setMeineReposts(liste);
      })
      .catch((e) => console.error('Reposts laden fehlgeschlagen:', e?.message ?? e));
    return () => {
      abgebrochen = true;
    };
  }, [supabase, user?.id, tab, reposts]);

  /*
   * Die gespeicherten Beitraege — der Reiter mit dem Lesezeichen.
   *
   * Der Reiter stand seit jeher in TABS und hat nie etwas geladen. Wer etwas
   * gespeichert hatte, bekam trotzdem „Noch nichts hier" zu sehen: der
   * Leerzustand war die einzige Antwort, die dieser Reiter kannte. Henrik am
   * 18.09.2026: „Gespeicherte Beitraege werden nicht synchronisiert (unter
   * Videos/Profil kann ich sie nicht sehen)."
   *
   * `null` heisst „noch nicht geladen" und ist von „geladen, nichts drin"
   * unterscheidbar. Ohne diesen Unterschied stuende beim Oeffnen fuer einen
   * Wimpernschlag „Noch nichts gespeichert" — also eine Falschaussage.
   */
  const [gespeichert, setGespeichert] = useState<Aktion.Rasterkachel[] | null>(null);

  useEffect(() => {
    if (!supabase || !user?.id || tab !== 'saved') return;
    let abgebrochen = false;
    Aktion.gespeicherteVon(supabase, user.id)
      .then((liste) => {
        if (!abgebrochen) setGespeichert(liste);
      })
      .catch((e) => console.error('Gespeicherte laden fehlgeschlagen:', e?.message ?? e));
    return () => {
      abgebrochen = true;
    };
  }, [supabase, user?.id, tab]);

  /*
   * Solange die Daten laden, gibt es das eigene Profil noch nicht.
   *
   * Vorher stand hier direkt `alleNutzer.me.handle` — beim ersten Aufbau ist
   * `alleNutzer` aber ein leeres Objekt, und die App stürzte mit "Cannot read
   * property 'handle' of undefined" ab. Aufgefallen ist das erst im
   * Simulator: die Prüfläufe der Website kommen an diesem Bildschirm nicht
   * vorbei, und `tsc` sieht den Fall nicht, weil ein Index-Zugriff in
   * TypeScript als vorhanden gilt.
   */
  const ich = alleNutzer.me;
  if (!ich || !me) {
    return <View style={styles.screen}><SwitchBar onPress={() => (onSwitchAccount ? onSwitchAccount() : onSwitchArea('messenger'))} /></View>;
  }

  return (
    <View style={styles.screen}>
      <SwitchBar onPress={() => (onSwitchAccount ? onSwitchAccount() : onSwitchArea('messenger'))} />

      <ScrollView contentContainerStyle={styles.content}>
        <OwnProfileHead
          storyBereich="videos"
          handle={ich.handle}
          stats={[
            { label: 'Beiträge', value: compact(me.posts + eigeneBeitraege.length) },
            { label: 'Follower', value: compact(me.followers) },
            { label: 'Gefolgt', value: compact(gefolgt.length) },
          ]}
          name={eigenesProfil.name}
          bio={eigenesProfil.bio}
          link={eigenesProfil.link}
          ungelesen={ungelesen('videos')}
          onAction={onAction}
          onBearbeiten={onBearbeiten}
          onLink={() => oeffneLink(eigenesProfil.link, onNotice)}
          onStat={(label) => {
            if (label === 'Follower') return onOpenFollowers?.();
            if (label === 'Gefolgt') return onOpenFollowing?.();
            onNotice('Deine Beiträge stehen darunter.');
          }}
          onAvatarPress={onProfilbild ?? (() => onNotice('Dein Profilbild'))}
          onOnlinePunkt={() => setOnlineOffen(true)}
          onlineSichtbar={online.stufe !== 'niemand'}
        />

        {/* Kasten 12.3: antippbar, mit Detailblatt und Spendenweg. */}
        {spende && user?.id ? (
          <SpendeKarte spende={spende} empfaengerId={user.id} name={eigenesProfil.name} onNotice={onNotice} />
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlights}>
          {kreise('playlist').map((s) => (
            <Druck key={`pl-${s.name}`} style={styles.highlight} onPress={() => oeffnen(s)}>
              <View style={[styles.ring, { borderColor: SammlungRegel.ringfarbe('playlist'), borderWidth: STRICH }]}>
                <Motiv
                  id={`pl-${s.name}`}
                  bild={s.bild ?? undefined}
                  icon="play-outline"
                  iconSize={22}
                  style={styles.ringInhalt}
                />
              </View>
              <View style={[styles.abzeichen, { backgroundColor: SammlungRegel.ringfarbe('playlist') }]}>
                <Ionicons name="play" size={10} color={colors.white} />
              </View>
              <Text style={styles.highlightLabel} numberOfLines={1}>
                {s.name}
              </Text>
            </Druck>
          ))}
          {kreise('highlight').map((s) => (
            <Druck key={`hl-${s.name}`} style={styles.highlight} onPress={() => oeffnen(s)}>
              <View style={[styles.ring, { borderColor: SammlungRegel.ringfarbe('highlight'), borderWidth: STRICH }]}>
                <Motiv
                  id={`hl-${s.name}`}
                  bild={s.bild ?? undefined}
                  icon="image-outline"
                  iconSize={22}
                  style={styles.ringInhalt}
                />
              </View>
              <View style={[styles.abzeichen, { backgroundColor: SammlungRegel.ringfarbe('highlight') }]}>
                <Ionicons name="star" size={10} color={colors.white} />
              </View>
              <Text style={styles.highlightLabel} numberOfLines={1}>
                {s.name}
              </Text>
            </Druck>
          ))}
        </ScrollView>

        <View style={styles.tabs}>
          {TABS.map((item) => (
            <Druck
              key={item.key}
              style={[styles.tab, tab === item.key && styles.tabActive]}
              onPress={() => setTab(item.key)}
            >
              <Ionicons name={item.icon} size={22} color={tab === item.key ? colors.text : colors.text3} />
            </Druck>
          ))}
        </View>

        {tab === 'grid' ? (
          <View style={styles.grid}>
            {raster.map((eintrag) => (
              <Druck key={eintrag.id} style={[styles.gridItem, { height: kachelHoehe }]} onPress={() => onOpenKachel?.(eintrag)}>
                {/*
                  * Bei einem Video steht in mediaUri seit Schema 8 eine .mp4;
                  * ins Raster gehoert das Standbild dazu. Motiv nimmt, was da
                  * ist, und zeichnet sonst die Farbflaeche.
                  */}
                <Motiv
                  id={eintrag.id}
                  bild={eintrag.standbild ?? eintrag.mediaUri}
                  icon={eintrag.kind === 'video' ? 'play-outline' : 'image-outline'}
                  iconSize={20}
                  style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                />
              </Druck>
            ))}
          </View>
        ) : tab === 'repost' && meineReposts.length > 0 ? (
          // Der Reiter war immer leer. Jetzt stehen hier die Beitraege und
          // Videos, die man selbst repostet hat — und zwar die aus der
          // Datenbank, nicht nur die dieser Sitzung.
          <View style={styles.grid}>
            {meineReposts.map((r) => (
              <Druck key={r.id} style={[styles.gridItem, { height: kachelHoehe }]} onPress={() => onOpenKachel?.(r)}>
                <Motiv
                  id={r.id}
                  bild={r.thumbnail ?? r.mediaUrl ?? undefined}
                  icon={r.kind === 'post' ? 'image-outline' : 'play-outline'}
                  iconSize={20}
                  style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                />
                <View style={styles.repostMarke}>
                  <Ionicons name="repeat" size={12} color={colors.white} />
                </View>
              </Druck>
            ))}
          </View>
        ) : tab === 'tagged' && markiert.length > 0 ? (
          <View style={styles.grid}>
            {markiert.map((m) => (
              <Druck
                key={m.id}
                style={[styles.gridItem, { height: kachelHoehe }]}
                onPress={() => onOpenKachel?.(m)}
              >
                <Motiv
                  id={m.id}
                  bild={m.thumbnail ?? m.mediaUrl ?? undefined}
                  icon={m.kind === 'post' ? 'image-outline' : 'play-outline'}
                  iconSize={20}
                  style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                />
                <View style={styles.repostMarke}>
                  <Ionicons name="person" size={12} color={colors.white} />
                </View>
              </Druck>
            ))}
          </View>
        ) : tab === 'saved' && (gespeichert ?? []).length > 0 ? (
          /*
           * Die gespeicherten Beitraege. Kein Abzeichen auf der Kachel: hier
           * ist ohnehin alles gespeichert, ein Lesezeichen auf jedem Bild
           * waere Rauschen. Bei Repost und Markierung ist es umgekehrt — dort
           * sagt das Zeichen, warum ein fremder Beitrag im eigenen Profil
           * steht.
           */
          <View style={styles.grid}>
            {(gespeichert ?? []).map((g) => (
              <Druck
                key={g.id}
                style={[styles.gridItem, { height: kachelHoehe }]}
                onPress={() => onOpenKachel?.(g)}
              >
                <Motiv
                  id={g.id}
                  bild={g.thumbnail ?? g.mediaUrl ?? undefined}
                  icon={g.kind === 'post' ? 'image-outline' : 'play-outline'}
                  iconSize={20}
                  style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                />
              </Druck>
            ))}
          </View>
        ) : (
          <EmptyState
            icon={TABS.find((t) => t.key === tab)!.icon}
            title={
              tab === 'repost'
                ? 'Noch nichts repostet'
                : tab === 'tagged'
                  ? 'Keine Markierungen'
                  : tab === 'saved'
                    ? gespeichert === null
                      ? 'Wird geladen …'
                      : 'Noch nichts gespeichert'
                    : 'Noch nichts hier'
            }
            text={
              tab === 'repost'
                ? 'Tippe im Feed auf den Repost-Knopf, dann erscheint es hier.'
                : tab === 'tagged'
                  ? 'Wer dich mit @ in einer Beschreibung nennt, markiert dich — dann steht der Beitrag hier.'
                  : tab === 'saved'
                    ? gespeichert === null
                      ? ''
                      : 'Tippe unter einem Beitrag auf das Lesezeichen, dann liegt er hier.'
                    : 'Dieser Bereich füllt sich, sobald du ihn benutzt.'
            }
          />
        )}
      </ScrollView>

      {/*
        * Der Inhalt einer Sammlung. Eine Kachel fuehrt weiter an dieselbe
        * Stelle wie im Raster darunter — sonst waere das Oeffnen wieder nur
        * eine Anzeige.
        */}
      <Modal
        visible={offen !== null}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setOffen(null)}
      >
        <View style={styles.screen}>
          <View style={styles.sammlungKopf}>
            <Druck onPress={() => setOffen(null)} style={styles.sammlungZurueck}>
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Druck>
            <Text style={styles.sammlungTitel} numberOfLines={1}>
              {offen?.sammlung.name ?? ''}
            </Text>
            {offen ? (
              <Druck
                onPress={() => setTitelMenue(true)}
                style={styles.sammlungZurueck}
                accessibilityLabel="Titelbild wählen"
                testID="titelbild-waehlen"
              >
                <Ionicons name="image-outline" size={22} color={waehlen ? colors.brand : colors.text} />
              </Druck>
            ) : null}
            {offen ? (
              <Druck onPress={() => loeschenFragen(offen.sammlung)} style={styles.sammlungZurueck}>
                <Ionicons name="trash-outline" size={22} color={colors.text} />
              </Druck>
            ) : null}
          </View>
          {waehlen ? (
            <Text style={styles.wahlHinweis}>
              {offen?.sammlung.art === 'playlist'
                ? 'Tippe auf den Beitrag, der im Kreis stehen soll.'
                : 'Tippe auf die Story, die im Kreis stehen soll.'}
            </Text>
          ) : null}
          {offen && offen.kacheln.length > 0 ? (
            <ScrollView contentContainerStyle={styles.content}>
              <View style={styles.grid}>
                {offen.kacheln.map((k) => (
                  <Druck
                    key={k.id}
                    style={[
                      styles.gridItem,
                      { height: kachelHoehe },
                      (offen.sammlung.titelPostId === k.id || offen.sammlung.titelStoryId === k.id) && {
                        borderColor: SammlungRegel.ringfarbe(offen.sammlung.art),
                        borderWidth: 3,
                      },
                    ]}
                    onPress={() => {
                      if (waehlen) {
                        return void titelSetzen(k.kind === 'story' ? { storyId: k.id } : { postId: k.id });
                      }
                      setOffen(null);
                      onOpenKachel?.(k);
                    }}
                  >
                    <Motiv
                      id={k.id}
                      bild={k.thumbnail ?? k.mediaUrl ?? undefined}
                      icon={k.kind === 'post' ? 'image-outline' : 'play-outline'}
                      iconSize={20}
                      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
                    />
                  </Druck>
                ))}
              </View>
            </ScrollView>
          ) : (
            <EmptyState
              icon="albums-outline"
              title="Noch nichts darin"
              text={'Über das Drei-Punkte-Menü an einem Beitrag legst du ihn hier hinein.'}
            />
          )}
        </View>

        <ActionSheet
          visible={titelMenue}
          title="Titelbild"
          untertitel={
            offen?.sammlung.art === 'playlist'
              ? 'Aus einem Beitrag dieser Playlist'
              : 'Aus einer Story dieses Highlights oder ein eigenes Foto'
          }
          items={[
            {
              key: 'aus',
              label: offen?.sammlung.art === 'playlist' ? 'Beitrag wählen' : 'Story wählen',
              icon: 'grid-outline',
            },
            ...(offen?.sammlung.art === 'highlight'
              ? [
                  { key: 'galerie', label: 'Foto aus Mediathek', icon: 'images-outline' as const },
                  { key: 'kamera', label: 'Foto aufnehmen', icon: 'camera-outline' as const },
                ]
              : []),
            { key: 'zurueck', label: 'Automatisch (neuestes)', icon: 'refresh-outline' },
          ]}
          onSelect={(key) => {
            setTitelMenue(false);
            if (key === 'aus') {
              if (!offen?.kacheln.length) return onNotice('Noch nichts darin, woraus ein Titelbild werden könnte');
              return setWaehlen(true);
            }
            if (key === 'galerie' || key === 'kamera') return void titelFoto(key);
            void titelSetzen({});
          }}
          onClose={() => setTitelMenue(false)}
        />
      </Modal>

      <SichtbarkeitSheet
        visible={onlineOffen}
        titel="Online-Status"
        stufe={online.stufe}
        ausnahmen={online.ausnahmen}
        onStufe={async (stufe) => {
          await aktionen.sichtbarkeit('onlinestatus', stufe, () => {});
          await neuLaden();
        }}
        onAusnahme={async (userId) => {
          await aktionen.sichtbarkeitAusnahme('onlinestatus', userId, () => {});
          await neuLaden();
        }}
        onClose={() => setOnlineOffen(false)}
      />

      {laedt && (
        <View style={styles.laedt} pointerEvents="none">
          <ActivityIndicator color={colors.text} />
        </View>
      )}
    </View>
  );
};

const styles = themenStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.surface },
  repostMarke: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { paddingBottom: spacing.xl },

  // Der Kopf ueber dem Inhalt einer Sammlung.
  sammlungKopf: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    paddingRight: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sammlungZurueck: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  sammlungTitel: { ...typography.h3, color: colors.text, flex: 1 },
  laedt: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  highlights: { gap: 14, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  highlight: { alignItems: 'center', gap: 6, width: 68 },
  /*
   * Punkt 39: Playlist und Highlight muessen auseinanderzuhalten sein. Hier
   * unterschied sie nur ein blasses Symbol im Kreis — auf einem Bildschirm
   * nebeneinander sah man keinen Unterschied. Die Website loest es seit dem
   * 26.08.2026 ueber die Form: eine Playlist ist ein abgerundetes Quadrat mit
   * einem Dreieck, ein Highlight ein Kreis mit einem Stern. Dieselbe Sprache
   * jetzt auch hier.
   */
  /*
   * Kasten 12.9 (Henrik 21.09.2026: „Prototyp ist bindend"): beide Gattungen
   * als Kreis, unterschieden durch die Ringfarbe aus dem Prototyp —
   * Playlist #FF0A0A, Highlight #FF990A, Strich 4 bei 45 px. Farbe und
   * Staerke kommen aus gemeinsam/sammlungen.js, damit die Website dieselben
   * zeichnet. Das abgerundete Quadrat fuer Playlists (Punkt 39, 26.08.)
   * steht nicht im Prototyp; die Unterscheidung traegt jetzt die Farbe,
   * dazu das Abzeichen.
   */
  ring: {
    width: KREIS,
    height: KREIS,
    borderRadius: KREIS / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ringInhalt: { width: INNEN, height: INNEN, borderRadius: INNEN / 2, overflow: 'hidden' },
  /* Das Abzeichen sitzt unten rechts auf dem Rand — deshalb absolut, mit
     einem Rand in der Flaechenfarbe, damit es sich abhebt. */
  abzeichen: {
    position: 'absolute',
    right: 2,
    top: 44,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  wahlHinweis: { ...typography.small, color: colors.text2, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  highlightLabel: { ...typography.small, color: colors.text2 },
  tabs: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tab: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.text },
  /*
   * Das Raster hatte nur zwei Spalten statt drei. Grund: 3 × 33 % plus zwei
   * Luecken von je 2px sind zusammen breiter als die Zeile — das dritte Feld
   * rutschte um. Abstand jetzt ueber einen Rand in Hintergrundfarbe statt
   * ueber gap, dann bleibt die Breite exakt ein Drittel. Genauso macht es
   * UserProfileScreen, wo es immer richtig war.
   */
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: {
    width: '33.333%',
    borderWidth: 1,
    borderColor: colors.surface,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
}));
