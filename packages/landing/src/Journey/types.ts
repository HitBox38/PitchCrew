import type { ComponentProps } from 'react';
import type { BriefSummary } from '@/ApplicationBriefReview/components/BriefSummary.tsx';
import type { JobHeading } from '@/components/CardDetails/components/JobHeading.tsx';
import type { JobHistory } from '@/components/CardDetails/components/JobHistory.tsx';

export type DemoCard = ComponentProps<typeof JobHeading>['card'];
export type DemoBrief = ComponentProps<typeof BriefSummary>['value'];
export type DemoSnapshot = ComponentProps<typeof JobHistory>['data'];
export type DemoEvent = DemoSnapshot['events'][number];
export type DemoDocument = 'resume' | 'coverLetter' | 'formAnswers' | 'note';
export type DemoTab = 'overview' | 'packet' | 'history';
