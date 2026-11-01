export type BeadTone = 'primary' | 'plum' | 'ochre' | 'moss' | 'teal' | 'rose' | 'current';

/** A state bead: tone follows the bead law; no tone is an empty socket. */
export const Bead = ({
  tone,
  size,
  live,
  label,
  className,
}: {
  tone?: BeadTone;
  size?: 'sm' | 'lg' | 'xl';
  live?: boolean;
  label?: string;
  className?: string;
}) => {
  return (
    <i
      className={className ? `bead ${className}` : 'bead'}
      data-tone={tone}
      data-size={size}
      data-live={live ? '' : undefined}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
};
