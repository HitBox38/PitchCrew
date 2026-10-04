import { createToastManager } from '@/components/ui/toast/index.tsx';
import type { CrewNotification } from './types.ts';
export const workspaceToasts = createToastManager<CrewNotification>();
