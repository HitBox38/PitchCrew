import type { ComponentProps } from 'react';
import type { ActivityGroup } from '@/ChatTurn/components/ActivityGroup.tsx';

export type Activity = ComponentProps<typeof ActivityGroup>['entries'][number];
