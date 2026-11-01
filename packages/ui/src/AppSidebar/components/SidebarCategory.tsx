import { useCategoryOpen } from '@/AppSidebar/hooks/useCategoryOpen.ts';
import { Collapsible } from '@/components/ui/collapsible/components/Collapsible.tsx';
import { CollapsibleContent } from '@/components/ui/collapsible/components/CollapsibleContent.tsx';
import { SidebarGroup } from '@/components/ui/sidebar/components/SidebarGroup.tsx';
import { useSidebar } from '@/components/ui/sidebar/hooks/useSidebar.ts';
import { SidebarCategoryTrigger } from './SidebarCategoryTrigger.tsx';
import type { ReactNode } from 'react';

interface SidebarCategoryProps {
  id: string;
  label: string;
  className?: string;
  children: ReactNode;
  action?: ReactNode;
  /** Whether the category starts open before the user chooses. */
  defaultOpen?: boolean;
}

export const SidebarCategory = ({
  id,
  label,
  className,
  children,
  action,
  defaultOpen = true,
}: SidebarCategoryProps) => {
  const { open, changeOpen } = useCategoryOpen(id, defaultOpen);
  const { state, isMobile } = useSidebar();
  const iconOnly = !isMobile && state === 'collapsed';

  return (
    <Collapsible
      open={iconOnly || open}
      onOpenChange={changeOpen}
      render={<SidebarGroup className={className} data-replay-category={id} />}
    >
      <SidebarCategoryTrigger label={label} />
      {action}
      <CollapsibleContent keepMounted>{children}</CollapsibleContent>
    </Collapsible>
  );
};
