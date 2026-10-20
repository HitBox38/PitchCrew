import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';

export const SourceChoice = ({
  icon: Icon,
  title,
  description,
  choose,
  disabled,
  focusKey,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  choose: () => void;
  disabled: boolean;
  focusKey?: string;
}) => {
  return (
    <Button
      variant="outline"
      className="h-auto min-h-23 w-full justify-start gap-3 px-4 py-4 text-left whitespace-normal"
      disabled={disabled}
      onClick={choose}
      data-source-focus={focusKey}
    >
      <Icon size={21} className="shrink-0 text-primary" aria-hidden="true" />
      <span className="grid flex-1 gap-1">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs leading-relaxed font-normal text-muted-foreground">
          {description}
        </span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
    </Button>
  );
};
