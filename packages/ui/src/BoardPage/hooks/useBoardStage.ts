import { useState } from 'react';
import { focusStage } from '../focus.ts';

/**
 * The stage shown on phones and the target of Jump to. Jumping clears the board search, selects
 * Pipeline or Closed, then scrolls to and focuses that column heading.
 */
export const useBoardStage = (
  showClosed: boolean,
  setShowClosed: (closed: boolean) => void,
  setQuery: (query: string) => void,
) => {
  const [stage, setStage] = useState('lead');
  const select = (id: string) => {
    if (id !== 'closed' && id !== 'pipeline') setStage(id);
    setShowClosed(id === 'closed');
  };
  const jump = (id: string) => {
    setQuery('');
    select(id);
    focusStage(id);
  };
  return { current: showClosed ? 'closed' : stage, select, jump };
};
