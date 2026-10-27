/**
 * Medienadressen unterschreiben.
 *
 * Sicherheitspruefung 04.09.2026 (Fund 4). Gegenstueck zu
 * web/server/medien.js — dieselbe Regel auf beiden Seiten, sonst zeigt die
 * eine Fassung Bilder und die andere leere Kaesten.
 *
 * Der Eimer `media` war oeffentlich: jede hochgeladene Datei war ohne
 * Anmeldung abrufbar, egal wie privat die Zeile dazu war. Jetzt ist er
 * geschlossen, und jede Adresse, die die App anzeigt, wird vorher
 * unterschrieben. Vier Stunden gueltig.
 *
 * Die Zeilen in der Datenbank bleiben unveraendert — dort stehen weiterhin
 * die alten `.../object/public/media/...`-Adressen. Umgeschrieben wird erst
 * beim Anzeigen. Das erspart eine Wanderung ueber den ganzen Bestand, die
 * keinen Rueckweg haette.
 */

import { SupabaseClient } from '@supabase/supabase-js';

// Upload und Unterschriften verwenden denselben Server wie die Website.
export const medienServerAktiv = () => true;
export function medienServerBasis() {
  const server=((typeof process!=='undefined'?process.env.EXPO_PUBLIC_WEB_URL:undefined) || 'https://all-media-website.onrender.com').replace(/\/$/,'');
  if(!/^https:\/\//.test(server) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(server))throw new Error('Ungültiger Medienserver');
  return server;
}
export async function medienAnfrage(client:SupabaseClient,pfad:string,body:unknown) {
  const {data}=await client.auth.getSession();const token=data.session?.access_token;
  if(!token)throw new Error('Bitte erneut anmelden.');
  const r=await fetch(medienServerBasis()+pfad,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body),redirect:'error'});
  const wert=await r.json();
  if((await client.auth.getSession()).data.session?.access_token!==token)throw new Error('Das Konto wurde gewechselt. Bitte erneut versuchen.');
  if(!r.ok||!wert.ok)throw new Error(wert.error||'Der Medienserver ist nicht erreichbar.');return wert;
}
async function medienSignaturliste(client:SupabaseClient,pfade:string[]) {
 const dateien:any[]=[];
 for(let i=0;i<pfade.length;i+=500){const r=await medienAnfrage(client,'/api/medien/unterschreiben',{pfade:pfade.slice(i,i+500)});dateien.push(...r.dateien);}
 return dateien;
}
const OEFFENTLICH = '/storage/v1/object/public/media/';
const GUELTIG = 4 * 60 * 60;

/*
 * Zwischenspeicher fuer unterschriebene Adressen, getrennt je Client und Sitzung.
 *
 * Gegenstueck zu web/server/medien.js. Ohne ihn bekam jeder Screenaufruf eine
 * neue Unterschrift, also eine neue Adresse (der Token steht im Query-String).
 * Fuer das CDN war das jedes Mal eine „neue" Datei, und dasselbe Bild wurde
 * bei jedem Oeffnen komplett neu von Supabase geladen. Auf der Website hat
 * genau das aus 44 MB Speicher 7,2 GB Egress gemacht.
 *
 * Innerhalb der Gueltigkeit bleibt die Adresse fuer denselben Pfad jetzt
 * gleich, damit das Supabase-CDN sie tatsaechlich aus dem Cache bedienen kann.
 */
type Medienspeicher = {
  token: string;
  eintraege: Map<string, { url: string; ablauf: number }>;
};
const speicherJeClient = new WeakMap<SupabaseClient, Medienspeicher>();
const PUFFER_MS = 10 * 60 * 1000;
const MAX_EINTRAEGE = 1000;

// getSession liest die lokale Sitzung. Auch derselbe Client kann zwischen
// Konten wechseln; ein Speicher nur je Client oder Pfad waere deshalb offen.
async function speicherFuer(client: SupabaseClient): Promise<Medienspeicher | null> {
  try {
    const { data, error } = await client.auth.getSession();
    const token = data?.session?.access_token;
    if (error || !data?.session?.user?.id || !token) {
      speicherJeClient.delete(client);
      return null;
    }
    let speicher = speicherJeClient.get(client);
    if (!speicher || speicher.token !== token) {
      speicher = { token, eintraege: new Map() };
      speicherJeClient.set(client, speicher);
    }
    return speicher;
  } catch {
    speicherJeClient.delete(client);
    return null;
  }
}

function merken(speicher: Medienspeicher, pfad: string, url: string, ablauf: number) {
  const jetzt = Date.now();
  for (const [name, eintrag] of speicher.eintraege) {
    if (eintrag.ablauf - PUFFER_MS <= jetzt) speicher.eintraege.delete(name);
  }
  speicher.eintraege.delete(pfad);
  while (speicher.eintraege.size >= MAX_EINTRAEGE) {
    const erster = speicher.eintraege.keys().next().value;
    if (erster === undefined) break;
    speicher.eintraege.delete(erster);
  }
  speicher.eintraege.set(pfad, { url, ablauf });
}

function istMedienAdresse(wert: unknown): wert is string {
  // Der ganze Wert muss eine Adresse sein, nicht ein Satz, der eine erwähnt —
  // gleiche Regel wie web/server/medien.js (Sicherheitsprüfung 17.10.2026).
  return typeof wert === 'string' && /^https?:\/\/\S+$/.test(wert) && wert.includes(OEFFENTLICH);
}

