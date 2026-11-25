import type { ReactElement } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '@pitchcrew/design-system/button';
import type { AttentionItem } from '@/lib/attention.ts';
import { useDeskTools, type DeskTools } from '../../../hooks/useDeskTools.ts';
import type { BodyProps } from '../../../types.ts';
import { attemptOf } from '../helpers.ts';
import { OpenHeader } from './OpenHeader.tsx';
import { WaitingOn } from './WaitingOn.tsx';

type VerbsProps = { item: AttentionItem; openCard: DeskTools['openCard'] };

/**
 * Where each kind is decided. Every verb navigates or opens job details, which decide nothing on
 * their own; links render as buttons so they keep the 44px phone target.
 */
const Verbs = ({ item, openCard }: VerbsProps) => {
  const job = (label: string) =>
    item.cardId ? <Button onClick={() => openCard(item.cardId!)}>{label}</Button> : null;
  const link = (label: string, to: ReactElement, variant?: 'outline') => (
    <Button variant={variant} nativeButton={false} render={to}>
      {label}
    </Button>
  );
  switch (item.kind) {
    case 'connection':
      return link(
        'Review in Settings',
        <Link to="/settings" search={{ section: 'accounts' }} hash="remote-mcp-heading" />,
      );
    case 'profile-recovery':
    case 'profile-proposal':
      return link('Review on Profile', <Link to="/profile" />);
    case 'verify':
      return job('Verify in job details');
    case 'export':
      return job('Choose formats in job details');
    case 'blocked':
      return (
        <>
          {item.cardId
            ? job('Open job')
            : item.threadId
              ? link(
                  'Open the conversation',
                  <Link to="/chat/$thread" params={{ thread: item.threadId }} />,
                )
              : null}
          {link('Open Queue', <Link to="/queue" />, 'outline')}
        </>
      );
    case 'instruction-update':
      return link('Compare', <Link to="/crew" search={{ review: item.targetId ?? undefined }} />);
    case 'skill-update':
      return link(
        'Review update',
        <Link to="/skills" search={{ skill: item.targetId ?? undefined, review: true }} />,
      );
    default:
      return null;
  }
};

/**
 * Kinds decided in a form or on another page: the ask, any evidence worth reading first (a
 * submission's confirmation text), who asked, what waits on it, then where to decide it.
 */
export const LinkBody = ({ item, data }: BodyProps) => {
  const { openCard } = useDeskTools();
  const evidence = item.kind === 'verify' ? attemptOf(item, data)?.evidence : undefined;
  return (
    <>
      <OpenHeader item={item} data={data}>
        {evidence ? <blockquote className="needs-quote">{evidence}</blockquote> : null}
      </OpenHeader>
      <WaitingOn item={item} data={data} />
      <div className="needs-verbs">
        <Verbs item={item} openCard={openCard} />
      </div>
    </>
  );
};
