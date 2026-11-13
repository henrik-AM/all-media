"""Echte App-Bildschirme im gesonderten Live-Prüfstand bedienen.
Exklusiver Testbestand erforderlich; nur All-Media Codex, beschriftete Treffer.
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
 if text=='Zurück':
  liste=cmd(['node','tools/tippen.js','--liste',text]);treffer=re.findall(r'^\s*(\d+)\. \[GenericElement\]',liste,re.M)
  assert len(treffer)==1,'Modaler Zurück nicht eindeutig: '+liste
  args+=['--nr',treffer[0]]
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

rows=wait(lambda r:label(r,'LIVE · Paket 6'))
pruefe('Native Live-Komponenten mit echtem SecureStore gestartet',label(rows,'Native Schlüssel im echten SecureStore'))
pruefe('Website-Chiffre auf nativem Gerät A tatsächlich gelesen',label(rows,'Website an Native A'))
eingeben('Native an Website A');wait(lambda r:label(r,'Native an Website A'));bild('native-live-A.png')
tap('Konto B');rows=wait(lambda r:label(r,'Konto B') and label(r,'Website an Native B'))
pruefe('Zweites Konto liest Website-Chiffre mit eigenem SecureStore-Schlüssel',label(rows,'Website an Native B'))
eingeben('Native an Website B');wait(lambda r:label(r,'Native an Website B'));bild('native-live-B.png')
tap('Live prüfen');rows=wait(lambda r:label(r,'2/2 native Nachrichten im Browser lesbar'))
pruefe('Native Nachrichten beider Konten in echter Website gelesen',label(rows,'2/2 native Nachrichten im Browser lesbar'))
tap('Störung');eingeben('Darf nicht offen raus');rows=wait(lambda r:label(r,'ließ sich gerade nicht verschlüsseln'))
pruefe('Native Live-Sendefehler erhält den Entwurf',any(x.get('AXValue')=='Darf nicht offen raus' for x in rows));bild('native-live-sendesperre.png')
tap('Störung');tap('Prüfstand Kontakt');wait(lambda r:label(r,'Verschlüsselung'));tap('Verschlüsselung');rows=wait(lambda r:label(r,'Sicherheitsnummer des Gegenübers'))
info1=next(x['AXLabel'] for x in rows if 'Sicherheitsnummer des Gegenübers' in (x.get('AXLabel') or ''))
pruefe('Native Live-Kontaktinfo zeigt alle bestehenden realen Geräte',int(re.search(r'\((\d+) Geräte?\)',info1).group(1))>=3);bild('native-live-nummer-drei.png')
tap('Zurück');tap('Zweites Gerät');time.sleep(1);tap('Verschlüsselung');rows=wait(lambda r:label(r,'Sicherheitsnummer des Gegenübers'))
info2=next(x['AXLabel'] for x in rows if 'Sicherheitsnummer des Gegenübers' in (x.get('AXLabel') or ''))
nummer=lambda text:re.search(r'([0-9A-F]{4} ){7}[0-9A-F]{4}',text).group(0)
pruefe('Reales Zusatzgerät ändert die native Sicherheitsnummer',int(re.search(r'\((\d+) Geräte?\)',info2).group(1))==int(re.search(r'\((\d+) Geräte?\)',info1).group(1))+1 and nummer(info1)!=nummer(info2));bild('native-live-nummer-vier.png')
tap('Zurück');tap('Absenderfälschung');rows=wait(lambda r:label(r,'Absender nicht prüfbar') and label(r,'Unregistrierter Live-Absender'))
pruefe('Native Originalblase warnt bei real unregistriertem Absenderschlüssel',label(rows,'Absender nicht prüfbar'));bild('native-live-absenderwarnung.png')
tap('Konto A');rows=wait(lambda r:label(r,'Native an Website A'))
pruefe('Native Rückkehr A liest bestehende Chiffre weiter',label(rows,'Website an Native A'))
import urllib.request
req=urllib.request.Request('http://127.0.0.1:3302/neustart',data=b'{}',headers={'Content-Type':'application/json'})
with urllib.request.urlopen(req,timeout=5) as antwort:assert json.load(antwort)['ok']
cmd([SIM,'terminate',UDID,'host.exp.Exponent']);cmd([SIM,'launch',UDID,'host.exp.Exponent','exp://127.0.0.1:3301']);cmd([SIM,'openurl',UDID,'exp://127.0.0.1:3301'])
rows=wait(lambda r:label(r,'Native Schlüssel im echten SecureStore') and label(r,'Native an Website A'))
pruefe('Echter Prozessneustart liest die bestehenden Chiffren mit SecureStore weiter',label(rows,'Website an Native A'))
bild('native-live-neustart.png')
tap('Live prüfen');rows=wait(lambda r:label(r,'2/2 native Nachrichten im Browser lesbar'))
pruefe('Schlüsselfehler hinterließ keine fünfte Nachrichtenzeile',label(rows,'5 Zeilen, 5 Chiffren'))
tap('Fertig');wait(lambda r:label(r,'Live abgeschlossen'))
print(f'{ok}/{ok} native Live-Komponentenprüfungen. Echte Konten/Supabase/SecureStore, gesonderte Rahmenkontexte.',flush=True)
