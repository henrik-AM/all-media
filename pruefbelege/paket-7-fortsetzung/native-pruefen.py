"""Echter ProfilProvider auf All-Media Codex; native Infoseiten und echte Testkonten."""
import json,time,subprocess,urllib.request,os,re,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2];OUT=pathlib.Path(__file__).parent
SIM='5210E675-C198-4328-B3E2-30FCE9E0F624';ENV={**os.environ,'SIM_GERAET':'All-Media Codex'};gut=0

def api(art,d={}):
 req=urllib.request.Request('http://127.0.0.1:3302/'+art,data=json.dumps(d).encode(),headers={'Content-Type':'application/json'})
 with urllib.request.urlopen(req,timeout=25) as r:return json.load(r)
def cmd(art,**d):return api('cmd',{'art':art,**d})
def state():return cmd('lesen')
def wait(fn,seconds=15):
 end=time.time()+seconds
 while time.time()<end:
  r=fn()
  if r:return r
  time.sleep(.12)
 raise AssertionError('Zeitgrenze')
def check(t,b=True):
 global gut
 assert b,t;gut+=1;print('OK',t,flush=True)
def wert(v,idx=0):
 s=state();c=s['chats'][idx];return s if c['server']==v and c['anzeige']==v else False
def reset(gruppe=False):
 api('remote',{'wert':False,'gruppe':gruppe});wait(lambda:wert(False,1 if gruppe else 0));time.sleep(.3)
def bild(name):subprocess.run(['xcrun','simctl','io',SIM,'screenshot',str(OUT/name)],check=True,capture_output=True,timeout=25)
def tippen(text):
 args=['node','tools/tippen.js'];s=subprocess.check_output(args+['--liste',text],cwd=ROOT/'app',env=ENV,text=True,timeout=30)
 rows=[(m[0],m[1]) for m in re.findall(r'^\s*(\d+)\. \[(?:Button|GenericElement)\] (.+)$',s,re.M) if 'Benachrichtigungen' in m[1]]
 assert len(rows)==1,s
 print(subprocess.check_output(args+[text,'--nr',rows[0][0],'--bewusst'],cwd=ROOT/'app',env=ENV,text=True,timeout=30),flush=True)
wait(lambda:api('status')['bereit'],90);check('Native Original-ProfilProvider bereit')
reset();tippen('Benachrichtigungen');wait(lambda:wert(True));check('Original-Kontaktinfo speichert und zeigt Aus');bild('stumm-kontakt-aus.png')
api('remote',{'wert':False});wait(lambda:wert(False));check('Spätere Änderung vom Zweitgerät wird in Kontaktinfo An');bild('stumm-kontakt-fern-an.png')
cmd('gruppe',wert=True);time.sleep(.8)
# Gruppeninfo: Zeile bei Bedarf mit dem geprüften Scrollwerkzeug sichtbar machen.
for _ in range(3):
 try:tippen('Benachrichtigungen');break
 except AssertionError:subprocess.run(['node','tools/tippen.js','--runter'],cwd=ROOT/'app',env=ENV,check=True,timeout=30)
else:raise AssertionError('Gruppenschalter nicht sichtbar')
wait(lambda:wert(True,1));check('Original-Gruppeninfo speichert und zeigt Aus');bild('stumm-gruppe-aus.png')
api('remote',{'wert':False,'gruppe':True});wait(lambda:wert(False,1));check('Spätere Zweitgerätänderung wird in Gruppeninfo An');bild('stumm-gruppe-fern-an.png')
cmd('gruppe',wert=False);reset();start=len(state()['trace']);cmd('transport',delay=1200);cmd('tipps',n=3)
# Alle drei echten Callback-Aufträge wurden gemeinsam ausgelöst, Antworten kommen seriell.
wait(lambda:wert(True));check('Dreifachtipp zeigt neuesten Wunsch sofort')
samples=[];end=time.time()+5
while time.time()<end:
 s=state();samples.append(s['chats'][0]['anzeige']);time.sleep(.1)
s=state();check('Zwischenbestätigungen verdrehen Dreifachtipp nicht',all(samples) and len([t for t in s['trace'][start:] if t['art']=='start'])==3);check('Dritter Wunsch tatsächlich in Datenbank bestätigt',bool(wert(True)))
bild('stumm-dreifachtipp.png');api('remote',{'wert':False});wait(lambda:wert(False));check('Dreifachtipp hinterlässt keinen dauerhaften lokalen Wunsch')
cmd('transport',fehler=1,delay=1000);cmd('tipps',n=3);time.sleep(.2);check('Jüngerer Wunsch trotz ausstehendem älterem Fehler sichtbar',state()['chats'][0]['anzeige']);wait(lambda:wert(True));time.sleep(2);check('Älterer Schreibfehler entfernt neueren Wunsch nicht',bool(wert(True)))
reset();cmd('transport',fehler=1);cmd('tipps',n=1);time.sleep(2);wait(lambda:wert(False));check('Fehler des letzten Schreibens kehrt zum echten Serverstand zurück')
reset();cmd('transport',lesefehler=16);cmd('tipps',n=1);time.sleep(.5);s=state();check('Listenfehler nach bestätigtem Schreiben hält den neuesten Wunsch',s['chats'][0]['anzeige'] and not s['chats'][0]['server']);wait(lambda:wert(True),15);check('Erfolgreicher späterer Listenabruf bestätigt tatsächliche Speicherung');api('remote',{'wert':False});wait(lambda:wert(False));check('Nach behobenem Lesefehler gewinnt wieder der Server');
start=len(state()['trace']);cmd('transport',delay=1800);cmd('tipps',n=2);cmd('konto',index=1);time.sleep(.3);check('Konto B übernimmt keinen Wunsch von A',not state()['chats'][0]['anzeige']);cmd('konto',index=0);time.sleep(3);s=state();check('A/B/A startet keinen alten wartenden Auftrag',len([t for t in s['trace'][start:] if t['art']=='start'])==1);check('Konto A zeigt nach Rückkehr seinen tatsächlichen Stand',bool(wert(True)))
bild('stumm-kontowechsel.png');api('remote',{'wert':False});wait(lambda:wert(False));check('Auch nach Kontorückkehr gewinnt spätere Zweitgerätänderung')
(OUT/'native-ergebnis.json').write_text(json.dumps({'gut':gut,'gesamt':gut,'stand':state(),'datenbank':api('db')},indent=2))
print(f'{gut}/{gut} native Stummprüfungen',flush=True)
