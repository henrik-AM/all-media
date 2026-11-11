"""Echte App-Bildschirme im gesonderten Offline-Prüfstand bedienen.
Kein Live-Login: nur All-Media Codex, nur über beschriftete Treffer.
Vorher Metro im Prüfstand starten und dessen Projekt in Expo Go öffnen.
"""
import subprocess,os,json,time,pathlib,re
ROOT=pathlib.Path(__file__).resolve().parents[2];APP=ROOT/'app';OUT=ROOT/'pruefbelege/paket-6'
SIM='/Applications/Xcode.app/Contents/Developer/usr/bin/simctl'
raw=json.loads(subprocess.check_output([SIM,'list','devices','available','--json'],text=True))
ger=[g for xs in raw['devices'].values() for g in xs if g['name']=='All-Media Codex']
assert len(ger)==1 and ger[0]['state']=='Booted','Eigenes Prüfgerät nicht eindeutig gestartet'
UDID=ger[0]['udid'];env={**os.environ,'SIM_GERAET':'All-Media Codex'};ok=0

def cmd(a):
 r=subprocess.run(a,cwd=APP,env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=35)
 if r.returncode:raise RuntimeError(' '.join(a[:3])+': '+r.stdout+r.stderr)
 return r.stdout

def ui():
 data=json.loads(cmd(['axe','describe-ui','--udid',UDID]));rows=[]
 def walk(xs):
  for x in xs:rows.append(x);walk(x.get('children',[]))
 walk(data);return rows

def label(rows,t):return any(t in (x.get('AXLabel') or '') for x in rows)
def tap(text):
 args=['node','tools/tippen.js',text,'--bewusst']
 if text=='Nachricht':
  liste=cmd(['node','tools/tippen.js','--liste',text]);felder=re.findall(r'^\s*(\d+)\. \[TextArea\]',liste,re.M)
  assert len(felder)==1,'Eingabefeld nicht eindeutig: '+liste;args+=['--nr',felder[0]]
 print(cmd(args).strip(),flush=True)

def wait(pred):
 for _ in range(30):
  rows=ui()
  if pred(rows):return rows
  time.sleep(.3)
 raise RuntimeError('UI-Erwartung nicht erreicht: '+str([(r.get('AXLabel'),r.get('AXValue')) for r in rows if r.get('AXLabel') or r.get('AXValue')]))

def bild(name):cmd([SIM,'io',UDID,'screenshot',str(OUT/name)])
def pruefe(text,wahr):
 global ok
 assert wahr,text;ok+=1;print('OK '+text,flush=True)

def eingeben(text):
 tap('Nachricht');cmd(['axe','type',text,'--udid',UDID]);wait(lambda r:any(x.get('type')=='TextArea' and x.get('AXValue')==text for x in r))
 tap('Tastatur schließen');tap('Senden')

rows=wait(lambda r:label(r,'OFFLINE · Paket 6'))
pruefe('Eigener nativer Offline-Prüfstand mit App-Chat sichtbar',label(rows,'Prüfstand Chat'))
rows=wait(lambda r:label(r,'Absender nicht prüfbar'));bild('native-absenderwarnung.png')
pruefe('Native Blase zeigt Absenderwarnung',label(rows,'Absender nicht prüfbar'))
if label(rows,'Zeilen 0; Chiffren 0; extern gesperrt 0'):eingeben('Native offline Nachricht')
rows=wait(lambda r:label(r,'Zeilen 1; Chiffren 1; extern gesperrt 0'));bild('native-chat-gesendet.png')
pruefe('Native Sendeaktion erzeugt genau eine Chiffre und kein externes Netz',label(rows,'Native offline Nachricht'))
tap('Netzfehler umschalten');eingeben('Darf nicht offen raus')
rows=wait(lambda r:label(r,'ließ sich gerade nicht verschlüsseln'))
pruefe('Native Fehlermeldung, unveränderter Bestand und erhaltener Entwurf',label(rows,'Zeilen 1; Chiffren 1; extern gesperrt 0') and any(x.get('AXValue')=='Darf nicht offen raus' for x in rows))
bild('native-sendesperre.png');tap('Netzfehler umschalten');tap('Prüfstand Kontakt')
wait(lambda r:label(r,'Verschlüsselung'));tap('Verschlüsselung');rows=wait(lambda r:label(r,'Sicherheitsnummer des Gegenübers'))
info1=next(x['AXLabel'] for x in rows if 'Sicherheitsnummer des Gegenübers' in (x.get('AXLabel') or ''))
pruefe('Native Kontaktinfo zeigt Sicherheitsnummer für ein Gerät','1 Gerät' in info1)
bild('native-sicherheitsnummer-ein-geraet.png')
# Das Blatt selbst hat einen eindeutig beschrifteten Schließen-Knopf.
tap('Zurück');tap('Zweites Gerät');wait(lambda r:label(r,'Verschlüsselung'));tap('Verschlüsselung');rows=wait(lambda r:label(r,'Sicherheitsnummer des Gegenübers'))
info2=next(x['AXLabel'] for x in rows if 'Sicherheitsnummer des Gegenübers' in (x.get('AXLabel') or ''))
nummer=lambda text:re.search(r'([0-9A-F]{4} ){7}[0-9A-F]{4}',text).group(0)
pruefe('Zweites simuliertes Gerät ändert native Nummer und Gerätezahl','2 Geräte' in info2 and nummer(info1)!=nummer(info2))
bild('native-sicherheitsnummer-zwei-geraete.png')
print(f'{ok}/{ok} native Offline-Komponentenprüfungen. Keine Live-/Konten-Abnahme.',flush=True)
