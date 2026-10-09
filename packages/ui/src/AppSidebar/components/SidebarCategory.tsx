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
}

export function SidebarCategory({ id, label, className, children, action }: SidebarCategoryProps) {
  const { open, changeOpen } = useCategoryOpen(id);
  const { state, isMobile } = useSidebar();
  const iconOnly = !isMobile && state === 'collapsed';

  return (
    <Collapsible
      open={iconOnly || open}
      onOpenChange={changeOpen}
      render={<SidebarGroup className={className} />}
    >
      <SidebarCategoryTrigger label={label} />
      {action}
      <CollapsibleContent keepMounted>{children}</CollapsibleContent>
    </Collapsible>
  );
}
