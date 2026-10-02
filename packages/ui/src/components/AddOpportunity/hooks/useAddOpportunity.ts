import type { AddOpportunityProps } from '@/components/AddOpportunity/types.ts';
import { useState, type FormEvent } from 'react';

export function useAddOpportunity({ action, working, onClose }: AddOpportunityProps) {
  const [error, setError] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError('');
    try {
      await action(
        '/cards',
        'POST',
        {
          company: form.get('company'),
          title: form.get('title'),
          location: form.get('location'),
          url: form.get('url'),
          salary: form.get('salary'),
          description: form.get('description'),
          tags: String(form.get('tags'))
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        },
        'Job added',
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the job.');
    }
  }
  return { working, onClose, error, setError, submit };
}
