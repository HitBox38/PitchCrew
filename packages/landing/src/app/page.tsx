import { Crew } from '../Crew';
import { latestRelease } from '../Downloads/api';
import { Downloads } from '../Downloads';
import { FAQ } from '../FAQ';
import { Footer } from '../Footer';
import { Gates } from '../Gates';
import { Header } from '../Header';
import { Hero } from '../Hero';
import { Ownership } from '../Ownership';
import { ReviewThread } from '../ReviewThread';
import { SEO } from '../SEO';
import { WatchItWork } from '../WatchItWork';

const LandingPage = async () => {
  const release = await latestRelease();
  return (
    <>
      <SEO />
      <Header />
      <main id="main" data-replay-public data-replay-surface="landing">
        <Hero />
        <ReviewThread />
        <Gates />
        <Crew />
        <WatchItWork />
        <Ownership />
        <Downloads release={release} />
        <FAQ />
      </main>
      <Footer />
    </>
  );
};
export default LandingPage;

export const revalidate = 3600;
