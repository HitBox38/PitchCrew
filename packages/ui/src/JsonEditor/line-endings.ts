import { Compartment, Text } from '@codemirror/state';

export const jsonLineEndings = new Compartment();
export const lineEnding = (source: string) => source.match(/\r\n?|\n/)?.[0] ?? '\n';
export const editorText = (source: string) => Text.of(source.split(/\r\n?|\n/));
