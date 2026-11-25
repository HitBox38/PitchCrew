import { cn } from '@pitchcrew/design-system/utils';
import type { BeadTone } from '../helpers.ts';

export type BeadProps = {
  /** Bead law: ochre waits on the user, plum executes, rose failed, primary done, moss recorded. */
  tone?: BeadTone | 'rose' | 'done';
  size?: 'sm' | 'lg';
  /** Breathes while an agent executes; a wait on the user stays still. */
  live?: boolean;
  /** Read to screen readers in place of the bead. */
  label?: string;
  className?: string;
};

/**
 * One clay bead: any tone with or without the live breath, which `StatusBead` and `JobBead`
 * cannot show together. Without a tone it is an empty socket (idle work).
 */
export const Bead = ({ tone, size, live, label, className }: BeadProps) => (
  <>
    <span
      className={cn('clay-bead', className)}
      data-tone={tone}
      data-size={size}
      data-live={live ? '' : undefined}
      data-empty={tone ? undefined : ''}
      aria-hidden="true"
    />
    {label ? <span className="sr-only">{label}</span> : null}
  </>
);
