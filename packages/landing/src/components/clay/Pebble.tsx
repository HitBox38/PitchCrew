import type { ReactNode } from 'react';

export type Role =
  | 'scout'
  | 'writer'
  | 'reviewer'
  | 'submitter'
  | 'tracker'
  | 'documenter'
  | 'pipeline-coach'
  | 'career-coach'
  | 'you';

/** Identity orb: the only round, shaded object. Role tones come from `data-role`. */
export const Pebble = ({
  agent,
  size,
  label,
  children,
}: {
  agent?: Role;
  size?: number;
  label?: string;
  children: ReactNode;
}) => {
  return (
    <span
      className="pebble"
      data-role={agent}
      style={size ? ({ '--pebble-size': `${size}px` } as React.CSSProperties) : undefined}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {children}
    </span>
  );
};
