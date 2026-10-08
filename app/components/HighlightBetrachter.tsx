/**
 * Ein Highlight abspielen — Kasten 17.1.
 *
 * Henrik am 01.10.2026: „Die Highlights kannst du einfach komplett von
 * Instagram übernehmen." Bei Instagram öffnet ein Highlight keinen Ordner,
 * sondern spielt seine Storys im Vollbild nacheinander ab. Bis dahin zeigte
 * die App im eigenen Profil ein Raster, im fremden nur einen Hinweis.
 *
 * Hier steht KEIN zweiter Betrachter: es ist der vorhandene
 * StoryViewerScreen in einem Modal, mit `highlight` als Zusatz. Ein Modal,
 * weil der Betrachter über dem Profil liegen muss — über die Overlay-Weiche
 * in App.tsx ersetzte er das fremde Profil, und „Zurück" landete im Feed.
 *
 * Gegenstück auf der Website: highlightAbspielen() in web/public/app.js.
 */

import React from 'react';
import { Modal } from 'react-native';
import { StoryViewerScreen, HighlightModus } from '../screens/messenger/StoryViewerScreen';
import { useAktionen } from '../lib/useAktionen';
import { Story } from '../types';
import { FarbfilterSchicht } from './Farbfilter';

interface Props {
  /** Null: nichts offen. Die Liste ist nie leer — leere Highlights öffnen den Ordner. */
  offen: { storys: Story[]; start?: string; highlight: HighlightModus } | null;
  onClose: () => void;
  onNotice: (message: string) => void;
  onOpenProfile?: (userId: string) => void;
}

export const HighlightBetrachter = ({ offen, onClose, onNotice, onOpenProfile }: Props) => {
  const aktion = useAktionen(onNotice);
  const storys = offen?.storys ?? [];
  const start = storys.find((s) => s.id === offen?.start) ?? storys[0];

  return (
    <Modal
      visible={Boolean(offen && start)}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {offen && start ? (
        <StoryViewerScreen
          // Neu aufbauen, wenn ein anderes Highlight kommt — der Betrachter
          // merkt sich seinen Startpunkt beim ersten Aufbau.
          key={`${offen.highlight.name}-${start.id}`}
          story={start}
          alle={storys}
          highlight={offen.highlight}
          onClose={onClose}
          onNotice={onNotice}
          onOpenProfile={onOpenProfile}
          /*
           * Antworten wie bei jeder Story: die Nachricht landet im Chat mit
           * dieser Person (story_antwort). Der Chat öffnet sich nicht — wer
           * ein fremdes Highlight ansieht, bleibt im Profil.
           */
          onReply={async (story, text) => {
            const chatId = await aktion.storyAntwort(story.id, text);
            if (chatId) onNotice('Antwort gesendet');
          }}
        />
      ) : null}
      {/* Kasten 21: Vollbild-Fenster — Farbfilter-Fläche als letztes Kind. */}
      <FarbfilterSchicht />
    </Modal>
  );
};
