import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fraunces/full.css';
import '@fontsource-variable/fraunces/full-italic.css';
import '@fontsource/source-sans-3/latin-400.css';
import '@fontsource/source-sans-3/latin-600.css';
import { RouterProvider } from '@tanstack/react-router';
import { createAppRouter } from './router.tsx';
import './styles.css';
const router = createAppRouter();
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="desktop-titlebar" aria-hidden="true">
      <span>Pitchcrew</span>
    </div>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
