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
      className="profile-source-choice"
      disabled={disabled}
      onClick={choose}
      data-source-focus={focusKey}
    >
      <span className="profile-source-icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <span className="grid flex-1 gap-0.5">
        <span className="text-label font-semibold text-foreground">{title}</span>
        <span className="text-detail font-normal text-muted-foreground">{description}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
    </Button>
  );
};
