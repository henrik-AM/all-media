(function (g, f) { if (typeof module === 'object' && module.exports)
    module.exports = f();
else
    g.Instants = f(); })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const TEXT_MAX = 100, BILD_MAX = 250 * 1024, SEITE_MAX = 1080, URL_SEKUNDEN = 60;
    const HINWEIS = 'Einmal im Postfach öffnen; ungeöffnet nach 24 Stunden weg. Bereits geladene Bilder und Bildschirmfotos lassen sich nicht zurückholen.';
    function pruefen(text, anzahl, bytes) { if (!Number.isInteger(anzahl) || anzahl < 1)
        return 'Lege zuerst Enge Freunde an.'; if (String(text || '').length > TEXT_MAX)
        return 'Die Bildunterschrift darf höchstens 100 Zeichen haben.'; if (bytes !== undefined && (!Number.isFinite(bytes) || bytes <= 0 || bytes > BILD_MAX))
        return 'Das Foto darf höchstens 250 KB groß sein.'; return null; }
    function masse(w, h) { const f = Math.min(1, SEITE_MAX / Math.max(w, h)); return { breite: Math.round(w * f), hoehe: Math.round(h * f) }; }
    function kameragroesse(groessen) { return (groessen || []).map(s => ({ s, werte: s.split('x').map(Number) })).filter(x => x.werte.length === 2 && x.werte.every(n => n > 0 && n <= SEITE_MAX)).sort((a, b) => b.werte[0] * b.werte[1] - a.werte[0] * a.werte[1])[0]?.s || null; }
    function sichtbar(i, jetzt) { return !i.geoeffnet_at && !i.blockiert && new Date(i.expires_at).getTime() > (jetzt || Date.now()); }
    return { TEXT_MAX, BILD_MAX, SEITE_MAX, URL_SEKUNDEN, HINWEIS, pruefen, masse, kameragroesse, sichtbar };
});
