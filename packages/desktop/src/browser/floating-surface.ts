import { floatingToolbarHeight } from './floating-layout.ts';

// A sandboxed, offline surface: only the preload can receive frames or send input.
export const floatingBrowserHtml = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">
<style>
:root{color-scheme:light dark;--paper:#f5f0e8;--ink:#29251f;--muted:#6d665c;--clay:#e8e0d4;--edge:#c8bfb1;--focus:#675081}
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}
body{display:flex;flex-direction:column;background:var(--paper);color:var(--ink);font:14px/20px 'Source Sans 3',system-ui,sans-serif}
header{flex:none;height:${floatingToolbarHeight}px;border-bottom:1px solid var(--edge);padding:8px}
[role=toolbar]{display:flex;align-items:center;gap:2px;height:32px}
button{font:inherit;color:inherit;background:var(--clay);border:1px solid var(--edge);border-radius:8px;height:32px;padding:0 8px;box-shadow:0 1px 2px #0002;white-space:nowrap;cursor:pointer}
button:hover{filter:brightness(1.04)}button:active,button[aria-pressed=true]{box-shadow:inset 0 1px 3px #0003}
button:focus-visible,img:focus-visible{outline:2px solid var(--focus);outline-offset:-2px}
button:disabled{opacity:.45;cursor:default}#out,#in{width:32px;padding:0}
output{min-width:40px;text-align:center;font-variant-numeric:tabular-nums}#return{margin-left:auto}
header p{margin:4px 0 0;color:var(--muted);font-size:12px;line-height:18px}
#surface{flex:1;min-height:0;overflow:auto;background:var(--clay);box-shadow:inset 0 1px 4px #0002}
#stage{display:grid;place-items:center;min-width:100%;min-height:100%}
img{display:block;max-width:none;user-select:none;background:white}
#status{flex:none;margin:0;padding:8px;font-size:12px;line-height:18px}#status:empty{display:none}
@media(prefers-color-scheme:dark){:root{--paper:#292621;--ink:#ece5db;--muted:#bbb1a4;--clay:#35302a;--edge:#5d5448;--focus:#b9a1d0}}
</style></head><body>
<header><div role="toolbar" aria-label="Floating display">
<button id="fit" type="button" aria-pressed="true" title="Fit the entire page in this window">Fit</button>
<button id="actual" type="button" aria-pressed="false" title="Display at actual size; use scrollbars to move the view">100%</button>
<button id="out" type="button" aria-label="Decrease display scale">−</button>
<output id="scale" aria-label="Display scale" aria-live="polite">…</output>
<button id="in" type="button" aria-label="Increase display scale">+</button>
<button id="return" type="button">Back to app</button>
</div><p>Display only. Scrollbars move the view; wheel scrolls the page.</p></header>
<main id="surface" aria-label="Scrollable browser display"><div id="stage"><img draggable="false" tabindex="0" alt="Live browser page" title="F6 switches between the page and display controls"></div></main>
<p id="status" role="status"></p></body></html>`;
