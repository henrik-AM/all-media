"""Bewusster Einzelaufruf nach Auswertung des vollständig beendeten Vollnachweises."""
import pathlib, subprocess, json, sys
r=pathlib.Path(__file__).resolve().parents[2];o=pathlib.Path(__file__).parent
with open(o/'gezielt.log','w') as f:
    p=subprocess.Popen(['node',str(o/'gezielt-lauf.cjs'),sys.argv[1]],cwd=r,stdin=subprocess.DEVNULL,stdout=f,stderr=f,start_new_session=True)
    (o/'gezielt-prozess.json').write_text(json.dumps({'pid':p.pid,'quellcommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=r,text=True).strip()}))
    subprocess.Popen(['caffeinate','-d','-s','-i','-w',str(p.pid)],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
    (o/'gezielt-exit.txt').write_text(str(p.wait()))
