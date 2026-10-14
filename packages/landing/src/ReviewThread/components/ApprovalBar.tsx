'use client';

import { Download } from 'lucide-react';
import { platforms } from '../../Downloads/constants';
import { usePlatform } from '../../Downloads/hooks/usePlatform';

export function ApprovalBar() {
  const { platform } = usePlatform();
  const label = platforms.find(({ id }) => id === platform)?.label ?? 'your computer';
  return (
    <div className="approval-bar">
      <p>
        <strong>Free and open source</strong>
        <span>macOS, Windows and Linux · uses your AI tool</span>
      </p>
      <div className="approval-actions">
        <a className="button button-secondary" href="#gates">
          See how it’s checked
        </a>
        <a className="button button-primary" href="#download">
          <Download size={18} aria-hidden="true" />
          Download for {label}
        </a>
      </div>
    </div>
  );
}
