"""Native Original-Chatkomponenten: A/B aktiv, echte Website als Gegenstelle.
Nur All-Media Codex. UI-Ziele ausschließlich beschriftet über tippen.js.
"""
import subprocess,json,pathlib,time,os,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[2];APP=ROOT/'app';OUT=ROOT/'pruefbelege/paket-7'
SIM='/Applications/Xcode.app/Contents/Developer/usr/bin/simctl';UDID='5210E675-C198-4328-B3E2-30FCE9E0F624';ENV={**os.environ,'SIM_GERAET':'All-Media Codex'}
ok=0

def cmd(args,timeout=35):return subprocess.check_output(args,cwd=APP,env=ENV,text=True,stderr=subprocess.PIPE,timeout=timeout)
def api(art,d={}):
 req=urllib.request.Request('http://127.0.0.1:3302/'+art,data=json.dumps(d).encode(),headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=15) as r:return json.load(r)
def ui():
 data=json.loads(cmd(['axe','describe-ui','--udid',UDID]));rows=[]
 def walk(xs):
  for x in xs:rows.append(x);walk(x.get('children',[]))
 walk(data);return rows
def hat(text):return any(text in (x.get('AXLabel') or '') for x in ui())
def warte(text,limit=25):
 ab=time.time()
 while time.time()-ab<limit:
  if hat(text):return int((time.time()-ab)*1000)
  time.sleep(.12)
 raise RuntimeError('Native Text fehlt: '+text)
def tap(text):
 args=['node','tools/tippen.js',text,'--bewusst']
 if text in ['Konto A','Konto B','Gruppe','Zweierchat','Tastatur schließen']:
  liste=cmd(['node','tools/tippen.js','--liste',text]);import re
  nr=re.findall(r'^\s*(\d+)\. \[Button\] '+re.escape(json.dumps(text,ensure_ascii=False)),liste,re.M);assert len(nr)==1,liste;args+=['--nr',nr[0]]
 if text=='Nachricht':
  liste=cmd(['node','tools/tippen.js','--liste',text]);import re
  nr=re.findall(r'^\s*(\d+)\. \[TextArea\]',liste,re.M);assert len(nr)==1,liste;args+=['--nr',nr[0]]
 print(cmd(args).strip(),flush=True)
def senden(text):
 tap('Nachricht');cmd(['axe','type',text,'--udid',UDID]);tap('Tastatur schließen');ab=int(time.time()*1000);tap('Senden');warte(text);return ab
def check(t,b=True):
 global ok
 assert b,t;ok+=1;print('OK '+t,flush=True)
def bild(name):cmd([SIM,'io',UDID,'screenshot',str(OUT/name)])

warte('Paket 7 bereit',90);check('Zwei native Geräte mit getrennten Original-Chatkomponenten bereit')
for gruppe in [False,True]:
 art='Gruppe' if gruppe else 'Chiffre';tap('Gruppe' if gruppe else 'Zweierchat');tap('Konto A');api('mode',{'gruppe':gruppe})
 # Beide native Instanzen bleiben eingehängt; nur die Anzeige wechselt.
 text='Native A an B '+art;ab=senden(text);r=api('seen',{'index':1,'text':text,'ab':ab,'gruppe':gruppe});check('Native A an echte Website B '+art,r['ok'])
 tap('Konto B');warte(text,3);check('Native B liest Native A ohne Neuöffnung '+art);bild('native-B-'+art+'.png')
 text='Native B an A '+art;ab=senden(text);r=api('seen',{'index':0,'text':text,'ab':ab,'gruppe':gruppe});check('Native B an echte Website A '+art,r['ok'])
 tap('Konto A');warte(text,3);check('Native A liest Native B ohne Neuöffnung '+art)
 text='Website B an Native A '+art;ab=int(time.time()*1000);api('websend',{'index':1,'gruppe':gruppe,'text':text});warte(text,3);check('Echte Website an Native A '+art,int(time.time()*1000)-ab<3000);bild('native-A-'+art+'.png')
tap('Zweierchat');tap('Konto A');api('mode',{'gruppe':False});api('spaet');time.sleep(3);ab=time.time();api('nachreichen');warte('Kuvert nach Klingel angekommen',4);check('Nachgeliefertes Kuvert heilt per eigener Klingel',time.time()-ab<4);bild('native-kuvert.png')
tap('Gruppe');api('mode',{'gruppe':True})
# Funkloch-/Hintergrund-Nachholen am echten AppState, keine Chat-Neuöffnung.
cmd([SIM,'launch',UDID,'com.apple.mobilesafari']);text='Während Hintergrund angekommen';api('websend',{'index':1,'gruppe':True,'text':text});ab=time.time();cmd([SIM,'launch',UDID,'host.exp.Exponent']);warte(text,5);check('Hintergrund-Rückkehr lädt tatsächliche Nachricht nach',time.time()-ab<5);bild('native-hintergrund.png')
r=api('fertig');check('Backend bestätigt verschlüsselte Zweierchats und Klartextgruppen',r['ok']);print(f'{ok}/{ok} native Plattformprüfungen',flush=True)
