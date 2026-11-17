"""Nur nach beiden beendeten Paket6-Prüfungen und Fixture-Rest0 starten."""
import pathlib,time,subprocess,json
r=pathlib.Path(__file__).resolve().parents[2];o=pathlib.Path(__file__).parent;p6=r/'pruefbelege/paket67-p6'
# Aktuelle Einzelabnahmen werden vor dem bewussten Aufruf geprüft und belegt.
# Der Vollnachweis selbst prüft Belegung, Prozesssperre, Server und Quellgleichheit.
(o/'gesamtlauf-exit.txt').unlink(missing_ok=True)
with open(o/'gesamtlauf.log','w') as f:
    p=subprocess.Popen(['node','pruefbelege/paket67-abschluss/gesamt-lauf.cjs'],cwd=r,stdin=subprocess.DEVNULL,stdout=f,stderr=f,start_new_session=True)
    (o/'gesamtlauf-prozess.json').write_text(json.dumps({'pid':p.pid,'quellcommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=r,text=True).strip()}))
    subprocess.Popen(['caffeinate','-d','-s','-i','-w',str(p.pid)],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
    code=p.wait()
    (o/'gesamtlauf-exit.txt').write_text(str(code))
