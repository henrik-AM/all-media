/**
 * Medienadressen unterschreiben.
 *
 * Sicherheitspruefung 04.09.2026 (Fund 4).
 *
 * Der Eimer `media` war oeffentlich. Jede hochgeladene Datei — Chat-Anhaenge,
 * Storys privater Profile, Profilbilder — hing an einer rohen Adresse, die
 * ohne Anmeldung abrufbar war. Die ganze Sichtbarkeitslogik der Datenbank
 * (`sichtbar_fuer`, `beitrag_sichtbar`, `is_chat_member`) schuetzt die ZEILE.
 * Die DATEI dahinter kannte keine dieser Regeln. Wer eine Story-Adresse
 * einmal gesehen hatte, konnte sie unbegrenzt weiterreichen, und das Loeschen
 * der Story aenderte daran nichts.
 *
 * WARUM KEINE DATENWANDERUNG
 *
 * In den Zeilen stehen fertige Adressen der Form
 * `https://<projekt>.supabase.co/storage/v1/object/public/media/<pfad>` — in
 * `posts.media_url`, `posts.thumbnail_url`, `stories.media_url`,
 * `messages.attachment_url` und weiteren. Diese Spalten alle umzuschreiben
 * waere eine Wanderung ueber den gesamten Bestand, mit einem Rueckweg, den
 * niemand mehr hat.
 *
 * Stattdessen bleiben die Zeilen, wie sie sind, und die Umwandlung passiert
 * einmal zentral beim Ausliefern: jede Antwort der API wird durchlaufen, jede
 * gefundene Adresse gegen eine unterschriebene mit Ablauf getauscht. Wer die
 * Zeile nicht lesen darf, bekommt sie gar nicht erst — und damit auch keine
 * Adresse zum Unterschreiben.
 *
 * DER ABLAUF
 *
 * Vier Stunden. Kurz genug, dass eine weitergereichte Adresse wertlos wird;
 * lang genug, dass eine Sitzung nicht mitten im Blaettern auf tote Bilder
 * laeuft. Die Oberflaeche holt die Startdaten bei jedem Laden neu.
 */

// Videotypen und -grenzen (Kasten 15) — dieselbe Datei wie in App und Browser.
const Bunny = require('./bunny');
// Bereits eine teilweise gesetzte Konfiguration darf nicht still auf Supabase ausweichen.
const mitBunny = () => ['BUNNY_STORAGE_ZONE','BUNNY_STORAGE_KEY','BUNNY_STORAGE_HOST','BUNNY_PULL_HOST','BUNNY_TOKEN_KEY'].some(k => Boolean(process.env[k]));

const StoryRegeln = require('../../gemeinsam/story');

const OEFFENTLICH = '/storage/v1/object/public/media/';

/*
 * Zwischenspeicher fuer unterschriebene Adressen: Pfad -> { url, ablauf }.
 *
 * Ohne ihn bekam jede Anfrage eine neue Unterschrift, also eine neue
 * Adresse (der Token steht im Query-String). Fuer den Browser war das jedes
 * Mal eine „neue" Datei, der `Cache-Control`-Header beim Hochladen (siehe
 * `hochladen` unten) griff nie, und dasselbe Bild oder Video wurde bei jedem
 * Neuladen komplett neu von Supabase geladen. Das Nutzungs-Dashboard zeigte
 * 44 MB Speicher gegen 7,2 GB Egress bei 13 Testkonten — derselbe kleine
 * Bestand, hunderte Male neu heruntergeladen.
 *
 * Innerhalb der Gueltigkeit bleibt die Adresse fuer denselben Pfad jetzt
 * gleich, damit Browser und Supabase-CDN sie tatsaechlich aus dem Cache
 * bedienen koennen.
 */
const zwischenspeicher = new Map();
const PUFFER_MS = 10 * 60 * 1000;

/** Steckt in diesem Wert eine Adresse aus unserem Eimer? */
function istMedienAdresse(wert) {
  return typeof wert === 'string' && wert.includes(OEFFENTLICH);
}

