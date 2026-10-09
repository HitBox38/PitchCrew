import type { ChatComposerProps } from '../types.ts';
import { useRef, type RefObject } from 'react';
import { Modal } from '@/components/Modal/index.tsx';
import { Command } from '@/components/ui/command/components/Command.tsx';
import { CommandInput } from '@/components/ui/command/components/CommandInput.tsx';
import { CommandList } from '@/components/ui/command/components/CommandList.tsx';
import { CommandEmpty } from '@/components/ui/command/components/CommandEmpty.tsx';
import { CommandItem } from '@/components/ui/command/components/CommandItem.tsx';
import { BriefcaseBusiness, Check } from 'lucide-react';

export function ComposerJobPicker({
  jobItems,
  cardId,
  working,
  error,
  patchConversation,
  onClose,
  returnFocus,
}: ChatComposerProps & { onClose: () => void; returnFocus: RefObject<HTMLButtonElement | null> }) {
  const search = useRef<HTMLInputElement>(null);
  return (
    <Modal
      title="Conversation job"
      className="chat-editor"
      onClose={onClose}
      initialFocus={search}
      finalFocus={returnFocus}
    >
      <p className="modal-intro">
        Choose a job for every agent in this conversation. It stays attached across messages and
        handoffs.
      </p>
      <Command className="chat-job-picker">
        <CommandInput
          ref={search}
          aria-label="Search conversation jobs"
          placeholder="Search company or job title…"
        />
        <CommandList aria-label="Jobs">
          <CommandEmpty>
            {jobItems.some((item) => item.value)
              ? 'No matching jobs. Try another company or title.'
              : 'No jobs yet. Add a job from the board.'}
          </CommandEmpty>
          {jobItems
            .filter((item) => item.value)
            .map((item) => (
              <CommandItem
                key={item.value}
                value={item.value}
                keywords={[item.label]}
                disabled={working}
                onSelect={() => {
                  void patchConversation({ cardId: item.value }).then((saved) => {
                    if (saved) onClose();
                  });
                }}
              >
                <BriefcaseBusiness />
                <span className="min-w-0 flex-1 whitespace-normal">{item.label}</span>
                {cardId === item.value ? <Check aria-label="Current conversation job" /> : null}
              </CommandItem>
            ))}
        </CommandList>
      </Command>
      {error ? (
        <p className="form-error mt-3" role="alert">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
