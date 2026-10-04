import { EmptyState } from '@/components/EmptyState/index.tsx';
import { InsightsFilters } from './components/InsightsFilters.tsx';
import { OutcomeSummary } from './components/OutcomeSummary.tsx';
import { RecentLessons } from './components/RecentLessons.tsx';
import { StaleCleanup } from './components/StaleCleanup.tsx';
import { TagMerge } from './components/TagMerge.tsx';
import { TagScoreboard } from './components/TagScoreboard.tsx';
import { WeightDistribution } from './components/WeightDistribution.tsx';
import { useInsightsPage } from './hooks/useInsightsPage.ts';

export function InsightsPage() {
  const { cards, search, insights, tags, change } = useInsightsPage();
  if (!cards || !insights) return null;
  const filtered = Boolean(search.tag || search.from || search.to);
  return (
    <div className="insights flex max-w-245 flex-col gap-5">
      <InsightsFilters search={search} tags={tags} change={change} />
      {insights.total ? (
        <>
          <OutcomeSummary insights={insights} />
          <div className="grid gap-5 wide:grid-cols-2">
            <WeightDistribution insights={insights} />
            <RecentLessons insights={insights} />
          </div>
          <TagScoreboard insights={insights} change={change} />
        </>
      ) : (
        <EmptyState
          title={filtered ? 'No matching applications' : 'No applications to learn from yet'}
          description={
            filtered
              ? 'Try another tag or a wider date range.'
              : 'Add jobs, record outcomes and note lessons in each job. Insights appear here.'
          }
        />
      )}
      <section className="insights-panel flex flex-col gap-6" aria-labelledby="insights-tidy">
        <h2 id="insights-tidy">Tidy up</h2>
        <TagMerge cards={cards} tags={tags} />
        <StaleCleanup />
      </section>
    </div>
  );
}
