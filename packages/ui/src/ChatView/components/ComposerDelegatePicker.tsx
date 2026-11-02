import type { ChatComposerProps } from '../types.ts';
import { useRef, useState, type RefObject } from 'react';
import { Modal } from '@/components/Modal/index.tsx';
import { Button } from '@pitchcrew/design-system/button';
import { Checkbox } from '@pitchcrew/design-system/checkbox';
import { RoleAvatar } from '@/components/RoleAvatar/index.tsx';
import { delegationRoundLimits } from '@pitchcrew/core/delegation-rounds';

export const ComposerDelegatePicker = ({
  data,
  conversation,
  participants,
  draft,
  working,
  error,
  sendDelegation,
  onClose,
  returnFocus,
}: ChatComposerProps & {
  onClose: () => void;
  returnFocus: RefObject<HTMLButtonElement | null>;
}) => {
  const first = useRef<HTMLButtonElement>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const leadId = conversation?.leadId ?? participants[0] ?? '';
  const limit = delegationRoundLimits.delegates;
  const agents = data.roles.filter(
    (role) =>
      role.id !== leadId &&
      !role.retiredAt &&
      role.enabled &&
      data.runtimes.some((runtime) => runtime.id === role.runtime && runtime.available),
  );
  const lead = data.roles.find((role) => role.id === leadId);
  const text = draft.trim();
  return (
    <Modal
      title="Delegate this message"
      className="chat-editor"
      onClose={onClose}
      finalFocus={returnFocus}
    >
      <p className="modal-intro">
        Each chosen agent gets your message as its own subtask and works at the same time.{' '}
        {lead?.name ?? 'The lead'} collects every result and replies here. Choose up to {limit}.
      </p>
      <blockquote className="chat-delegate-draft">{text || 'Write the message first.'}</blockquote>
      <fieldset className="chat-participant-picker chat-delegate-picker">
        <legend className="sr-only">Delegates</legend>
        {agents.map((role) => {
          const checked = chosen.includes(role.id);
          return (
            <label key={role.id} className="chat-participant-choice checkbox-label">
              <Checkbox
                checked={checked}
                disabled={!checked && chosen.length >= limit}
                aria-label={`Delegate to ${role.name}`}
                onCheckedChange={(next) =>
                  setChosen(next ? [...chosen, role.id] : chosen.filter((id) => id !== role.id))
                }
              />
              <RoleAvatar agentRole={role.id} size="small" />
              <span>
                {role.name}
                <small className="font-normal">{role.description}</small>
              </span>
            </label>
          );
        })}
        {agents.length ? null : <p className="chat-delegate-note">No other enabled agents.</p>}
      </fieldset>
      {error ? (
        <p className="form-error mt-3" role="alert">
          {error}
        </p>
      ) : null}
      <div className="chat-panel-actions">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          ref={first}
          disabled={working || !text || !chosen.length}
          onClick={() => {
            void sendDelegation(text, chosen).then((sent) => {
              if (sent) onClose();
            });
          }}
        >
          Send to {chosen.length || 'agents'}
          {chosen.length ? (chosen.length === 1 ? ' agent' : ' agents') : ''}
        </Button>
      </div>
    </Modal>
  );
};
