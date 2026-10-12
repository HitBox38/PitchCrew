'use client';

import { useEffect, useState } from 'react';
import { analytics } from '../client';
import { analyticsConfigured } from '../config';
import { analyticsAllowed, preferenceKey, replayAllowed, replayPreferenceKey } from '../helpers';

function allowed(): boolean {
  try {
    return analyticsAllowed(window.localStorage, navigator.doNotTrack);
  } catch {
    return false;
  }
}

export function useAnalytics() {
  const [enabled, setEnabled] = useState(false);
  const [replay, setReplay] = useState(false);
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const sync = () => {
      const configured =
        analyticsConfigured() && !['1', 'yes'].includes(navigator.doNotTrack ?? '');
      const next = configured && allowed();
      setAvailable(configured);
      setEnabled(next);
      const recording = next && replayAllowed(window.localStorage, navigator.doNotTrack);
      setReplay(recording);
      void analytics.setReplayEnabled(recording);
      void analytics.setEnabled(next);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === replayPreferenceKey || event.key === preferenceKey || event.key === null)
        sync();
    };
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) analytics.capturePageview();
    };
    sync();
    window.addEventListener('pageshow', restored);
    window.addEventListener('storage', storage);
    window.addEventListener('pitchcrew-landing-consent', sync);
    return () => {
      window.removeEventListener('pageshow', restored);
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
  const toggleReplay = () => {
    if (!available || !enabled) return;
    try {
      window.localStorage.setItem(replayPreferenceKey, replay ? 'off' : 'on');
    } catch {
      return;
    }
    // Stop first, before rendering or asynchronous SDK work.
    void analytics.setReplayEnabled(!replay);
    window.dispatchEvent(new Event('pitchcrew-landing-consent'));
  };
  return { enabled, available, toggle, replay, toggleReplay };
}
