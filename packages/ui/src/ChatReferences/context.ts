import { createContext } from 'react';
import type { ChatReference } from '@pitchcrew/core';
import type { ReferenceCatalog } from './types.ts';
export const ReferenceContext = createContext<{
  references: ChatReference[];
  catalog: ReferenceCatalog;
}>({ references: [], catalog: { roles: [], skills: [] } });
