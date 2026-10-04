import { outcomeLabels } from '@/lib/labels.ts';
import { outcomes, type ApplicationInsights } from '@pitchcrew/core/insights';

export function RecentLessons({ insights }: { insights: ApplicationInsights }) {
  const groups = outcomes.filter((outcome) => insights.lessons[outcome].length);
  return (
    <section className="insights-panel" aria-labelledby="insights-lessons">
      <h2 id="insights-lessons">Recent lessons</h2>
      {groups.length ? (
        groups.map((outcome) => (
          <div key={outcome} className="mt-3">
            <h3>{outcomeLabels[outcome]}</h3>
            <ul className="mt-1 flex flex-col gap-2">
              {insights.lessons[outcome].map((lesson) => (
                <li key={lesson.id}>
                  <span className="prewrap">{lesson.text}</span>
                  <small className="quiet block">
                    {lesson.company} · {lesson.title} ·{' '}
                    {new Date(lesson.createdAt).toLocaleDateString()}
                  </small>
                </li>
              ))}
            </ul>
          </div>
        ))
      ) : (
        <p className="quiet">Add lessons from a job’s details to see them here.</p>
      )}
    </section>
  );
}
