const assert = require('node:assert/strict');
const I = require('../../gemeinsam/instants');
const D = require('../../gemeinsam/instantsdaten');
const M = require('../../web/server/medien');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
let n = 0;
const t = async (name, fn) => { await fn(); console.log(`OK ${++n} ${name}`); };
(async () => {
    await t('leere Liste gesperrt', () => assert.match(I.pruefen('', 0), /Enge Freunde/));
    await t('100 Zeichen erlaubt', () => assert.equal(I.pruefen('a'.repeat(100), 1, 200000), null));
    await t('101 Zeichen abgewiesen', () => assert.ok(I.pruefen('a'.repeat(101), 1, 1)));
    await t('Größengrenze 250 KB', () => assert.equal(I.pruefen('', 1, 256000), null));
    await t('Grenze überschritten', () => assert.ok(I.pruefen('', 1, 256001)));
    await t('leere Datei gesperrt', () => assert.ok(I.pruefen('', 1, 0)));
    await t('großes Foto proportional verkleinern', () => assert.deepEqual(I.masse(4000, 3000), { breite: 1080, hoehe: 810 }));
    await t('kleines Foto nicht aufblasen', () => assert.deepEqual(I.masse(640, 480), { breite: 640, hoehe: 480 }));
    await t('native Kamera nur Größe unter 1080', () => assert.equal(I.kameragroesse(['4000x3000', '1920x1080', '640x480', '800x600']), '800x600'));
    await t('keine passende Kameraauflösung', () => assert.equal(I.kameragroesse(['4000x3000']), null));
    const jetzt = Date.parse('2026-10-26T12:00:00Z');
    await t('ungeöffnet und frisch sichtbar', () => assert.equal(I.sichtbar({ expires_at: '2026-10-26T13:00:00Z' }, jetzt), true));
    await t('am Ablauf unsichtbar', () => assert.equal(I.sichtbar({ expires_at: '2026-10-26T12:00:00Z' }, jetzt), false));
    await t('geöffnet unsichtbar', () => assert.equal(I.sichtbar({ expires_at: '2026-10-26T13:00:00Z', geoeffnet_at: 'x' }, jetzt), false));
    await t('blockiert unsichtbar', () => assert.equal(I.sichtbar({ expires_at: '2026-10-26T13:00:00Z', blockiert: true }, jetzt), false));
    await t('abgelehntes DELETE wird als Fehler gemeldet', async () => {
        const q = { delete() { return this; }, eq() { return this; }, then(ok) { return Promise.resolve({ count: 0, error: null }).then(ok); } };
        await assert.rejects(() => D.freund({ from: () => q }, 'a', 'b', false), /entfernt/);
    });
    await t('bestätigtes DELETE erfolgreich', async () => {
        const q = { delete() { return this; }, eq() { return this; }, then(ok) { return Promise.resolve({ count: 1, error: null }).then(ok); } };
        await D.freund({ from: () => q }, 'a', 'b', false);
    });
    const pfad = 'instants/11111111-1111-4111-8111-111111111111/foto.jpg';
    const leser = erlaubt => ({from:()=>({select(){return this;},eq(){return this;},single:async()=>erlaubt?{data:{bild_pfad:pfad}}:{error:new Error('RLS verweigert')}})});
    await t('Web prüft RLS und signiert als Dienst nur 60 Sekunden', async () => {
        let ttl;
        const dienst = { storage: { from: () => ({ createSignedUrl: async (p, s) => { ttl = s; assert.equal(p, pfad); return { data: { signedUrl: 'lokal' }, error: null }; } }) } };
        assert.equal(await M.instantUnterschrift(leser(true), pfad, dienst), 'lokal');
        assert.equal(ttl, 60);
    });
    await t('RLS-Verweigerung erreicht Dienstsignatur niemals', async () => {
        const dienst = {storage:{from(){throw new Error('Darf nicht erreicht werden');}}};
        await assert.rejects(() => M.instantUnterschrift(leser(false), pfad, dienst), /nicht mehr verfügbar/);
    });
    await t('fehlender Dienstschlüssel scheitert geschlossen', async () => {
        const alt=process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        try { await assert.rejects(() => M.instantUnterschrift(leser(true),pfad), /derzeit nicht verfügbar/); }
        finally { if(alt!==undefined)process.env.SUPABASE_SERVICE_ROLE_KEY=alt; }
    });
    await t('falscher Medienpfad abgewiesen', () => assert.rejects(() => M.instantUnterschrift({}, 'posts/fremd.jpg')));
    function medienModul(fetch) {
        const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/medien.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
        const ex={};vm.runInNewContext(code,{exports:ex,require,module:{exports:ex},console,Map,WeakMap,Date,Set,process:{env:{}},fetch});return ex;
    }
    await t('App holt jede Instant-Adresse am kontrollierten Server mit Kontotoken', async () => {
        const anfragen=[];
        const ex=medienModul(async (url,optionen)=>{anfragen.push({url,optionen});return {ok:true,json:async()=>({bild:'url-'+anfragen.length})};});
        const c={auth:{getSession:async()=>({data:{session:{access_token:'a',user:{id:'a'}}}})},storage:{from(){throw new Error('Direkte Signatur verboten');}}};
        assert.equal(await ex.signiereEine(c,pfad),'url-1');assert.equal(await ex.signiereEine(c,pfad),'url-2');
        assert.equal(anfragen.length,2);assert.equal(anfragen[0].optionen.headers.Authorization,'Bearer a');
        assert.equal(anfragen[0].optionen.redirect,'error');
        assert.equal(JSON.parse(anfragen[0].optionen.body).pfad,pfad);
        assert.match(anfragen[0].url,/^https:\/\/all-media-website\.onrender\.com\/api\/instants\/signatur$/);
    });
    await t('Kontowechsel während Instant-Signatur verwirft das alte Bild', async () => {
        let token='a';
        const ex=medienModul(async ()=>{token='b';return {ok:true,json:async()=>({bild:'privates-altes-bild'})};});
        const c={auth:{getSession:async()=>({data:{session:{access_token:token,user:{id:token}}}})}};
        assert.equal(await ex.signiereEine(c,pfad),null);
    });
    await t('Serververweigerung wird nicht als Bild angezeigt', async () => {
        const ex=medienModul(async()=>({ok:false,json:async()=>({error:'verweigert'})}));
        const c={auth:{getSession:async()=>({data:{session:{access_token:'a',user:{id:'a'}}}})}};
        await assert.rejects(()=>ex.signiereEine(c,pfad),/nicht mehr verfügbar/);
    });
    await t('Badge liest nur eine Zahl', async () => {
        const c={rpc:async(name,args)=>{assert.equal(name,'instant_stand');assert.equal(args,undefined);return {data:1234};}};
        assert.equal(await D.stand(c),1234);
    });
    await t('Postfach lädt die nächste Seite gezielt', async () => {
        const c={rpc:async(name,args)=>{assert.equal(name,'instant_postfach');assert.deepEqual(args,{p_ab:50});return {data:[]};}};
        assert.deepEqual(await D.postfach(c,50),[]);
    });
    await t('Dateifehler löscht keine Metadaten', async () => {
        let bestaetigt = false;
        const c = { rpc: async (name) => { if (name === 'instant_loeschkandidaten')
                return { data: [{ id: 'i', bild_pfad: pfad }] }; bestaetigt = true; return {}; }, storage: { from: () => ({ remove: async () => ({ error: new Error('Speicher nicht erreichbar') }) }) } };
        await assert.rejects(() => M.instantsAufraeumen(c));
        assert.equal(bestaetigt, false);
    });
    await t('Datei zuerst löschen, dann Zeilen bestätigen; verwaiste Datei ohne ID', async () => {
        const aufrufe = [];
        const c = { rpc: async (name, args) => { aufrufe.push(name); if (name === 'instant_loeschkandidaten')
                return { data: [{ id: 'i', bild_pfad: pfad }, { id: null, bild_pfad: pfad + 'alt' }] }; assert.deepEqual(args.p_ids, ['i']); return {}; }, storage: { from: () => ({ remove: async () => { aufrufe.push('bytes'); return { error: null }; } }) } };
        assert.equal(await M.instantsAufraeumen(c), 2);
        assert.deepEqual(aufrufe, ['instant_loeschkandidaten', 'bytes', 'instant_loeschbestaetigen']);
    });
    console.log(`${n}/${n} Prüfungen bestanden`);
})().catch(e => { console.error(e); process.exit(1); });
