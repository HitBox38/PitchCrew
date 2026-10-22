import type { EditorState } from '@codemirror/state';
import { jsonLanguage } from '@codemirror/lang-json';
import type { SyntaxNode } from '@lezer/common';
import type { Diagnostic } from '@codemirror/lint';
import type { JsonIssue } from './types.ts';

export const propertyName = (state: EditorState, property: SyntaxNode): string => {
  const name = property.getChild('PropertyName');
  if (!name) return '';
  try {
    return JSON.parse(state.sliceDoc(name.from, name.to)) as string;
  } catch {
    return '';
  }
};

export const objectProperties = (object: SyntaxNode) => object.getChildren('Property');

export const ancestor = (node: SyntaxNode | null, name: string): SyntaxNode | null => {
  while (node && node.name !== name) node = node.parent;
  return node;
};

export const issueDiagnostics = (state: EditorState, issues: JsonIssue[]): Diagnostic[] => {
  if (!issues.length) return [];
  const root = jsonLanguage.parser.parse(state.doc.toString()).topNode.firstChild;
  return issues.map((issue) => {
    let node = root;
    for (const segment of issue.path) {
      if (!node) break;
      if (typeof segment === 'number' && node.name === 'Array') {
        const children: SyntaxNode[] = [];
        for (let child = node.firstChild; child; child = child.nextSibling)
          if (!['[', ']', ','].includes(child.name)) children.push(child);
        node = children[segment] ?? node;
      } else {
        const property = objectProperties(node).find(
          (item) => propertyName(state, item) === segment,
        );
        node = property?.lastChild ?? node;
      }
    }
    return {
      from: node?.from ?? 0,
      to: node?.to ?? Math.min(1, state.doc.length),
      severity: 'error',
      message: issue.message,
    };
  });
};
