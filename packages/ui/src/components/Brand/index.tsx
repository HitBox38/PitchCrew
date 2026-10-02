import type { BrandProps } from '@/components/Brand/types.ts';

export function Brand({ compact = false }: BrandProps) {
  return (
    <div className="brand">
      <img src="/favicon.svg" width="26" height="26" alt="" aria-hidden="true" />
      {!compact ? <span>pitchcrew</span> : null}
    </div>
  );
}
