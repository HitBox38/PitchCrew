import { nameList } from './composer-status.ts';

/** Announce only coarse phase changes; token-by-token commentary remains in readable activity. */
export const conversationAnnouncement = (workingNames: string[], askingNames: string[]) => {
  if (askingNames.length)
    return askingNames.length > 1
      ? `Questions are ready to answer from ${nameList(askingNames)}.`
      : `${nameList(askingNames)} has a question ready to answer.`;
  const names = [...new Set(workingNames)];
  if (names.length) return `${nameList(names)} ${names.length > 1 ? 'are' : 'is'} working.`;
  return 'Conversation ready.';
};

type NamedTurn = { id: string; name: string };
type AnnouncementSource = {
  thread: string;
  running: NamedTurn[];
  asking: NamedTurn[];
  runs: (NamedTurn & { status: string })[];
};
export type AnnouncementState = {
  thread: string;
  signature: string;
  running: string[];
  text: string;
};
const identity = (items: NamedTurn[]) =>
  items.toSorted((a, b) => a.id.localeCompare(b.id)).map(({ id, name }) => [id, name]);
const outcome = (names: string[], result: string) =>
  `${names.length === 1 ? `${names[0]}'s turn` : `Turns from ${nameList(names)}`} ${result}.`;

/** Only work observed running on this thread can announce a new failure or stop. */
export const nextConversationAnnouncement = (
  previous: AnnouncementState | undefined,
  source: AnnouncementSource,
): AnnouncementState => {
  const signature = JSON.stringify([identity(source.running), identity(source.asking)]);
  const sameThread = previous?.thread === source.thread;
  if (sameThread && previous.signature === signature) return previous;
  const observed = new Set(sameThread ? previous.running : []);
  const settled = source.runs.filter((run) => observed.has(run.id));
  const failed = settled.filter((run) => run.status === 'failed').map((run) => run.name);
  const stopped = settled.filter((run) => run.status === 'cancelled').map((run) => run.name);
  const phase = conversationAnnouncement(
    source.running.map((run) => run.name),
    source.asking.map((question) => question.name),
  );
  const changes = [
    failed.length ? outcome(failed, 'failed') : '',
    stopped.length ? outcome(stopped, 'stopped') : '',
  ].filter(Boolean);
  return {
    thread: source.thread,
    signature,
    running: source.running.map((run) => run.id),
    text: !sameThread
      ? ''
      : changes.length && !source.running.length && !source.asking.length
        ? changes.join(' ')
        : [...changes, phase].join(' '),
  };
};
