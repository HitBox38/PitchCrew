import type { EmptyStateProps } from '@/components/EmptyState/types.ts';

export function EmptyState({ title, description, children }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
