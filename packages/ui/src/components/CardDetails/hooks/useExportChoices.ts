import { useRef, useState } from 'react';
import type { Card } from '@pitchcrew/core';
import type { Action } from '@/WorkspaceStore/index.ts';
import { exportFormats, suggestedExportFormat, type ExportFormat } from '../export-format.ts';

export type ExportLayout = 'formatted' | 'plain';

/**
 * The export choices shared by the inline Export section and the persistent footer, so both
 * request approval for exactly what is visible. One request at a time; choices survive failures.
 */
export const useExportChoices = (card: Card, action: Action) => {
  const suggestion = suggestedExportFormat(card);
  // Null follows the suggestion until the user picks a format.
  const [chosen, setFormat] = useState<ExportFormat | null>(null);
  const [layout, setLayout] = useState<ExportLayout>('formatted');
  const [requesting, setRequesting] = useState(false);
  const inFlight = useRef(false);
  const format = chosen ?? suggestion.format;
  const request = () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setRequesting(true);
    void action(
      `/cards/${card.id}/approval`,
      'POST',
      { formats: exportFormats(format), layout },
      'Documents generated for review in Decisions',
    )
      .catch(() => {})
      .finally(() => {
        inFlight.current = false;
        setRequesting(false);
      });
  };
  return { suggestion, format, setFormat, layout, setLayout, requesting, request };
};
export type ExportChoices = ReturnType<typeof useExportChoices>;
