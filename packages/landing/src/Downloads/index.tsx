'use client';

import { releasesUrl } from '../lib/links';
import { InstallerLink } from './components/InstallerLink';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/PlatformTabs';
import { Setup } from './components/Setup';
import { platforms } from './constants';
import { usePlatform } from './hooks/usePlatform';
import type { Platform, Release } from './types';

const notes: Record<Platform, string> = {
  mac: 'Current macOS builds are unsigned and not notarized. macOS may ask for permission to open Pitchcrew.',
  windows: 'Current Windows builds are unsigned. Windows may ask for permission to open Pitchcrew.',
  linux:
    'Choose AppImage for a portable app, or .deb for Debian and Ubuntu. Both are for x64 computers.',
};

export const Downloads = ({ release }: { release: Release }) => {
  const { platform, select } = usePlatform();
  return (
    <section id="download" className="section downloads" aria-labelledby="download-title">
      <div className="page-width download-grid">
        <Setup />
        <div className="tray download-sheet">
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
                <div className="installers">
                  {release.installers
                    .filter((installer) => installer.platform === id)
                    .map((installer) => (
                      <InstallerLink key={installer.id} installer={installer} />
                    ))}
                </div>
                <p className="fine download-note">{notes[id]}</p>
              </TabsContent>
            ))}
          </Tabs>
          {!release.available ? (
            <p className="fine download-note">
              Installer information is temporarily unavailable. The links above open GitHub
              Releases.
            </p>
          ) : null}
          <div className="download-foot">
            <p className="fine">
              The app includes its local runtime and browser. Install and sign in to your chosen AI
              tool separately. AI usage follows your provider plan.
            </p>
            <a className="text-link meta" href={releasesUrl}>
              All releases and checksums
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
