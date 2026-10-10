'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { documentationUrl, releasesUrl } from '../lib/links';
import { InstallerLink } from './components/InstallerLink';
import { platforms } from './constants';
import { usePlatform } from './hooks/usePlatform';
import type { Platform, Release } from './types';

export function Downloads({ release }: { release: Release }) {
  const { platform, select } = usePlatform();
  return (
    <section
      id="download"
      className="download-section section-space"
      aria-labelledby="download-title"
    >
      <div className="page-width grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-24">
        <div>
          <h2 id="download-title" className="section-title">
            Your next chapter
            <br />
            starts here.
          </h2>
          <p className="section-copy mt-6">
            Give your job search a workspace—and a crew that knows your background.
          </p>
          <p className="mt-7 font-semibold text-primary">
            Free to download. Bring your own AI account.
          </p>
          <a className="text-link mt-3 inline-block" href={documentationUrl}>
            Read the setup guide
          </a>
        </div>
        <div className="download-sheet">
          <Tabs value={platform} onValueChange={(value) => select(value as Platform)}>
            <TabsList aria-label="Choose your operating system">
              {platforms.map(({ id, label }) => (
                <TabsTrigger key={id} value={id}>
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            {platforms.map(({ id }) => (
              <TabsContent key={id} value={id}>
                <div className="space-y-3">
                  {release.installers
                    .filter((installer) => installer.platform === id)
                    .map((installer) => (
                      <InstallerLink key={installer.id} installer={installer} />
                    ))}
                </div>
                <p className="mt-5 text-sm leading-relaxed text-muted">
                  {id === 'mac'
                    ? 'Current macOS builds are unsigned and not notarized. macOS may require permission to open Pitchcrew.'
                    : id === 'windows'
                      ? 'Current Windows builds are unsigned. Windows may require permission to open Pitchcrew.'
                      : 'Choose AppImage for a portable app, or .deb for Debian and Ubuntu. Both are for x64 computers.'}
                </p>
              </TabsContent>
            ))}
          </Tabs>
          {!release.available ? (
            <p className="mt-4 text-sm text-muted">
              Installer information is temporarily unavailable. The links above open GitHub
              Releases.
            </p>
          ) : null}
          <div className="mt-6 border-t border-border pt-5 text-sm leading-relaxed text-muted">
            <p>
              The app includes its local runtime and browser. Install and sign in to your chosen AI
              CLI separately. AI usage follows your provider plan.
            </p>
            <a className="text-link mt-3 inline-block" href={releasesUrl}>
              All releases and checksums
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
