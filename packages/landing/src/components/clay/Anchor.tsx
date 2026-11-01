import type { ComponentProps } from 'react';

/** A plain link for Base UI `render` props; the rendered control supplies its label. */
export const Anchor = ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>;
