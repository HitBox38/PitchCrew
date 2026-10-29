import type { DesktopBrowserView } from '../../../core/src/native-browser.ts';
import { browserViewStyle } from '../../../ui/src/DesktopBrowserHost/presentation.ts';

/** Minimal trusted host using the production presentation contract and preload bridge. */
const bridge = window.pitchcrewBrowser!;
const nodes = new Map<string, Electron.WebviewTag>();
const guards = new Map<string, HTMLElement>();
const sizes = new Map<string, { width: number; height: number }>();
const fixture = { created: 0, destroyed: 0, errors: [] as string[] };
Object.assign(window, { nativeFixture: fixture });
let lastViews: DesktopBrowserView[] = [];
const render = (views: DesktopBrowserView[]) => {
  lastViews = views;
  const tokens = new Set(views.map((view) => view.token));
  for (const [token, node] of nodes) {
    if (tokens.has(token)) continue;
    node.remove();
    nodes.delete(token);
    sizes.delete(token);
    guards.get(token)?.remove();
    guards.delete(token);
  }
  for (const view of [...views].sort((first, second) => first.token.localeCompare(second.token))) {
    let node = nodes.get(view.token);
    if (!node) {
      node = document.createElement('webview') as Electron.WebviewTag;
      node.dataset.token = view.token;
      node.setAttribute('partition', view.partition);
      node.setAttribute('allowpopups', '');
      node.setAttribute('src', `about:blank#pitchcrew-${view.token}`);
      const guest = node;
      node.addEventListener('dom-ready', () => {
        void bridge.registerView(view.token, guest.getWebContentsId()).catch((error: unknown) => {
          fixture.errors.push(String(error));
        });
      });
      node.addEventListener('destroyed', () => fixture.destroyed++);
      nodes.set(view.token, node);
      fixture.created++;
      document.body.append(node);
    }
    if (view.bounds) sizes.set(view.token, view.bounds);
    if (view.bounds && !view.manual) {
      let guard = guards.get(view.token);
      if (!guard) {
        guard = document.createElement('div');
        guard.dataset.browserInputGuard = view.token;
        guards.set(view.token, guard);
        document.body.append(guard);
      }
      Object.assign(guard.style, {
        position: 'fixed',
        left: `${view.bounds.x}px`,
        top: `${view.bounds.y}px`,
        width: `${view.bounds.width}px`,
        height: `${view.bounds.height}px`,
        zIndex: '2',
        pointerEvents: 'auto',
      });
    } else {
      guards.get(view.token)?.remove();
      guards.delete(view.token);
    }

    for (const [property, value] of Object.entries(
      browserViewStyle(
        view,
        sizes.get(view.token),
        { width: innerWidth, height: innerHeight },
        /mac/i.test(navigator.platform),
      ),
    )) {
      const name = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      node.style.setProperty(
        name,
        typeof value === 'number' && property !== 'zIndex' ? `${value}px` : String(value),
      );
    }
  }
};
window.addEventListener('resize', () => render(lastViews));
bridge.subscribeViews(render);
void bridge.views().then(render);
