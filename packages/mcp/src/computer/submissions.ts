import { digestPacket, type Board } from '@pitchcrew/board';
import {
  formAssessmentInput,
  type Approval,
  type BrowserAction,
  type BrowserSnapshot,
  type Card,
  type ComputerApproval,
  type FormAssessment,
  type RoleId,
  type SubmissionAttempt,
} from '@pitchcrew/core';
import { randomUUID } from 'node:crypto';

export const pageEvidence = ({ screenshot: _screenshot, ...page }: BrowserSnapshot) => page;

export function saveAssessment(
  board: Board,
  scope: { runId: string; roleId: RoleId; cardId: string | null },
  page: BrowserSnapshot,
  raw: unknown,
) {
  if (!scope.cardId) throw new Error('Attach an application to assess its form.');
  const input = formAssessmentInput.parse(raw);
  const seen = new Set<string>();
  for (const field of input.fields) {
    const key = JSON.stringify([field.frame, field.selector]);
    if (seen.has(key)) throw new Error('Duplicate form control reference.');
    seen.add(key);
    const matches =
      page.controls?.filter(
        (control) => control.selector === field.selector && control.frame === field.frame,
      ) ?? [];
    if (matches.length !== 1)
      throw new Error('Assessment fields must reference exactly one server-inspected control.');
  }
  const fields = (page.controls ?? []).map((control) => {
    const annotation = input.fields.find(
      (field) => field.selector === control.selector && field.frame === control.frame,
    );
    return {
      ...control,
      condition: annotation?.condition ?? '',
      missingAnswer: annotation?.missingAnswer ?? '',
      assessed: !!annotation,
    };
  });
  const assessment: FormAssessment = {
    id: randomUUID(),
    ...scope,
    cardId: scope.cardId,
    page: pageEvidence(page),
    fields,
    blockers: input.blockers,
    uninspected: [...(page.uninspected ?? []), ...input.uninspected],
    createdAt: new Date().toISOString(),
  };
  board.db.transaction(() => {
    const card = board.get<Card>('card', scope.cardId!);
    board.record(
      'form_assessment',
      assessment,
      scope.roleId,
      'Saved inspected application form requirements',
    );
    board.updateCard(
      card.id,
      { formAssessments: [...(card.formAssessments ?? []), assessment].slice(-20) },
      scope.roleId,
      'Updated form requirements for Writer handoff',
    );
  })();
  return assessment;
}

export function currentExport(
  board: Board,
  cardId: string | null,
  id: string | undefined,
  allowRecorded = false,
) {
  if (!cardId || !id)
    throw new Error('Submission requires an attached card and exact exported packet.');
  const card = board.get<Card>('card', cardId);
  const exported = board.get<Approval>('approval', id);
  if (
    exported.cardId !== cardId ||
    exported.status !== 'consumed' ||
    !exported.exportDirectory ||
    !card.packet ||
    exported.digest !== digestPacket(cardId, card.packet)
  )
    throw new Error('An exported current packet for this card is required.');
  if (
    (!allowRecorded && card.state !== 'awaiting_approval') ||
    (allowRecorded &&
      ![
        'awaiting_approval',
        'submitted',
        'screening',
        'interviewing',
        'offer',
        'rejected',
        'withdrawn',
        'ghosted',
      ].includes(card.state)) ||
    board.hasActiveRun(cardId)
  )
    throw new Error(
      'Submission requires an exported awaiting-approval packet with no competing workflow.',
    );
  return exported;
}

export function assertNoUncertainSubmission(board: Board, cardId: string | null) {
  if (
    cardId &&
    board
      .list<SubmissionAttempt>('submission_attempt')
      .some((attempt) => attempt.cardId === cardId && attempt.status === 'uncertain')
  )
    throw new Error(
      'Submission outcome is uncertain. Inspect and capture confirmation, then ask the user to resolve it before any further browser interaction.',
    );
}

export function beginSubmission(board: Board, approval: ComputerApproval) {
  const action = approval.action;
  if (!('purpose' in action) || action.purpose !== 'submission') return;
  assertNoUncertainSubmission(board, approval.cardId);
  const exported = currentExport(board, approval.cardId, action.exportApprovalId);
  const attempt: SubmissionAttempt = {
    id: randomUUID(),
    cardId: exported.cardId,
    runId: approval.runId,
    roleId: approval.roleId,
    computerApprovalId: approval.id,
    exportApprovalId: exported.id,
    packetDigest: exported.digest,
    status: 'uncertain',
    before: pageEvidence(approval.page),
    createdAt: new Date().toISOString(),
  };
  const card = board.get<Card>('card', exported.cardId);
  board.record(
    'submission_attempt',
    attempt,
    'mcp',
    'Saved submission attempt before browser action; outcome uncertain',
  );
  board.updateCard(
    card.id,
    { submissionAttempts: [...(card.submissionAttempts ?? []), attempt] },
    'mcp',
    'Recorded submission attempt',
  );
}

export function resolveSubmission(
  board: Board,
  id: string,
  confirmed: boolean,
  reason: string,
  external?: { url: string; evidence: string; verified: true },
) {
  return board.db.transaction(() => {
    const attempt = board.get<SubmissionAttempt>('submission_attempt', id);
    if (attempt.status !== 'uncertain') throw new Error('Submission was already resolved.');
    if (confirmed) {
      const exported = currentExport(board, attempt.cardId, attempt.exportApprovalId, true);
      if (exported.digest !== attempt.packetDigest) throw new Error('Submission packet changed.');
      if ((!attempt.confirmation || !attempt.evidence) && !external)
        throw new Error('Capture browser confirmation evidence before confirming submission.');
      const approval = board.get<ComputerApproval>('computer_approval', attempt.computerApprovalId);
      if (
        !['consumed', 'failed'].includes(approval.status) ||
        approval.cardId !== attempt.cardId ||
        approval.runId !== attempt.runId ||
        !isSubmission(approval.action) ||
        !('exportApprovalId' in approval.action) ||
        approval.action.exportApprovalId !== attempt.exportApprovalId
      )
        throw new Error('No consumed submission action.');
      if (board.get<Card>('card', attempt.cardId).state === 'awaiting_approval')
        board.move(attempt.cardId, 'submitted', 'user', 'User verified submission confirmation');
    }
    const next: SubmissionAttempt = {
      ...attempt,
      ...(confirmed && external
        ? {
            externalConfirmation: {
              url: external.url,
              evidence: external.evidence,
              verifiedAt: new Date().toISOString(),
              provenance: 'user' as const,
            },
          }
        : {}),
      status: confirmed ? 'confirmed' : 'not_submitted',
      resolvedAt: new Date().toISOString(),
    };
    board.record('submission_attempt', next, 'user', reason);
    const card = board.get<Card>('card', attempt.cardId);
    board.updateCard(
      card.id,
      {
        submissionAttempts: card.submissionAttempts?.map((item) => (item.id === id ? next : item)),
      },
      'user',
      'Resolved submission outcome',
    );
    return next;
  })();
}

export function isSubmission(action: BrowserAction) {
  return 'purpose' in action && action.purpose === 'submission';
}
