import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { AppMotion } from '@/AppMotion/index.tsx';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource-variable/fraunces/full.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import { RouterProvider } from '@tanstack/react-router';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { createAppRouter } from './router.ts';
import { installErrorTracking } from './Analytics/error-tracking.ts';
import { reactErrorHandlers } from './Analytics/react-errors.ts';
import './styles.css';

const router = createAppRouter(undefined, () => useWorkspaceStore.getState().data?.roles);
const stopErrorTracking = installErrorTracking(window);
if (import.meta.hot) import.meta.hot.dispose(stopErrorTracking);
createRoot(document.getElementById('root')!, reactErrorHandlers).render(
  <React.StrictMode>
    <div className="desktop-titlebar" aria-hidden="true">
      <span>Pitchcrew</span>
    </div>
    <AppMotion>
      <RouterProvider router={router} />
    </AppMotion>
  </React.StrictMode>,
);
