import { boardActionLabels } from '@pitchcrew/core/states';
import { useState } from 'react';
import { type BoardAction, type Snapshot } from '@pitchcrew/core';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import { Button } from '@pitchcrew/design-system/button';
import { FormSelect } from '@/FormSelect/index.tsx';
import { Modal } from '@/components/Modal/index.tsx';
import { Plus } from 'lucide-react';

export const AddQueueAction = ({ data, cardId }: { data: Snapshot; cardId?: string }) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(cardId ?? data.cards[0]?.id ?? '');
  const [kind, setKind] = useState<BoardAction>('draft');
  const [error, setError] = useState('');
  const action = useWorkspaceStore((s) => s.action);
  const working = useWorkspaceStore((s) => s.working);
  const add = async () => {
    setError('');
    try {
      await action(
        '/queue/actions',
        'POST',
        { cardId: selected, action: kind, repeat: true },
        'Action queued',
      );
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add action.');
    }
  };
  return (
    <>
      <Button
        className={cardId ? 'queue-add-request' : undefined}
        variant={cardId ? 'ghost' : 'default'}
        size={cardId ? 'sm' : 'default'}
        onClick={() => {
          setError('');
          setOpen(true);
        }}
        disabled={!data.cards.length}
      >
        <Plus size={15} />
        Add action
      </Button>
      {open ? (
        <Modal
          title="Add queued action"

          onClose={() => setOpen(false)}
        >
          <div className="ui-field-group">
            <FormSelect
              label="Job"
              value={selected}
              onValueChange={setSelected}
              options={data.cards.map((c) => ({ value: c.id, label: `${c.company}: ${c.title}` }))}
            />
            <FormSelect
              label="Action"
              value={kind}
              onValueChange={(v) => setKind(v as BoardAction)}
              options={Object.entries(boardActionLabels).map(([value, label]) => ({
                value,
                label,
              }))}
            />
            {error ? (
              <p role="alert" className="form-error">
                {error}
              </p>
            ) : null}
            <div className="queue-add-footer">
              <p>Joins this job’s queue and starts when its prerequisites are ready.</p>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button disabled={working || !selected} onClick={() => void add()}>
                Add to queue
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
};
