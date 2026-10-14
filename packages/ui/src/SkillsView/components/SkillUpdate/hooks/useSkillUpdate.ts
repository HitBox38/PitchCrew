import { useEffect, useRef, useState } from 'react';
import type { Skill, SkillUpdatePreview } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/index.ts';
import { previewSkillUpdate } from '../api.ts';

export function useSkillUpdate(skill: Skill, action: Action, working: boolean) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<SkillUpdatePreview | null>(null);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  function close() {
    if (working) return;
    request.current?.abort();
    setOpen(false);
    setLoading(false);
    setReview(null);
    setError('');
  }
  async function check() {
    if (loading || working) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setOpen(true);
    setLoading(true);
    setReview(null);
    setError('');
    try {
      const preview = await previewSkillUpdate(skill.id, controller.signal);
      if (!controller.signal.aborted) setReview(preview);
    } catch (error) {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : 'Could not check for updates.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  async function approve() {
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
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not update skill.');
    }
  }
  return { open, loading, review, error, working, close, check, approve };
}
