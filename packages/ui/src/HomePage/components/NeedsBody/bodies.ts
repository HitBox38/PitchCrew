import type { ComponentType } from 'react';
import type { AttentionKind } from '@/lib/attention.ts';
import type { BodyProps } from '../../types.ts';
import { BrowserBody } from './components/BrowserBody.tsx';
import { DecisionsBody } from './components/DecisionsBody.tsx';
import { FailureBody } from './components/FailureBody.tsx';
import { LinkBody } from './components/LinkBody.tsx';
import { QuestionBody } from './components/QuestionBody.tsx';
import { ReviewToggle } from './components/ReviewToggle.tsx';
import { TrackingBody } from './components/TrackingBody.tsx';
import { WritingBody } from './components/WritingBody.tsx';

/**
 * Each kind's open row. A `Record` over every kind, so a kind without a body fails typecheck.
 * Kinds decided in place embed the existing deciding component; the rest link to their form.
 */
export const bodies: Record<AttentionKind, ComponentType<BodyProps>> = {
  browser: BrowserBody,
  connection: LinkBody,
  'profile-recovery': LinkBody,
  question: QuestionBody,
  failure: FailureBody,
  verify: LinkBody,
  blocked: LinkBody,
  packet: DecisionsBody,
  brief: DecisionsBody,
  export: LinkBody,
  tracking: TrackingBody,
  'role-proposal': ReviewToggle,
  'skill-proposal': ReviewToggle,
  'instruction-update': LinkBody,
  'skill-update': LinkBody,
  'writing-suggestion': WritingBody,
  'profile-proposal': LinkBody,
};
