import { useState } from 'react';
import { Button } from '@pitchcrew/design-system/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@pitchcrew/design-system/collapsible';
import { acceptedFiles, fieldKind, fieldName, type InspectedField } from '../helpers.ts';

const meta = (field: InspectedField) =>
  [
    fieldKind(field),
    field.type === 'file' ? acceptedFiles(field.accept) : null,
    field.maxLength === undefined ? null : `up to ${field.maxLength.toLocaleString()}`,
    field.visible ? null : 'Hidden',
    field.disabled ? 'Disabled' : null,
    field.visible && !field.disabled && !field.assessed ? 'Not fully checked' : null,
    // Absent the flag, nothing is claimed: the employer may still require it.
    field.required ? 'Required' : null,
  ]
    .filter(Boolean)
    .join(' · ');

/**
 * Every inspected field in page order, one line each. It starts open while the brief is being
 * confirmed, since confirming adopts all of it, and folded otherwise.
 */
export const FormFieldList = ({
  fields,
  selectors,
  defaultOpen,
}: {
  fields: InspectedField[];
  /** The inspected controls' page references, used only to identify unlabeled fields. */
  selectors?: string[];
  defaultOpen: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  if (!fields.length) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="grid gap-1">
      <CollapsibleTrigger
        render={<Button variant="ghost" size="sm" className="-ml-3 justify-self-start" />}
      >
        {open ? 'Hide fields' : `Show all ${fields.length} fields`}
      </CollapsibleTrigger>
      <CollapsibleContent render={<ol className="form-field-list" aria-label="Inspected fields" />}>
        {fields.map((field, index) => (
          <li key={index}>
            <span>{fieldName(field, index)}</span>
            <small>{meta(field)}</small>
            {field.options.length ? (
              <small className="form-field-note">{field.options.join(', ')}</small>
            ) : null}
            {!field.label && selectors?.[index] ? (
              <small className="form-field-note">Page reference: {selectors[index]}</small>
            ) : null}
            {/* Conditions come from the inspecting agent, not from the page itself. */}
            {field.condition ? (
              <small className="form-field-note">Agent note: {field.condition}</small>
            ) : null}
          </li>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};
