import { useContext, type ComponentProps } from 'react';
import { ReferenceContext } from '../context.ts';
import { ReferenceChip } from './ReferenceChip.tsx';
export const ReferenceMarkdownChip = ({
  index,
  children,
}: ComponentProps<'span'> & { index?: string | number }) => {
  const { references, catalog, mention } = useContext(ReferenceContext);
  const reference = references[Number(index)];
  return reference ? (
    <ReferenceChip reference={reference} catalog={catalog} mention={mention} />
  ) : (
    <span>{children}</span>
  );
};
