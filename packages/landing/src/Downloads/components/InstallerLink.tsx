'use client';

import { Download, ExternalLink } from 'lucide-react';
import { captureDownload } from '../../Analytics/client';
import { installerSize } from '../helpers';
import type { Installer } from '../types';

export function InstallerLink({ installer }: { installer: Installer }) {
  const available = installer.filename !== null;
  return (
    <a className="installer-link" href={installer.url} onClick={() => captureDownload(installer)}>
      <span>
        <span className="block text-lg font-semibold">{installer.label}</span>
        <span className="mt-1 block text-sm text-muted">{installer.detail}</span>
      </span>
      <span className="flex shrink-0 items-center gap-3 text-sm">
        {available && installer.size ? installerSize(installer.size) : 'View releases'}
        {available ? (
          <Download size={18} aria-hidden="true" />
        ) : (
          <ExternalLink size={18} aria-hidden="true" />
        )}
      </span>
    </a>
  );
}
