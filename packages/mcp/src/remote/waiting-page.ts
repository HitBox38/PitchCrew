import { randomBytes } from 'node:crypto';
import type { Express } from 'express';
import type { RemoteAuthorization } from './authorization.ts';

export const registerConnectionPage = (app: Express, authorization: RemoteAuthorization) => {
  app.get('/connect/:ticket', (req, res) => {
    const status = authorization.connection(req.params.ticket);
    const expired = status.status === 'expired';
    const nonce = randomBytes(16).toString('hex');
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`,
    );
    return res.status(expired ? 410 : 200).type('html')
      .send(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Connect to Pitchcrew</title>
<style nonce="${nonce}">:root{color-scheme:light dark;background:#faf8f4;color:#292525}body{font:18px/1.5 system-ui,sans-serif;max-width:34rem;margin:clamp(1rem,10vh,6rem) auto;padding:24px;overflow-wrap:anywhere}h1{font-size:clamp(1.6rem,5vw,2.2rem);line-height:1.2}code{font-size:clamp(1.5rem,6vw,2rem);letter-spacing:.15em}p{max-width:55ch}.quiet{font-size:.9rem;color:#655c55}@media(prefers-color-scheme:dark){:root{background:#24211f;color:#eee7dd}.quiet{color:#bcb1a4}}</style>
<main><h1>${expired ? 'Connection request expired' : 'Approve in Pitchcrew'}</h1>${expired ? '<p id="status" role="status">This connection request expired. Connect again from your app. You can close this page.</p>' : `<p>Open Pitchcrew on your computer, then Settings → Accounts → Grok Bot and remote apps. Choose what this app can access there, starting with read-only access. Review the connection with this matching code:</p><code>${status.code ?? ''}</code>${status.expiresAt ? `<p class="quiet">Expires <time datetime="${status.expiresAt}">${status.expiresAt}</time>.</p>` : ''}<p id="status" role="status">Waiting for your decision. Only approve a connection you started. After approval, you'll return to your app.</p>`}</main>
${expired ? '' : `<script nonce="${nonce}">const expiry=document.querySelector('time');if(expiry)expiry.textContent=new Date(expiry.dateTime).toLocaleString();let tries=0;async function check(){if(++tries>600){document.getElementById('status').textContent='This request expired. Connect again from your app.';return}try{const r=await fetch(location.pathname+'/status',{cache:'no-store',signal:AbortSignal.timeout(10000)});const s=await r.json();if((s.status==='approved'||s.status==='denied')&&s.redirect){location.replace(s.redirect);return}if(s.status==='denied'||s.status==='expired'){document.getElementById('status').textContent=s.status==='denied'?'You declined this connection. You can close this page.':'This request expired. Connect again from your app.';return}}catch{}setTimeout(check,1000)}check()</script>`}</html>`);
  });
  app.get('/connect/:ticket/status', (req, res) => {
    res.json(authorization.connection(req.params.ticket));
  });
};
