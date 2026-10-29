import json,subprocess,pathlib
base=pathlib.Path(__file__).resolve().parents[1]
m={x['name']:x['t'] for x in json.loads((base/'capture/events.json').read_text())}
t={x['name']:x['t'] for x in json.loads((base/'capture/tail-events.json').read_text())}
e={x['name']:x['t'] for x in json.loads((base/'capture/export-events.json').read_text())}
segments=[
(0,m['board'],m['evaluate-click']-.8,3,'Open the same Orbit Labs job'),
(0,m['evaluate-click']-.8,m['shortlist-click']-.8,4,'Scout assessment'),
(0,m['shortlist-click']-.8,m['draft-click']+3.2,3.2,'Shortlist and start Writer'),
(0,m['drafted']-.25,m['application-click']-.8,.8,'Draft finished; omit idle wait'),
(0,m['application-click']-.8,m['review-click']-.8,6,'Read packet and profile citations'),
(0,m['review-click']-.8,m['prepare-click']-1,3,'Reviewer checks and marks Reviewed'),
(2,e['export-start'],e['inbox-click']+.8,4,'Request approval and enter Inbox'),
(1,t['inbox']+.1,t['approved']-.1,4,'Open exact packet and approve'),
(1,t['approved']-.1,t['end']-.2,4,'Approved; submission choices')]
filters=[]
for i,(source,start,end,duration,label) in enumerate(segments):
 filters.append(f'[{source}:v]trim=start={start:.6f}:end={end:.6f},setpts=(PTS-STARTPTS)*{duration/(end-start):.9f},fps=30,tpad=stop_mode=clone:stop_duration=2,trim=end_frame={round(duration*30)},setpts=PTS-STARTPTS[v{i}]')
filters.append(''.join(f'[v{i}]' for i in range(len(segments)))+f'concat=n={len(segments)}:v=1:a=0,format=yuv420p[out]')
(base/'capture/edit-filter.txt').write_text(';\n'.join(filters))
(base/'capture/edit-decisions.json').write_text(json.dumps([dict(source=['full-flow.webm','approval-flow.webm','export-flow.webm'][s],start=a,end=b,outputDuration=d,description=l)for s,a,b,d,l in segments],indent=2))
subprocess.run(['/tmp/pitchcrew-video-tools/bin/ffmpeg','-y','-v','warning','-i',str(base/'capture/full-flow.webm'),'-i',str(base/'capture/approval-flow.webm'),'-i',str(base/'capture/export-flow.webm'),'-filter_complex_script',str(base/'capture/edit-filter.txt'),'-map','[out]','-an','-c:v','libx264','-preset','fast','-crf','16','-movflags','+faststart',str(base/'composition/assets/footage/journey.mp4')],check=True)
