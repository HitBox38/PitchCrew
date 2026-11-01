import { useWorkspaceStore } from '@/WorkspaceStore/index.ts';
import type { InsightLesson } from '@pitchcrew/core/insights';

export const LessonList = ({ lessons }: { lessons: InsightLesson[] }) => {
  const openCard = useWorkspaceStore((state) => state.openCard);
  return (
    <ul className="ui-tray insights-lesson-list">
      {lessons.map((lesson) => (
        <li key={`${lesson.cardId}:${lesson.id}`}>
          <p>{lesson.text}</p>
          <span className="insights-lesson-meta">
            <button
              type="button"
              className="insights-lesson-job"
              onClick={() => openCard(lesson.cardId)}
            >
              {lesson.company} · {lesson.title}
            </button>{' '}
            · {new Date(lesson.createdAt).toLocaleDateString()}
          </span>
        </li>
      ))}
    </ul>
  );
};
