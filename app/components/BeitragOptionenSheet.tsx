import React, { useEffect, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { ActionSheet, ActionSheetItem } from './ActionSheet';
import { SUPABASE_CONFIG } from '../constants/supabase';
import { useDaten } from '../contexts/DatenContext';
import { useSupabase } from '../contexts/SupabaseContext';
import { useAktionen } from '../lib/useAktionen';
import * as Aktion from '../lib/aktionen';

/** Was das Menue ueber den Beitrag wissen muss. */
export interface OptionenBeitrag {
  id: string;
  userId: string;
  mediaUri?: string;
  /** Fuer den Dateinamen beim Herunterladen. */
  video?: boolean;
}

interface Props {
  beitrag: OptionenBeitrag | null;
  onClose: () => void;
  onNotice: (message: string) => void;
}

const GRUENDE = [
  'Spam oder Werbung',
  'Beleidigung oder Hass',
  'Gewalt oder Gefahr',
  'Nicht jugendfreie Inhalte',
  'Falschinformation',
  'Etwas anderes',
];

/**
 * Die Adresse eines Beitrags. Sie fuehrt auf die Website, die ihn dort
 * oeffnet (`?beitrag=` in web/public/app.js, bootstrap) — vorher kopierte die
 * App "all-media.app/...", eine Adresse, die es nicht gibt.
 */
export const beitragLink = (id: string) => `${SUPABASE_CONFIG.redirectUrl}/?beitrag=${id}`;

/**
 * Drei-Punkte-Menue am Beitrag — Henrik am 21.09.2026: "Link kopieren,
 * herunterladen, zu Story hinzufügen, melden, kein Interesse ... Vorbild
 * TikTok. Kein 'an WhatsApp senden' oder 'Snapchat' — genau die soll All
 * Media ersetzen." Deshalb steht hier kein Systemblatt zum Weiterschicken:
 * Senden geht ueber den Teilen-Knopf an Leute in All Media.
 *
 * Gegenstueck auf der Website: openBeitragOptionen in web/public/app.js.
 */
export const BeitragOptionenSheet = ({ beitrag, onClose, onNotice }: Props) => {
  const { ichId, keinInteresseMerken } = useDaten();
  const { supabase } = useSupabase();
  const aktion = useAktionen(onNotice);
  const [meldeSchritt, setMeldeSchritt] = useState(false);
  const [darfSichern, setDarfSichern] = useState(false);

  const eigener = beitrag?.userId === 'me' || beitrag?.userId === ichId;

  /*
   * Herunterladen nur, wenn die Person es zulaesst ("Downloadeinstellungen").
   * Gefragt wird vor dem Zeichnen - ein Knopf, der beim Antippen "darfst du
   * nicht" sagt, ist schlechter als keiner. Gleiche Regel wie bei Storys.
   */
  useEffect(() => {
    setMeldeSchritt(false);
    if (!beitrag) return;
    if (eigener) return setDarfSichern(true);
    setDarfSichern(false);
    if (!supabase || !ichId) return;
    let abgebrochen = false;
    Aktion.darfHerunterladen(supabase, beitrag.userId, ichId)
      .then((ja) => !abgebrochen && setDarfSichern(ja))
      .catch(() => !abgebrochen && setDarfSichern(false));
    return () => {
      abgebrochen = true;
    };
  }, [beitrag, eigener, supabase, ichId]);

  if (!beitrag) return null;

  const punkte: ActionSheetItem[] = meldeSchritt
    ? GRUENDE.map((g) => ({ key: `grund:${g}`, label: g, icon: 'flag-outline' }))
    : [
        { key: 'link', label: 'Link kopieren', icon: 'link-outline' },
        ...(darfSichern && beitrag.mediaUri
          ? [{ key: 'sichern', label: 'Herunterladen', icon: 'download-outline' } as ActionSheetItem]
          : []),
        { key: 'story', label: 'Zu Story hinzufügen', icon: 'add-circle-outline' },
        ...(eigener
          ? []
          : ([
              { key: 'kein', label: 'Kein Interesse', icon: 'eye-off-outline' },
              { key: 'melden', label: 'Melden', icon: 'flag-outline', gefahr: true },
            ] as ActionSheetItem[])),
      ];

  const waehlen = async (key: string) => {
    if (key === 'melden') return setMeldeSchritt(true);
    onClose();

    if (key.startsWith('grund:')) {
      const ok = await aktion.beitragMelden(beitrag.id, key.slice(6));
      if (ok) onNotice('Danke, wir sehen uns das an');
      return;
    }
    if (key === 'link') {
      await Clipboard.setStringAsync(beitragLink(beitrag.id));
      return onNotice('Link kopiert');
    }
    if (key === 'sichern') {
      const ok = await aktion.medienSichern(
        beitrag.mediaUri ?? '',
        `all-media-${beitrag.id}.${beitrag.video ? 'mp4' : 'jpg'}`
      );
      if (ok) onNotice('Gesichert');
      return;
    }
    if (key === 'story') {
      const id = await aktion.beitragInStory(beitrag.id);
      if (id) onNotice('Zu deiner Story hinzugefügt');
      return;
    }
    if (key === 'kein') {
      const ok = await aktion.keinInteresse(beitrag.id);
      if (ok) {
        keinInteresseMerken(beitrag.id);
        onNotice('Du siehst diesen Beitrag nicht mehr im Feed');
      }
    }
  };

  return (
    <ActionSheet
      visible
      title={meldeSchritt ? 'Warum meldest du das?' : 'Optionen'}
      items={punkte}
      onSelect={waehlen}
      onClose={onClose}
    />
  );
};
