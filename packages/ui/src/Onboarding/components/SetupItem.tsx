import { Check, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button/components/Button.tsx';

export function SetupItem({
  title,
  description,
  done,
  label,
  action,
  disabled,
}: {
  title: string;
  description: string;
  done: boolean;
  label: string;
  action: () => void;
  disabled: boolean;
}) {
  const Icon = done ? Check : Circle;
  return (
    <li className="grid grid-cols-[19px_minmax(0,1fr)_auto] items-start gap-3 border-t border-border py-4 max-phone:grid-cols-[19px_minmax(0,1fr)]">
      <Icon
        size={19}
        className={done ? 'mt-0.5 shrink-0 text-teal' : 'mt-0.5 shrink-0 text-muted-foreground'}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold">
          {title}
          <span className="sr-only">{done ? ': Complete' : ': To do'}</span>
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Button
        className="button small shrink-0 max-phone:col-start-2 max-phone:justify-self-start"
        disabled={disabled}
        onClick={action}
      >
        {done ? 'Review' : label}
      </Button>
    </li>
  );
}
