from pathlib import Path
import json,shutil
base=Path(__file__).resolve().parents[1];project=base/'composition';scenes=project/'compositions';scenes.mkdir(exist_ok=True)
reference=scenes/'components/ui-focus-zoom.html'
if reference.exists():shutil.move(reference,base/'scripts/ui-focus-zoom-reference.html')
audio=json.loads((project/'assets/audio/audio-data.json').read_text())
shots=[
 dict(id='reveal',start=0,d=5,src=0,span=3,kicker='MEET PITCHCREW',title=['Your job search.','A whole crew.'],body='AI agents prepare applications from your profile.',initial=[.8,18,90],moves=[],mode='hero'),
 dict(id='scout',start=5,d=5,src=3,span=4,kicker='01 / SCOUT',title=['Know','the fit.'],body='Scout compares each job with your profile.',initial=[.8,18,90],moves=[[.05,.85,1.3,-604,-240],[1.8,.85,1.3,-604,-20]],mode='wipe'),
 dict(id='writer',start=10,d=5.5,src=7,span=4,kicker='02 / WRITER',title=['Build your','application.'],body='Writer drafts your resume, cover letter and answers.',initial=[1.3,-604,-20],moves=[[.1,.8,1.3,-604,-240],[3,.85,1.25,-540,-20]],mode='lines'),
 dict(id='evidence',start=15.5,d=5,src=11,span=6,kicker='03 / SOURCES',title=['Backed by','your experience.'],body='Claims link back to your profile notes.',initial=[1.25,-540,-20],moves=[[.3,1.05,1.38,-706,-110]],mode='fade'),
 dict(id='review',start=20.5,d=5,src=17,span=3,kicker='04 / REVIEWER',title=['A second','set of eyes.'],body='Reviewer checks the packet before it reaches you.',initial=[1.38,-706,-110],moves=[[.1,.75,1.3,-604,-240],[1.8,.8,1.3,-604,-20]],mode='wipe'),
 dict(id='approve',start=25.5,d=7.5,src=20,span=8,kicker='05 / YOUR APPROVAL',title=['You decide','what leaves.'],body='Review the exact documents.<br>Approve before export.',initial=[1.3,-604,-20],moves=[[.1,.65,1.25,-540,-100],[2.65,.6,1.3,-604,-240],[3.6,.8,1,-220,0],[6.25,.7,1.3,-604,-240]],mode='fade'),
 dict(id='resolve',start=33,d=5,src=28,span=4,kicker='PITCHCREW',title=['Your crew.','Your call.'],body='Board, profile, chats and packets are saved locally.',initial=[1.3,-604,-240],moves=[[.25,1.15,1,-220,0]],mode='lines'),
]
css='''
@font-face{font-family:'Fraunces Variable';font-weight:100 900;src:url('fonts/fraunces.woff2')}
@font-face{font-family:'Source Sans 3';font-weight:400;src:url('fonts/sans-400.woff2')}
@font-face{font-family:'Source Sans 3';font-weight:600;src:url('fonts/sans-600.woff2')}
*{box-sizing:border-box}html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:var(--color-ground,#18242b);color:var(--color-ink,#f2f1ec);font-family:'Source Sans 3'}#root{position:absolute;inset:0;overflow:hidden}.clip{position:absolute;inset:0}.stage-ground{position:absolute;inset:0;background:var(--color-ground,#18242b)}
.film-brand{position:absolute;left:150px;top:74px;display:flex;align-items:center;gap:17px;font-family:'Fraunces Variable';font-size:42px;font-weight:600;letter-spacing:-1.1px;z-index:8}.film-brand img{width:43px;height:43px}.film-category{font-family:'Source Sans 3';position:absolute;right:140px;top:89px;font-size:28px;line-height:34px;color:#b7d3cf;letter-spacing:.06em;font-weight:600;margin:0;z-index:8}.film-copy{position:absolute;left:150px;top:294px;width:500px;z-index:8}.film-kicker{font-family:'Source Sans 3';font-size:28px;line-height:36px;font-weight:600;letter-spacing:.07em;color:#b7d3cf;margin:0 0 24px}.film-title{font-family:'Fraunces Variable';font-weight:600;font-size:72px;line-height:1.06;letter-spacing:-2.8px;margin:0}.film-line{display:block}.film-description{font-family:'Source Sans 3';font-size:34px;line-height:1.28;color:#d5ddd9;margin:32px 0 0;max-width:500px}
.film-lens{position:absolute;left:720px;top:150px;width:1060px;height:800px;perspective:2200px;perspective-origin:50% 50%;z-index:3}.film-plane{position:absolute;inset:0;border-radius:26px;background:#f2f1ec;box-shadow:0 8px 0 #121c21,0 40px 90px #0008,0 3px 9px #0004;transform-style:preserve-3d}.film-window{position:absolute;inset:0;overflow:hidden;border-radius:26px;border:1px solid #d9dfdb;background:#f2f1ec}.film-camera{position:absolute;left:0;top:0;width:1280px;height:800px;transform-origin:0 0;will-change:transform}.film-footage{position:absolute;left:0;top:0;width:1280px;height:800px;object-fit:contain;z-index:1}.film-illumination{position:absolute;left:610px;top:0;width:1280px;height:1000px;border-radius:50%;background:radial-gradient(ellipse,#b7d3cf55 0%,#b7d3cf18 38%,transparent 70%);pointer-events:none;z-index:0}
.film-progress{position:absolute;left:150px;top:976px;width:1630px;height:3px;background:#43555b;z-index:8}.film-progress-fill{width:100%;height:3px;background:#b7d3cf;transform-origin:0 50%}.film-footer{font-family:'Source Sans 3';position:absolute;left:150px;top:1006px;font-size:28px;line-height:36px;color:#b8c6c6;margin:0;z-index:8}.film-credit{font-family:'Source Sans 3';position:absolute;right:140px;top:1006px;font-size:28px;line-height:36px;color:#b8c6c6;margin:0;z-index:8}
'''
(project/'assets/style.css').write_text(css)
hosts=[]
for q in shots:
 i=q['id'];dur=q['d'];start=q['start']
 title=''.join(f'<span id="{i}-line-{n}" class="film-line">{v}</span>'for n,v in enumerate(q['title']))
 credit='Music: Sascha Ende, ende.app · CC BY 4.0' if i=='resolve' else 'SCOUT → WRITER → REVIEWER → YOU'
 initial=q['initial'];tweens=[f"tl.set('#{i}-camera',{{scale:{initial[0]},x:{initial[1]},y:{initial[2]},transformOrigin:'0 0'}} ,0);"]
 prev=initial
 for t,d,s,x,y in q['moves']:
  tweens.append(f"tl.fromTo('#{i}-camera',{{scale:{prev[0]},x:{prev[1]},y:{prev[2]}}},{{scale:{s},x:{x},y:{y},duration:{d},ease:'power2.inOut',immediateRender:false}},{t});")
  prev=[s,x,y]
 if q['mode']=='hero':
  tweens.append(f"tl.fromTo('#{i}-plane',{{rotationY:-11,rotationX:5,scale:.91,opacity:0}},{{rotationY:0,rotationX:0,scale:1,opacity:1,duration:1.1,ease:'power4.out'}},0);")
 elif q['mode']=='wipe':
  tweens.append(f"tl.fromTo('#{i}-title',{{clipPath:'inset(0 0 100% 0)'}},{{clipPath:'inset(0 0 0% 0)',duration:.5,ease:'power3.out'}},.08);")
 elif q['mode']=='fade':
  tweens.append(f"tl.fromTo('#{i}-title',{{opacity:0}},{{opacity:1,duration:.26,ease:'none'}},.1);")
 else:
  for n in range(2):tweens.append(f"tl.fromTo('#{i}-line-{n}',{{y:22,opacity:0}},{{y:0,opacity:1,duration:.55,ease:'power4.out'}},{.08+n*.08});")
 tweens.append(f"tl.fromTo('#{i}-kicker',{{opacity:0}},{{opacity:1,duration:.2,ease:'none'}},.06);")
 tweens.append(f"tl.fromTo('#{i}-description',{{opacity:0,y:8}},{{opacity:1,y:0,duration:.35,ease:'power3.out'}},.4);")
 tweens.append(f"tl.fromTo('#{i}-progress',{{scaleX:{start/38}}},{{scaleX:{(start+dur)/38},duration:{dur},ease:'none'}},0);")
 # Music energy modulates the stage light only, at build time.
 levels=[]
 for n in range(int(dur*8)):
  t=min(dur-.01,n/8);frame=audio['frames'][min(len(audio['frames'])-1,int((start+t)*30))]
  rms=frame.get('rms',0);bass=max(frame.get('bands',[0])[:2]);level=.42+min(1,max(rms,bass))*.24
  levels.append((t,level))
 tweens.append(f"tl.set('#{i}-light',{{opacity:{levels[0][1]:.4f}}},0);")
 for (t,v) in levels[1:]:tweens.append(f"tl.to('#{i}-light',{{opacity:{v:.4f},duration:.125,ease:'none'}},{max(0,t-.125):.3f});")
 intro_style='#reveal-plane{background:transparent;box-shadow:none}#reveal-plane .film-window{background:transparent;border:0;overflow:visible}#reveal-camera{border-radius:22px;overflow:hidden;box-shadow:0 24px 80px #0008}' if i=='reveal' else ''
 html=f'''<template>
<style>#root{{position:absolute;inset:0;overflow:hidden}}{intro_style}</style>
<div id="root" data-composition-id="{i}" data-width="1920" data-height="1080" data-hold="Explanatory reading holds over native app footage">
<div class="stage-ground"></div>
<div class="film-brand"><img src="assets/logo.svg" alt=""><span>pitchcrew</span></div>
<p class="film-category">A LOCAL-FIRST JOB-SEARCH APP</p>
<div id="{i}-light" class="film-illumination" data-layout-ignore="true"></div>
<div class="film-copy"><p id="{i}-kicker" class="film-kicker">{q['kicker']}</p><h1 id="{i}-title" class="film-title">{title}</h1><p id="{i}-description" class="film-description">{q['body']}</p></div>
<div class="film-lens"><div id="{i}-plane" class="film-plane"><div class="film-window"><div id="{i}-camera" class="film-camera" data-layout-allow-overflow="true"><video id="{i}-footage" class="clip film-footage" muted playsinline src="assets/footage/journey.mp4" data-start="0" data-duration="{dur}" data-media-start="{q['src']}" data-playback-rate="{q['span']/dur:.9f}" data-track-index="1"></video></div></div></div></div>
<div class="film-progress"><div id="{i}-progress" class="film-progress-fill"></div></div>
<p class="film-footer">Fictional demo · Waits shortened</p><p class="film-credit">{credit}</p>
</div>
<script>const tl=gsap.timeline({{paused:true}});{''.join(tweens)}window.__timelines.{i}=tl;</script>
</template>'''
 (scenes/f'{i}.html').write_text(html)
 hosts.append(f'<div id="{i}" class="clip" data-composition-id="{i}" data-composition-src="compositions/{i}.html" data-start="{start}" data-duration="{dur}" data-track-index="1" data-track-kind="graphics" data-width="1920" data-height="1080"></div>')
