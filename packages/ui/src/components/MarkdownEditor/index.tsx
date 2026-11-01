import { lazy, Suspense } from 'react';
import { Textarea } from '@pitchcrew/design-system/textarea';
import { TabsContent } from '@pitchcrew/design-system/tabs';

/** Shared Profile and Skill document panels, inside their parent Tabs and form. */
export const MarkdownEditor = ({
  id,
  label,
  content,
  onChange,
  maxLength,
  placeholder,
  required = false,
  disabled = false,
}: {
  id: string;
  label: string;
  content: string;
  onChange: (content: string) => void;
  maxLength: number;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) => {
  return (
    <>
      <TabsContent value="write" keepMounted className="profile-write-panel">
        <label className="sr-only" htmlFor={id}>
          {label}
        </label>
        <Textarea
          id={id}
          value={content}
          onChange={(event) => onChange(event.target.value)}
          spellCheck
          maxLength={maxLength}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
        />
      </TabsContent>
      <TabsContent value="preview" className="profile-preview-panel">
        <Suspense fallback={<p className="quiet">Opening preview…</p>}>
          <MarkdownPreview content={content} />
        </Suspense>
      </TabsContent>
    </>
  );
};

const MarkdownPreview = lazy(() => import('./components/MarkdownPreview.tsx'));
