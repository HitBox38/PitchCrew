import { keyedItems } from '@/lib/list-keys.ts';
import { AccordionSection } from '@pitchcrew/design-system/accordion';
import type { ReviewDetail } from '../types.ts';

export const ReviewExtensions = ({
  extensions,
}: {
  extensions: ReviewDetail['report']['extensions'];
}) => {
  if (!extensions.length) return null;
  return (
    <AccordionSection
      triggerClassName="cursor-pointer"
      heading={<>Deadline extensions ({extensions.length})</>}
    >
      <ul className="mt-3 list-disc space-y-2 pl-5">
        {keyedItems(extensions, (extension) => JSON.stringify(extension)).map(
          ({ item: extension, key }) => (
            <li key={key}>
              {extension.minutes} minutes: {extension.reason}
            </li>
          ),
        )}
      </ul>
    </AccordionSection>
  );
};
