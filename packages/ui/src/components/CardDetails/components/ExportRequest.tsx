import { Button } from '@pitchcrew/design-system/button';
import { FormSelect } from '@/FormSelect/index.tsx';
import { exportFormatLabels, type ExportFormat } from '../export-format.ts';
import type { ExportChoices, ExportLayout } from '../hooks/useExportChoices.ts';

const order: ExportFormat[] = ['pdf', 'docx', 'both', 'markdown'];

/**
 * Chooses the files to generate; Pitchcrew then checks them and asks for approval in Decisions.
 * While the job footer offers Request export approval (with these exact choices) it is the one
 * primary action, so no second button shows here; otherwise a quiet outline button remains.
 */
export const ExportRequest = ({
  choices,
  working,
  footer,
}: {
  choices: ExportChoices;
  working: boolean;
  footer: boolean;
}) => {
  const { suggestion, format, layout, requesting } = choices;
  const locked = working || requesting;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <FormSelect
          label="Files to export"
          value={format}
          disabled={locked}
          onValueChange={(value) => choices.setFormat(value as ExportFormat)}
          options={order.map((value) => ({
            value,
            label:
              value === suggestion.format
                ? `${exportFormatLabels[value]} (suggested)`
                : exportFormatLabels[value],
          }))}
        />
        <FormSelect
          label="Layout"
          value={layout}
          onValueChange={(value) => choices.setLayout(value as ExportLayout)}
          disabled={locked || format === 'markdown'}
          options={[
            { value: 'formatted', label: 'Formatted' },
            { value: 'plain', label: 'Plain text' },
          ]}
        />
        {footer ? null : (
          <Button
            variant="outline"
            disabled={locked}
            aria-busy={requesting}
            onClick={choices.request}
          >
            Request export approval
          </Button>
        )}
      </div>
      <p className="quiet">
        {suggestion.reason} Markdown copies are always included. Pitchcrew generates and checks the
        files, then you approve the exact files in Decisions. Nothing is sent.
        {footer ? ' Request export approval below when these choices are right.' : ''}
      </p>
    </div>
  );
};
