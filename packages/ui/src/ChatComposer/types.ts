import type { ChatReference } from '@pitchcrew/core';
import type { ReferenceValue } from '@/ChatReferences/types.ts';
import type { RefObject } from 'react';
export interface ComposerSuggestion {
  key: string;
  label: string;
  description: string;
  reference?: ReferenceValue;
  action?: 'attach' | 'job' | 'skills';
  disabled?: string;
}
export interface ComposerEditorProps {
  thread: string;
  value: string;
  references: ChatReference[];
  onChange: (value: string, references: ChatReference[]) => void;
  inputRef: RefObject<HTMLDivElement | null>;
  disabled: boolean;
  label: string;
  placeholder: string;
  suggestions: ComposerSuggestion[];
  onAction: (action: NonNullable<ComposerSuggestion['action']>) => void;
  onFiles: (files: File[]) => void;
  onSend: (alternate: boolean) => void;
}
