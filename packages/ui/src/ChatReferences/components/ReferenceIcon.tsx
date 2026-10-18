import { AtSign, Box, Slash } from 'lucide-react';
import type { ChatReference } from '@pitchcrew/core';
export function ReferenceIcon({ kind }: Pick<ChatReference, 'kind'>) {
  const Icon = kind === 'agent' ? AtSign : kind === 'skill' ? Box : Slash;
  return <Icon size={13} aria-hidden="true" />;
}
