import type { ProfileViewProps } from '@/components/ProfileView/types.ts';
import { useState, type FormEvent } from 'react';

export function useProfileView({ data, action, working }: ProfileViewProps) {
  const [name, setName] = useState(data.profile[0]?.name ?? 'profile.md');
  const [content, setContent] = useState(
    data.profile[0]?.content ??
      '# Your name\n\n- Describe one experience or achievement you can substantiate.\n',
  );
  const [error, setError] = useState('');
  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await action('/profile', 'PUT', { name, content }, 'Saved');
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save profile.');
    }
  }
  return { data, working, name, setName, content, setContent, error, setError, save };
}
