(function (g, f) { if (typeof module === 'object' && module.exports)
    module.exports = f();
else
    g.InstantsDaten = f(); })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    async function wert(p) { const { data, error } = await p; if (error)
        throw error; return data; }
    async function freunde(c, ich, suche) {
        const liste = await wert(c.from('enge_freunde').select('freund_id').eq('user_id', ich));
        const ids = (liste || []).map(f => f.freund_id);
        const freunde = ids.length ? await wert(c.from('profiles').select('id,name,handle').in('id', ids).order('name')) : [];
        const vorschlaege = String(suche || '').trim().length >= 2 ? await wert(c.rpc('enge_freunde_suche', { p_suche: suche })) : [];
        return { freunde: freunde || [], vorschlaege: vorschlaege || [] };
    }
    async function freund(c, ich, id, an) {
        if (an)
            return wert(c.from('enge_freunde').upsert({ user_id: ich, freund_id: id }, { onConflict: 'user_id,freund_id', ignoreDuplicates: true }));
        const { error, count } = await c.from('enge_freunde').delete({ count: 'exact' }).eq('user_id', ich).eq('freund_id', id);
        if (error)
            throw error;
        if (count !== 1)
            throw new Error('Eintrag konnte nicht entfernt werden.');
    }
    const empfaengerzahl = c => wert(c.rpc('instant_empfaengerzahl'));
    const stand = c => wert(c.rpc('instant_stand'));
    const postfach = (c, ab = 0) => wert(c.rpc('instant_postfach', { p_ab: ab }));
    const senden = (c, pfad, text) => wert(c.rpc('instant_senden', { p_pfad: pfad, p_text: text || '' }));
    const datei = (c, id) => wert(c.from('instants').select('bild_pfad,text').eq('id', id).single());
    const oeffnen = (c, id) => wert(c.rpc('instant_oeffnen', { p_id: id }));
    const zurueckziehen = (c, id) => wert(c.rpc('instant_zurueckziehen', { p_id: id }));
    const eigene = (c, ich, ab = 0) => wert(c.from('instants').select('id,text,expires_at').eq('absender', ich).order('created_at', { ascending: false }).order('id').range(ab, ab + 49));
    return { freunde, freund, empfaengerzahl, stand, postfach, senden, datei, oeffnen, zurueckziehen, eigene };
});
