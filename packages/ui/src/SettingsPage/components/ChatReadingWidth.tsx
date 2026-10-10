import { useChatPreferenceStore } from '@/ChatView/preferences.ts';
import { FormSelect } from '@/FormSelect/index.tsx';

export function ChatReadingWidth() {
  const width = useChatPreferenceStore((state) => state.width);
  const setWidth = useChatPreferenceStore((state) => state.setWidth);
  return (
    <div className="form mt-6 max-w-sm">
      <FormSelect
        id="chat-reading-width"
        label="Chat reading width"
        value={width}
        onValueChange={setWidth}
        options={[
          { value: 'comfortable', label: 'Comfortable' },
          { value: 'wide', label: 'Wide' },
          { value: 'full', label: 'Full' },
        ]}
      />
      <p className="optional mt-2">
        Sets the width of messages and the composer in every conversation. Saves automatically on
        this device.
      </p>
    </div>
  );
}
