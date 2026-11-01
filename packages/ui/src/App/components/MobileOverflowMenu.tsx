import { Bell, Briefcase, FilePlus2, MessageSquarePlus, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PopoverTitle } from '@pitchcrew/design-system/popover';
import { useNewActions } from '@/AppSidebar/hooks/useNewActions.ts';

type MobileOverflowMenuProps = {
  unread: number;
  close: () => void;
  showNotifications: () => void;
  onSearch: () => void;
  onAddJob: () => void;
};

/** The overflow's rows: Notifications with its unread count, Search, then the New actions. */
export const MobileOverflowMenu = ({
  unread,
  close,
  showNotifications,
  onSearch,
  onAddJob,
}: MobileOverflowMenuProps) => {
  const create = useNewActions(onAddJob);
  const closing = (action: () => unknown) => () => {
    close();
    void action();
  };
  const rows: { label: string; icon: LucideIcon; meta?: string; run: () => void }[] = [
    {
      label: 'Notifications',
      icon: Bell,
      meta: unread ? `${unread} unread` : undefined,
      run: showNotifications,
    },
    { label: 'Search', icon: Search, run: closing(onSearch) },
    { label: 'New job', icon: Briefcase, run: closing(create.addJob) },
    {
      label: 'New conversation',
      icon: MessageSquarePlus,
      run: closing(create.newConversation),
    },
    { label: 'New note', icon: FilePlus2, run: closing(create.newNote) },
  ];
  return (
    <>
      <PopoverTitle className="sr-only">More</PopoverTitle>
      <ul className="workspace-overflow-list">
        {rows.map(({ label, icon: Icon, meta, run }) => (
          <li key={label}>
            <button type="button" onClick={run}>
              <Icon size={16} aria-hidden="true" />
              <span>{label}</span>
              {meta ? <span className="workspace-overflow-meta">{meta}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
};
