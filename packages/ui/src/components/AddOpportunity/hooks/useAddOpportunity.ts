import type { AddOpportunityProps } from '@/components/AddOpportunity/types.ts';
import { useState, type FormEvent } from 'react';
import { tagValues } from '@/TagPicker/helpers.ts';

export function useAddOpportunity({ action, working, onClose }: AddOpportunityProps) {
  const [error, setError] = useState('');
  const [external, setExternal] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagQuery, setTagQuery] = useState('');
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (working) return;
    const form = new FormData(e.currentTarget);
    setError('');
    try {
      await action(
        external ? '/tracking/external' : '/cards',
        'POST',
        {
          ...(external
            ? {
                submittedAt: new Date(String(form.get('submittedAt'))).toISOString(),
                jobIdentifier: String(form.get('jobIdentifier') ?? ''),
                note: form.get('note'),
              }
            : {}),
          company: form.get('company'),
          title: form.get('title'),
          location: form.get('location'),
          url: form.get('url'),
          salary: form.get('salary'),
          description: form.get('description'),
          tags: tagValues([...tags, ...tagQuery.split(',')]),
        },
        external ? 'External application registered' : 'Job added',
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the job.');
    }
  }
  return {
    working,
    onClose,
    error,
    setError,
    submit,
    external,
    setExternal,
    tags,
    setTags,
    tagQuery,
    setTagQuery,
  };
}
