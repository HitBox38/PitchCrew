import { expect, it } from 'vitest';
import { conversationAnnouncement, nextConversationAnnouncement } from '../announcement.ts';

it('keeps live announcements short and stable across duplicate participant work', () => {
  expect(conversationAnnouncement(['Scout', 'Scout'], [])).toBe('Scout is working.');
  expect(conversationAnnouncement(['Scout', 'Writer'], [])).toBe('Scout and Writer are working.');
  expect(conversationAnnouncement(['A', 'B', 'C', 'D'], [])).toBe('4 agents are working.');
  expect(conversationAnnouncement([], [])).toBe('Conversation ready.');
});

it('prioritizes the answer phase while other agents work without reading question text aloud', () => {
  expect(conversationAnnouncement(['Scout'], ['Coach'])).toBe(
    'Coach has a question ready to answer.',
  );
  expect(conversationAnnouncement(['Scout'], ['Coach', 'Coach'])).toBe(
    'Questions are ready to answer from Coach.',
  );
});

const scout = { id: 'run-scout', name: 'Scout' };
const source = {
  thread: 'first',
  running: [scout],
  asking: [],
  runs: [{ ...scout, status: 'running' }],
};

it('does not announce a historical failure on mount or when changing threads', () => {
  const saved = { ...source, running: [], runs: [{ ...scout, status: 'failed' }] };
  const first = nextConversationAnnouncement(undefined, saved);
  expect(first.text).toBe('');
  const working = nextConversationAnnouncement(undefined, source);
  expect(nextConversationAnnouncement(working, { ...saved, thread: 'second' }).text).toBe('');
});

it('announces an observed failure without claiming the conversation finished normally', () => {
  const working = nextConversationAnnouncement(undefined, source);
  const failed = nextConversationAnnouncement(working, {
    ...source,
    running: [],
    runs: [{ ...scout, status: 'failed' }],
  });
  expect(failed.text).toBe("Scout's turn failed.");
  expect(nextConversationAnnouncement(failed, { ...source, running: [] })).toBe(failed);
});

it('keeps stopped distinct from failed and retains the other agent working', () => {
  const coach = { id: 'run-coach', name: 'Career Coach' };
  const working = nextConversationAnnouncement(undefined, {
    ...source,
    running: [scout, coach],
  });
  expect(
    nextConversationAnnouncement(working, {
      ...source,
      running: [coach],
      runs: [{ ...scout, status: 'cancelled' }],
    }).text,
  ).toBe("Scout's turn stopped. Career Coach is working.");
});

it('announces the question phase after running without narrating its text', () => {
  const working = nextConversationAnnouncement(undefined, source);
  expect(
    nextConversationAnnouncement(working, {
      ...source,
      running: [],
      asking: [{ id: 'question-1', name: 'Scout' }],
      runs: [{ ...scout, status: 'waiting' }],
    }).text,
  ).toBe('Scout has a question ready to answer.');
});

it('keeps the same announcement across token updates and reordered parallel runs', () => {
  const coach = { id: 'run-coach', name: 'Career Coach' };
  const parallel = { ...source, running: [scout, coach] };
  const working = nextConversationAnnouncement(undefined, parallel);
  const updated = {
    ...parallel,
    running: [coach, scout],
    runs: [{ ...scout, status: 'running', commentary: 'A new public update' }],
  };
  expect(nextConversationAnnouncement(working, updated)).toBe(working);
});
