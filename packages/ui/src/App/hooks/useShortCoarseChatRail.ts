import { useSyncExternalStore } from 'react';
import type { View } from '@/navigation.ts';

const query = '(height < 40rem) and (pointer: coarse)';
const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};

/** Chat gains reading space on short touch windows without changing the normal sidebar choice. */
export const useShortCoarseChatRail = (view: View | undefined) => {
  const shortCoarse = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
  return view === 'chat' && shortCoarse;
};
