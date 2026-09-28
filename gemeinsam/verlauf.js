/**
 * „Mein Verlauf" — was man selbst an Beiträgen getan hat, einmal für App und
 * Website.
 *
 * WARUM ES DAS GIBT
 *
 * Henrik am 21.09.2026 (Kasten 10.1): „Like, Kommentar, Teilen, Repost,
 * Speichern müssen synchronisiert werden: was ich auslöse, muss im Verlauf
 * unter meinem Profil sichtbar und gespeichert sein."
 *
 * Geschrieben wurde alles fünf schon, in App und Website. Gezeigt wurde es
 * verstreut und unvollständig:
 *   - Likes und Kommentare als Liste in den Einstellungen, mit Datum, aber
 *     nicht antippbar,
 *   - Reposts und Gespeichertes als Profilreiter, ohne Zeitpunkt,
 *   - Geteiltes nirgends.
 * Einen Verlauf — alles in zeitlicher Folge, mit Zeitpunkt, antippbar zum
 * Beitrag — gab es nicht.
 *
 * WARUM KEIN FÜNFTER PROFILREITER
 *
 * Der Prototyp zeigt dort genau vier (Raster, Repost, @, Gespeichert). Der
 * Verlauf steht deshalb im Profilmenü ☰ → Einstellungen → Videos, direkt über
 * „Gelikte Beiträge" und „Meine Kommentare", die dort schon wohnen.
 *
 * WARUM GEMEINSAM
 *
 * Sechs Abfragen, eine Zusammenführung, eine Zeilenregel. Zwei Fassungen davon
 * laufen auseinander, sobald eine angefasst wird — so geschehen bei Telefon,
 * Passwort und Kommentarzeile. Beide Seiten reichen hier ihren eigenen
 * Supabase-Client herein (App: angemeldeter Client, Website: req.db). Beide
 * sind supabase-js, die Abfragen sind also wörtlich dieselben.
 *
 * WARUM DIE UMD-HÜLLE
 *
 * Wie bei kommentar.js: die Prüfläufe legen den App-Code als blob:-Modul in
 * den Browser, dort gibt es kein `require`. Deshalb auch KEIN require auf
 * kommentar.js hier drin — die drei Ersatztexte stehen lieber zweimal.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node und Metro.
    module.exports = factory();
  } else {
    // Browser: als eigenes <script> eingebunden.
    global.Verlauf = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Die fünf Aktionen, in der Reihenfolge des Auftrags. */
  const ARTEN = ['like', 'kommentar', 'teilen', 'repost', 'speichern'];

  /** Was vor dem Beitrag steht. */
  const WORT = {
    like: 'Gefällt dir',
    kommentar: 'Kommentiert',
    teilen: 'Geteilt',
    repost: 'Repostet',
    speichern: 'Gespeichert',
  };

  /** Der Ersatz, wenn ein Beitrag weder Titel noch Beschreibung hat. */
  const ART = { post: 'Foto', reel: 'Video (Hochformat)', clip: 'Video' };

  /** Wie viele Zeilen je Quelle höchstens geholt werden. */
  const GRENZE = 200;

  const BEITRAG = 'id, kind, title, description';

  /** Titel, sonst Beschreibung, sonst die Art — wie gemeinsam/kommentar.js. */
  function beitragsName(b) {
    const text = ((b && (b.title || b.description)) || '').trim();
    return text || ART[b && b.kind] || 'Beitrag';
  }

  function eintrag(art, beitrag, wann, detail, schluessel) {
    return {
      schluessel: art + ':' + schluessel,
      art: art,
      beitragId: beitrag.id,
      kind: beitrag.kind,
      titel: beitragsName(beitrag),
      detail: detail || '',
      wann: wann,
    };
  }

  function namensliste(namen) {
    const eindeutig = [];
    for (const n of namen) if (n && !eindeutig.includes(n)) eindeutig.push(n);
    if (eindeutig.length <= 3) return eindeutig.join(', ');
    return eindeutig.slice(0, 3).join(', ') + ' und ' + (eindeutig.length - 3) + ' weitere';
  }

  /**
   * Die Rohzeilen der sechs Quellen zu einer Liste, neueste zuerst.
   *
   * Zeilen ohne lesbaren Beitrag fallen heraus: sie haben keinen Ort, auf den
   * sie zeigen könnten (gelöscht oder unsichtbar geworden).
   *
   * Teilen an mehrere Personen auf einmal legt je Person eine `shares`-Zeile
   * mit demselben Zeitpunkt an. Das ist EINE Handlung und wird zu einer Zeile
   * zusammengefasst: „Geteilt an Anna, Ben".
   */
  function zusammenfuehren(roh) {
    const r = roh || {};
    const liste = [];

    for (const z of r.likes || []) {
      if (z.posts) liste.push(eintrag('like', z.posts, z.created_at, '', z.post_id));
    }
    for (const z of r.kommentare || []) {
      if (z.posts) liste.push(eintrag('kommentar', z.posts, z.created_at, (z.text || '').trim(), z.id));
    }

    const geteilt = new Map();
    for (const z of r.geteilt || []) {
      if (!z.posts) continue;
      const k = z.post_id + '@' + z.created_at;
      if (!geteilt.has(k)) geteilt.set(k, { z: z, namen: [] });
      const empf = z.profiles || {};
      geteilt.get(k).namen.push(empf.name || (empf.handle ? '@' + empf.handle : ''));
    }
    for (const [k, g] of geteilt) {
      const an = namensliste(g.namen);
      liste.push(eintrag('teilen', g.z.posts, g.z.created_at, an ? 'an ' + an : '', k));
    }

    for (const z of r.kanal || []) {
      if (!z.posts) continue;
      const kanal = z.community_channels || {};
      const community = (kanal.communities && kanal.communities.name) || kanal.name || '';
      liste.push(eintrag('teilen', z.posts, z.created_at, community ? 'in ' + community : 'in einer Community', z.id));
    }

    for (const z of r.reposts || []) {
      if (z.posts) liste.push(eintrag('repost', z.posts, z.created_at, '', z.post_id));
    }
    for (const z of r.gespeichert || []) {
      if (z.posts) liste.push(eintrag('speichern', z.posts, z.created_at, '', z.post_id));
    }

    // Neueste zuerst. Gleicher Zeitpunkt: feste Reihenfolge der Arten, damit
    // App und Website dieselbe Liste zeigen.
    liste.sort((a, b) => {
      const d = String(b.wann || '').localeCompare(String(a.wann || ''));
      if (d !== 0) return d;
      const x = ARTEN.indexOf(a.art) - ARTEN.indexOf(b.art);
      return x !== 0 ? x : a.schluessel.localeCompare(b.schluessel);
    });
    return liste;
  }

  /**
   * Die sechs Abfragen — jede nur auf die eigene Kennung.
   *
   * Absichtlich kein `?user=`: was jemand speichert, liked oder teilt, geht
   * niemanden sonst etwas an. Die Leseregeln auf saves und shares sehen das
   * genauso.
   *
   * Eine einzelne fehlgeschlagene Quelle bricht den Verlauf ab (Fehler wird
   * geworfen). Eine stille Lücke sähe aus wie „nichts getan" — genau der
   * Eindruck, über den Henrik sich beschwert hat.
   */
  async function laden(client, ichId, grenze) {
    if (!ichId) return [];
    const n = grenze || GRENZE;
    const neueste = (q) => q.order('created_at', { ascending: false }).limit(n);

    const antworten = await Promise.all([
      neueste(client.from('post_likes').select('post_id, created_at, posts!post_id(' + BEITRAG + ')').eq('user_id', ichId)),
      neueste(client.from('comments').select('id, text, created_at, post_id, posts!post_id(' + BEITRAG + ')').eq('user_id', ichId)),
      // shares hat zwei Fremdschlüssel auf profiles — über die Spalte auflösen.
      neueste(client.from('shares').select('id, post_id, created_at, posts!post_id(' + BEITRAG + '), profiles!shared_to(name, handle)').eq('shared_by', ichId)),
      // Teilen in eine Community legt keine shares-Zeile an, sondern eine
      // Kanalnachricht mit shared_post_id (Schema 59).
      neueste(client.from('community_channel_messages')
        .select('id, created_at, shared_post_id, posts!shared_post_id(' + BEITRAG + '), community_channels!channel_id(name, communities!community_id(name))')
        .eq('sender_id', ichId)
        .not('shared_post_id', 'is', null)),
      neueste(client.from('reposts').select('post_id, created_at, posts!post_id(' + BEITRAG + ')').eq('user_id', ichId)),
      neueste(client.from('saves').select('post_id, created_at, posts!post_id(' + BEITRAG + ')').eq('user_id', ichId)),
    ]);

    for (const a of antworten) if (a.error) throw a.error;
    const [likes, kommentare, geteilt, kanal, reposts, gespeichert] = antworten.map((a) => a.data || []);
    return zusammenfuehren({ likes, kommentare, geteilt, kanal, reposts, gespeichert });
  }

  const zwei = (x) => (x < 10 ? '0' : '') + x;

  /**
   * Datum und Uhrzeit, von Hand statt toLocaleString — Hermes und die Browser
   * formatieren das unterschiedlich, und dann stünde in App und Website nicht
   * dasselbe.
   */
  function zeit(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return zwei(d.getDate()) + '.' + zwei(d.getMonth() + 1) + '.' + d.getFullYear() +
      ', ' + zwei(d.getHours()) + ':' + zwei(d.getMinutes());
  }

  /** Die Zeile: `Gespeichert · Titel`, `Geteilt an Anna · Titel`, `Kommentiert „…" · Titel`. */
  function zeile(e) {
    const wort = WORT[e.art] || e.art;
    if (e.art === 'kommentar' && e.detail) return wort + ' „' + e.detail + '" · ' + e.titel;
    if (e.art === 'teilen' && e.detail) return wort + ' ' + e.detail + ' · ' + e.titel;
    return wort + ' · ' + e.titel;
  }

  /** Wohin Antippen führt — dieselben drei Ziele wie kachelOeffnen() in App.tsx. */
  function ziel(e) {
    return e.kind === 'clip' ? 'clip' : e.kind === 'reel' ? 'reel' : 'beitrag';
  }

  return {
    ARTEN: ARTEN,
    WORT: WORT,
    GRENZE: GRENZE,
    beitragsName: beitragsName,
    zusammenfuehren: zusammenfuehren,
    laden: laden,
    zeit: zeit,
    zeile: zeile,
    ziel: ziel,
  };
});
