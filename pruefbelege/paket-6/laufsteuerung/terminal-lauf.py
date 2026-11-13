import os,sys,json,time,subprocess,datetime,urllib.request,shutil,fcntl
from pathlib import Path
W=Path('/Users/henrik.dikta/allmedia-wt-codex/paket-6-kuvert');O=W/'pruefbelege/paket-6'
H=Path('/Users/henrik.dikta/Library/CloudStorage/OneDrive-Persönlich/Business/AI/Henrik');A=H/'Claude/Uebergabe/ki-abgleich.sh'
lock=open(O/'sdk58-prueflauf.lock','a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
name=sys.argv[1];tests=sys.argv[2:];status=O/(name+'.json');log=O/(name+'.log');serverlog=O/(name+'-server.log');node=shutil.which('node')
assert tests and all('/' not in x and x.endswith(('.js','.cjs')) for x in tests)
env=dict(os.environ,KI_NAME='codex',AM_ENV_DATEI=str(H/'All-Media/app/.env.local'),AM_WEB_ENV_DATEI=str(H/'All-Media/web/.env.local'),AM_TOKEN_DATEI=str(H/'2.Gehirn.md/04 Ressourcen/Zugangsdaten/Supabase.md'))
d={'commit':'bb5963c','pid':os.getpid(),'parent':os.getppid(),'phase':'startet','tests':tests,'start':datetime.datetime.now(datetime.timezone.utc).isoformat()};server=None

def save():
 t=status.with_suffix('.tmp');t.write_text(json.dumps(d,indent=2)+'\n');t.replace(status)
def run(args):
 with log.open('a') as f:return subprocess.run(args,cwd=W,env=env,stdin=subprocess.DEVNULL,stdout=f,stderr=subprocess.STDOUT).returncode
save()
try:
 assert subprocess.check_output(['git','rev-parse','--short','HEAD'],cwd=W,text=True).strip()=='bb5963c','Quellstand nicht bb5963c'
 assert subprocess.run(['bash',str(A),'meine','testbestand'],cwd=W,env=env).returncode==0,'Testbestand nicht selbst belegt'
 assert not subprocess.run(['lsof','-nP','-tiTCP:3300','-sTCP:LISTEN'],capture_output=True,text=True).stdout.strip(),'Port3300 fremd belegt'
 with serverlog.open('a') as f:server=subprocess.Popen([node,str(W/'app/test/_paket6_server.cjs')],cwd=W,env=env,stdin=subprocess.DEVNULL,stdout=f,stderr=subprocess.STDOUT)
 d['server']=server.pid;save()
 for i in range(30):
  try:
   with urllib.request.urlopen('http://127.0.0.1:3300/api/version',timeout=2) as r:v=json.load(r)
   assert v.get('commit')=='bb5963c','Falsche Serverversion'
   break
  except (OSError,ValueError):time.sleep(.5)
 else:raise RuntimeError('Server wurde nicht bereit')
 d['vorbereinigung']=run([node,str(W/'app/test/_paket6_lauf.cjs'),'bereinigen']);save()
 assert d['vorbereinigung']==0,'Vorbereinigung fehlgeschlagen'
 subprocess.Popen(['/usr/bin/caffeinate','-i','-w',str(os.getpid())],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 d['phase']='laeuft';save();print('Paket6 bb5963c:',', '.join(tests),flush=True)
 d['code']=run([node,str(W/'app/test/_paket6_lauf.cjs'),*tests]);d['nachbereinigung']=run([node,str(W/'app/test/_paket6_lauf.cjs'),'bereinigen']);save()
except Exception as e:d.update(phase='fehler',fehler=str(e));save()
finally:
 if server is not None and server.poll() is None:
  server.terminate()
  try:server.wait(timeout=15)
  except subprocess.TimeoutExpired:server.kill();server.wait()
 d['server_beendet']=server is None or server.poll() is not None
 if d.get('nachbereinigung')==0:
  d['freigaben']={}
  for sache in ('testbestand','port-3300'):d['freigaben'][sache]=run(['bash',str(A),'freigeben','codex',sache])
  d['phase']='beendet'
 d['ende']=datetime.datetime.now(datetime.timezone.utc).isoformat();save();print('Abschluss gespeichert:',status,flush=True)
