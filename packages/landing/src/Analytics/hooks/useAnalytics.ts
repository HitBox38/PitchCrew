'use client';

import { useEffect, useState } from 'react';
import { analytics } from '../client';
import { analyticsConfigured } from '../config';
import { analyticsAllowed, preferenceKey } from '../helpers';

function allowed(): boolean {
  try {
    return analyticsAllowed(window.localStorage, navigator.doNotTrack);
  } catch {
    return false;
  }
}

export function useAnalytics() {
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const sync = () => {
      const configured =
        analyticsConfigured() && !['1', 'yes'].includes(navigator.doNotTrack ?? '');
      const next = configured && allowed();
      setAvailable(configured);
      setEnabled(next);
      void analytics.setEnabled(next);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === preferenceKey || event.key === null) sync();
    };
    sync();
    window.addEventListener('storage', storage);
    window.addEventListener('pitchcrew-landing-consent', sync);
    return () => {
      window.removeEventListener('storage', storage);
      window.removeEventListener('pitchcrew-landing-consent', sync);
      void analytics.setEnabled(false);
    };
  }, []);
  const toggle = () => {
    if (!available) return;
    try {
      window.localStorage.setItem(preferenceKey, enabled ? 'off' : 'on');
    } catch {
      return;
    }
    window.dispatchEvent(new Event('pitchcrew-landing-consent'));
  };
  return { enabled, available, toggle };
}
