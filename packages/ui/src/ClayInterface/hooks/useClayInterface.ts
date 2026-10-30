import { useEffect } from 'react';
import { useDevicePreferences } from '@/lib/device-preferences.ts';

/** Marks the document so shared surfaces can adopt clay materials while the preview is on. */
export const useClayInterface = () => {
  const clay = useDevicePreferences((state) => state.clayInterface);
  useEffect(() => {
    const root = document.documentElement;
    if (clay) root.dataset.interface = 'clay';
    else delete root.dataset.interface;
    return () => {
      delete root.dataset.interface;
    };
  }, [clay]);
  return clay;
};
