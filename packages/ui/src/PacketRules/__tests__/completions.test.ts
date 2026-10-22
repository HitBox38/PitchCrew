import { expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { CompletionContext } from '@codemirror/autocomplete';
import { json } from '@codemirror/lang-json';
import { completePacketRules } from '../completions.ts';

const complete = (marked: string, explicit = true) => {
  const pos = marked.indexOf('|');
  const source = marked.replace('|', '');
  const state = EditorState.create({ doc: source, extensions: [json()] });
  return { source, result: completePacketRules(new CompletionContext(state, pos, explicit)) };
};
const labels = (marked: string) => complete(marked).result?.options.map((item) => item.label) ?? [];

it('completes root keys and omits keys already present', () => {
  expect(labels('{|}')).toEqual(['"version"', '"rules"']);
  expect(labels('{"version":1, |}')).toEqual(['"rules"']);
  expect(labels('{"version":1, "ru|')).toContain('"rules"');
});

it('completes properties according to the selected rule type', () => {
  const choices = labels('{"version":1,"rules":[{"kind":"word_limit", |}]}');
  expect(choices).toContain('"max"');
  expect(choices).toContain('"count"');
  expect(choices).not.toContain('"pattern"');
  expect(choices).not.toContain('"kind"');
  expect(labels('{"rules":[{"kind":"pattern","maxCount":0, |}]}')).not.toContain('"equals"');
});

it('replaces a partial property without duplicating quotes or an existing colon', () => {
  const { source, result } = complete('{"version":1,"ru|":[]}');
  const rules = result?.options.find((item) => item.label === '"rules"');
  expect(rules?.apply).toBe('"rules"');
  expect(source.slice(0, result!.from) + rules?.apply + source.slice(result!.to!)).toBe(
    '{"version":1,"rules":[]}',
  );
  expect(
    complete('{"version":1,"|":[]}').result?.options.find((item) => item.label === '"rules"')
      ?.apply,
  ).toBe('"rules"');
});

it('suggests enum values and replaces the entire quoted value', () => {
  const { source, result } = complete('{"rules":[{"kind":"pa|"}]}', false);
  expect(result?.options.map((item) => item.label)).toContain('"pattern"');
  expect(source.slice(0, result!.from) + '"pattern"' + source.slice(result!.to!)).toBe(
    '{"rules":[{"kind":"pattern"}]}',
  );
  expect(labels('{"rules":[{"severity": |}]}')).toEqual(['"error"', '"warn"']);
  expect(labels('{"rules":[{"documents":["co|"]}]}')).toContain('"coverLetter"');
});

it('does not suggest rule fields in free text or nested unrelated objects', () => {
  expect(labels('{"rules":[{"message":"some |text"}]}')).toEqual([]);
  expect(labels('{"other":{|}}')).toEqual([]);
});
