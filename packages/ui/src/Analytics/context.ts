import metadata from '../../../../package.json';
import { desktopUpdateBridge } from '../AppUpdates/desktop.ts';

export function analyticsContext() {
  return {
    app_version: metadata.version,
    analytics_schema: 2,
    renderer: desktopUpdateBridge() ? 'electron' : 'browser',
  };
}
