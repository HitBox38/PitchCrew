import { createContext } from 'react';
import type { RuntimeInfo } from '@pitchcrew/core';

/** The section owns the dialog so moving a row after detection cannot close setup. */
export const RuntimeSetupLauncher = createContext<((runtime: RuntimeInfo) => void) | null>(null);
