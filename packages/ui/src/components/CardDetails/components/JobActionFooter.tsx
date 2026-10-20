import type { ReactNode } from 'react';

/** Shared presentation for the app and the fictional website walkthrough. */
export const JobActionFooter = ({
  hint,
  failure,
  children,
}: {
  hint: ReactNode;
  failure?: string;
  children: ReactNode;
}) => {
  return (
    <footer className="detail-footer">
      <div className="min-w-0 flex-1">
        {hint}
        {failure ? <p className="form-error line-clamp-2">Last run: {failure}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </footer>
  );
};
