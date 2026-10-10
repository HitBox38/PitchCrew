import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface WorkspaceNoticeProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  actions: ReactNode;
  className?: string;
}

export function WorkspaceNotice({
  title,
  icon,
  children,
  actions,
  className,
}: WorkspaceNoticeProps) {
  return (
    <aside
      className={cn('workspace-notice mb-5 flex flex-wrap items-center gap-4', className)}
      aria-label={title}
    >
      <div className="flex min-w-0 flex-1 basis-80 items-center gap-3">
        <span className="flex shrink-0" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="font-serif text-lg leading-tight">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</p>
        </div>
      </div>
      <div className="ml-auto flex max-w-full flex-wrap items-center gap-2 max-phone:ml-0 max-phone:w-full max-phone:pl-8">
        {actions}
      </div>
    </aside>
  );
}
