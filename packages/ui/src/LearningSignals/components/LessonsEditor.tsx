import { Button } from '@/components/ui/button/components/Button.tsx';
import { Textarea } from '@/components/ui/textarea/components/Textarea.tsx';
import type { Card } from '@pitchcrew/core';
import { lessonLimits } from '@pitchcrew/core/insights';
import { Trash2 } from 'lucide-react';
import { useLessonDraft } from '../hooks/useLessonDraft.ts';

export function LessonsEditor({ card }: { card: Card }) {
  const draft = useLessonDraft(card);
  return (
    <div className="my-3">
      <h4>Lessons</h4>
      {draft.lessons.length ? (
        <ul className="lesson-list my-2 flex flex-col gap-2">
          {draft.lessons.map((lesson) => (
            <li key={lesson.id} className="flex items-start justify-between gap-3">
              <span className="prewrap min-w-0">
                {lesson.text}
                <small className="quiet block">
                  {new Date(lesson.createdAt).toLocaleDateString()}
                </small>
              </span>
              <Button
                variant="ghost"
                className="icon-button"
                aria-label="Remove lesson"
                disabled={draft.working}
                onClick={() => draft.remove(lesson.id)}
              >
                <Trash2 size={15} />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="quiet">No lessons yet. Note what worked or what to change next time.</p>
      )}
      <form
        className="mt-2 flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.canAdd) void draft.add();
        }}
      >
        <label className="field">
          New lesson
          <Textarea
            value={draft.text}
            maxLength={lessonLimits.length}
            rows={2}
            disabled={draft.full || draft.working}
            placeholder="For example: the take-home rewarded clear tradeoffs."
            onChange={(event) => draft.setText(event.target.value)}
          />
        </label>
        <div className="flex items-center justify-between gap-2">
          <small className="quiet">
            {draft.full
              ? `${lessonLimits.count} of ${lessonLimits.count} lessons. Remove one to add another.`
              : `${draft.lessons.length} of ${lessonLimits.count} lessons`}
          </small>
          <Button type="submit" className="button small" disabled={!draft.canAdd}>
            Add lesson
          </Button>
        </div>
      </form>
    </div>
  );
}
