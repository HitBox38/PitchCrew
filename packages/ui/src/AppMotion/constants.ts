import { createContext } from 'react';

export const claySpring = { type: 'spring', stiffness: 420, damping: 32 } as const;

export const surfaceSpring = { type: 'spring', stiffness: 320, damping: 30 } as const;

export const ReducedMotion = createContext(true);
