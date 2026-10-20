import { EmptyState } from '@/components/EmptyState/index.tsx';
import { CareerPlans } from '@/CareerPlans/index.tsx';
import { InsightsFilters } from './components/InsightsFilters.tsx';
import { OutcomeSummary } from './components/OutcomeSummary.tsx';
import { RecentLessons } from './components/RecentLessons.tsx';
import { InsightsTidyUp } from './components/InsightsTidyUp.tsx';
import { TagScoreboard } from './components/TagScoreboard.tsx';
import { WeightDistribution } from './components/WeightDistribution.tsx';
import { useInsightsPage } from './hooks/useInsightsPage.ts';

export const InsightsPage = () => {
  const { cards, search, insights, tags, change } = useInsightsPage();
  if (!cards || !insights) return null;
  const filtered = Boolean(search.tag || search.from || search.to);
  return (
    <div className="insights flex min-w-0 flex-col gap-5">
      <CareerPlans />
      <InsightsFilters search={search} tags={tags} change={change} />
      {insights.total ? (
        <>
          <OutcomeSummary insights={insights} />
          <div className="insights-reports grid min-w-0 gap-5 wide:grid-cols-2">
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
      <InsightsTidyUp cards={cards} tags={tags} />
    </div>
  );
};
