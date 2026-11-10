import { useState } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from '@pitchcrew/design-system/tabs';
import { outcomeLabels } from '@/lib/labels.ts';
import { outcomes, type InsightLesson, type Outcome } from '@pitchcrew/core/insights';
import { LessonList } from './LessonList.tsx';

const preview = 6;

/** Lessons by outcome; the first six show, Show all reveals the complete list. */
export const RecentLessons = ({ lessons }: { lessons: Record<Outcome, InsightLesson[]> }) => {
  const [outcome, setOutcome] = useState<Outcome>(
    outcomes.find((item) => lessons[item].length) ?? 'positive',
  );
  const [expanded, setExpanded] = useState(false);
  const list = lessons[outcome];
  const total = outcomes.reduce((sum, item) => sum + lessons[item].length, 0);
  return (
    <section className="insights-lessons" aria-labelledby="insights-lessons">
      <h2 id="insights-lessons" className="ui-section-heading">
        Lessons <span className="ui-count">{total}</span>
      </h2>
      <Tabs
        value={outcome}
        onValueChange={(value: Outcome) => {
          setOutcome(value);
          setExpanded(false);
        }}
      >
        <TabsList className="ui-segment insights-lesson-segment" aria-label="Lessons by outcome">
          {outcomes.map((item) => (
            <TabsTrigger key={item} value={item}>
              {outcomeLabels[item]} <span className="ui-count">{lessons[item].length}</span>
            </TabsTrigger>
          ))}
          <TabsIndicator />
        </TabsList>
      </Tabs>
      {list.length ? (
        <LessonList lessons={expanded ? list : list.slice(0, preview)} />
      ) : (
        <p className="ui-empty">
          {total
            ? 'No lessons for this outcome.'
            : 'Add lessons from a job’s details to see them here.'}
        </p>
      )}
      {list.length > preview ? (
        <Button className="button small insights-after" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show fewer' : `Show all lessons (${list.length})`}
        </Button>
      ) : null}
    </section>
  );
};
