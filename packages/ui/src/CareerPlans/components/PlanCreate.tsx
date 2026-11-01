import { useState } from 'react';
import { Input } from '@/components/ui/input/index.tsx';
import { Button } from '@/components/ui/button/components/Button.tsx';
import { Modal } from '@/components/Modal/index.tsx';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges.ts';
import { DiscardChanges } from '@/components/DiscardChanges/index.tsx';
import { PlanJobPicker } from './PlanJobPicker.tsx';

/** 560px dialog: name, then any mix of role text, tag and chosen jobs. */
export const PlanCreate = ({
  change,
  close,
  working,
}: {
  change: (data: Record<string, unknown>) => Promise<unknown>;
  close: () => void;
  working: boolean;
}) => {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState('');
  const [cardIds, setCardIds] = useState<string[]>([]);
  const guard = useUnsavedChanges(!!(name || title || tag || cardIds.length));
  const requestClose = () => {
    if (!working) guard.requestLeave(close);
  };
  return (
    <>
      <Modal title="Create a career plan" onClose={requestClose} className="career-plan-dialog">
        <form
          className="career-plan-form"
          onSubmit={(event) => {
            event.preventDefault();
            void change({ action: 'plan_create', name, scope: { title, tag, cardIds } })
              .then(close)
              .catch(() => {});
          }}
        >
          <label className="field" htmlFor="career-plan-name">
            Plan name
            <Input
              id="career-plan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              required
            />
          </label>
          <div className="career-plan-form-row">
            <label className="field" htmlFor="career-plan-role">
              Target role contains
              <Input
                id="career-plan-role"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="For example, platform engineer"
                maxLength={120}
              />
            </label>
            <label className="field" htmlFor="career-plan-tag">
              Job tag
              <Input
                id="career-plan-tag"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                maxLength={80}
              />
            </label>
          </div>
          <p className="career-plan-note">
            Choose at least one filter or job. Combined filters narrow the selection.
          </p>
          <PlanJobPicker selected={cardIds} change={setCardIds} />
          <div className="career-plan-actions">
            <Button className="button" disabled={working} onClick={requestClose}>
              Cancel
            </Button>
            <Button
              className="button primary"
              type="submit"
              disabled={working || !name.trim() || !(title.trim() || tag.trim() || cardIds.length)}
            >
              Save plan
            </Button>
          </div>
        </form>
      </Modal>
      <DiscardChanges guard={guard} />
    </>
  );
};
