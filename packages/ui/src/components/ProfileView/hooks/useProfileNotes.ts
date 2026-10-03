import type { ProfileNotesProps } from '../types.ts';
import { useState } from 'react';

export function useProfileNotes({ data, sourceController }: ProfileNotesProps) {
  const [query, setQuery] = useState('');
  const paths = new Map(
    sourceController.sources.flatMap((source) =>
      source.files.map((file) => [file.name, file.path] as const),
    ),
  );
  const notes = data.profile.filter((file) =>
    `${file.name} ${paths.get(file.name) ?? ''}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  return { query, setQuery, notes, paths };
}
