import { CareerPlans } from '@/CareerPlans/index.tsx';
import { useCareerPlans } from '@/CareerPlans/hooks/useCareerPlans.ts';
import { InsightsFilters } from './components/InsightsFilters.tsx';
import { InsightsHeader } from './components/InsightsHeader.tsx';
import { OutcomeSummary } from './components/OutcomeSummary.tsx';
import { RecentLessons } from './components/RecentLessons.tsx';
import { InsightsTidyUp } from './components/InsightsTidyUp.tsx';
import { TagScoreboard } from './components/TagScoreboard.tsx';
import { WeightDistribution } from './components/WeightDistribution.tsx';
import { useInsightsPage } from './hooks/useInsightsPage.ts';

/** Filters, a recessed figures strip, plans beside tags, weights beside lessons, Tidy up.
 * Every section always renders, with an honest empty state when there is no data. */
export const InsightsPage = () => {
  const page = useInsightsPage();
  const plans = useCareerPlans();
  const { cards, insights } = page;
  if (!cards || !insights) return null;
  return (
    <div className="insights">
      <InsightsHeader insights={insights} create={() => plans.setCreating(true)} />
      <InsightsFilters {...page} />
      <OutcomeSummary {...page} insights={insights} />
      <div className="insights-band">
        <CareerPlans model={plans} />
        <TagScoreboard insights={insights} change={page.change} />
      </div>
      <div className="insights-pair">
        <WeightDistribution insights={insights} />
        <RecentLessons lessons={page.lessons} />
      </div>
      <InsightsTidyUp cards={cards} tags={page.tags} />
    </div>
  );
};
