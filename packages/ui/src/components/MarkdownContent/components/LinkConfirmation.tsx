import { useState } from 'react';
import type { LinkSafetyModalProps } from 'streamdown';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { Modal } from '@/components/Modal/index.tsx';
import { Button } from '@pitchcrew/design-system/button';
import { DialogDescription } from '@pitchcrew/design-system/dialog';
import { blockUnsafeLink } from '@/Notifications/link-feedback.ts';

export const LinkConfirmation = (props: LinkSafetyModalProps) => {
  if (!props.isOpen) return null;
  return <LinkConfirmationDialog {...props} />;
};

const LinkConfirmationDialog = ({ url, onClose, onConfirm }: LinkSafetyModalProps) => {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('failed');
    }
  };
  return (
    <Modal title="Open external link?" onClose={onClose}>
      <DialogDescription className="modal-intro">
        You’re about to visit an external website.
      </DialogDescription>
      <p className="info-note max-h-32 overflow-y-auto font-mono text-sm break-all">{url}</p>
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <Button variant="outline" onClick={() => void copyLink()}>
          <span
            data-slot="icon-swap"
            data-swapped={copyStatus === 'copied' || undefined}
            aria-hidden="true"
          >
            <Copy size={16} />
            <Check size={16} />
          </span>
          {copyStatus === 'copied' ? 'Copied' : 'Copy link'}
        </Button>
        <Button
          onClick={() => {
            if (!blockUnsafeLink(url)) onConfirm();
            onClose();
          }}
        >
          <ExternalLink size={16} /> Open link
        </Button>
      </div>
      <output className="quiet mt-2 block" aria-live="polite">
        {copyStatus === 'copied'
          ? 'Link copied.'
          : copyStatus === 'failed'
            ? 'Could not copy. Select the link above to copy it.'
            : ''}
      </output>
    </Modal>
  );
};
