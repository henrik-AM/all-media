import pathlib,subprocess,json,time,urllib.request,os,re
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=pathlib.Path(__file__).parent;ENV={**os.environ,'SIM_GERAET':'All-Media Codex'};SIM='5210E675-C198-4328-B3E2-30FCE9E0F624';gut=0

def api(art,d={}):
 r=urllib.request.Request('http://127.0.0.1:3302/'+art,data=json.dumps(d).encode(),headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(r,timeout=25) as z:return json.load(z)
def cmd(art,**d):return api('cmd',{'art':art,**d})
def wait(fn,sec=30):
 end=time.time()+sec
 while time.time()<end:
  try:
   r=fn()
   if r:return r
  except Exception:pass
  time.sleep(.2)
 raise AssertionError('Native Erwartung fehlt')
def sh(args):return subprocess.check_output(args,cwd=ROOT/'app',env=ENV,text=True,stderr=subprocess.PIPE,timeout=35)
def tip(t):
 x=sh(['node','tools/tippen.js','--liste',t]);rows=re.findall(r'^\s*(\d+)\. \[(?:GenericElement)\] (.+)$' if t=='Zurück' else r'^\s*(\d+)\. \[(?:Button|GenericElement)\] (.+)$',x,re.M);assert len(rows)==1,x;print(sh(['node','tools/tippen.js',t,'--nr',rows[0][0],'--bewusst']),flush=True)
def labels():
 x=json.loads(sh(['axe','describe-ui','--udid',SIM]));out=[]
 def walk(xs):
  for z in xs:out.append(z.get('AXLabel') or '');walk(z.get('children',[]))
 walk(x);return '\n'.join(out)
def check(t,b=True):
 global gut
 assert b,t;gut+=1;print('OK',t,flush=True)
def bild(n):sh(['xcrun','simctl','io',SIM,'screenshot',str(OUT/n)])
paar=api('paar');ergebnisse=[];cmd('gruppe',wert=False)
for i in [0,1]:
 sh(['xcrun','simctl','terminate',SIM,'host.exp.Exponent']);sh(['xcrun','simctl','openurl',SIM,'exp://127.0.0.1:3301']);time.sleep(3)
 cmd('konto',index=i);wait(lambda:cmd('lesen').get('geladen'),45);time.sleep(.5);tip('Verschlüsselung');txt=wait(lambda:(lambda t:t if 'Gemeinsame Sicherheitsnummer' in t else None)(labels()))
 check('Native Paar-Sicherheitsnummer für Konto '+str(i)+' entspricht beiden Live-Gerätelisten',paar['nummer'] in txt)
 check('Lokaler Fingerabdruck und getrennte Listen bei Konto '+str(i),all(t in txt for t in ['Lokaler Fingerabdruck dieses Geräts','Deine registrierten Geräteschlüssel','Geräteschlüssel des Gegenübers']))
 bild('paar-konto-'+str(i)+'.png');ergebnisse.append({'konto':i,'gleich':paar['nummer'] in txt,'geraete':paar['geraete']});tip('Zurück');check('Langes Verschlüsselungsblatt schließt per sichtbarem Zurück bei Konto '+str(i),'Gemeinsame Sicherheitsnummer' not in labels())
cmd('konto',index=0);wait(lambda:cmd('lesen').get('geladen'),45)
(OUT/'native-paar-ergebnis.json').write_text(json.dumps({'gut':gut,'gesamt':gut,'ergebnisse':ergebnisse},indent=2));print(f'{gut}/{gut} native Paarprüfungen',flush=True)
