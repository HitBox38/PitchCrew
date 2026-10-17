import { api } from '@/api.ts';
import type { ReviewDetail, ReviewList, ReviewSupport } from './types.ts';
export const loadReviewSupport = (signal: AbortSignal) =>
  api<{ runtimes: ReviewSupport[] }>('/deep-review-support', 'GET', undefined, signal);
export const loadReviews = (id: string, offset: number, signal: AbortSignal) =>
  api<ReviewList>(`/cards/${id}/deep-reviews?offset=${offset}`, 'GET', undefined, signal);
export const loadReview = (id: string, reviewId: string, offset: number, signal: AbortSignal) =>
  api<ReviewDetail>(
    `/cards/${id}/deep-reviews/${reviewId}?offset=${offset}`,
    'GET',
    undefined,
    signal,
  );
