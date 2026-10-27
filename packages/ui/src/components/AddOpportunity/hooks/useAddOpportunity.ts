import type { AddOpportunityProps } from '@/components/AddOpportunity/types.ts';
import { useState, type FormEvent } from 'react';
import { tagValues } from '@/TagPicker/helpers.ts';
import { provenanceFor } from '../helpers.ts';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges.ts';
import { useJobLookup } from './useJobLookup.ts';
import { useScoutJobImport } from './useScoutJobImport.ts';

export const useAddOpportunity = (props: AddOpportunityProps) => {
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (working || lookup.pending || props.saveBlocker) return;
    const form = new FormData(e.currentTarget);
    // A fetched posting keeps its provider provenance so later scans skip it.
    const provenance = external
      ? undefined
      : provenanceFor(lookup.prefill, String(form.get('url')));
    setError('');
    try {
      const fields = {
        company: form.get('company'),
        title: form.get('title'),
        location: form.get('location'),
        url: form.get('url'),
        salary: form.get('salary'),
        description: form.get('description'),
        tags: tagValues([...tags, ...tagQuery.split(',')]),
      };
      if (card) {
        await action(
          `/cards/${card.id}`,
          'PUT',
          {
            ...fields,
            expectedUpdatedAt: card.updatedAt,
          },
          'Job updated',
        );
        props.onClose();
        return;
      }
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
          ...fields,
          ...(provenance &&
          lookup.prefill?.description === form.get('description') &&
          lookup.prefill.sourceHtml
            ? { sourceHtml: lookup.prefill.sourceHtml }
            : {}),
          ...(provenance ? { provenance } : {}),
        },
        external ? 'External application registered' : 'Job added',
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not ${card ? 'update' : 'add'} the job.`);
    }
  };

  const { action } = props;
  // Keep the opened version stable while polling updates the workspace behind this form.
  const [card] = useState(props.card);
  const [dirty, setDirty] = useState(false);
  const guard = useUnsavedChanges(!!card && dirty);
  const markDirty = () => setDirty(true);
  const onClose = () => {
    if (!working) guard.requestLeave(props.onClose);
  };
  const scout = useScoutJobImport(props);
  const working = props.working || scout.pending;
  const [error, setError] = useState('');
  const [external, setExternal] = useState(false);
  const [tags, setTags] = useState<string[]>(card?.tags ?? []);
  const [tagQuery, setTagQuery] = useState('');
  const lookup = useJobLookup(card, markDirty);
  return {
    card,
    guard,
    markDirty,
    working,
    onClose,
    error: error || props.saveBlocker || '',
    setError,
    submit,
    external,
    setExternal,
    tags,
    setTags: (values: string[]) => {
      markDirty();
      setTags(values);
    },
    tagQuery,
    setTagQuery: (value: string) => {
      markDirty();
      setTagQuery(value);
    },
    lookup,
    scout,
  };
};
