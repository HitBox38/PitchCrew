import { useCategoryOpen } from '@/AppSidebar/hooks/useCategoryOpen.ts';
import { Collapsible } from '@/components/ui/collapsible/components/Collapsible.tsx';
import { CollapsibleContent } from '@/components/ui/collapsible/components/CollapsibleContent.tsx';
import { CollapsibleTrigger } from '@/components/ui/collapsible/components/CollapsibleTrigger.tsx';
import { SidebarGroup } from '@/components/ui/sidebar/components/SidebarGroup.tsx';
import { SidebarGroupLabel } from '@/components/ui/sidebar/components/SidebarGroupLabel.tsx';
import { useSidebar } from '@/components/ui/sidebar/hooks/useSidebar.ts';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

interface SidebarCategoryProps {
  id: string;
  label: string;
  className?: string;
  children: ReactNode;
}

export function SidebarCategory({ id, label, className, children }: SidebarCategoryProps) {
  const { open, changeOpen } = useCategoryOpen(id);
  const { state, isMobile } = useSidebar();
  const iconOnly = !isMobile && state === 'collapsed';

  return (
    <Collapsible
      open={iconOnly || open}
      onOpenChange={changeOpen}
      render={<SidebarGroup className={className} />}
    >
      <CollapsibleTrigger
        render={
          <SidebarGroupLabel
            render={<button type="button" aria-label={label} />}
            className="sidebar-category-toggle w-full cursor-pointer justify-between group-data-[collapsible=icon]:hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          />
        }
      >
        <span>{label}</span>
        <ChevronRight aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent keepMounted>{children}</CollapsibleContent>
    </Collapsible>
  );
}
