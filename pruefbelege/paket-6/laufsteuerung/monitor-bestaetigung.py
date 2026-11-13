import json
from pathlib import Path
w=Path(__file__).resolve().parents[3];o=w/'pruefbelege/paket-6'
p=w/'app/test/.gesamtlauf-belege/f117d6fb-083e-4273-9a7e-5a137c028e49/status.json'
c=json.loads((o/'sdk58-terminal-gesamt-bestaetigung-13-11.json').read_text());s=json.loads(p.read_text());e=s['ergebnisse'];q=max(p.parent.glob('*.log'),key=lambda p:p.stat().st_mtime);lines=q.read_text(errors='replace').strip().splitlines()
print(json.dumps({'prozess':c.get('phase'),'freigaben':c.get('freigaben'),'laeufe':len(e),'erwartet':s['erwartet'],'phase':s.get('phase'),'code':s.get('code'),'bereinigung':s.get('bereinigung'),'quellenUnveraendert':s.get('quellenUnveraendert'),'letzte':e[-2:],'rot':[x['name'] for x in e if x['code']!=0 or not x.get('zahlen') or x['zahlen']['gut']!=x['zahlen']['gesamt']],'ohne_zaehlbare':[x['name'] for x in e if not x.get('zahlen') or x['zahlen']['gesamt']==0],'aktuell':q.stem,'fortschritt':lines[-3:]},ensure_ascii=False))
