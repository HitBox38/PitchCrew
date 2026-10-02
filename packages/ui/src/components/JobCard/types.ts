import type { useJobCard } from '@/components/JobCard/hooks/useJobCard.ts';
import type { Card } from '@pitchcrew/core';

export interface JobCardProps {
  card: Card;
  onOpen: () => void;
}
export type JobCardModel = NonNullable<ReturnType<typeof useJobCard>>;
