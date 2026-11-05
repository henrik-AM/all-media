#!/usr/bin/env node
// Gegenprobe zu _probe_paket1.js: Prüfkonto schreibt als Mitglied ins Unterthema,
// mit den Schemas aus SCHEMAS=88,89,… (leer = live-Stand). Verworfen, nichts bleibt.
const fs = require('fs');
const path = require('path');
const { frage } = require('./_aufraeumen');
const W = path.join(__dirname, '..', '..');
const P = '62616c1d-82e2-4ee4-aab9-950e40e438a4', T = '3baafacd-bbdb-40fb-8ef4-a4e365ae00c4';
const C = '88888888-0000-4000-8000-0000000000c1', K = '88888888-0000-4000-8000-0000000000c2';
const nummern = (process.env.SCHEMAS || '').split(',').filter(Boolean);
const dateien = fs.readdirSync(W).filter((d) => /^SUPABASE_SCHEMA_\d+_.*\.sql$/.test(d) && nummern.includes(d.match(/_(\d+)_/)[1]))
  .sort((a, b) => nummern.indexOf(a.match(/_(\d+)_/)[1]) - nummern.indexOf(b.match(/_(\d+)_/)[1]));
(async () => {
  const sql = `begin;
${dateien.map((d) => fs.readFileSync(path.join(W, d), 'utf8')).join('\n')}
insert into public.communities (id, name, topic, visibility, created_by) values ('${C}', 'Probe R', 'x', 'public', '${T}');
insert into public.community_members (community_id, user_id) values ('${C}', '${T}'), ('${C}', '${P}') on conflict do nothing;
insert into public.community_channels (id, community_id, slug, name) values ('${K}', '${C}', 'r', 'R');
select set_config('request.jwt.claims', '{"sub":"${P}","role":"authenticated"}', true), set_config('request.jwt.claim.sub', '${P}', true);
set local role authenticated;
do $p$ begin
  begin insert into public.community_channel_messages (channel_id, sender_id, text) values ('${K}', auth.uid(), 'hallo');
    raise exception 'ERG:ok';
  exception when others then
    if sqlerrm like 'ERG:%' then raise; end if;
    raise exception 'ERG:% %', sqlstate, sqlerrm;
  end;
end $p$;`;
  const t = JSON.stringify(await frage(sql));
  console.log('Schemas [' + (dateien.join(', ') || 'keine') + ']: ' + ((t.match(/ERG:(.*?)(\\n|")/) || [])[1] || t.slice(0, 400)));
})();
