import type { CompanyMarkProps } from '@/components/CompanyMark/types.ts';

export function CompanyMark({ name }: CompanyMarkProps) {
  const colors = ['violet', 'blue', 'pink', 'green', 'orange'];
  let hash = 0;
  for (const c of name) hash += c.charCodeAt(0);
  return (
    <span className={`company-mark ${colors[hash % colors.length]}`} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
