import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useIsMobile } from '@pitchcrew/design-system/use-mobile';
import { cn } from '@pitchcrew/design-system/utils';
import { ResponsiveDisclosure } from '@/components/ResponsiveDisclosure/index.tsx';

type HomeSectionProps = {
  title: string;
  /** A short fact beside the title on a phone ("5 of 5 slots · 3 up next"). */
  fact?: string;
  children: ReactNode;
  /** Controlled on a phone, where the since button opens its section. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
};

/**
 * Open on desktop, a closed section on a phone: one DOM either way (the trigger is hidden and the
 * panel forced open when wide), so crossing the breakpoint remounts nothing and focus survives.
 * Wide, the section gives up its boxes and its blocks lay out in the page's own grid.
 */
export const HomeSection = ({ title, fact, children, className, ...open }: HomeSectionProps) => {
  const phone = useIsMobile();
  return (
    <ResponsiveDisclosure
      collapsible={phone}
      trigger={
        <>
          <span className="home-section-title">{title}</span>
          {fact ? <span className="home-section-fact">{fact}</span> : null}
          <ChevronDown size={16} className="home-section-chevron" aria-hidden="true" />
        </>
      }
      className={cn('home-section', className)}
      triggerClassName="home-section-trigger"
      panelClassName="home-section-panel"
      {...open}
    >
      {children}
    </ResponsiveDisclosure>
  );
};
