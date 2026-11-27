import { memo, useLayoutEffect, useRef, useState } from 'react';
import type { Snapshot } from '@pitchcrew/core';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@pitchcrew/design-system/accordion';
import type { AttentionItem } from '@/lib/attention.ts';
import { deepEqual } from '@/lib/share-equal.ts';
import { useDeskTools } from '../hooks/useDeskTools.ts';
import type { RowLine } from '../types.ts';
import { NeedsBody } from './NeedsBody/index.tsx';
import { NeedsRowLine } from './NeedsRowLine.tsx';

type NeedsRowProps = {
  item: AttentionItem;
  line: RowLine;
  open: boolean;
  /** Opened this visit: its body stays mounted while closed, so drafts survive. */
  kept: boolean;
  /** The snapshot its body draws from, only while the body can be mounted. */
  data?: Snapshot;
  armedAt: number;
};

/** Rows compare their snapshot by identity and everything else by content. */
const same = ({ data: a, ...prev }: NeedsRowProps, { data: b, ...next }: NeedsRowProps) =>
  a === b && deepEqual(prev, next);

/**
 * One Needs you row: its line is the accordion trigger, and its panel holds the open row. A row
 * that unmounts while it holds focus (decided, resolved elsewhere or moved to another tier) hands
 * focus back to the desk.
 */
export const NeedsRow = memo(({ item, line, open, kept, data, armedAt }: NeedsRowProps) => {
  const { lost } = useDeskTools();
  const row = useRef<HTMLDivElement>(null);
  const [focusWithin, setFocusWithin] = useState(false);
  useLayoutEffect(() => {
    const element = row.current;
    return () => {
      if (element?.contains(document.activeElement)) lost(item.key);
    };
  }, [lost, item.key]);
  return (
    <AccordionItem
      ref={row}
      value={item.key}
      className="needs-row"
      data-kind={item.kind}
      data-tone={item.tone}
      data-needs-key={item.key}
      onFocus={() => setFocusWithin(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusWithin(false);
      }}
    >
      <AccordionTrigger className="needs-trigger" data-needs-trigger={item.key}>
        <NeedsRowLine line={line} tone={item.tone} open={open} />
      </AccordionTrigger>
      <AccordionContent keepMounted={kept} className="needs-panel">
        {data ? (
          <NeedsBody
            item={item}
            data={data}
            open={open}
            armedAt={armedAt}
            focusWithin={focusWithin}
          />
        ) : null}
      </AccordionContent>
    </AccordionItem>
  );
}, same);
