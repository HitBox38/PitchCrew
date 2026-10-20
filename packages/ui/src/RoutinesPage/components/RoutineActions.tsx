import type { Routine } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Link } from '@tanstack/react-router';
import { Pause, Play, Pencil, Trash2 } from 'lucide-react';

export const RoutineActions = ({
  routine,
  working,
  edit,
  toggle,
  remove,
}: {
  routine: Routine;
  working: boolean;
  edit(): void;
  toggle(): void;
  remove(): void;
}) => {
  return (
    <div className="routine-actions flex flex-wrap items-center gap-2">
      <Button className="text-button" variant="ghost" size="sm" disabled={working} onClick={edit}>
        <Pencil size={14} /> Edit
      </Button>
      {routine.nextRunAt ? (
        <Button
          className="text-button"
          variant="ghost"
          size="sm"
          disabled={working}
          onClick={toggle}
        >
          {routine.enabled ? <Pause size={14} /> : <Play size={14} />}
          {routine.enabled ? 'Pause' : 'Resume'}
        </Button>
      ) : null}
      <Button
        className="icon-button danger"
        variant="ghost"
        size="icon-sm"
        disabled={working}
        onClick={remove}
        aria-label={`Delete ${routine.name}`}
      >
        <Trash2 size={15} />
      </Button>
      <Link className="routine-link" to="/chat/$thread" params={{ thread: routine.roleId }}>
        Open chat
      </Link>
      {routine.lastRunId ? (
        <Link className="routine-link" to="/activity" search={{ q: routine.name, kind: 'routine' }}>
          History
        </Link>
      ) : null}
    </div>
  );
};
