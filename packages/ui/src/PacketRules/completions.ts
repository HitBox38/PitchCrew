import type { CompletionContext, CompletionResult, Completion } from '@codemirror/autocomplete';
import { syntaxTree } from '@codemirror/language';
import { ancestor, objectProperties, propertyName } from '../JsonEditor/helpers.ts';
import { enumValues, fieldsByKind, ruleFields } from './completion-fields.ts';

/** Completion uses the tolerant syntax tree so unfinished JSON remains editable. */
export const completePacketRules = (context: CompletionContext): CompletionResult | null => {
  const { state, pos } = context;
  const node = syntaxTree(state).resolveInner(pos, -1);
  const object = ancestor(node, 'Object');
  const candidate = ancestor(node, 'Property');
  const property = candidate?.parent?.from === object?.from ? candidate : null;
  const name = property?.getChild('PropertyName');
  const colon = property?.getChild(':');
  const prefix = context.matchBefore(/"?[\w-]*$/);
  if (!context.explicit && !prefix?.text) return null;
  if (colon && pos > colon.from && (!name || pos > name.to)) {
    const key = propertyName(state, property!);
    const values = enumValues[key];
    if (!values || (key === 'documents' && !ancestor(node, 'Array'))) return null;
    const from = node.name === 'String' ? node.from : (prefix?.from ?? pos);
    const to = node.name === 'String' ? node.to : pos;
    return {
      from,
      to,
      options: values.map((value) => ({ label: JSON.stringify(value), type: 'enum' })),
    };
  }
  if (!object || (node.name === 'String' && name?.from !== node.from)) return null;
  const properties = objectProperties(object);
  const existing = properties.map((item) => propertyName(state, item));
  const root = !ancestor(object.parent, 'Object');
  // Only the document object and objects directly inside rules receive field suggestions.
  if (!root && propertyName(state, object.parent?.parent ?? object) !== 'rules') return null;
  const kindProperty = properties.find((item) => propertyName(state, item) === 'kind');
  const kindNode = kindProperty?.lastChild;
  let kind = '';
  try {
    kind = kindNode ? (JSON.parse(state.sliceDoc(kindNode.from, kindNode.to)) as string) : '';
  } catch {
    /* Incomplete kind. */
  }
  const fields = root
    ? {
        version: { detail: 'Packet rules file version', value: '1' },
        rules: { detail: 'Packet rules', value: '[]' },
      }
    : Object.fromEntries(
        [
          'id',
          'kind',
          'severity',
          'documents',
          'message',
          ...(fieldsByKind[kind] ?? Object.keys(ruleFields)),
        ].map((field) => [field, ruleFields[field]!]),
      );
  const current = name && pos <= name.to ? propertyName(state, property!) : '';
  const options: Completion[] = Object.entries(fields)
    .filter(([field]) => !existing.includes(field) || field === current)
    .filter(
      ([field]) =>
        !(
          kind === 'pattern' &&
          ((field === 'equals' && existing.includes('maxCount')) ||
            (field === 'maxCount' && existing.includes('equals')))
        ),
    )
    .map(([field, description]) => ({
      label: JSON.stringify(field),
      detail: description.detail,
      type: 'property',
      apply: `${JSON.stringify(field)}${colon && name && pos <= name.to ? '' : `: ${description.value}`}`,
    }));
  return {
    from: name && pos <= name.to ? name.from : (prefix?.from ?? pos),
    to: name && pos <= name.to ? name.to : pos,
    options,
  };
};
