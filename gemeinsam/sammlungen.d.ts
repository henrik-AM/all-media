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
