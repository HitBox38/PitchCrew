import { AlertTriangle, Check, CircleDashed, PenLine, ShieldQuestion } from 'lucide-react';
import type { DetectorProvider } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/components/Button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu/index.tsx';
import { timeAgo } from '@/lib/time.ts';
import { providerNames, scoreLabel, type AdvisoryRow, type DocumentRow } from '../helpers.ts';

const icons = { flagged: AlertTriangle, clear: Check, low: ShieldQuestion } as const;

/** One eligible document: saved results per provider, or Not checked, plus the Check menu. */
export const DetectorRow = ({
  row,
  providers,
  canAct,
  onCheck,
  onRevise,
}: {
  row: DocumentRow;
  providers: DetectorProvider[];
  canAct: boolean;
  onCheck: (provider: DetectorProvider) => void;
  onRevise: (advisory: AdvisoryRow) => void;
}) => (
  <li className="detector-row">
    <span className="detector-document">{row.label}</span>
    <ul className="detector-results" aria-label={`${row.label} detector results`}>
      {row.advisories.length ? (
        row.advisories.map((item) => {
          const Icon = icons[item.tone];
          return (
            <li
              key={item.advisory.id}
              data-tone={item.tone}
              data-outdated={item.outdated ? '' : undefined}
            >
              <Icon size={14} aria-hidden="true" />
              <span>{scoreLabel(item)}</span>
              <time dateTime={item.advisory.checkedAt}>{timeAgo(item.advisory.checkedAt)}</time>
              {item.tone === 'flagged' && !item.outdated && canAct ? (
                <Button size="sm" variant="ghost" onClick={() => onRevise(item)}>
                  <PenLine size={14} aria-hidden="true" /> Ask Writer to revise
                </Button>
              ) : null}
            </li>
          );
        })
      ) : (
        <li data-tone="none">
          <CircleDashed size={14} aria-hidden="true" />
          <span>Not checked</span>
        </li>
      )}
    </ul>
    {canAct && providers.length ? (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
          Check…
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            {providers.map((provider) => (
              <DropdownMenuItem key={provider} onClick={() => onCheck(provider)}>
                Check with {providerNames[provider]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null}
  </li>
);
