import { RadioGroup } from '@base-ui/react/radio-group';
import { Radio } from '@base-ui/react/radio';
import { useChatPreferenceStore } from '@/ChatView/preferences.ts';

const widths = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'wide', label: 'Wide' },
  { value: 'full', label: 'Full' },
] as const;

export const ChatReadingWidth = () => {
  const width = useChatPreferenceStore((state) => state.width);
  const setWidth = useChatPreferenceStore((state) => state.setWidth);
  return (
    <div className="settings-row settings-row-stacked">
      <span>
        <strong id="chat-reading-width-label">Chat reading width</strong>
        <span className="quiet block">The message column in every conversation.</span>
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
    </div>
  );
};
