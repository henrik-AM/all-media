// Supabase-Anbindung des Website-Servers.
//
// Wichtig zum Verständnis: Die Datenbank ist durch Row Level Security
// geschützt. Die Regeln gelten für die Rolle „authenticated" — also für einen
// angemeldeten Nutzer. Ein Client ohne Anmeldung ist „anon" und darf nichts
// lesen und nichts schreiben. Deshalb gibt es hier zwei Wege:
//
//   leseClient()      — ohne Anmeldung. Nur für Dinge, die öffentlich sind.
//   clientFuer(token) — mit dem Zugangstoken des angemeldeten Nutzers. Nur
//                       damit greifen die Regeln richtig und Schreibzugriffe
//                       funktionieren.
//
// Der Schlüssel unten ist der „publishable"-Schlüssel. Er ist dafür gemacht,
// öffentlich zu sein — er steckt genauso im App-Bundle. Der Schutz kommt aus
// den Regeln in der Datenbank, nicht aus der Geheimhaltung des Schlüssels.

const { createClient } = require('@supabase/supabase-js');

// Fallback, damit die Website auch dann mit der Datenbank spricht, wenn auf
// Render keine Umgebungsvariablen gesetzt sind.
const STANDARD_URL = 'https://ijztosbjfybdgotpdixw.supabase.co';
const STANDARD_KEY = 'sb_publishable_sh_LhLSMkHNZrmmj7XkTtw_QFT1G9Ze';

const supabaseUrl = process.env.SUPABASE_URL || STANDARD_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || STANDARD_KEY;

const konfiguriert = Boolean(supabaseUrl && supabaseKey);

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.warn(
    '  Hinweis: SUPABASE_URL/SUPABASE_ANON_KEY sind nicht gesetzt — es gelten die eingebauten Standardwerte.'
  );
}

// Client ohne Anmeldung. Sitzungen werden nicht gespeichert: Der Server
// bedient viele Nutzer gleichzeitig, eine gemeinsame Sitzung wäre ein Leck.
const supabase = konfiguriert
  ? createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

/**
 * Client im Namen eines angemeldeten Nutzers. Ohne Token gibt es keinen —
 * dann greift beim Aufrufer der Rückfall auf die Beispieldaten.
 */
function clientFuer(zugangstoken) {
  if (!konfiguriert || !zugangstoken) return null;

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${zugangstoken}` } },
  });
}

/**
 * Liest das Zugangstoken aus einer Anfrage (Header „Authorization").
 */
function tokenAus(req) {
  const kopf = req?.headers?.authorization || '';
  return kopf.startsWith('Bearer ') ? kopf.slice(7).trim() : null;
}

/**
 * Wer stellt diese Anfrage? Gibt das Profil des angemeldeten Nutzers zurück
 * oder null, wenn niemand angemeldet ist.
 */
async function nutzerAus(req) {
  const token = tokenAus(req);
  const client = clientFuer(token);
  if (!client) return null;

  try {
    const { data, error } = await client.auth.getUser();
    if (error) return null;
    return data?.user || null;
  } catch {
    return null;
  }
}

function isConfigured() {
  return konfiguriert;
}

module.exports = {
  supabase,
  clientFuer,
  tokenAus,
  nutzerAus,
  isConfigured,
  supabaseUrl,
  supabaseKey,
};
