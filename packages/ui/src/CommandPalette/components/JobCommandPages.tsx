import { CommandItem } from '@/components/ui/command/components/CommandItem.tsx';
import { jobPagePrefix } from '../helpers.ts';
import type { useJobCommands } from '../hooks/useJobCommands.ts';

export function JobCommandPages({ page, pages, setPage }: ReturnType<typeof useJobCommands>) {
  if (pages <= 1) return null;
  return (
    <>
      {page > 0 ? (
        <CommandItem value={`${jobPagePrefix}previous`} onSelect={() => setPage(page - 1)}>
          Previous job results
        </CommandItem>
      ) : null}
      {page + 1 < pages ? (
        <CommandItem value={`${jobPagePrefix}next`} onSelect={() => setPage(page + 1)}>
          Next job results
        </CommandItem>
      ) : null}
    </>
  );
}
