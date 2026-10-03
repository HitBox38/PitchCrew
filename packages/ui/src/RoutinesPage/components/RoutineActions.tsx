import type { Routine } from '@pitchcrew/core';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Link } from '@tanstack/react-router';
import { Pause, Play, Pencil, Trash2 } from 'lucide-react';

export function RoutineActions({
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
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button className="button" disabled={working} onClick={edit}>
        <Pencil size={14} /> Edit
      </Button>
      {routine.nextRunAt ? (
        <Button className="button" disabled={working} onClick={toggle}>
          {routine.enabled ? <Pause size={14} /> : <Play size={14} />}
          {routine.enabled ? 'Pause' : 'Resume'}
        </Button>
      ) : null}
      <Button
        variant="ghost"
        disabled={working}
        onClick={remove}
        aria-label={`Delete ${routine.name}`}
      >
        <Trash2 size={15} />
      </Button>
      <Link
        className="text-sm underline underline-offset-4"
        to="/chat/$thread"
        params={{ thread: routine.roleId }}
      >
        Open chat
      </Link>
      {routine.lastRunId ? (
        <Link
          className="text-sm underline underline-offset-4"
          to="/activity"
          search={{ q: routine.name, kind: 'routine' }}
        >
          History
        </Link>
      ) : null}
    </div>
  );
}
