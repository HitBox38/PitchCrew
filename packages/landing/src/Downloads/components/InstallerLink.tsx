'use client';

import { Download, ExternalLink } from 'lucide-react';
import { captureDownload } from '../../Analytics/client';
import { installerSize } from '../helpers';
import type { Installer } from '../types';

export const InstallerLink = ({ installer }: { installer: Installer }) => {
  const available = installer.filename !== null;
  return (
    <a
      className="installer clay-card"
      href={installer.url}
      onClick={() => captureDownload(installer)}
    >
      <span className="min-w-0">
        <span className="installer-label">{installer.label}</span>
        <span className="installer-detail">{installer.detail}</span>
      </span>
      <span className="installer-size tabular">
        {available && installer.size ? installerSize(installer.size) : 'View releases'}
        {available ? (
          <Download size={18} aria-hidden="true" />
        ) : (
          <ExternalLink size={18} aria-hidden="true" />
        )}
      </span>
    </a>
  );
};
