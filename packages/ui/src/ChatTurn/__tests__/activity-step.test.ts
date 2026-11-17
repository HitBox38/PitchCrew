import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { RunActivity } from '@pitchcrew/core';
import { runtimeStepId } from '@pitchcrew/core/tool-activity';
import { TraceCollapsible } from '@pitchcrew/design-system/trace';
import { ActivityStep } from '../components/ActivityStep.tsx';
import { ActivityStepDetails } from '../components/ActivityStepDetails.tsx';
import { codeTarget, stepGlyph, stepReason } from '../helpers.ts';

vi.mock('@/WorkspaceStore/index.ts', () => ({
  useWorkspaceStore: (select: (state: { data: undefined }) => unknown) =>
    select({ data: undefined }),
}));

const at = '2026-11-06T16:00:00.000Z';
const step = (fields: Partial<RunActivity>): RunActivity => ({
  id: 'step',
  kind: 'tool',
  label: 'Ran command',
  status: 'completed',
  startedAt: at,
  finishedAt: at,
  ...fields,
});
const render = (entry: RunActivity, waiting = false) =>
  renderToStaticMarkup(createElement(ActivityStep, { entry, waiting }));
const details = (entry: RunActivity, reason?: string) =>
  renderToStaticMarkup(
    createElement(
      TraceCollapsible,
      { open: true, onOpenChange: () => {} },
      createElement(ActivityStepDetails, { entry, reason }),
    ),
  );
const reason = 'Exit code 1: 3 of 120 tests failed in packages/ui';

