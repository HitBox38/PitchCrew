import type { JobContextSelectProps } from '@/ChatView/components/types.ts';
import { SelectContent } from '@/components/ui/select/components/SelectContent.tsx';
import { SelectItem } from '@/components/ui/select/components/SelectItem.tsx';
import { SelectTrigger } from '@/components/ui/select/components/SelectTrigger.tsx';
import { SelectValue } from '@/components/ui/select/components/SelectValue.tsx';
import { Select } from '@/components/ui/select/constants.ts';
import { BriefcaseBusiness } from 'lucide-react';

export function JobContextSelect({
  cardId,
  jobItems,
  busy,
  working,
  setJobs,
  thread,
  attached,
}: JobContextSelectProps) {
  return (
    <Select
      value={cardId}
      items={jobItems}
      disabled={busy || working}
      onValueChange={(value: string | null) => {
        if (value !== null) setJobs((current) => ({ ...current, [thread]: value }));
      }}
    >
      <SelectTrigger
        className={`chat-context-select chat-job-select ${attached ? 'attached' : ''}`}
        aria-label="Attach job context"
        size="sm"
      >
        <BriefcaseBusiness size={14} />
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        side="top"
        align="start"
        alignItemWithTrigger={false}
        className="chat-job-menu"
      >
        {jobItems.map((item) => (
          <SelectItem value={item.value} key={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