/** Aus der vollen Adresse den Pfad im Eimer holen. */
function pfadAus(adresse) {
  const stelle = adresse.indexOf(OEFFENTLICH);
  if (stelle === -1) return null;
  const rest = adresse.slice(stelle + OEFFENTLICH.length);
  // Ein angehaengtes ?t=... oder #... gehoert nicht zum Pfad.
  return decodeURIComponent(rest.split(/[?#]/)[0]);
}

/**
 * Jede Medienadresse in `daten` durch eine unterschriebene ersetzen.
 *
 * Laeuft in zwei Durchgaengen: erst alle Pfade einsammeln, dann in EINEM
 * Aufruf unterschreiben lassen, dann ersetzen. Ein Aufruf je Bild waere bei
 * zweihundert Beitraegen zweihundert Anfragen.
 *
 * Faellt das Unterschreiben aus, bleibt die urspruengliche Adresse stehen.
 * Sie fuehrt dann ins Leere (der Eimer ist nicht mehr oeffentlich) — aber ein
 * fehlendes Bild ist besser als eine Seite, die gar nicht laedt.
 */
async function signiereMedien(client, daten, sekunden = 4 * 60 * 60) {
  if (!client || daten == null) return daten;
  if (mitBunny()) return signiereMitBunny(client, daten, sekunden);

  const pfade = new Set();
  sammle(daten, pfade);
  if (pfade.size === 0) return daten;

  const karte = new Map();
  const jetzt = Date.now();
  const fehlend = [];
  for (const pfad of pfade) {
    const eintrag = zwischenspeicher.get(pfad);
    if (eintrag && eintrag.ablauf - PUFFER_MS > jetzt) {
      karte.set(pfad, eintrag.url);
    } else {
      fehlend.push(pfad);
    }
  }

  if (fehlend.length) {
    try {
      const { data, error } = await client.storage.from('media').createSignedUrls(fehlend, sekunden);
      if (error) throw error;
      const ablauf = jetzt + sekunden * 1000;
      for (const eintrag of data || []) {
        if (eintrag?.signedUrl && !eintrag.error) {
          karte.set(eintrag.path, eintrag.signedUrl);
          zwischenspeicher.set(eintrag.path, { url: eintrag.signedUrl, ablauf });
        }
      }
    } catch (fehler) {
      // Sichtbar machen, nicht verschlucken.
      console.error('Medienadressen unterschreiben fehlgeschlagen:', fehler.message);
      if (karte.size === 0) return daten;
    }
  }

  return ersetze(daten, karte);
}

function sammle(wert, pfade) {
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

function ersetze(wert, karte) {
  if (istMedienAdresse(wert)) {
    const p = pfadAus(wert);
    return (p && karte.get(p)) || wert;
  }
  if (Array.isArray(wert)) return wert.map((e) => ersetze(e, karte));
  if (wert && typeof wert === 'object') {
    const neu = {};
    for (const [schluessel, e] of Object.entries(wert)) neu[schluessel] = ersetze(e, karte);
    return neu;
  }
  return wert;
}

/*
 * Eine Aufnahme aus dem Browser in den Eimer `media` legen.
 *
 * WARUM ES DAS ERST SEIT DEM 09.09.2026 GIBT
 *
 * Die Website hatte ueberhaupt keinen Hochladeweg. `alsStorySetzen` in
 * web/public/app.js legte die Aufnahme in den `localStorage` und meldete
 * „Deine Story ist online" — sie war es nie. Niemand ausser diesem einen
 * Browser konnte sie sehen, und beim Leeren des Speichers war sie weg.
 * Genau derselbe Fehler stand bis zum 01.09.2026 in der App (siehe
 * app/lib/supabaseStorage.ts); dort wurde er behoben, hier nicht.
 *
 * Aufgefallen ist er beim Umbau der Story-Trennung: eine Frage „auch unter
 * Videos?" ist sinnlos, solange die Story nirgends ankommt.
 *
 * WAS HEREINKOMMT
 *
 * Eine Datenadresse (`data:image/jpeg;base64,…`) — das ist die Form, die
 * `bildVerkleinern` im Browser ohnehin erzeugt. Ein Dateiupload mit
 * `multipart` braeuchte eine zusaetzliche Bibliothek fuer nichts.
 *
 * ZURUECK GEHEN ZWEI ADRESSEN, und die Unterscheidung ist der Kern von
 * Fund 4 (oben):
 *   url      die bestaendige Form fuer die DATENBANK. Nicht abrufbar.
 *   anzeige  die unterschriebene, vier Stunden gueltig — fuer das Bild, das
 *            sofort erscheinen soll.
 * Wer die unterschriebene in die Datenbank schreibt, hat dort nach vier
 * Stunden eine tote Adresse stehen.
 */
const ORDNER = ['messages', 'stories', 'avatars', 'posts', 'insights', 'ptt'];

async function hochladen(client, nutzerId, ordner, datenadresse) {
  if (!client) return { ok: false, error: 'Nicht angemeldet' };
  if (!ORDNER.includes(ordner)) return { ok: false, error: 'Unbekannte Ablage' };

  const treffer = /^data:([\w/+.-]+);base64,(.+)$/.exec(String(datenadresse || ''));
  if (!treffer) return { ok: false, error: 'Das ist keine lesbare Aufnahme' };

  const typ = treffer[1];
  const inhalt = Buffer.from(treffer[2], 'base64');
  return ablegen(client, nutzerId, ordner, typ, inhalt);
}

/*
 * Ein Video als rohe Bytes ablegen (Kasten 15: Video-Storys der Website).
 *
 * WARUM NICHT AUCH ALS DATENADRESSE
 *
 * Eine Datenadresse ist ein Drittel größer als die Datei, und sie geht als
 * JSON durch `express.json` mit 2 MB Grenze. Ein Bild nach `bildVerkleinern`
 * passt da hinein, ein 60-s-Video (bis 50 MB) nicht. Darum kommt ein Video
 * als Körper mit seinem eigenen Inhaltstyp (express.raw in app.js) — ohne
 * Umweg über Base64 und ohne die Grenze für alle anderen Endpunkte
 * anzuheben.
 *
 * Erlaubt sind nur die Videotypen des Eimers (StoryRegeln.videoTyp); die
 * Größe prüft express.raw, die Länge der Browser vor dem Hochladen.
 */
async function hochladenVideo(client, nutzerId, ordner, mime, inhalt) {
  if (!client) return { ok: false, error: 'Nicht angemeldet' };
  if (!ORDNER.includes(ordner)) return { ok: false, error: 'Unbekannte Ablage' };
  const typ = StoryRegeln.videoTyp(mime);
  if (!typ) return { ok: false, error: StoryRegeln.videoPruefen({ mime: String(mime || 'unbekannt') }) };
  if (!Buffer.isBuffer(inhalt)) return { ok: false, error: 'Das ist keine lesbare Aufnahme' };
  const zuGross = StoryRegeln.videoPruefen({ bytes: inhalt.length });
  if (zuGross) return { ok: false, error: zuGross };
  return ablegen(client, nutzerId, ordner, typ, inhalt);
}

/** Der gemeinsame Teil: Datei in den Eimer, zwei Adressen zurück. */
async function ablegen(client, nutzerId, ordner, typ, inhalt) {
  if (mitBunny()) return bunnyAblegen(client, nutzerId, ordner, typ, inhalt);
  if (!inhalt.length) return { ok: false, error: 'Die Aufnahme ist leer' };

  /*
   * Die Endung entscheidet in App und Website, ob abgespielt wird
   * (istVideo: .mp4/.mov/.m4v/.webm). Bis Kasten 15 hieß jedes Video .mp4 —
   * auch ein WebM aus dem Browser; der Inhaltstyp stimmte, der Name nicht.
   */
  const endung =
    typ === 'image/png' ? 'png' : typ === 'image/webp' ? 'webp' : typ.startsWith('video/') ? StoryRegeln.videoEndung(typ) : 'jpg';
  /*
   * Zufallsteil im Namen — dieselbe Ueberlegung wie in
   * app/lib/supabaseStorage.ts: `<kennung>-<zeitstempel>` heisst, dass man
   * nur noch die Millisekunde raten muss.
   */
  const zufall = Math.random().toString(36).slice(2, 10);
  const pfad = `${ordner}/${nutzerId}-${Date.now()}-${zufall}.${endung}`;

  const { error } = await client.storage.from('media').upload(pfad, inhalt, {
    cacheControl: '3600',
    contentType: typ,
    upsert: false,
  });
  if (error) {
    // Sichtbar machen, nicht verschlucken: das Verschweigen war der Grund,
    // warum der Fehler in der App ein Vierteljahr unbemerkt blieb.
    console.error('Hochladen fehlgeschlagen:', error.message);
    return { ok: false, error: 'Die Aufnahme ließ sich nicht speichern' };
  }

  const { data } = client.storage.from('media').getPublicUrl(pfad);
  let anzeige = null;
  try {
    const { data: unterschrift } = await client.storage
      .from('media')
      .createSignedUrl(pfad, 4 * 60 * 60);
    anzeige = (unterschrift && unterschrift.signedUrl) || null;
  } catch (fehler) {
    console.error('Unterschreiben nach dem Hochladen fehlgeschlagen:', fehler.message);
  }

  return { ok: true, url: data.publicUrl, anzeige, pfad };
}

async function hochladenDatei(client, nutzerId, ordner, mime, inhalt, optionen) {
  if (!client || !nutzerId) return {ok:false,error:'Nicht angemeldet'};
  if (!ORDNER.includes(ordner) || !Buffer.isBuffer(inhalt)) return {ok:false,error:'Unbekannte Aufnahme'};
  const typ=String(mime || '').split(';')[0].toLowerCase();
  if (typ.startsWith('video/')) return hochladenVideo(client,nutzerId,ordner,typ,inhalt,optionen);
  if (!['image/jpeg','image/png','image/webp','audio/mp4'].includes(typ)) return {ok:false,error:'Dieses Dateiformat wird nicht unterstützt.'};
  if (inhalt.length>10*1024*1024 && typ.startsWith('image/')) return {ok:false,error:'Das Bild darf höchstens 10 MB groß sein.'};
  return ablegen(client,nutzerId,ordner,typ,inhalt,optionen);
}
async function signiereMitBunny(client,daten,sekunden) {
  const pfade=new Set();sammle(daten,pfade);const karte=new Map();
  const liste=[...pfade].filter(p=>!p.startsWith('instants/'));
  for(let i=0;i<liste.length;i+=500) {
    const {data,error}=await client.rpc('medien_leseliste',{p_pfade:liste.slice(i,i+500)});
    if(error) {
      if (error.code === 'PGRST202') {
        const {data:alt,error:e}=await client.storage.from('media').createSignedUrls(liste.slice(i,i+500),sekunden);
        if(!e)for(const z of alt || [])if(z.signedUrl&&!z.error)karte.set(z.path,z.signedUrl);
      }
      continue;
    }
    const alt=[];
    for(const z of data || []) {
      if(!pfade.has(z.pfad))continue;
      if(z.anbieter==='bunny') {const url=Bunny.signierteAdresse(z.pfad,sekunden);if(url)karte.set(z.pfad,url);}
      else if(z.anbieter==='supabase') {
        // Rechte wurden gerade erneut geprüft; nur die Signatur wiederverwenden.
        alt.push(z.pfad);
      }
    }
    if(alt.length) {
      const {data:signiert,error:e}=await client.storage.from('media').createSignedUrls(alt,sekunden);
      if(!e)for(const z of signiert || [])if(z.signedUrl&&!z.error) {
        karte.set(z.path,z.signedUrl);
        zwischenspeicher.set(z.path,{url:z.signedUrl,ablauf:Date.now()+sekunden*1000});
      }
    }
  }
  return ersetze(daten,karte);
}
async function unterschreiben(client,pfade) {
  if(!Array.isArray(pfade)||pfade.length>500)return {ok:false,error:'Ungültige Medienliste'};
  const gueltig=p=>!!Bunny.pfadPruefen(p,Bunny.ORDNER_LESEN)&&!p.startsWith('instants/');
  const basis=require('./supabase').supabaseUrl + OEFFENTLICH;
  const liste=pfade.filter(gueltig);
  const daten=await signiereMedien(client,liste.map(p=>basis+p));
  const signiert=new Map(liste.map((p,i)=>[p,daten[i]!==basis+p?daten[i]:null]));
  return {ok:true,dateien:pfade.map(p=>{
    const pfad=typeof p==='string'?p:null;
    const url=gueltig(p)?signiert.get(p):null;
    const eintrag=zwischenspeicher.get(pfad);
    const tokenAblauf=url?Number(new URL(url).searchParams.get('expires'))*1000:0;
    return {pfad,url,ablauf:url?(eintrag?.url===url?eintrag.ablauf:tokenAblauf||Date.now()+4*60*60*1000):null};
  })};
}

/** Bunny braucht einen dauerhaften Eigentumsbeleg. Ohne Schema 113 geschlossen bleiben. */
async function bunnyAblegen(client,nutzerId,ordner,typ,inhalt) {
  const {data:frei,error}=await client.rpc('medium_upload_erlaubt');
  if(error?.code==='PGRST202')return {ok:false,error:'Bunny-Upload benötigt die noch fehlende Datenbankfreigabe (Schema 113).'};
  if(error || frei!==true)return {ok:false,error:'Dieses Konto darf derzeit keine Medien hochladen.'};
  if(!process.env.SUPABASE_SERVICE_ROLE_KEY)return {ok:false,error:'Der Medienspeicher ist derzeit nicht vollständig eingerichtet.'};
  const {createClient}=require('@supabase/supabase-js');
  const {supabaseUrl}=require('./supabase');
  const dienst=createClient(supabaseUrl,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  // Auch den Metadatenvertrag vor dem ersten Datei-Byte prüfen.
  const {error:bereit}=await dienst.from('medien_objekte').select('pfad').limit(0);
  if(bereit)return {ok:false,error:'Die Medienablage ist noch nicht vorbereitet (Schema 113).'};
  const hoch=await Bunny.ablegen(nutzerId,ordner,typ,inhalt);
  if(!hoch.ok)return hoch;
  const {error:beleg}=await dienst.from('medien_objekte').insert({pfad:hoch.pfad,owner_id:nutzerId,typ,bytes:inhalt.length,sha256:require('crypto').createHash('sha256').update(inhalt).digest('hex')});
  if(beleg){await Bunny.loeschen(hoch.pfad);return {ok:false,error:'Die Aufnahme konnte nicht bestätigt werden.'};}
  return hoch;
}
async function loeschen(client,nutzerId,pfad) {
  if(!Bunny.pfadPruefen(pfad,Bunny.ORDNER_LESEN))return {ok:false,error:'Ungültige Datei'};
  if(mitBunny()) {
    const {data:anbieter,error}=await client.rpc('medium_loeschrecht',{p_pfad:pfad});
    if(error || !anbieter)return {ok:false,error:'Diese Datei darfst du nicht löschen oder die Datenbankfreigabe fehlt.'};
    if(anbieter==='bunny') {
      if(!process.env.SUPABASE_SERVICE_ROLE_KEY)return {ok:false,error:'Der Medienspeicher ist derzeit nicht vollständig eingerichtet.'};
      const {createClient}=require('@supabase/supabase-js');
      const dienst=createClient(require('./supabase').supabaseUrl,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
      const weg=await Bunny.loeschen(pfad);if(!weg.ok&&!weg.fehlt)return weg;
      const {error:e}=await dienst.from('medien_objekte').delete().eq('pfad',pfad).eq('owner_id',nutzerId);
      return e?{ok:false,error:'Löschung muss erneut bestätigt werden.'}:{ok:true};
    }
    if(anbieter!=='supabase')return {ok:false,error:'Unbekannte Ablage'};
  }
  const {error}=await client.storage.from('media').remove([pfad]);
  return error?{ok:false,error:'Datei nicht gelöscht'}:{ok:true};
}
module.exports = { mitBunny, hochladenDatei, unterschreiben, loeschen, signiereMedien, istMedienAdresse, pfadAus, hochladen, hochladenVideo };
