import { createRoot } from 'react-dom/client';
import { FileViewer } from '@/FileViewer/index.tsx';
import type { ViewerFile } from '@/FileViewer/types.ts';
import '@/styles.css';

declare global {
  interface Window {
    /** Fictional files the test supplies before the page loads. */
    viewerFiles?: ViewerFile[];
  }
}

createRoot(document.getElementById('root')!).render(
  <FileViewer
    files={window.viewerFiles ?? []}
    initialIndex={0}
    close={() => document.body.setAttribute('data-closed', '')}
  />,
);
