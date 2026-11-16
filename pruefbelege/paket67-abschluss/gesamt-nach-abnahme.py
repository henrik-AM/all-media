"""Nur nach beiden beendeten Paket6-Prüfungen und Fixture-Rest0 starten."""
import pathlib,time,subprocess,json
r=pathlib.Path(__file__).resolve().parents[2];o=pathlib.Path(__file__).parent;p6=r/'pruefbelege/paket67-p6'
for i in range(1800):
    ps=[p6/(n+'.exit') for n in ['_paket6_browser_offline.cjs','_paket6_live.cjs']]
    if all(p.exists() for p in ps):
        assert all(p.read_text()=='0' for p in ps),'Paket6-Liveabnahme noch rot'
        assert json.loads((p6/'live/live-fixtures.json').read_text()).get('rest')==0,'Paket6-Reste offen'
        break
    time.sleep(1)
else:
    raise RuntimeError('Paket6-Abnahme nicht fertig')
with open(o/'gesamtlauf.log','w') as f:
    p=subprocess.Popen(['node','pruefbelege/paket67-abschluss/gesamt-lauf.cjs'],cwd=r,stdin=subprocess.DEVNULL,stdout=f,stderr=f,start_new_session=True)
    (o/'gesamtlauf-prozess.json').write_text(json.dumps({'pid':p.pid,'quellcommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=r,text=True).strip()}))
    subprocess.Popen(['caffeinate','-i','-w',str(p.pid)],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
    code=p.wait()
    (o/'gesamtlauf-exit.txt').write_text(str(code))
