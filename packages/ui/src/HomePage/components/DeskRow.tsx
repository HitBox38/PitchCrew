import type { Snapshot } from '@pitchcrew/core';
import { rowLine } from '../helpers.ts';
import type { DeskEntry, DeskState } from '../types.ts';
import { NeedsRecord } from './NeedsRecord.tsx';
import { NeedsRow } from './NeedsRow.tsx';

export type EntryProps = {
  entry: DeskEntry;
  desk: DeskState;
  data: Snapshot;
  now: number;
  /** The record made while the desk was on screen, which settles in. */
  fresh: number;
};

/**
 * One desk entry: a record line, or a row whose body draws from the live snapshot (or the view it
 * was decided from, while its call runs and a poll left it out). Only an open or visited row gets
 * the snapshot, so closed rows skip the chat stream's updates.
 */
export const DeskRow = ({ entry, desk, data, now, fresh }: EntryProps) => {
  if (entry.type === 'record')
    return <NeedsRecord record={entry.record} fresh={entry.record.seq === fresh} />;
  const from = entry.kept ?? data;
  const open = desk.openKey === entry.key;
  const kept = desk.visited.has(entry.key);
  return (
    <NeedsRow
      item={entry.item}
      line={rowLine(entry.item, from, now)}
      open={open}
      kept={kept}
      data={open || kept ? from : undefined}
      armedAt={open ? desk.armedAt : 0}
    />
  );
};
