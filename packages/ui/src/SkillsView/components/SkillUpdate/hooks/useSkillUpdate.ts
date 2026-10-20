import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { Skill, SkillUpdatePreview } from '@pitchcrew/core';
import { skillSourceRevision } from '@pitchcrew/core/skill-updates';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { Action } from '@/WorkspaceStore/index.ts';
import { previewSkillUpdate } from '../api.ts';

export const useSkillUpdate = (
  skill: Skill,
  action: Action,
  working: boolean,
  requested: boolean,
  onReviewClose: () => void,
) => {
  const close = () => {
    if (working) return;
    request.current?.abort();
    setOpen(false);
    setLoading(false);
    setReview(null);
    setError('');
    if (requested) onReviewClose();
  };
  const check = async () => {
    if (loading) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setOpen(true);
    setLoading(true);
    setReview(null);
    setError('');
    try {
      const preview = await previewSkillUpdate(skill.id, controller.signal);
      if (!controller.signal.aborted) {
        setReview(preview);
        void useWorkspaceStore
          .getState()
          .reload()
          .catch(() => {});
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : 'Could not check for updates.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };
  const approve = async () => {
    if (!review?.changed || working) return;
    setError('');
    try {
      await action(
        `/skills/${skill.id}/update/approve`,
        'POST',
        {
          previewId: review.id,
          approved: true,
        },
        'Updated skill',
      );
      setOpen(false);
      setReview(null);
      if (requested) onReviewClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not update skill.');
    }
  };
  const dismiss = async () => {
    if (!upstreamChanged || !review?.latest.source) {
      close();
      return;
    }
    try {
      await action(
        `/skills/${skill.id}/update/dismiss`,
        'POST',
        {
          revision: skillSourceRevision(review.latest.source),
        },
        'Kept your skill instructions',
      );
      close();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not dismiss this version.');
    }
  };

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<SkillUpdatePreview | null>(null);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const previousRequested = useRef(requested);
  const upstreamChanged = Boolean(
    review?.current.source &&
    review.latest.source &&
    skillSourceRevision(review.current.source) !== skillSourceRevision(review.latest.source),
  );
  const openRequestedReview = useEffectEvent(() => {
    if (requested) void check();
    else if (previousRequested.current) {
      request.current?.abort();
      setOpen(false);
      setLoading(false);
      setReview(null);
      setError('');
    }
    previousRequested.current = requested;
  });
  useEffect(() => {
    openRequestedReview();
  }, [requested]);
  useEffect(() => () => request.current?.abort(), []);
  return { open, loading, review, error, working, upstreamChanged, close, check, approve, dismiss };
};
