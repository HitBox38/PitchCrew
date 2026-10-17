import type {
  ReviewRuntimeAlternative,
  Card,
  DeepReview,
  DeepReviewSummary,
  ReviewSubagent,
  RuntimeInfo,
  Snapshot,
} from '@pitchcrew/core';
export interface ReviewSupport extends RuntimeInfo {
  reviewSubagents: { maxConcurrent: number } | null;
  applicationIsolation: boolean;
}
export interface ReviewDetail {
  report: DeepReview;
  subagents: ReviewSubagent[];
  nextOffset: number | null;
}
export interface ReviewList {
  reviews: DeepReviewSummary[];
  nextOffset: number | null;
}
export interface ReviewLaunchProps {
  card: Card;
  data: Snapshot;
  working: boolean;
  disabled?: boolean;
  act: (path: string, body?: unknown, success?: string) => void;
}

export interface ReviewAlternativeRow extends ReviewRuntimeAlternative {
  id: string;
}
