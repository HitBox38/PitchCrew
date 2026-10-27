import { View, type BrowserWindow } from 'electron';

/** Give the app and guests sibling views so hidden guests can paint below the opaque app. */
export const installBrowserComposition = (window: BrowserWindow) => {
  const appView = window.contentView;
  const root = new View();
  window.setContentView(root);
  root.addChildView(appView);
  const layout = () => {
    if (window.isDestroyed()) return;
    const { width, height } = window.getContentBounds();
    appView.setBounds({ x: 0, y: 0, width, height });
  };
  layout();
  window.on('resize', layout);
  window.on('enter-full-screen', layout);
  window.on('leave-full-screen', layout);
  return { appView, root };
};
