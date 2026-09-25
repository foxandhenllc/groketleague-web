"""Build timestamped review sheets, a local sequence player and descriptive metrics.
Usage: python tests/review-captures.py output/capture-matches/<run-folder>
No gameplay is simulated here; all images come from the browser captures.
"""
import json, math, sys, pathlib, statistics, collections
from PIL import Image, ImageDraw

root=pathlib.Path(sys.argv[1]).resolve()
manifest=json.loads((root/'manifest.json').read_text())
summaries=[]

def longest(rows, predicate):
    best=[]; current=[]
    for r in rows:
        if predicate(r):
            current.append(r)
            if len(current)>len(best): best=current[:]
        else: current=[]
    return best

def select(rows,n):
    if not rows:return []
    return [rows[round(i*(len(rows)-1)/max(1,min(n,len(rows))-1))] for i in range(min(n,len(rows)))]

def sheet(directory,rows,name):
    if not rows:return
    w,h=320,236; canvas=Image.new('RGB',(w*4,h*math.ceil(len(rows)/4)), '#111a24')
    draw=ImageDraw.Draw(canvas)
    for i,r in enumerate(rows):
        image=Image.open(directory/r['image']);image.thumbnail((320,213))
        x,y=(i%4)*w,(i//4)*h;canvas.paste(image,(x,y))
        draw.text((x+4,y+215),f"{r['captureSeconds']:.2f}s f{r['captureFrame']} {r['scoreA']}:{r['scoreB']} {r['P'].get('_ai',{}).get('mode','-')}",fill='white')
    canvas.save(directory/(name+'.jpg'),quality=88)

for run in manifest['runs']:
    directory=root/run['id'];rows=[json.loads(l) for l in (directory/'states.ndjson').read_text().splitlines()]
    assert len(rows)==run['images'] and rows[0]['captureFrame']==0 and rows[-1]['mode']=='results'
    assert all((directory/r['image']).is_file() for r in rows), 'Missing screenshot'
    assert all(b['captureFrame']-a['captureFrame']==10 for a,b in zip(rows[:-2],rows[1:-1])), 'Capture gap'
    assert 0<rows[-1]['captureFrame']-rows[-2]['captureFrame']<=10, 'Invalid final frame'
    active=[r for r in rows if r['mode']=='play' and not r['locked']]
    def speed(b):return math.hypot(b['vx'],b['vz'])
    slow=longest(rows,lambda r:r['mode']=='play' and not r['locked'] and speed(r['ball'])<1)
    recover=longest(rows,lambda r:r['mode']=='play' and not r['locked'] and r['P'].get('_ai',{}).get('mode')=='recover')
    invisible=longest(rows,lambda r:r['mode']=='play' and not r['locked'] and (abs(r['ballScreen']['x'])>1 or abs(r['ballScreen']['y'])>1 or abs(r['ballScreen']['z'])>1))
    # Movement-heavy six-second windows with little net ball progress are candidates
    # for orbiting, not proof: sheets must be inspected before reporting a bug.
    orbit=[]
    for i in range(0,len(rows)-72,12):
        window=rows[i:i+73]
        if any(r['mode']!='play' or r['locked'] for r in window):continue
        a,b=window[0],window[-1]
        movement=sum(math.hypot(q['P']['x']-p['P']['x'],q['P']['z']-p['P']['z']) for p,q in zip(window,window[1:]))
        ballnet=math.hypot(b['ball']['x']-a['ball']['x'],b['ball']['z']-a['ball']['z'])
        distance=statistics.mean(math.hypot(r['P']['x']-r['ball']['x'],r['P']['z']-r['ball']['z']) for r in window)
        if ballnet<4 and movement>20 and distance<12:orbit.append((movement,window))
    orbit.sort(key=lambda a:a[0],reverse=True)
    sheet(directory,select(rows,32),'overview')
    for name,sequence in [('slow-ball',slow),('recovery',recover),('offscreen',invisible if run['mode']=='3d' else [])]:
        sheet(directory,select(sequence,16),name)
    if orbit:sheet(directory,select(orbit[0][1],24),'orbit-candidate')
    goals=[]
    for i,(a,b) in enumerate(zip(rows,rows[1:])):
        if (a['scoreA'],a['scoreB'])!=(b['scoreA'],b['scoreB']):
            goals.append({'seconds':b['captureSeconds'],'frame':b['captureFrame'],'score':[b['scoreA'],b['scoreB']]})
            sheet(directory,select(rows[max(0,i-96):i+13],16),f'goal-{len(goals)}')
    def episode(seq):return None if not seq else {'start':seq[0]['captureSeconds'],'end':seq[-1]['captureSeconds'],'sampledSeconds':len(seq)/12,'firstImage':seq[0]['image']}
    summary={**run,'goals':goals,'meanBallSpeed':statistics.mean(speed(r['ball']) for r in active),
      'slowBallPercent':100*sum(speed(r['ball'])<1 for r in active)/len(active),
      'nearBoardPercent':100*sum(abs(r['ball']['x'])>18 or abs(r['ball']['z'])>30 for r in active)/len(active),
      'playerModes':dict(collections.Counter(r['P'].get('_ai',{}).get('mode') for r in active)),
      'opponentModes':dict(collections.Counter(r['B'].get('_ai',{}).get('mode') for r in active)),
      'longestSlowBall':episode(slow),'longestPlayerRecovery':episode(recover),
      'longestBallOffscreen':episode(invisible) if run['mode']=='3d' else None,
      'orbitCandidate':episode(orbit[0][1]) if orbit else None,
      'diagnostics':rows[-1]['diagnostics'],'cadenceOK':all(b['captureFrame']-a['captureFrame']==10 for a,b in zip(rows[:-2],rows[1:-1]))}
    summaries.append(summary)
    data=[{'file':r['image'],'time':round(r['captureSeconds'],3),'frame':r['captureFrame'],'score':[r['scoreA'],r['scoreB']]} for r in rows]
    html='''<!doctype html><meta charset="utf-8"><title>Match capture review</title>
<style>body{background:#101821;color:#e5edf4;font:16px system-ui;max-width:1100px;margin:24px auto}img{width:100%}input{width:70%}button,select{padding:8px}a{color:#74d5ed}</style>
<h1>RUN_TITLE</h1><p>Every ten 120 Hz simulation frames. The whole match is retained. Arrows step one image.</p>
<button id="play">Play / pause</button> <input id="seek" type="range" min="0" value="0"> <select id="rate"><option value="83.333">1x</option><option value="20.833">4x</option><option value="8.333">10x</option></select><p id="label"></p><img id="frame">
<p><a href="overview.jpg">Whole-match contact sheet</a> | <a href="states.ndjson">Raw game state</a></p>
<script>const frames=DATA;let index=0,timer;const seek=document.querySelector('#seek');seek.max=frames.length-1;
function show(){const f=frames[index];seek.value=index;document.querySelector('#frame').src=f.file;document.querySelector('#label').textContent=`${f.time}s — frame ${f.frame} — score ${f.score.join(':')} — image ${index+1}/${frames.length}`;}
seek.oninput=()=>{index=+seek.value;show()};document.querySelector('#play').onclick=()=>{if(timer){clearInterval(timer);timer=null;}else timer=setInterval(()=>{index=(index+1)%frames.length;show()},+document.querySelector('#rate').value)};
onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){index=Math.max(0,Math.min(frames.length-1,index+(e.key==='ArrowRight'?1:-1)));show();}};show();</script>'''
    (directory/'review.html').write_text(html.replace('RUN_TITLE',run['id']).replace('DATA',json.dumps(data)),encoding='utf-8')

(root/'analysis.json').write_text(json.dumps(summaries,indent=2),encoding='utf-8')
links=''.join(f'<li><a href="{r["id"]}/review.html">{r["id"]}</a> — {r["score"]}, {r["images"]} images</li>' for r in summaries)
(root/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>Eight match review</title><style>body{font:18px system-ui;background:#101821;color:white;margin:40px}a{color:#74d5ed}li{margin:15px}</style><h1>Full-match capture review</h1><p>Each sequence contains every 10th simulation frame, from countdown to results.</p><ul>'+links+'</ul>',encoding='utf-8')
print(json.dumps(summaries,indent=2))
