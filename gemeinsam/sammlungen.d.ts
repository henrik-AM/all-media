/**
 * Typen zu sammlungen.js — Ringfarben und Vorschaubild von Playlists und
 * Highlights, gemeinsam für App und Website.
 */
export type SammlungsArt = 'playlist' | 'highlight';

export const RINGFARBEN: Readonly<Record<SammlungsArt, string>>;
export const RINGSTAERKE_ANTEIL: number;
export function ringfarbe(art: SammlungsArt | string): string;
export function ringstaerke(durchmesser: number): number;
export function vorschaubild(
  sammlung: {
    titelbild_url?: string | null;
    titel_post_id?: string | null;
    titel_story_id?: string | null;
  } | null | undefined,
  inhalte: Array<{
    created_at?: string | null;
    post_id?: string | null;
    story_id?: string | null;
    posts?: { thumbnail_url?: string | null; media_url?: string | null } | null;
    stories?: { media_url?: string | null } | null;
  }> | null | undefined
): string | null;

/** „Playlist · 3 Beiträge" / „Highlight · 1 Story" (Kasten 17). */
export function untertitel(art: SammlungsArt | string, anzahl: number): string;

/** Alter einer Story im Highlight — Minuten bis Datum (Kasten 17.1). */
export function storyAlter(iso: string | number | null | undefined, jetzt?: number): string;

/** Eine Zeile aus `stories` als Story für den Betrachter (Kasten 17.1). */
export function alsHighlightStory(
  zeile: {
    id: string;
    user_id: string;
    media_url?: string | null;
    media_type?: string | null;
    caption?: string | null;
    created_at?: string | null;
    overlays?: unknown;
    profiles?: { name?: string | null } | null;
  },
  optionen: { ichId: string; ichKennung?: string; gemocht?: Set<string> }
): {
  id: string;
  userId: string;
  name: string;
  own: boolean;
  viewed: boolean;
  liked: boolean;
  caption: string;
  mediaUri?: string;
  mediaType: 'image' | 'video';
  aufgenommen?: string;
  overlays: any;
};
