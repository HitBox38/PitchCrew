import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { BrowserSessionInfo } from '@pitchcrew/core';
import { browserGuardPressEvent } from '@/DesktopBrowserHost/presentation.ts';
import type { BrowserControl } from '../types.ts';
import { shouldHandBack } from '../control-leases.ts';

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
  const { leaseId, implicit, working } = control;
  const handedBack = useRef<string>(undefined);
  // Reconcile rather than react to a transition: a lease acquired after the run started, or a
  // panel mounted mid-run, still hands back. Wait for in-flight page commands (a restored tab's
  // create-then-navigate) so the handback never revokes the lease underneath them.
  useEffect(() => {
    if (!shouldHandBack({ runId, leaseId, implicit, working, handedBack: handedBack.current }))
      return;
    handedBack.current = leaseId;
    void latest.current.release();
  }, [runId, leaseId, implicit, working]);
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
