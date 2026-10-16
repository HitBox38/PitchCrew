import type { useJobCard } from '@/components/JobCard/hooks/useJobCard.ts';
import type { Card } from '@pitchcrew/core';
import type { ReactNode, Ref } from 'react';

export interface JobCardProps {
  card: Card;
  onOpen: () => void;
  stationary?: boolean;
  actions?: ReactNode;
  buttonRef?: Ref<HTMLButtonElement>;
}
export type JobCardModel = NonNullable<ReturnType<typeof useJobCard>>;
