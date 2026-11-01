import { RadioGroup } from '@base-ui/react/radio-group';
import { Radio } from '@base-ui/react/radio';
import { useChatPreferenceStore } from '@/ChatView/preferences.ts';
import { SettingsSection } from './SettingsSection.tsx';

const widths = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'wide', label: 'Wide' },
  { value: 'full', label: 'Full' },
] as const;

export const ChatReadingWidth = () => {
  const width = useChatPreferenceStore((state) => state.width);
  const setWidth = useChatPreferenceStore((state) => state.setWidth);
  return (
    <SettingsSection id="chat-heading" title="Chat" autosave>
      <div className="settings-row settings-row-stacked">
        <span>
          <strong id="chat-reading-width-label">Reading width</strong>
          <span className="quiet block">Messages and the composer in every conversation.</span>
        </span>
        <RadioGroup
          id="chat-reading-width"
          className="settings-segment"
          aria-labelledby="chat-reading-width-label"
          value={width}
          onValueChange={(value) => setWidth(value as typeof width)}
        >
          {widths.map(({ value, label }) => (
            <Radio.Root key={value} value={value} className="settings-segment-option">
              {label}
            </Radio.Root>
          ))}
        </RadioGroup>
        <p className="settings-width-example" data-width={width} aria-hidden="true">
          <span>
            <strong>Scout</strong> I scored the Waypoint role 82 — a strong match on product
            analytics and research, with a gap in people management worth addressing in the cover
            letter.
          </span>
        </p>
      </div>
    </SettingsSection>
  );
};
