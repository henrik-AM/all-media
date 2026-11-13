import subprocess,json,sys,datetime,pathlib,time
u='5210E675-C198-4328-B3E2-30FCE9E0F624';o=pathlib.Path(__file__).resolve().parents[1];name,label=sys.argv[1:3]
x=json.loads(subprocess.check_output(['axe','describe-ui','--udid',u],text=True));labels=[]
def walk(xs):
 for t in xs:
  if t.get('AXLabel'):labels.append(t['AXLabel'])
  walk(t.get('children',[]))
walk(x)
for _ in range(30):
 if any(label in s for s in labels):break
 time.sleep(.3);labels.clear();walk(json.loads(subprocess.check_output(['axe','describe-ui','--udid',u],text=True)))
assert any(label in s for s in labels),'Label nicht im echten Produkt sichtbar'
p=o/'sdk58-produkt-ui.json';d=json.loads(p.read_text()) if p.exists() else [];d.append({'name':name,'label':label,'zeit':datetime.datetime.now(datetime.timezone.utc).isoformat()});p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n');subprocess.run(['xcrun','simctl','io',u,'screenshot',str(o/('produkt-'+name+'.png'))],check=True,capture_output=True);print('BELEGT',name)
