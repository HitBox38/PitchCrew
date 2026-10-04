import { useState } from 'react';
import { parseTime, type Time } from '@internationalized/date';

export function useTimeFields(value: string, onValueChange: (value: string) => void) {
  const [draft, setDraft] = useState<{ source: string; time: Time | null }>(() => ({
    source: value,
    time: parseTime(value),
  }));
  if (draft.source !== value) setDraft({ source: value, time: parseTime(value) });
  function change(next: Time | null) {
    setDraft({ source: next?.toString() ?? value, time: next });
    if (next) onValueChange(next.toString());
  }
  return { time: draft.time, change };
}
