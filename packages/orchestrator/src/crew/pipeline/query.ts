import {
  decodeEvent,
  pipelineQuery,
  type BoardEvent,
  type Card,
  type PipelineReview,
  type Role,
  type Run,
  type Skill,
} from '@pitchcrew/core';
import type { Board } from '@pitchcrew/board';
import { configRevision, packetDigest } from './snapshots.ts';

export const pipelineEvidenceKinds = [
  'card',
  'run',
  'role',
  'proposal',
  'skill',
  'skill_proposal',
  'pipeline_review',
  'tracking_signal',
  'tracking_scan',
  'profile_proposal',
  'form_assessment',
  'submission_attempt',
];
export function eventSummary(event: BoardEvent) {
  const base = {
    id: event.id,
    kind: event.kind,
    entityId: event.entityId,
    actor: event.actor,
    createdAt: event.createdAt,
    message: event.message.slice(0, 500),
  };
  if (event.kind === 'card') {
    const card = event.data as Card;
    return {
      ...base,
      cardId: card.id,
      state: card.state,
      feedback: card.feedback.slice(0, 10).map((item) => item.slice(0, 500)),
      packetDigest: packetDigest(card),
    };
  }
  if (event.kind === 'run') {
    const run = event.data as Run;
    return {
      ...base,
      cardId: run.cardId,
      roleId: run.roleId,
      status: run.status,
      configurationRevision: run.configuration?.revision,
      inputPacketDigest: run.inputPacketDigest,
      outputPacketDigest: run.outputPacketDigest,
    };
  }
  const data = event.data as unknown as Record<string, unknown>;
  const metadata = Object.fromEntries(
    [
      'cardId',
      'roleId',
      'runId',
      'status',
      'state',
      'effectiveAt',
      'complete',
      'processedCount',
      'packetDigest',
    ]
      .filter((key) => ['string', 'number', 'boolean'].includes(typeof data[key]))
      .map((key) => [key, data[key]]),
  );
  return { ...base, ...metadata };
}
function boundedDetail(value: Record<string, unknown>): Record<string, unknown> {
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 512000)
    throw new Error(
      'Selected review data exceeds the 512 KB detail limit. Narrow the review or skills assignment.',
    );
  return value;
}
export function readPipeline(board: Board, input: unknown): Record<string, unknown> {
  const query = pipelineQuery.parse(input);
  if (['run_configuration', 'role_configuration', 'packet', 'review'].includes(query.section)) {
    if (!query.entityId) throw new Error('Select an entity ID for a detailed review.');
    if (query.section === 'review') {
      const review = board.get<PipelineReview>('pipeline_review', query.entityId);
      if (
        (query.scope.cardIds.length &&
          !review.scope.cardIds.some((id) => query.scope.cardIds.includes(id))) ||
        (query.scope.from && review.createdAt < query.scope.from) ||
        (query.scope.to && review.createdAt > query.scope.to)
      )
        throw new Error('Review is outside the requested scope.');
      return boundedDetail({ review });
    }
    if (query.section === 'role_configuration') {
      const role = board.get<Role>('role', query.entityId);
      const skills = board
        .list<Skill>('skill')
        .filter((s) => !s.deletedAt && (s.scope === 'all' || s.roleIds.includes(role.id)));
      return boundedDetail({ role, revision: configRevision(role), skills });
    }
    if (query.section === 'packet') {
      const card = board.get<Card>('card', query.entityId);
      if (query.scope.cardIds.length && !query.scope.cardIds.includes(card.id))
        throw new Error('Packet is outside the requested applications.');
      return boundedDetail({
        cardId: card.id,
        packet: card.packet,
        digest: packetDigest(card),
        note: 'This is the current packet. Run input/output digests identify the historical version used.',
      });
    }
    const run = board.get<Run>('run', query.entityId);
    if (query.scope.cardIds.length && !query.scope.cardIds.includes(run.cardId ?? ''))
      throw new Error('Run is outside the requested applications.');
    if (
      (query.scope.from && run.startedAt < query.scope.from) ||
      (query.scope.to && run.startedAt > query.scope.to)
    )
      throw new Error('Run is outside the requested dates.');
    return boundedDetail({
      runId: run.id,
      configuration: run.configuration ?? null,
      inputPacketDigest: run.inputPacketDigest,
      outputPacketDigest: run.outputPacketDigest,
    });
  }
  const kind = {
    cards: 'card',
    runs: 'run',
    roles: 'role',
    events: '',
    reviews: 'pipeline_review',
  }[query.section as 'cards' | 'runs' | 'roles' | 'events' | 'reviews'];
  const events = query.section === 'events';
  const field =
    query.section === 'cards' ? 'updatedAt' : query.section === 'runs' ? 'startedAt' : 'createdAt';
  const where = [
    events
      ? `json_extract(e.json,'$.kind') IN (${pipelineEvidenceKinds.map((kind) => `'${kind}'`).join(',')})`
      : 'kind = ?',
  ];
  const args: (string | number)[] = events ? [] : [kind];
  where.push(`${events ? 'id' : 'rowid'} > ?`);
  args.push(query.cursor);
  const root = events ? '$.data.' : '$.';
  if (query.section !== 'roles') {
    if (query.scope.from) {
      where.push(`json_extract(e.json, '${events ? '$.createdAt' : root + field}') >= ?`);
      args.push(query.scope.from);
    }
    if (query.scope.to) {
      where.push(`json_extract(e.json, '${events ? '$.createdAt' : root + field}') <= ?`);
      args.push(query.scope.to);
    }
    if (query.scope.cardIds.length) {
      const marks = query.scope.cardIds.map(() => '?').join(',');
      const cardField = query.section === 'cards' ? 'id' : 'cardId';
      if (query.section === 'reviews') {
        where.push(
          `EXISTS (SELECT 1 FROM json_each(e.json, '$.scope.cardIds') WHERE value IN (${marks}))`,
        );
      } else if (events) {
        where.push(
          `(json_extract(e.json,'$.kind') IN ('role','proposal','skill','skill_proposal') OR json_extract(e.json,'$.data.cardId') IN (${marks}) OR (json_extract(e.json,'$.kind') = 'card' AND json_extract(e.json,'$.data.id') IN (${marks})) OR (json_extract(e.json,'$.kind') = 'tracking_signal' AND EXISTS (SELECT 1 FROM json_each(e.json, '$.data.candidateIds') WHERE value IN (${marks}))) OR (json_extract(e.json,'$.kind') = 'pipeline_review' AND EXISTS (SELECT 1 FROM json_each(e.json, '$.data.scope.cardIds') WHERE value IN (${marks}))))`,
        );
        args.push(...query.scope.cardIds, ...query.scope.cardIds, ...query.scope.cardIds);
      } else where.push(`json_extract(e.json, '${root + cardField}') IN (${marks})`);
      args.push(...query.scope.cardIds);
    }
  }
  const rows = board.db
    .prepare(
      `SELECT e.${events ? 'id' : 'rowid'} AS cursor,e.json FROM ${events ? 'events' : 'entities'} AS e WHERE ${where.join(' AND ')} ORDER BY ${events ? 'id' : 'rowid'} LIMIT ?`,
    )
    .all(...args, query.limit + 1) as { cursor: number; json: string }[];
  const items: unknown[] = [];
  let size = 0;
  let cursor = query.cursor;
  for (const row of rows.slice(0, query.limit)) {
    const raw = JSON.parse(row.json) as Card & Role & Run & PipelineReview;
    const item = events
      ? eventSummary({ ...decodeEvent(row.json), id: row.cursor })
      : query.section === 'cards'
        ? {
            id: raw.id,
            company: raw.company,
            title: raw.title,
            state: raw.state,
            fit: raw.fit,
            feedback: raw.feedback.slice(0, 10).map((text) => text.slice(0, 500)),
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
            packetDigest: packetDigest(raw),
          }
        : query.section === 'roles'
          ? {
              id: raw.id,
              name: raw.name,
              description: raw.description,
              runtime: raw.runtime,
              model: raw.model,
              enabled: raw.enabled,
              capabilities: raw.capabilities,
              revision: configRevision(raw),
              assignedSkillIds: board
                .list<Skill>('skill')
                .filter(
                  (skill) =>
                    !skill.deletedAt && (skill.scope === 'all' || skill.roleIds.includes(raw.id)),
                )
                .map((s) => s.id),
            }
          : query.section === 'runs'
            ? {
                id: raw.id,
                roleId: raw.roleId,
                cardId: raw.cardId,
                runtime: raw.runtime,
                status: raw.status,
                mode: raw.mode,
                startedAt: raw.startedAt,
                finishedAt: raw.finishedAt,
                configurationRevision: raw.configuration?.revision ?? null,
                skillsRevision: raw.configuration?.skillsRevision ?? null,
                inputPacketDigest: raw.inputPacketDigest,
                outputPacketDigest: raw.outputPacketDigest,
              }
            : {
                id: raw.id,
                roleId: raw.roleId,
                title: raw.title,
                scope: raw.scope,
                criteria: raw.criteria,
                findingCount: raw.findings.length,
                seats: raw.seats,
                followups: raw.followups.map((followup) => ({
                  findingId: followup.findingId,
                  status: followup.status,
                  metrics: followup.metrics,
                })),
                createdAt: raw.createdAt,
                updatedAt: raw.updatedAt,
              };
    const length = Buffer.byteLength(JSON.stringify(item), 'utf8');
    if (length > 160000)
      throw new Error('An item exceeds the summary byte limit. Fetch its details separately.');
    if (size + length > 160000) break;
    items.push(item);
    size += length;
    cursor = row.cursor;
  }
  return {
    section: query.section,
    scope: query.scope,
    items,
    nextCursor: rows.some((row) => row.cursor > cursor) ? cursor : null,
    limits: { maximumItems: 50, maximumBytes: 160000 },
    note: 'Board evidence describes observations. Application outcomes alone do not establish causation. Missing historical run configurations remain unknown. Role listings ignore card/date filters so every seat can be assessed.',
  };
}
