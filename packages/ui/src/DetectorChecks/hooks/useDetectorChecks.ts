import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import type { Card, Conversation, DetectorDocument, DetectorProvider } from '@pitchcrew/core';
import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import {
  configuredProviders,
  detectorRows,
  revisionDraft,
  type AdvisoryRow,
  type Digests,
  type DocumentRow,
} from '../helpers.ts';

const sha256 = async (text: string) => {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
};
export interface Consent {
  row: DocumentRow;
  provider: DetectorProvider;
}

/** Digests the current documents in the browser so outdated results and consent bind exact text. */
export const useDetectorChecks = (card: Card) => {
  const navigate = useNavigate();
  const data = useWorkspaceStore((s) => s.data);
  const action = useWorkspaceStore((s) => s.action);
  const working = useWorkspaceStore((s) => s.working);
  const [digests, setDigests] = useState<Digests>({});
  const [consent, setConsent] = useState<Consent | null>(null);
  const cover = card.packet?.coverLetter ?? '';
  const answers = card.packet?.formAnswers ?? '';
  useEffect(() => {
    let active = true;
    void Promise.all([sha256(cover), sha256(answers)]).then(([coverLetter, formAnswers]) => {
      if (active) setDigests({ coverLetter, formAnswers });
    });
    return () => {
      active = false;
    };
  }, [cover, answers]);
  const providers = configuredProviders(data?.quality?.detectors);
  const rows = detectorRows(card, digests);
  const check = async (document: DetectorDocument, provider: DetectorProvider) => {
    const documentDigest = digests[document];
    if (!documentDigest) return;
    setConsent(null);
    await action(
      '/detectors/check',
      'POST',
      { cardId: card.id, provider, document, documentDigest },
      'Detector check saved',
    ).catch(() => {});
  };
  const askWriter = async (row: AdvisoryRow, document: DocumentRow) => {
    const writer =
      data?.roles.find((role) => role.id === 'writer') ??
      data?.roles.find((role) => role.workflow === 'writer');
    if (!writer) {
      useWorkspaceStore.getState().setToast('Create an application Writer in Crew first.', 'error');
      return;
    }
    let thread = data?.conversations?.find(
      (item) =>
        item.cardId === card.id &&
        item.participants.includes(writer.id) &&
        !['history', 'agent_dm'].includes(item.kind),
    );
    try {
      if (!thread)
        thread = (await action('/conversations', 'POST', {
          title: `${card.company}: Packet changes`.slice(0, 120),
          participants: [writer.id],
          cardId: card.id,
        })) as Conversation;
      sessionStorage.setItem(
        `pitchcrew.handoff-draft.${thread.id}`,
        revisionDraft(row, document.label, document.text),
      );
      void navigate({ to: '/chat/$thread', params: { thread: thread.id } });
    } catch {
      /* The workspace action reports the failure. */
    }
  };
  return {
    rows,
    providers,
    working,
    consent,
    setConsent,
    check,
    askWriter,
    ready: !!digests.coverLetter,
  };
};
