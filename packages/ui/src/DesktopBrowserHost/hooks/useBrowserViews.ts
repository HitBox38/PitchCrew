import { useEffect, useState } from 'react';
import type { DesktopBrowserView } from '../../../../core/src/native-browser.ts';

export const useBrowserViews = () => {
  const [views, setViews] = useState<DesktopBrowserView[]>([]);
  useEffect(() => {
    const bridge = window.pitchcrewBrowser;
    if (!bridge?.views || !bridge.subscribeViews) return;
    let disposed = false;
    let updates = 0;
    const unsubscribe = bridge.subscribeViews((next) => {
      updates++;
      if (!disposed) setViews(next);
    });
    const requestedAt = updates;
    void bridge
      .views()
      .then((next) => {
        if (!disposed && requestedAt === updates) setViews(next);
      })
      .catch(() => {});
    return () => {
      disposed = true;
      unsubscribe();
    };
  }, []);
  return views.toSorted((first, second) => first.token.localeCompare(second.token));
};
