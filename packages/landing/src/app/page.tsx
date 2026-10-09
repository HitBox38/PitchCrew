import { Control } from '../Control';
import { latestRelease } from '../Downloads/api';
import { Downloads } from '../Downloads';
import { FAQ } from '../FAQ';
import { Footer } from '../Footer';
import { Header } from '../Header';
import { Hero } from '../Hero';
import { ProductViews } from '../ProductViews';
import { Workflow } from '../Workflow';
import { SEO } from '../SEO';

export const revalidate = 3600;

export default async function LandingPage() {
  const release = await latestRelease();
  return (
    <>
      <SEO />
      <Header />
      <main id="main">
        <Hero />
        <Workflow />
        <ProductViews />
        <Control />
        <Downloads release={release} />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
