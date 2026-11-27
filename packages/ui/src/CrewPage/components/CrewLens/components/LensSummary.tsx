import { lensSummary, type LensRow } from '@/lib/crew-lens.ts';
import { LensStamp } from './LensStamp.tsx';

/**
 * A folded row's text: the agent's name, then its work in one line of whole facts ("Acme Robotics
 * running 12m · 3 queued · Corvid failed") while closed, or its runtime once open. Each fact wraps
 * as a unit; a separator that would start a line falls in the clipped strip at its left. Only a
 * fact's state word takes its tone, as on the wide entries.
 */
export const LensSummary = ({ row }: { row: LensRow }) => (
  <span className="crew-lens-trigger-text">
    <span className="crew-lens-trigger-name">{row.name}</span>
    {lensSummary(row).map((fact) => (
      <span key={fact.key} className="crew-lens-fact">
        <span className="crew-lens-sep" aria-hidden="true">
          ·
        </span>
        <span className="sr-only">, </span>
        {fact.text}{' '}
        <LensStamp stamp={fact.stamp} tone={fact.tone} className="crew-lens-fact-word" />
      </span>
    ))}
    <span className="crew-lens-trigger-meta">{row.meta}</span>
  </span>
);