sfx=''.join(f'<audio id="accent-{n}" class="clip" src="assets/audio/{asset}.ogg" data-start="{t}" data-duration="{dur}" data-volume="{vol}" data-track-index="{11+n}"></audio>'for n,(t,asset,dur,vol)in enumerate([(5.05,'impact',.18,.40),(15.5,'impact',.18,.30),(33,'impact',.18,.35)]))
root=f'''<!doctype html><html lang="en" data-resolution="landscape" data-composition-variables='[{{"id":"color-ground","type":"color","label":"Stage","default":"#18242b"}},{{"id":"color-ink","type":"color","label":"Paper","default":"#f2f1ec"}},{{"id":"color-accent","type":"color","label":"Sea glass","default":"#b7d3cf"}},{{"id":"font-display","type":"string","label":"Display font","default":"Fraunces Variable"}}]'><head><meta charset="utf-8"><title>Pitchcrew — Your job search. A whole crew.</title><link rel="stylesheet" href="assets/style.css"><script src="assets/vendor/gsap.min.js"></script></head><body><div id="root" data-composition-id="main" data-start="0" data-duration="38" data-width="1920" data-height="1080" data-fps="30">{''.join(hosts)}<audio id="music" data-timeline-role="music" class="clip" src="assets/audio/score.wav" data-start="0" data-duration="38" data-volume="0.34" data-fade-in="0.35" data-fade-out="2.5" data-track-index="10"></audio>{sfx}</div><script>window.__timelines=window.__timelines||{{}};window.__timelines.main=gsap.timeline({{paused:true}});</script></body></html>'''
(project/'index.html').write_text(root)
(base/'shots.json').write_text(json.dumps(shots,indent=2))
