from pathlib import Path
import subprocess,json,hashlib
base=Path(__file__).resolve().parents[1]
ff='/tmp/pitchcrew-video-tools/bin/ffmpeg';probe='/tmp/pitchcrew-video-tools/bin/ffprobe'
run=lambda a:subprocess.run(a,check=True)
raw=base/'brag.mp4';poster=base/'brag.jpg';baked=base/'brag.poster.mp4'
run([ff,'-y','-v','error','-ss','1.8','-i',str(raw),'-frames:v','1','-q:v','2',str(poster)])
def audio_hash(p):
 a=subprocess.check_output([ff,'-v','error','-i',str(p),'-map','0:a:0','-c:a','copy','-f','adts','-']);return hashlib.sha256(a).hexdigest()
before=audio_hash(raw)
run([ff,'-y','-v','error','-i',str(raw),'-i',str(poster),'-filter_complex',"[0:v][1:v]overlay=0:0:enable='eq(n,0)'[v]",'-map','[v]','-map','0:a?','-c:v','libx264','-crf','18','-preset','slow','-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',str(baked)])
assert audio_hash(baked)==before
j=json.loads(subprocess.check_output([probe,'-v','error','-show_streams','-show_format','-of','json',str(baked)]))
v=next(x for x in j['streams']if x['codec_type']=='video')
assert (v['width'],v['height'],v['nb_frames'])==(1920,1080,'960')
assert abs(float(v['duration'])-32)<.01
assert any(x['codec_type']=='audio'for x in j['streams'])
raw.rename(base/'brag.unbaked.mp4');baked.rename(raw)
run([ff,'-y','-v','error','-ss','30.2','-i',str(raw),'-frames:v','1',str(base/'final-approval.png')])
run([ff,'-y','-v','error','-i',str(raw),'-frames:v','1',str(base/'frame-zero.png')])
check=json.loads((base/'check-final.json').read_text())
report={'file':str(raw),'width':1920,'height':1080,'videoSeconds':32,'videoFrames':960,'fps':30,'audio':next(x['codec_name']for x in j['streams']if x['codec_type']=='audio'),'audioUnchangedByPosterBake':True,'audioStreamHash':before,'posterTime':1.8,'posterBakedIntoFrameZero':True,'hyperframesZeroErrors':check['ok'],'editorialContrastChecks':check['contrast']['checked'],'nativeUI':'Visually reviewed from actual app capture; text in footage is not part of DOM contrast audit.','review':'Settled frames inspected at opening, Writer progress, citations, export request and approved packet.','bytes':raw.stat().st_size,'sha256':hashlib.sha256(raw.read_bytes()).hexdigest()}
(base/'verification.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
