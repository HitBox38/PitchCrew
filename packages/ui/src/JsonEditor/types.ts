import type { CompletionSource } from '@codemirror/autocomplete';

export interface JsonIssue {
  path: (string | number)[];
  message: string;
}
export interface JsonEditorProps {
  id: string;
  label: string;
  filename: string;
  value: string;
  onChange: (value: string) => void;
  issues: JsonIssue[];
  complete: CompletionSource;
}
