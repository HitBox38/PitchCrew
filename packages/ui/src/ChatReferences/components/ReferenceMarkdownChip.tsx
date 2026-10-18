import { useContext, type ComponentProps } from 'react';
import { ReferenceContext } from '../context.ts';
import { ReferenceChip } from './ReferenceChip.tsx';
export function ReferenceMarkdownChip({
  index,
  children,
}: ComponentProps<'span'> & { index?: string | number }) {
  const { references, catalog } = useContext(ReferenceContext);
  const reference = references[Number(index)];
  return reference ? (
    <ReferenceChip reference={reference} catalog={catalog} />
  ) : (
    <span>{children}</span>
  );
}
