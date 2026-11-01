import { createToastManager } from '@pitchcrew/design-system/toast';
import type { CrewNotification } from './types.ts';
export const workspaceToasts = createToastManager<CrewNotification>();
