import os,json,time,subprocess,urllib.request,shutil,fcntl
from pathlib import Path
W=Path('/Users/henrik.dikta/allmedia-wt-codex/paket-6-kuvert');H=Path('/Users/henrik.dikta/Library/CloudStorage/OneDrive-Persönlich/Business/AI/Henrik');O=W/'pruefbelege/paket-6';A=H/'Claude/Uebergabe/ki-abgleich.sh'
lock=open(O/'sdk58-prueflauf.lock','a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
env=dict(os.environ,KI_NAME='codex',AM_ENV_DATEI=str(H/'All-Media/app/.env.local'),AM_WEB_ENV_DATEI=str(H/'All-Media/web/.env.local'),ZIEL='http://127.0.0.1:3300',__UNSAFE_EXPO_HOME_DIRECTORY='/private/tmp/paket6-sdk58-expo',EXPO_NO_TELEMETRY='1',CI='1')
node=shutil.which('node');status=O/'sdk58-native-terminal.json';d={'phase':'startet','pid':os.getpid(),'prozesse':{}};ps=[]
def save():status.write_text(json.dumps(d,indent=2)+'\n')
def start(name,args,cwd):
 f=open(O/('sdk58-native-'+name+'.log'),'a');p=subprocess.Popen(args,cwd=cwd,env=env,stdin=subprocess.DEVNULL,stdout=f,stderr=subprocess.STDOUT);ps.append(p);d['prozesse'][name]=p.pid;save();return p
save()
try:
 for port in [3300,3301,3302]:assert not subprocess.run(['lsof','-tiTCP:'+str(port),'-sTCP:LISTEN'],capture_output=True,text=True).stdout.strip(),'Port belegt'
 server=start('server',[node,str(W/'app/test/_paket6_server.cjs')],W)
 for i in range(60):
  try:
   urllib.request.urlopen('http://127.0.0.1:3300/api/version',timeout=2).close();break
  except OSError:time.sleep(.5)
 else:raise RuntimeError('Server nicht bereit')
 metro=start('metro',[node,str(W/'app/node_modules/expo/bin/cli'),'start','--localhost','--port','3301'],W/'app/test/paket6-live-native')
 native=start('bruecke',[node,str(W/'app/test/_paket6_native_live.cjs')],W)
 subprocess.Popen(['/usr/bin/caffeinate','-i','-w',str(os.getpid())],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 d['phase']='laeuft';save();d['code']=native.wait();d['phase']='beendet';save()
except Exception as e:d.update(phase='fehler',fehler=str(e));save()
finally:
 for p in reversed(ps):
  if p.poll() is None:
   p.terminate()
   try:p.wait(timeout=15)
   except subprocess.TimeoutExpired:p.kill();p.wait()
 d['prozesse_beendet']=all(p.poll() is not None for p in ps);save()
