import type { AddOpportunityProps } from '@/components/AddOpportunity/types.ts';
import { useState, type FormEvent } from 'react';
import { tagValues } from '@/TagPicker/helpers.ts';
import { provenanceFor } from '../helpers.ts';
import { useJobLookup } from './useJobLookup.ts';

export function useAddOpportunity({ action, working, onClose }: AddOpportunityProps) {
  const [error, setError] = useState('');
  const [external, setExternal] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagQuery, setTagQuery] = useState('');
  const lookup = useJobLookup();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (working) return;
    const form = new FormData(e.currentTarget);
    // A fetched posting keeps its provider provenance so later scans skip it.
    const provenance = external
      ? undefined
      : provenanceFor(lookup.prefill, String(form.get('url')));
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
          ...(provenance ? { provenance } : {}),
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
    lookup,
  };
}
