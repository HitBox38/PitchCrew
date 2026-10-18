// Custom rows keep textarea focus through aria-activedescendant; a native select cannot render them.
/* oxlint-disable jsx-a11y/prefer-tag-over-role */
import { useEffect, useRef } from 'react';
import type { ComposerSuggestion } from '../types.ts';
import { ReferenceIcon } from '@/ChatReferences/components/ReferenceIcon.tsx';

export function SuggestionList({
  id,
  symbol,
  items,
  active,
  choose,
}: {
  id: string;
  symbol: string;
  items: ComposerSuggestion[];
  active: number;
  choose: (item: ComposerSuggestion) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  return (
    <div className="chat-suggestions" onPointerDown={(event) => event.preventDefault()}>
      <div className="chat-suggestions-heading">
        {symbol === '@'
          ? 'Conversation participants'
          : symbol === '$'
            ? 'Assigned skills'
            : 'Actions and skills'}
      </div>
      <div
        id={id}
        ref={list}
        role="listbox"
        aria-label="Message suggestions"
        className="chat-suggestions-list"
      >
        {!items.length ? <output>No matches. Keep typing or press Escape.</output> : null}
        {items.map((item, index) => (
          <div
            key={item.key}
            id={`${id}-${index}`}
            role="option"
            tabIndex={-1}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !item.disabled) choose(item);
            }}
            aria-selected={active === index}
            aria-disabled={!!item.disabled}
            className="chat-suggestion"
            onClick={() => {
              if (!item.disabled) choose(item);
            }}
          >
            <ReferenceIcon kind={item.reference?.kind ?? 'action'} />
            <span>
              <strong>{item.label}</strong>
              <small>{item.disabled ?? item.description}</small>
            </span>
          </div>
        ))}
      </div>
      <div className="chat-suggestions-help">↑ ↓ navigate · Tab / Enter choose · Escape close</div>
    </div>
  );
}
