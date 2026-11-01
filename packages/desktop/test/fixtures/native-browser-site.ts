import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Session } from 'electron';

export const nativeFixtureOrigin = 'https://8.8.8.8';
export const nativeFixturePath = '/pitchcrew-native-fixture';
const installed = new WeakSet<Session>();
const downloads = new WeakMap<
  Session,
  { blocked: boolean; name: string; state?: string; bytes?: number[] }[]
>();
export const nativeFixtureDownloads = (session: Session) => downloads.get(session) ?? [];

const form = `<!doctype html><meta charset="utf-8"><title>Fictional native application</title>
<style>body{font:16px sans-serif;padding:16px}label{display:block;margin:8px 0}#source,#destination{display:inline-block;padding:16px;margin:8px;background:#ddd}iframe{height:100px}#scroller{height:80px;overflow:auto}</style>
<div id="capture-marker" style="position:fixed;right:8px;top:8px;width:40px;height:40px;background:rgb(240,20,70);z-index:10"></div><h1>Fictional native application</h1>
<form id="application"><label>Name<input id="name" name="name" maxlength="80" required></label>
<label>Location<select id="location" name="location"><option value="">Choose</option><option value="remote">Remote</option><option value="onsite">Onsite</option></select></label>
<label>Resume<input id="resume" type="file" accept=".pdf,.docx,.md"></label>
<label>Password<input id="password" type="password" value="fictional-private-password"></label>
<button id="submit">Submit fictional application</button></form>
<button id="continue" type="button">Continue</button><button id="float-target" type="button" onclick="window.fixtureFloatTrusted=event.isTrusted;document.querySelector('#result').textContent='Floating pointer reached same page'">Floating target</button><output id="result">Ready</output>
<div id="source" draggable="true">Drag fictional file</div><div id="destination">Drop here</div>
<div id="scroller"><div style="height:600px">Fictional long content</div></div>
<a id="next" href="${nativeFixturePath}/next">Next page</a>
<a id="new-tab" href="${nativeFixturePath}/next" target="_blank">Open ordinary linked tab</a>
<button id="popup" type="button">Open script popup</button>
<a id="download" href="${nativeFixturePath}/download">Download fictional receipt</a>
<iframe id="child" src="https://1.1.1.1${nativeFixturePath}/frame"></iframe>
<script>
const result=document.querySelector('#result');window.fixtureKeys=[];document.addEventListener('keydown',event=>{window.fixtureKeys.push({key:event.key,trusted:event.isTrusted,target:event.target.id});window.fixtureKeys=window.fixtureKeys.slice(-10)},true);
document.querySelector('#continue').onclick=()=>result.textContent='Continued by native agent';
document.querySelector('#name').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();result.textContent='Native Enter received'}};
document.querySelector('#source').ondragstart=event=>event.dataTransfer.setData('text/plain','fictional drag');
document.querySelector('#destination').ondragover=event=>event.preventDefault();
document.querySelector('#destination').ondrop=event=>{event.preventDefault();result.textContent='Dropped '+event.dataTransfer.getData('text/plain')};
document.querySelector('#popup').onclick=()=>{window.fixturePopup=window.open('${nativeFixtureOrigin}${nativeFixturePath}/popup','pitchcrew-fixture-signin','width=600,height=420')};
window.fixtureFrameSignals=[];window.addEventListener('message',event=>{if(event.data==='fictional-popup-complete')result.textContent='Popup opener message received';if(event.data?.fixtureFrameInput)window.fixtureFrameSignals.push(event.data.fixtureFrameInput)});
document.querySelector('#application').onsubmit=async event=>{event.preventDefault();const file=document.querySelector('#resume').files[0];const response=await fetch('${nativeFixturePath}/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:document.querySelector('#name').value,location:document.querySelector('#location').value,file:file?{name:file.name,type:file.type,bytes:Array.from(new Uint8Array(await file.arrayBuffer()))}:null})});result.textContent=await response.text()};
</script>`;

/** Fixture-owned protocol responses still pass through the production public-URL and request policy. */
export const installNativeFixtureSite = (session: Session, directory: string) => {
  if (installed.has(session)) return;
  installed.add(session);
  const submissions: unknown[] = [];
  const saved: { blocked: boolean; name: string; state?: string; bytes?: number[] }[] = [];
  downloads.set(session, saved);
  session.on('will-download', (event, item) => {
    const record = {
      blocked: event.defaultPrevented,
      name: item.getFilename(),
    } as (typeof saved)[number];
    saved.push(record);
    if (event.defaultPrevented) return;
    const target = join(directory, 'fictional-download.txt');
    item.setSavePath(target);
    item.once('done', (_event, state) => {
      record.state = state;
      if (state === 'completed')
        void readFile(target).then((bytes) => {
          record.bytes = Array.from(bytes);
        });
    });
  });
  session.protocol.handle('https', async (request) => {
    const url = new URL(request.url);
    if (
      !['8.8.8.8', '1.1.1.1'].includes(url.hostname) ||
      !url.pathname.startsWith(nativeFixturePath)
    )
      return new Response('Only fictional native-browser pages are available.', { status: 404 });
    const path = url.pathname.slice(nativeFixturePath.length);
    if (path === '/submit' && request.method === 'POST') {
      submissions.push(JSON.parse(await request.text()));
      return new Response('Application received FICTION-NATIVE-123');
    }
    if (path === '/receipts') return Response.json(submissions);
    if (path === '/download')
      return new Response('Fictional native download bytes', {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': 'attachment; filename=fictional-download.txt',
        },
      });
    if (path === '/redirect')
      return Response.redirect(`${nativeFixtureOrigin}${nativeFixturePath}/next`);
    if (path === '/unavailable') return Response.error();
    if (path === '/slow') await new Promise((resolve) => setTimeout(resolve, 1500));
    const body =
      path === '/form'
        ? form
        : path === '/frame'
          ? "<!doctype html><title>Fictional iframe</title><label>Frame answer<input id=\"frame-answer\"></label><button id=\"frame-go\" onclick=\"this.textContent='Frame interaction received'\">Frame continue</button><script>for(const type of ['mousedown','mouseup','click','keydown'])document.addEventListener(type,event=>parent.postMessage({fixtureFrameInput:{type,x:event.clientX,y:event.clientY,target:event.target.id,trusted:event.isTrusted}},'*'),true)</script>"
          : path === '/popup'
            ? '<!doctype html><title>Fictional sign in</title><button id="complete" onclick="opener.postMessage(\'fictional-popup-complete\',\'*\');window.close()">Complete fictional sign in</button>'
            : `<!doctype html><title>Fictional next page</title><h1>Fictional next page</h1><a href="${nativeFixturePath}/form">Application</a><script>window.fixtureLoadedAt=performance.timeOrigin</script>`;
    return new Response(body, { headers: { 'Content-Type': 'text/html' } });
  });
};
