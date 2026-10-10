import { CollapsibleTrigger } from '@/components/ui/collapsible/components/CollapsibleTrigger.tsx';
import { SidebarGroupLabel } from '@/components/ui/sidebar/components/SidebarGroupLabel.tsx';
import { ChevronRight } from 'lucide-react';

export function SidebarCategoryTrigger({ label, count }: { label: string; count?: number }) {
  return (
    <CollapsibleTrigger
      render={
        <SidebarGroupLabel
          render={<button type="button" aria-label={label} />}
          className="sidebar-category-toggle w-full cursor-pointer justify-between group-data-[collapsible=icon]:hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        />
      }
    >
      <span>
        {label}
        {count !== undefined ? (
          <span className="ml-2 font-normal tabular-nums">{count}</span>
        ) : null}
      </span>
      <ChevronRight aria-hidden="true" />
    </CollapsibleTrigger>
  );
}
