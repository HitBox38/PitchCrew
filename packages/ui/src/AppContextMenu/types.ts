import type { WorkspaceModel } from '@/App/types.ts';
import type { ReactNode } from 'react';

export type AppContextMenuProps = Pick<
  WorkspaceModel,
  'go' | 'view' | 'setPaletteOpen' | 'setAdd' | 'working' | 'reload'
> & { children: ReactNode };
