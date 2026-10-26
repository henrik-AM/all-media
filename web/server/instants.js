const D = require('../../gemeinsam/instantsdaten');
const M = require('./medien');
function einhaengen(app, route) {
    app.use('/api/instants', (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
    app.get('/api/enge-freunde', route(async (req) => ({ ...await D.freunde(req.db, req.nutzerId, String(req.query.suche || '')), empfaengerzahl: await D.empfaengerzahl(req.db) })));
    app.post('/api/enge-freunde', route(async (req) => { await D.freund(req.db, req.nutzerId, String(req.body.id), req.body.an === true); return { ok: true }; }));
    const seite = v => Math.max(0, Math.min(100000, Math.floor(Number(v) || 0)));
    app.get('/api/instants/stand', route(async (req) => ({ ungeoeffnet: await D.stand(req.db) })));
    app.get('/api/instants', route(async (req) => ({ postfach: await D.postfach(req.db, seite(req.query.postfachAb)), eigene: await D.eigene(req.db, req.nutzerId, seite(req.query.eigeneAb)) })));
    app.post('/api/instants/signatur', route(async (req) => ({ bild: await M.instantUnterschrift(req.db, String(req.body.pfad || '')) })));
    app.post('/api/instants', route(async (req) => ({ ok: true, id: await D.senden(req.db, String(req.body.pfad || ''), String(req.body.text || '')) })));
    app.get('/api/instants/:id/bild', route(async (req) => {
        const zeile = await D.datei(req.db, req.params.id);
        return { bild: await M.instantUnterschrift(req.db, zeile.bild_pfad), text: zeile.text };
    }));
    app.post('/api/instants/:id/gesehen', route(async (req) => ({ ok: await D.oeffnen(req.db, req.params.id) })));
    app.post('/api/instants/:id/zurueckziehen', route(async (req) => { await D.zurueckziehen(req.db, req.params.id); return { ok: true }; }));
}
// Aktivierung erst bei Auslieferung, weder lokal noch mit öffentlichem Schlüssel.
function arbeiterStarten() {
    if (process.env.INSTANTS_BEREINIGUNG !== 'an' || !process.env.SUPABASE_SERVICE_ROLE_KEY)
        return null;
    const { createClient } = require('@supabase/supabase-js');
    const { supabaseUrl } = require('./supabase');
    const c = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    let laeuft = false;
    const lauf = async () => { if (laeuft)
        return; laeuft = true; try {
        await M.instantsAufraeumen(c);
    }
    catch (e) {
        console.error('Instant-Bereinigung fehlgeschlagen:', e.message);
    }
    finally {
        laeuft = false;
    } };
    const timer = setInterval(lauf, 60 * 60 * 1000);
    timer.unref();
    void lauf();
    return timer;
}
module.exports = { einhaengen, arbeiterStarten };