function pfadAus(adresse: string): string | null {
  const stelle = adresse.indexOf(OEFFENTLICH);
  if (stelle === -1) return null;
  const rest = adresse.slice(stelle + OEFFENTLICH.length);
  /*
   * decodeURIComponent wirft bei kaputter Kodierung (`%zz`). Ohne den Fang
   * reichte ein einziger Beitrag mit so einer Beschreibung, und der Feed
   * jedes Nutzers, der ihn laden sollte, blieb leer.
   */
  let pfad: string;
  try {
    pfad = decodeURIComponent(rest.split(/[?#]/)[0]);
  } catch {
    return null;
  }
  // Allgemeine Signaturen erlauben dieselben Ordner wie Bunny. Instants bleiben separat.
  return /^(messages|stories|avatars|posts|insights|ptt|beispiel)\/[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(pfad) && !pfad.includes('..') ? pfad : null;
}

function sammle(wert: any, pfade: Set<string>) {
  if (istMedienAdresse(wert)) {
    const p = pfadAus(wert);
    if (p) pfade.add(p);
    return;
  }
  if (Array.isArray(wert)) {
    for (const e of wert) sammle(e, pfade);
    return;
  }
  if (wert && typeof wert === 'object') {
    for (const e of Object.values(wert)) sammle(e, pfade);
  }
}

function ersetze(wert: any, karte: Map<string, string>): any {
  if (istMedienAdresse(wert)) {
    const p = pfadAus(wert);
    return (p && karte.get(p)) || wert;
  }
  if (Array.isArray(wert)) return wert.map((e) => ersetze(e, karte));
  if (wert && typeof wert === 'object') {
    const neu: Record<string, any> = {};
    for (const [schluessel, e] of Object.entries(wert)) neu[schluessel] = ersetze(e, karte);
    return neu;
  }
  return wert;
}

/**
 * Alle Medienadressen in `daten` durch unterschriebene ersetzen.
 *
 * Erst einsammeln, dann in EINEM Aufruf unterschreiben, dann ersetzen — bei
 * zweihundert Beitraegen waere ein Aufruf je Bild zweihundert Anfragen.
 *
 * Schlaegt das Unterschreiben fehl, bleibt die alte Adresse stehen. Sie
 * fuehrt dann ins Leere, aber ein fehlendes Bild ist besser als ein Bildschirm,
 * der gar nicht laedt.
 */
export async function signiereMedien<T>(client: SupabaseClient | null, daten: T): Promise<T> {
  if (!client || daten == null) return daten;

  const pfade = new Set<string>();
  sammle(daten, pfade);
  if (pfade.size === 0) return daten;

  const speicher = await speicherFuer(client);
  if (!speicher) return daten;

  const karte = new Map<string, string>();
  const jetzt = Date.now();
  const fehlend: string[] = [];
  for (const pfad of pfade) {
    const eintrag = speicher.eintraege.get(pfad);
    if (eintrag && eintrag.ablauf - PUFFER_MS > jetzt) {
      karte.set(pfad, eintrag.url);
    } else {
      fehlend.push(pfad);
    }
  }

  if (fehlend.length) {
    try {
      const { data, error } = medienServerAktiv()
        ? {data:(await medienSignaturliste(client,fehlend)).map((z:any)=>({path:z.pfad,signedUrl:z.url,ablauf:z.ablauf,error:null})),error:null}
        : await client.storage.from('media').createSignedUrls(fehlend, GUELTIG);
      if (error) throw error;

      const ablauf = jetzt + GUELTIG * 1000;
      for (const eintrag of data ?? []) {
        if (eintrag?.signedUrl && !eintrag.error) {
          karte.set(eintrag.path as string, eintrag.signedUrl);
          merken(speicher, eintrag.path as string, eintrag.signedUrl, Math.min(ablauf, Number((eintrag as any).ablauf) || ablauf));
        }
      }
    } catch (fehler: any) {
      console.error('Medienadressen unterschreiben fehlgeschlagen:', fehler?.message ?? fehler);
      if (karte.size === 0) return daten;
    }
  }

  // Ein Kontowechsel waehrend der Unterschrift darf kein altes Kuvert liefern.
  if (await speicherFuer(client) !== speicher) return daten;
  return ersetze(daten, karte);
}

/** Eine einzelne Adresse unterschreiben — fuer frisch hochgeladene Dateien. */
export async function signiereEine(
  client: SupabaseClient | null,
  pfad: string
): Promise<string | null> {
  if (!client) return null;

  const speicher = await speicherFuer(client);
  if (!speicher) return null;
  const eintrag = speicher.eintraege.get(pfad);
  if (eintrag && eintrag.ablauf - PUFFER_MS > Date.now()) return eintrag.url;

  try {
    const { data, error } = medienServerAktiv()
      ? await (async()=>{const z=(await medienAnfrage(client,'/api/medien/unterschreiben',{pfade:[pfad]})).dateien[0];return {data:{signedUrl:z?.url,ablauf:z?.ablauf},error:null};})()
      : await client.storage.from('media').createSignedUrl(pfad, GUELTIG);
    if (error) throw error;
    if (await speicherFuer(client) !== speicher) return null;
    if (data?.signedUrl) {
      merken(speicher, pfad, data.signedUrl, Math.min(Date.now() + GUELTIG * 1000, Number((data as any).ablauf) || Infinity));
    }
    return data?.signedUrl ?? null;
  } catch (fehler: any) {
    console.error('Adresse unterschreiben fehlgeschlagen:', fehler?.message ?? fehler);
    return null;
  }
}
