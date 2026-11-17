import { Button } from '@pitchcrew/design-system/button';
import { CollapsibleContent, CollapsibleTrigger } from '@pitchcrew/design-system/collapsible';

/** The saved posting shown beside the brief (above it on narrow sheets) while comparing. */
export const OriginalPosting = ({ description }: { description: string }) => (
  <CollapsibleContent
    className="brief-compare-posting"
    render={<section aria-label="Original posting" />}
  >
    <h4>Original posting</h4>
    <p className="prewrap">{description || 'No description was saved for this job.'}</p>
  </CollapsibleContent>
);

/** Opens or closes the posting beside the brief; it belongs to the brief's compare Collapsible. */
export const CompareTrigger = ({ comparing }: { comparing: boolean }) => (
  <CollapsibleTrigger render={<Button variant="ghost" size="sm" />}>
    {comparing ? 'Hide posting' : 'Compare with posting'}
  </CollapsibleTrigger>
);
