import { useEffect, useState } from 'react';
import { loadReview, loadReviews } from '../api.ts';
import type { ReviewDetail, ReviewList } from '../types.ts';
export const useDeepReviews = (cardId: string, revision: string) => {
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [childPage, setChildPage] = useState(0);
  const [list, setList] = useState<ReviewList | null>(null);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void loadReviews(cardId, page, controller.signal)
      .then((value) => {
        setList(value);
        setError('');
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [cardId, page, revision, retry]);
  const reviewId = selected ?? list?.reviews[0]?.id;
  useEffect(() => {
    if (!reviewId) return;
    const controller = new AbortController();
    void loadReview(cardId, reviewId, childPage, controller.signal)
      .then((value) => {
        setDetail(value);
        setError('');
      })
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [cardId, reviewId, childPage, revision, retry]);
  return {
    list,
    detail: detail?.report.id === reviewId ? detail : null,
    page,
    childPage,
    error,
    retry: () => setRetry((value) => value + 1),
    select: (id: string) => {
      setSelected(id);
      setChildPage(0);
    },
    changePage: (offset: number) => {
      setPage(offset);
      setSelected(null);
      setChildPage(0);
      setDetail(null);
    },
    changeChildPage: setChildPage,
  };
};
