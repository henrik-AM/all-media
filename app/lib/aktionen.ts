/**
 * All Media — was die App in die Datenbank schreibt.
 *
 * WARUM ES DAS GIBT
 *
 * `lib/daten.ts` holt Inhalte; hier stehen die Gegenstücke, die etwas
 * verändern. Bis zum 01.09.2026 gab es die in der App gar nicht: Like,
 * Speichern, Folgen, Repost und der Beitragshinweis änderten nur den Zustand
 * im Bildschirm. Das Herz wurde rot, die Zahl ging hoch — und beim nächsten
 * Start der App war alles wieder wie vorher. Auf der Website erschien es nie.
 *
 * Nach außen sah das aus wie ein Fehler in der Datenbank. Es war keiner. Es
 * wurde schlicht nie etwas hingeschickt.
 *
 * Die Website macht dasselbe in web/server/sync-handlers.js. Beide schreiben
 * in dieselben Tabellen mit denselben Spalten; wer hier etwas ändert, muss
 * dort nachsehen, sonst laufen die beiden Fassungen wieder auseinander.
 *
 * WIE ES SICH ANFÜHLT
 *
 * Die Bildschirme schalten sofort um und rufen das hier nebenbei auf. Geht
 * es schief, wird zurückgeschaltet und der Grund gemeldet — nicht still
 * geschluckt. Ein Herz, das rot bleibt, obwohl nichts gespeichert wurde,
 * ist schlimmer als eines, das wieder grau wird.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { signiereMedien, medienAnfrage, eigeneMedienadresse } from './medien';
// Kasten 1.3 (Nachtrag 10.10.2026): Texte der Seite „Profil bearbeiten“.
const Profilfelder = require('../../gemeinsam/profilfelder') as typeof import('../../gemeinsam/profilfelder');
const Kontaktbild = require('../../gemeinsam/kontaktbild') as typeof import('../../gemeinsam/kontaktbild');