describe('step rows', () => {
  it('shows the kind, the verb-first label and a one-line target with the full text on hover', () => {
    const html = render(
      step({ tool: 'command', detail: 'bun x --no-install vitest run packages/ui/src/ChatTurn' }),
    );
    expect(html).toContain('lucide-square-terminal');
    expect(html).toContain('>Ran command<');
    expect(html).toContain(
      'class="chat-activity-step-detail" title="bun x --no-install vitest run packages/ui/src/ChatTurn"',
    );
    expect(html).not.toContain('chat-activity-step-reason');
    expect(html).not.toContain('aria-describedby');
  });

  it('says why a failed step failed in plain text below its button, linked as its description', () => {
    const html = render(step({ status: 'failed', label: 'Command failed', error: reason }));
    const id = /aria-describedby="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeTruthy();
    const line = `<p id="${id}" class="chat-activity-step-reason" dir="auto" title="${reason}">${reason}</p>`;
    expect(html).toContain(line);
    // Outside the button, so the reason shows in the collapsed turn and the name stays short.
    expect(html.indexOf('</button>')).toBeLessThan(html.indexOf(line));
    expect(html).not.toContain('role="alert"');
  });

  it('never gives a reason line to a waiting, declined or paused step', () => {
    const failed = step({ status: 'failed', error: reason });
    const quiet = [
      render(failed, true),
      render(step({ label: 'You declined to click “Apply”', error: 'You declined the request.' })),
      render(
        step({
          status: 'interrupted',
          label: 'Paused while you had control',
          error: 'The call paused while you had control.',
        }),
      ),
      render(step({ status: 'failed' })),
    ];
    for (const html of quiet) {
      expect(html).not.toContain('chat-activity-step-reason');
      expect(html).not.toContain('aria-describedby');
    }
    expect(stepReason(failed, false)).toBe(reason);
    expect(stepReason(failed, true)).toBeUndefined();
  });

  it('gives thinking its own glyph and older or unknown steps the generic tool glyph', () => {
    expect(stepGlyph(step({ kind: 'reasoning', label: 'Thinking' }))).toBe('thinking');
    expect(stepGlyph(step({ tool: 'command' }))).toBe('command');
    expect(stepGlyph(step({}))).toBe('other');
    for (const tool of ['future_kind', 'constructor', '__proto__'])
      expect(stepGlyph(step({ tool: tool as RunActivity['tool'] }))).toBe('other');
    expect(render(step({ kind: 'reasoning', label: 'Thinking' }))).toContain('lucide-brain');
    expect(render(step({ label: 'Read profile' }))).toContain('lucide-wrench');
  });

  it('lets a right-to-left target and reason keep their own direction', () => {
    const target = 'מהנדס תוכנה בכיר תל אביב משרה מלאה';
    const why = 'החיפוש נכשל: השירות לא זמין כרגע';
    const entry = step({
      status: 'failed',
      label: 'Web search failed',
      tool: 'web_search',
      detail: target,
      error: why,
    });
    const html = render(entry);
    // An overflowing target then keeps its first words, and the reason aligns and clamps from
    // its own start.
    expect(html).toContain(`class="chat-activity-step-detail" title="${target}" dir="auto">`);
    expect(html).toContain(
      `class="chat-activity-step-reason" dir="auto" title="${why}">${why}</p>`,
    );
    expect(details(entry, why)).toContain(
      `<p class="chat-activity-step-target" dir="auto">${target}</p>`,
    );
  });

  it('sets only a runtime’s literal command, file, search or fetch target in the code face', () => {
    const native = (tool: RunActivity['tool']) => step({ id: runtimeStepId('call_7'), tool });
    for (const tool of ['command', 'read', 'edit', 'search', 'fetch'] as const)
      expect(codeTarget(native(tool))).toBe(true);
    for (const tool of ['web_search', 'mcp', 'agent', 'todo', 'other', undefined] as const)
      expect(codeTarget(native(tool))).toBe(false);
    // Crew steps reuse those kinds for plain words: a saved query, a state, a company and title.
    for (const tool of ['search', 'edit', 'read', 'fetch'] as const)
      expect(codeTarget(step({ id: 'tool-6f1c2b9e', tool }))).toBe(false);

    const command = step({ id: runtimeStepId('call_7'), tool: 'command', detail: 'bun run lint' });
    expect(render(command)).toContain(
      'class="chat-activity-step-detail" title="bun run lint" dir="auto" data-code="true">',
    );
    expect(details(command)).toContain(
      '<p class="chat-activity-step-target" dir="auto" data-code="true">bun run lint</p>',
    );
    const recall = step({
      id: 'tool-6f1c2b9e',
      tool: 'search',
      label: 'Recalled saved context',
      detail: 'salary expectations',
    });
    expect(render(recall)).toContain(
      'class="chat-activity-step-detail" title="salary expectations" dir="auto">',
    );
    expect(details(recall)).toContain(
      '<p class="chat-activity-step-target" dir="auto">salary expectations</p>',
    );
  });
});

describe('step details', () => {
  it('holds the whole target and a quiet copy action, leaving the reason on its line', () => {
    const entry = step({
      status: 'failed',
      label: 'Command failed',
      detail: 'bun run lint',
      error: reason,
    });
    const html = details(entry, reason);
    expect(html).toContain('>Tool failed<');
    expect(html).toContain(`<time dateTime="${at}">`);
    expect(html).toContain('<p class="chat-activity-step-target" dir="auto">bun run lint</p>');
    // The step's own reason line shows the whole reason while open, so it is never repeated.
    expect(html).not.toContain(reason);
    expect(html).not.toContain('chat-activity-step-why');
    expect(html).toContain('Copy reason');
  });

  it('keeps thinking text private and offers no copy without a reason', () => {
    const html = details(
      step({ kind: 'reasoning', label: 'Thinking', text: 'PRIVATE_REASONING_MUST_NEVER_RENDER' }),
    );
    expect(html).toContain('Thinking text is kept private.');
    expect(html).not.toContain('PRIVATE_REASONING_MUST_NEVER_RENDER');
    expect(html).not.toContain('Copy reason');
    expect(html).not.toContain('chat-activity-step-target');
  });
});
