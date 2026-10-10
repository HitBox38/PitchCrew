'use client';

import { useState, useSyncExternalStore } from 'react';
import { detectPlatform } from '../helpers';
import type { Platform } from '../types';

const subscribe = () => () => {};
const getPlatform = () => detectPlatform(navigator.userAgent);
const serverPlatform = () => undefined;

export function usePlatform() {
  const detected = useSyncExternalStore(subscribe, getPlatform, serverPlatform);
  const [selected, select] = useState<Platform>();
  return { platform: selected ?? detected ?? 'mac', select };
}
