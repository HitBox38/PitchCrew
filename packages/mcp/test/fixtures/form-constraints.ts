import assert from 'node:assert/strict';
import type { BrowserSnapshot } from '@pitchcrew/core';

export const formConstraintsHtml = `<!doctype html><title>Fictional constraints</title>
<label for="summary">Summary</label><textarea id="summary" minlength="20" maxlength="500">Private draft</textarea>
<label>Years<input type="number" min="0" max="50" step="0.5"></label>
<label>Unspecified<input></label><label>Malformed<input minlength="invalid" step="${'x'.repeat(201)}"></label>
<label>Nested label<textarea>Private nested draft</textarea></label>
<label>Resume<input type="file" accept=".pdf" data-max-size="1000"></label>
<label for="country">Country</label><select id="country">${Array.from({ length: 105 }, (_, i) => `<option>Country ${i}</option>`).join('')}</select>
<label for="short">Short choices</label><select id="short"><option>Yes</option><option>No</option></select>
<label for="long">Long label</label><select id="long"><option>${'z'.repeat(600)}</option></select>
<span id="question">Work authorization?</span>
<div role="radiogroup" aria-labelledby="question" aria-required="true">
<button type="button" role="radio" aria-checked="false">Yes</button>
<button type="button" role="radio" aria-checked="false" aria-disabled="true">No</button></div>
<fieldset disabled><legend>Preferences</legend><input type="checkbox" aria-label="Remote"></fieldset>
<form><div role="group" aria-label="Availability"><button aria-pressed="false">Now</button></div></form>
<button type="button" aria-pressed="true">Selected toggle</button>
<button type="button" aria-pressed="mixed">Mixed toggle</button>
<button type="button" aria-pressed="invalid">Unknown toggle</button>
<div role="checkbox" aria-label="Selected checkbox" aria-checked="true"></div>
<div role="checkbox" aria-label="Mixed checkbox" aria-checked="mixed"></div>
<div role="radio" aria-label="Selected radio" aria-checked="true"></div>
<div role="radio" aria-label="Unknown radio" aria-checked="mixed"></div>
<input type="checkbox" hidden><button type="button">Unspecified Yes</button>
<input type="password" value="fictional-secret">
<div role="radiogroup" aria-label="${'p'.repeat(490)}fictional-secret"><button type="button" role="radio" aria-checked="false">Public</button></div>`;

export const assertFormConstraints = (page: BrowserSnapshot) => {
  const field = (label: string) => {
    const control = page.controls?.find((entry) => entry.label === label);
    assert.ok(control, `Missing inspected control ${label}`);
    return control;
  };
  assert.deepEqual(field('Summary').constraints?.minLength, { status: 'declared', value: '20' });
  assert.deepEqual(field('Summary').constraints?.maxLength, { status: 'declared', value: '500' });
  assert.deepEqual(field('Years').constraints?.min, { status: 'declared', value: '0' });
  assert.deepEqual(field('Years').constraints?.max, { status: 'declared', value: '50' });
  assert.deepEqual(field('Years').constraints?.step, { status: 'declared', value: '0.5' });
  assert.deepEqual(field('Unspecified').constraints?.minLength, { status: 'absent' });
  assert.deepEqual(field('Malformed').constraints?.minLength, {
    status: 'declared',
    value: 'invalid',
  });
  assert.deepEqual(field('Malformed').constraints?.step, { status: 'unavailable' });
  assert.equal(field('Resume').constraints?.uploadSizeLimit, 'unknown');
  assert.equal(field('Country').options.length, 100);
  assert.equal(field('Country').optionsTotal, 105);
  assert.equal(field('Country').optionsTruncated, true);
  assert.equal(field('Short choices').optionsTruncated, false);
  assert.equal(field('Long label').options[0]!.length, 500);
  assert.equal(field('Long label').optionsTruncated, true);
  assert.deepEqual(field('Yes').group, {
    role: 'radiogroup',
    label: 'Work authorization?',
    required: true,
  });
  assert.equal(field('Yes').required, true);
  assert.equal(field('No').disabled, true);
  assert.equal(field('Remote').disabled, true);
  assert.deepEqual(field('Now').group, { role: 'group', label: 'Availability', required: null });
  assert.equal(field('Now').type, 'toggle');
  assert.equal(field('Now').buttonType, 'submit');
  assert.equal(field('Now').pressed, false);
  assert.equal(field('Selected toggle').buttonType, 'button');
  assert.equal(field('Selected toggle').pressed, true);
  assert.equal(field('Mixed toggle').pressed, 'mixed');
  assert.equal(field('Unknown toggle').pressed, undefined);
  assert.equal(field('Selected checkbox').checked, true);
  assert.equal(field('Mixed checkbox').checked, 'mixed');
  assert.equal(field('Selected radio').checked, true);
  assert.equal(field('Unknown radio').checked, undefined);
  assert.equal(field('Yes').checked, false);
  assert.ok(!page.controls?.some((control) => control.label === 'Unspecified Yes'));
  assert.ok(!JSON.stringify(page.controls).includes('fictional-secret'));
  assert.ok(!JSON.stringify(page.controls).includes('Private draft'));
  assert.ok(!JSON.stringify(page.controls).includes('Private nested draft'));
  assert.equal(field('Nested label').type, 'textarea');
};
