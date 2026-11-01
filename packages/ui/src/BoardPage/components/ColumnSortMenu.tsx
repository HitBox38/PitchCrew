import { ArrowDownWideNarrow } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu/index.tsx';
import { boardSortOptions, defaultBoardSort, type BoardSort } from '../sorting.ts';

/** Single-choice sort menu; the trigger names the current choice and marks a non-default one. */
export const ColumnSortMenu = ({
  label,
  sort,
  changeSort,
  disabled,
}: {
  label: string;
  sort: BoardSort;
  changeSort: (value: unknown) => void;
  disabled: boolean;
}) => {
  const selected = boardSortOptions.find((option) => option.value === sort)!;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="clay-column-sort"
            data-custom={sort === defaultBoardSort ? undefined : ''}
            disabled={disabled}
            aria-label={`Sort ${label}: ${selected.label}`}
            title={`Sort ${label}: ${selected.label}`}
          />
        }
      >
        <ArrowDownWideNarrow size={16} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Sort {label}</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuRadioGroup value={sort} onValueChange={changeSort}>
          {boardSortOptions.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} closeOnClick>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
