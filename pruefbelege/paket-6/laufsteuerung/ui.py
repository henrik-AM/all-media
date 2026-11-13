import subprocess,json
u='5210E675-C198-4328-B3E2-30FCE9E0F624'
r=json.loads(subprocess.check_output(['axe','describe-ui','--udid',u],text=True));seen=set()
def walk(xs):
 for x in xs:
  if x.get('AXLabel') and len(x['AXLabel'])<400:
   z=(x.get('type'),x['AXLabel'],str(x.get('AXValue')))
   if z not in seen:seen.add(z);print(z)
  walk(x.get('children',[]))
walk(r)
