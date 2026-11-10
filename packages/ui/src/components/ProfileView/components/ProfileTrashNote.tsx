import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Undo2, X } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import type { ProfileViewModel } from '../types.ts';
import { noteLabel } from '../helpers.ts';

const shownFor = 10000;

/**
 * After a delete: the note's name and Undo, floating over the page (explorer open or not) for
 * ten seconds, paused while pointed at or focused, and gone once another note opens.
 * Recently deleted keeps the note restorable after that.
 */
export const ProfileTrashNote = (c: ProfileViewModel) => {
  const [held, setHeld] = useState(false);
  const { trash, activeId } = c;
  const note = useRef<HTMLOutputElement>(null);
  const latest = useRef({ dismiss: c.dismissTrash, activeId });
  const opened = useRef(activeId);
  useLayoutEffect(() => {
    latest.current = { dismiss: c.dismissTrash, activeId };
  });
  // A new deletion records the note open at that moment; opening another one dismisses Undo.
  useEffect(() => {
    opened.current = latest.current.activeId;
  }, [trash]);
  useEffect(() => {
    if (trash && activeId && opened.current !== activeId) latest.current.dismiss();
  }, [activeId, trash]);
  useEffect(() => {
    if (!trash || held) return;
    const timer = window.setTimeout(() => latest.current.dismiss(), shownFor);
    return () => window.clearTimeout(timer);
  }, [trash, held]);
  useEffect(() => {
    const element = note.current;
    if (!element) return;
    const hold = () => setHeld(true);
    const release = () => setHeld(element.matches(':hover, :focus-within'));
    const events = ['pointerenter', 'focusin'] as const;
    for (const name of events) element.addEventListener(name, hold);
    element.addEventListener('pointerleave', release);
    element.addEventListener('focusout', release);
    return () => {
      for (const name of events) element.removeEventListener(name, hold);
      element.removeEventListener('pointerleave', release);
      element.removeEventListener('focusout', release);
    };
  }, [trash]);
  if (!trash) return null;
  return (
    <output className="profile-trash-note" ref={note}>
      <span className="profile-trash-text">
        Deleted <b>{noteLabel(trash.name)}</b>
      </span>
      <Button variant="outline" size="sm" disabled={c.working} onClick={() => void c.restoreNote()}>
        <Undo2 aria-hidden="true" /> Undo
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={c.dismissTrash}>
        <X size={14} aria-hidden="true" />
      </Button>
    </output>
  );
};
