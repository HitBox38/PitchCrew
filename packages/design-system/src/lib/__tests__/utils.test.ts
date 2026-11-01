import { describe, expect, it } from 'vitest';
import { cn } from '../utils.ts';

describe('design-token class composition', () => {
  it('preserves custom font sizes alongside text colors and merges each independently', () => {
    expect(cn('text-body text-muted-foreground', 'text-label text-primary')).toBe(
      'text-label text-primary',
    );
    expect(cn('primitive:text-body primitive:text-primary', 'text-detail text-foreground')).toBe(
      'primitive:text-body primitive:text-primary text-detail text-foreground',
    );
  });

  it('keeps material shadow recipes distinct from shadow colors', () => {
    expect(cn('shadow-clay shadow-primary', 'shadow-sheet shadow-teal')).toBe(
      'shadow-sheet shadow-teal',
    );
  });

  it('merges defaults within their layer while retaining caller overrides', () => {
    expect(cn('primitive:h-9 primitive:px-4', 'primitive:h-10', 'h-6.5 px-2')).toBe(
      'primitive:px-4 primitive:h-10 h-6.5 px-2',
    );
    expect(cn('ease-in', 'ease-material', 'ease-drawer')).toBe('ease-drawer');
  });
});
