import type { ReactNode } from 'react';
import { CollapsibleTrigger } from '@/components/ui/collapsible/components/CollapsibleTrigger.tsx';
import { SidebarGroupLabel } from '@/components/ui/sidebar/components/SidebarGroupLabel.tsx';
import { ChevronRight } from 'lucide-react';

/**
 * A category or sub-group heading: its label, an optional state bead, then its count on the
 * trailing edge before the chevron.
 */
export const SidebarCategoryTrigger = ({
  label,
  count,
  indicator,
}: {
  label: string;
  count?: number;
  indicator?: ReactNode;
}) => {
  return (
    <CollapsibleTrigger
      render={
        <SidebarGroupLabel
          render={<button type="button" aria-label={label} />}
          className="sidebar-category-toggle w-full cursor-pointer group-data-[collapsible=icon]:hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        />
      }
    >
      <span className="sidebar-category-label">{label}</span>
      {indicator}
      {count !== undefined ? <span className="sidebar-category-count">{count}</span> : null}
      <ChevronRight aria-hidden="true" />
    </CollapsibleTrigger>
  );
};
