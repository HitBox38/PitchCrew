import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useSidebar } from '@/components/ui/sidebar/hooks/useSidebar.ts';

export type HeaderTargets = {
  fact: HTMLSpanElement | null;
  segment: HTMLDivElement | null;
  actions: HTMLDivElement | null;
  /** The page's one glaze action, at the end of the title row. */
  primary: HTMLDivElement | null;
  /** The same action's place in the phone top bar. */
  mobilePrimary: HTMLDivElement | null;
  /** Replaces the page name in the phone top bar, e.g. the open conversation's title. */
  mobileTitle?: HTMLDivElement | null;
  /** Chat and Profile draw their own header, so on wider screens the primary stays in place. */
  dedicated: boolean;
};

export const HeaderSlots = createContext<HeaderTargets>({
  fact: null,
  segment: null,
  actions: null,
  primary: null,
  mobilePrimary: null,
  dedicated: false,
});

/** Right side of the page title row: scoped search and clay secondaries. */
export const WorkspaceHeaderActions = ({ children }: { children: ReactNode }) => {
  const { actions } = useContext(HeaderSlots);
  return actions ? createPortal(children, actions) : null;
};

/**
 * The page's one glaze primary: last in the title row, and in the 48px top bar on phones so it is
 * reachable without scrolling. Chat and Profile keep it where they place it on wider screens.
 */
export const WorkspaceHeaderPrimary = ({ children }: { children: ReactNode }) => {
  const { primary, mobilePrimary, dedicated } = useContext(HeaderSlots);
  const { isMobile } = useSidebar();
  if (dedicated && !isMobile) return children;
  const target = isMobile ? mobilePrimary : primary;
  return target ? createPortal(children, target) : null;
};

/** Phones only: replaces the page name in the 48px top bar (and moves the bell into overflow). */
export const WorkspaceMobileTitle = ({ children }: { children: ReactNode }) => {
  const { mobileTitle } = useContext(HeaderSlots);
  const { isMobile } = useSidebar();
  return isMobile && mobileTitle ? createPortal(children, mobileTitle) : null;
};

/** Replaces the page's default fact beside its title, e.g. “1 of 3”. */
export const WorkspaceHeaderFact = ({ children }: { children: ReactNode }) => {
  const { fact } = useContext(HeaderSlots);
  return fact ? createPortal(<span data-page-fact="">{children}</span>, fact) : null;
};

/** An optional segment placed right after the fact, e.g. Pipeline | Closed. */
export const WorkspaceHeaderSegment = ({ children }: { children: ReactNode }) => {
  const { segment } = useContext(HeaderSlots);
  return segment ? createPortal(children, segment) : null;
};
