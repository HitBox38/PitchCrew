import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { BrowserSessionInfo } from '@pitchcrew/core';
import { browserGuardPressEvent } from '@/DesktopBrowserHost/presentation.ts';
import type { BrowserControl } from '../types.ts';

/**
 * Idle browsing without a separate takeover step:
 * - a press on the read-only page takes control while the agent is idle (otherwise it nudges
 *   the user toward Take control, since that pauses a running agent);
 * - control taken implicitly is handed back as soon as an agent run starts using the browser.
 * Explicit Take control keeps its existing return-it-yourself contract.
 */
export const useBrowserHandback = (
  control: BrowserControl,
  session: BrowserSessionInfo | undefined,
  pageId: string | undefined,
) => {
  const latest = useRef(control);
  useLayoutEffect(() => {
    latest.current = control;
  });
  const [nudged, setNudged] = useState(false);
  const runId = session?.runId ?? null;
  const previousRun = useRef(runId);
  useEffect(() => {
    const started = !!runId && runId !== previousRun.current;
    previousRun.current = runId;
    const current = latest.current;
    if (started && current.leaseId && current.implicit) void current.release();
  }, [runId]);
  useEffect(() => {
    if (!nudged) return;
    const timer = setTimeout(() => setNudged(false), 4000);
    return () => clearTimeout(timer);
  }, [nudged]);
  useEffect(() => {
    const press = () => {
      const current = latest.current;
      if (current.leaseId || current.working) return;
      if (!current.available) {
        setNudged(true);
        return;
      }
      void current.command(async () => {
        if (!(await current.ensure()) || !pageId) return;
        await window.pitchcrewBrowser?.focusPage(pageId).catch(() => {});
      });
    };
    window.addEventListener(browserGuardPressEvent, press);
    return () => window.removeEventListener(browserGuardPressEvent, press);
  }, [pageId]);
  return { nudged };
};
