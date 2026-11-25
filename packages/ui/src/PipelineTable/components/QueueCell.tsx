import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { Button } from '@pitchcrew/design-system/button';
import { Bead } from '@/ClayInterface/components/Bead.tsx';
import type { QueueStory } from '@/lib/queue-story.ts';

/** The story's words: one bead by bead law, who · what, then how long or where in line. */
export const QueueStoryLine = ({ story }: { story: QueueStory }) => {
  if (story.kind === 'idle')
    return story.text ? <span className="queue-cell-next">{story.text}</span> : null;
  const words = story.agent ? `${story.agent} · ${story.text}` : story.text;
  return (
    <span className="queue-cell-line" data-tone={story.tone}>
      <Bead tone={story.tone} live={story.live} />
      <span className="queue-cell-body">
        <span className="queue-cell-text" title={words}>
          {story.agent ? (
            <>
              <strong>{story.agent}</strong> ·{' '}
            </>
          ) : null}
          {story.text}
        </span>
        {story.meta ? <span className="queue-cell-meta">{story.meta}</span> : null}
      </span>
    </span>
  );
};

/**
 * The cell's one control: an item opens its row on Home and decides nothing there ("Question ›");
 * a running story opens its run ("View"). Both are links styled as quiet ink buttons, 44px tall on
 * phones and coarse pointers.
 */
export const QueueControl = ({ story }: { story: QueueStory }) => {
  if (!story.control) return null;
  const link = story.itemKey ? (
    <Link to="/" search={{ item: story.itemKey }} />
  ) : story.link ? (
    <Link
      to="/chat/$thread"
      params={{ thread: story.link.thread }}
      search={{ run: story.link.run }}
    />
  ) : null;
  if (!link) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      nativeButton={false}
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- Shared Button renders the actual router anchor below.
      role="link"
      render={link}
      className="queue-cell-action"
      aria-label={story.control.name}
    >
      {story.control.label}
      {story.itemKey ? <ChevronRight aria-hidden="true" /> : null}
    </Button>
  );
};

/** The Queue column's cell: the job's agent story and its control. */
export const QueueCell = ({ story }: { story: QueueStory }) => (
  <div className="queue-cell" data-kind={story.kind}>
    <QueueStoryLine story={story} />
    <QueueControl story={story} />
  </div>
);
