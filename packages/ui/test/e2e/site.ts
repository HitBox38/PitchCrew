import type { ElectronApplication } from 'playwright';

export const siteOrigin = 'https://8.8.8.8';
const html = `<!doctype html><meta charset="utf-8"><title>Fictional E2E application</title>
<style>body{font:18px sans-serif;padding:24px;background:#f4e8cb}label{display:block;margin:20px 0}#pulse{position:fixed;left:8px;right:8px;bottom:8px;height:30px;background:rgb(220,30,60);animation:pulse .3s steps(1) infinite}@keyframes pulse{50%{background:rgb(30,70,220)}}</style>
<h1>Fictional E2E application</h1><label>Name<input id="name"></label>
<label>Password<input id="password" type="password" value="e2e-private-password"></label>
<button id="continue" onclick="document.querySelector('#result').textContent='Continued by trusted input: '+event.isTrusted">Continue</button>
<output id="result">Ready</output><div id="pulse"></div>
<p><a href="/next">Next page</a> <a href="/next" target="_blank">Open linked tab</a></p>
<script>document.querySelector('#name').addEventListener('input',event=>window.lastInputTrusted=event.isTrusted)</script>`;

/** Only the external website is a fixture; no app routes, driver or preload are replaced. */
export const installSite = async (electron: ElectronApplication) => {
  await electron.evaluate(({ app }, form) => {
    const installed = new WeakSet<Electron.Session>();
    app.on('web-contents-created', (_event, contents) => {
      if (contents.getType() !== 'webview' || installed.has(contents.session)) return;
      installed.add(contents.session);
      contents.session.protocol.handle('https', (request) => {
        const url = new URL(request.url);
        if (url.hostname !== '8.8.8.8') return Response.error();
        return new Response(
          url.pathname === '/next'
            ? '<!doctype html><title>Fictional E2E next page</title><h1>Fictional E2E next page</h1><a href="/form">Application</a>'
            : form,
          { headers: { 'content-type': 'text/html' } },
        );
      });
    });
  }, html);
};
