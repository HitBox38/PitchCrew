import { useRef, useState } from 'react';
import { useIsMobile } from '@pitchcrew/design-system/use-mobile';
import { useAppReducedMotion } from '@/AppMotion/hooks/useAppReducedMotion.ts';

/**
 * The since button's jump: on a phone it opens the closed section first; then the section's
 * heading (on a phone its section trigger, the heading it shows) is brought to the top of the work
 * area, clear of its scroll padding, and takes focus. Only the work area scrolls, never the
 * document or the page frame around it.
 */
export const useSinceJump = () => {
  const area = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const phone = useIsMobile();
  const reduced = useAppReducedMotion();
  const jump = () => {
    if (phone) setOpen(true);
    requestAnimationFrame(() => {
      const target = area.current?.querySelector<HTMLElement>(
        phone ? '[data-slot="collapsible-trigger"]' : '[data-since-heading]',
      );
      const body = target?.closest<HTMLElement>('.workspace-body');
      if (!target || !body) return;
      const padding = Number.parseFloat(getComputedStyle(body).scrollPaddingTop) || 0;
      const top =
        target.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
      body.scrollTo({ top: top - padding, behavior: reduced ? 'auto' : 'smooth' });
      target.focus({ preventScroll: true });
    });
  };
  return { area, open, setOpen, jump };
};
