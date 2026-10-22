import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import type { ConnectorStatus, ExternalMcpInfo, PacketRules, Role } from '@pitchcrew/core';
import { cleanup, setup } from './helpers/daemon.ts';

let host: Awaited<ReturnType<typeof setup>>;
let browser: Browser;
let page: Page;
const errors: string[] = [];
const open = async (section: string) => {
  await page.goto(`${host.daemon.url}/settings?section=${section}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByRole('button', { name: 'Find a setting', exact: true }).waitFor();
};
const choose = async (label: string, value: string) => {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: value, exact: true }).click();
};
const addRule = async (firstField: string) => {
  await page.getByRole('button', { name: 'Add rule', exact: true }).click();
  // Adding a rule focuses its first field in the next animation frame.
  await expect
    .poll(() =>
      page
        .getByLabel(firstField, { exact: true })
        .evaluate((field) => field === document.activeElement),
    )
    .toBe(true);
};
const saveRules = async () => {
  const button = page.getByRole('button', { name: 'Save rules', exact: true });
  await expect.poll(() => button.isEnabled(), { timeout: 10000 }).toBe(true);
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/packet-rules') && response.request().method() === 'PUT',
    ),
    button.click(),
  ]);
  await page.getByText(/^\d+ saved rules$/).waitFor();
  await expect.poll(() => button.isDisabled()).toBe(true);
};
beforeAll(async () => {
  host = await setup(15752);
  host.daemon.service.onboarding.save({ version: 1, status: 'dismissed', step: 0 });
  browser = await chromium.launch({ headless: true });
}, 60000);
beforeEach(async () => {
  host.daemon.service.packetRules.reset();
  for (const source of await host.daemon.service.jobSources.list())
    await host.daemon.service.jobSources.remove(source.id);
  errors.length = 0;
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(10000);
  page.on('pageerror', (error) => errors.push(error.message));
});
afterEach(async () => {
  await page?.close();
  vi.restoreAllMocks();
  expect(errors).toEqual([]);
});
afterAll(async () => {
  await browser?.close();
  await cleanup();
});

test('changes word limits without JSON, validates incomplete fields and saves the same source', async () => {
  await open('rules');
  await page.getByRole('button', { name: /^Word limit for Resume/ }).click();
  const maximum = page.getByRole('spinbutton', { name: 'Maximum words', exact: true });
  await maximum.fill('');
  expect(
    await page.getByRole('tab', { name: 'Rule editor', exact: true }).getAttribute('aria-selected'),
  ).toBe('true');
  await expect
    .poll(() => page.getByRole('button', { name: 'Save rules', exact: true }).isDisabled())
    .toBe(true);
  await maximum.fill('700');
  await choose('When this rule fails', 'Show a warning');
  await saveRules();
  expect(host.daemon.service.packetRules.current().rules.rules[0]).toMatchObject({
    max: 700,
    severity: 'warn',
  });
  await page.getByRole('tab', { name: 'Advanced JSON', exact: true }).click();
  const source = JSON.parse(
    await page.getByRole('textbox', { name: 'Rules file (JSON)', exact: true }).innerText(),
  ) as PacketRules;
  expect(source.rules[0]).toMatchObject({ max: 700, severity: 'warn' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByText('At most 700 words.', { exact: true }).waitFor();
}, 30000);

test('keeps rule editors mounted when names change and an earlier rule is removed', async () => {
  await open('rules');
  await page.getByRole('button', { name: /^Word limit for Cover letter/ }).click();
  const name = page.getByRole('textbox', { name: 'Rule name', exact: true });
  await name.fill('cover-draft');
  await name.press('End');
  await page.keyboard.type('-edited');
  expect(await name.inputValue()).toBe('cover-draft-edited');
  expect(await name.evaluate((element) => element === document.activeElement)).toBe(true);
  const retained = await name.elementHandle();
  if (!retained) throw new Error('Expected the rule editor to be mounted.');

  await page.getByRole('button', { name: /^Word limit for Resume/ }).click();
  await page
    .getByRole('group', { name: 'Edit rule resume-length', exact: true })
    .getByRole('button', { name: 'Remove rule', exact: true })
    .click();
  expect(await retained.evaluate((element) => element.isConnected)).toBe(true);
  expect(await retained.getAttribute('id')).toBe('packet-rule-0-id');
  expect(await page.getByRole('textbox', { name: 'Rule name', exact: true }).inputValue()).toBe(
    'cover-draft-edited',
  );
  await saveRules();
  expect(host.daemon.service.packetRules.current().rules.rules).toMatchObject([
    { id: 'cover-draft-edited', documents: ['coverLetter'] },
  ]);
  await retained.dispose();
}, 30000);

test('creates bullet, allowed-line and captured-value rules with equivalent advanced JSON', async () => {
  await open('rules');
  await choose('Rule type', 'Bullets per section');
  await addRule('Maximum bullets per section');
  await page
    .getByRole('spinbutton', { name: 'Maximum bullets per section', exact: true })
    .fill('4');
  await page
    .getByRole('textbox', { name: 'Section heading pattern (optional)', exact: true })
    .fill('Experience');
  await choose('Rule type', 'Allowed lines');
  await addRule('Lines to check (regular expression)');
  await page
    .getByRole('textbox', { name: 'Lines to check (regular expression)', exact: true })
    .fill('^Degree:');
  await page
    .getByRole('textbox', { name: 'Allowed lines', exact: true })
    .fill('Degree: Fictional BSc\nDegree: Fictional MSc');
  await choose('Rule type', 'Text pattern');
  await addRule('Text to match (regular expression)');
  await page
    .getByRole('textbox', { name: 'Text to match (regular expression)', exact: true })
    .fill('Team of (\\d+)');
  await choose('Check', 'Require an exact captured value');
  await page.getByRole('textbox', { name: 'Required captured value', exact: true }).fill('3');
  await saveRules();
  const rules = host.daemon.service.packetRules.current().rules.rules;
  expect(rules.slice(2)).toMatchObject([
    { kind: 'max_bullets', max: 4, heading: 'Experience' },
    {
      kind: 'canonical_lines',
      selector: '^Degree:',
      values: ['Degree: Fictional BSc', 'Degree: Fictional MSc'],
    },
    { kind: 'pattern', pattern: 'Team of (\\d+)', equals: '3' },
  ]);
  expect(rules[4]).not.toHaveProperty('maxCount');
}, 30000);

test('preserves malformed and unsupported source and guards unsaved rule navigation', async () => {
  await open('rules');
  await page.getByRole('tab', { name: 'Advanced JSON', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Rules file (JSON)', exact: true });
  const source = '{"version":1,"rules":[{"kind":"future-kind","preserved":"keep me"}]}';
  await editor.fill(source);
  expect(await page.getByRole('tab', { name: 'Rule editor', exact: true }).isDisabled()).toBe(true);
  expect(await editor.innerText()).toBe(source);
  await editor.fill('{broken');
  expect(await editor.innerText()).toBe('{broken');
  await page.getByRole('tab', { name: 'General', exact: true }).click();
  const discard = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true });
  await discard.getByRole('button', { name: 'Keep editing', exact: true }).click();
  expect(await editor.innerText()).toBe('{broken');
  await page
    .locator('.packet-rules-actions')
    .getByRole('button', { name: 'Discard changes', exact: true })
    .click();
  await page.getByRole('tab', { name: 'Rule editor', exact: true }).click();
  await page.getByRole('button', { name: /^Word limit for Resume/ }).waitFor();
}, 30000);

test('JSON editor settings default formatting off and remember explicit choices across reloads', async () => {
  await open('rules');
  await page.getByRole('tab', { name: 'Advanced JSON', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Rules file (JSON)', exact: true });
  const preference = page.getByRole('switch', { name: 'Format on save', exact: true });
  await page.getByRole('button', { name: 'JSON editor settings', exact: true }).click();
  expect(await preference.isChecked()).toBe(false);
  expect(await page.getByRole('switch', { name: 'Format on paste', exact: true }).isChecked()).toBe(
    false,
  );
  expect(
    await page.getByRole('switch', { name: 'Format while typing', exact: true }).isChecked(),
  ).toBe(false);
  await preference.click();
  await page
    .getByRole('dialog', { name: 'JSON editor settings', exact: true })
    .getByRole('button', { name: 'Close', exact: true })
    .click();
  const source = '{ "version":1, "rules":[] }';
  await editor.fill(source);
  await saveRules();
  expect(host.daemon.service.packetRules.current().source).toBe(
    '{\n  "version": 1,\n  "rules": []\n}\n',
  );
  await page.getByRole('button', { name: 'JSON editor settings', exact: true }).click();
  await preference.click();
  await page
    .getByRole('dialog', { name: 'JSON editor settings', exact: true })
    .getByRole('button', { name: 'Close', exact: true })
    .click();
  await editor.fill(source);
  await saveRules();
  expect(host.daemon.service.packetRules.current().source).toBe(source);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'Advanced JSON', exact: true }).click();
  await page.getByRole('button', { name: 'JSON editor settings', exact: true }).click();
  expect(await preference.isChecked()).toBe(false);
  await page
    .getByRole('dialog', { name: 'JSON editor settings', exact: true })
    .getByRole('button', { name: 'Close', exact: true })
    .click();
  expect(await editor.innerText()).toBe(source);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export saved rules', exact: true }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString()).toBe(source);
  const windowsSource = '{\r\n\t"version":1, "rules":[]\r\n}';
  await host.request('/packet-rules', 'PUT', { source: windowsSource });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'Advanced JSON', exact: true }).click();
  await expect
    .poll(() => page.getByRole('button', { name: 'Save rules', exact: true }).isDisabled())
    .toBe(true);
  await editor.press('ControlOrMeta+End');
  await editor.press('Space');
  await saveRules();
  expect(host.daemon.service.packetRules.current().source).toBe(`${windowsSource} `);
}, 30000);

test('JSON editor settings enable paste and typing formatting independently and retain Undo', async () => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await open('rules');
  await page.getByRole('tab', { name: 'Advanced JSON', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Rules file (JSON)', exact: true });
  const settings = page.getByRole('button', { name: 'JSON editor settings', exact: true });
  const dialog = page.getByRole('dialog', { name: 'JSON editor settings', exact: true });
  const source = '{"version":1,"rules":[]}';
  await page.evaluate((text) => navigator.clipboard.writeText(text), source);
  await editor.fill('');
  await editor.press('ControlOrMeta+v');
  expect(await editor.innerText()).toBe(source);
  await settings.click();
  await dialog.getByRole('switch', { name: 'Format on paste', exact: true }).click();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect
    .poll(() => settings.evaluate((element) => document.activeElement === element))
    .toBe(true);
  await editor.fill('{}');
  await editor.press('ControlOrMeta+a');
  await editor.press('ControlOrMeta+v');
  expect(await editor.innerText()).toContain('\n  "version": 1');
  await editor.press('ControlOrMeta+z');
  expect(await editor.innerText()).toBe('{}');
  await editor.fill(source);
  await editor.press('ControlOrMeta+Home');
  await editor.press('Space');
  expect(await editor.innerText()).toBe(` ${source}`);
  await settings.click();
  await dialog.getByRole('switch', { name: 'Format while typing', exact: true }).click();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await editor.press('ControlOrMeta+Home');
  await editor.press('Space');
  expect(await editor.innerText()).toContain('\n  "version": 1');
  await saveRules();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'Advanced JSON', exact: true }).click();
  await settings.click();
  expect(
    await dialog.getByRole('switch', { name: 'Format on save', exact: true }).isChecked(),
  ).toBe(false);
  expect(
    await dialog.getByRole('switch', { name: 'Format on paste', exact: true }).isChecked(),
  ).toBe(true);
  expect(
    await dialog.getByRole('switch', { name: 'Format while typing', exact: true }).isChecked(),
  ).toBe(true);
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await editor.fill('{broken');
  expect(await editor.innerText()).toBe('{broken');
}, 30000);

test('JSON editor supports formatting, undo across tabs, indentation, focus escape and keyboard save', async () => {
  await open('rules');
  await page.getByRole('tab', { name: 'Advanced JSON', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Rules file (JSON)', exact: true });
  const source = '{"version":1,"rules":[]}';
  await editor.fill(source);
  await page.getByRole('button', { name: 'Format', exact: true }).click();
  expect(await editor.innerText()).toContain('\n  "version": 1');
  await page.getByRole('tab', { name: 'Rule editor', exact: true }).click();
  await page.getByRole('tab', { name: 'Advanced JSON', exact: true }).click();
  await editor.press('ControlOrMeta+z');
  expect(await editor.innerText()).toBe(source);
  await editor.press('ControlOrMeta+Home');
  await editor.press('Tab');
  expect(await editor.innerText()).toBe(`  ${source}`);
  await editor.press('Shift+Tab');
  expect(await editor.innerText()).toBe(source);
  await editor.press('Escape');
  await editor.press('Tab');
  expect(await editor.evaluate((element) => element === document.activeElement)).toBe(false);
  await expect
    .poll(() => page.getByRole('button', { name: 'Save rules', exact: true }).isEnabled())
    .toBe(true);
  await editor.press('ControlOrMeta+s');
  await page.getByText('0 saved rules', { exact: true }).waitFor();
  expect(host.daemon.service.packetRules.current().rules.rules).toEqual([]);
}, 30000);

test('JSON editor completes properties and values and locates daemon validation errors inline', async () => {
  await open('rules');
  await page.getByRole('tab', { name: 'Advanced JSON', exact: true }).click();
  const editor = page.getByRole('textbox', { name: 'Rules file (JSON)', exact: true });
  await editor.fill('{"version":1, }');
  await editor.press('ControlOrMeta+End');
  await editor.press('ArrowLeft');
  await editor.press('Control+Space');
  await page.getByRole('option', { name: /"rules"/ }).waitFor();
  await editor.press('Tab');
  expect(JSON.parse(await editor.innerText())).toEqual({ version: 1, rules: [] });
  await editor.fill('{"version":1,"rules":[{"kind":""}]}');
  await editor.press('ControlOrMeta+Home');
  for (let index = 0; index < '{"version":1,"rules":[{"kind":"'.length; index++)
    await editor.press('ArrowRight');
  await page.keyboard.type('pa');
  await page.getByRole('option', { name: /"pattern"/ }).waitFor();
  await editor.press('Enter');
  expect(JSON.parse(await editor.innerText()).rules[0].kind).toBe('pattern');
  await editor.fill(
    '{"version":1,"rules":[{"id":"test","kind":"word_limit","severity":"warn","documents":["resume"],"max":-5}]}',
  );
  await expect.poll(() => editor.getAttribute('aria-invalid')).toBe('true');
  await expect.poll(() => page.locator('.cm-lintRange-error').count()).toBeGreaterThan(0);
  expect(await page.locator('.cm-lintRange-error').first().innerText()).toBe('-5');
  await editor.fill('{broken');
  await expect
    .poll(() => page.getByRole('button', { name: 'Format', exact: true }).isDisabled())
    .toBe(true);
}, 30000);

test('Settings search and global search navigate to and focus a preference', async () => {
  await open('rules');
  await page.getByRole('button', { name: 'Find a setting', exact: true }).click();
  const search = page.getByRole('dialog', { name: 'Find a setting', exact: true });
  await search.getByRole('combobox').fill('mute');
  await search.getByRole('option', { name: /Notification sounds/ }).click();
  await expect
    .poll(() =>
      page
        .getByRole('switch', { name: 'Notification sounds', exact: true })
        .evaluate((element) => document.activeElement === element),
    )
    .toBe(true);
  expect(page.url()).toContain('section=general#notification-sounds');
  await page.keyboard.press('ControlOrMeta+k');
  const global = page.getByRole('dialog', { name: 'Search Pitchcrew', exact: true });
  await global.getByRole('combobox').fill('telemetry');
  await global.getByRole('option', { name: /Anonymous usage analytics/ }).click();
  await expect
    .poll(() =>
      page
        .getByRole('switch', { name: 'Share anonymous usage', exact: true })
        .evaluate((element) => document.activeElement === element),
    )
    .toBe(true);
  expect(page.url()).toContain('section=privacy#usage-analytics');
  await page.keyboard.press('ControlOrMeta+k');
  await global.getByRole('combobox').fill('format JSON');
  await global.getByRole('option', { name: /JSON editor settings/ }).click();
  await expect
    .poll(() =>
      page
        .getByRole('button', { name: 'JSON editor settings', exact: true })
        .evaluate((element) => document.activeElement === element),
    )
    .toBe(true);
  expect(page.url()).toContain('section=rules#json-editor-settings');
}, 30000);

test('connected accounts show agent access and open the existing explicit configuration flow', async () => {
  const fixture: ConnectorStatus[] = [
    {
      id: 'github',
      connected: true,
      account: 'fixture-user',
      services: ['github'],
      configured: true,
      pending: false,
      error: '',
      connectionMethod: 'cli',
    },
  ];
  vi.spyOn(host.daemon.service.connectors, 'status').mockReturnValue(fixture);
  await open('accounts');
  const account = page.getByRole('article', { name: 'GitHub account', exact: true });
  await account.getByText('No agents have access yet.', { exact: true }).waitFor();
  await account.getByRole('button', { name: 'Choose agents', exact: true }).click();
  const before = host.daemon.service.board.get<Role>('role', 'scout');
  await account
    .getByRole('button', { name: 'Configure Scout access to GitHub', exact: true })
    .click();
  await page.getByRole('heading', { name: 'Scout settings', exact: true }).waitFor();
  expect(host.daemon.service.board.get<Role>('role', 'scout')).toEqual(before);
  await page.getByRole('button', { name: 'Close agent settings', exact: true }).click();
}, 30000);

test('mobile source editing protects drafts and removal explains that leads stay', async () => {
  const source = await host.daemon.service.jobSources.add({
    provider: 'greenhouse',
    slug: 'fixture-board',
    name: 'Fixture Company',
    enabled: true,
    filters: { titleInclude: [], titleExclude: [], locationInclude: [], remoteOnly: false },
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem('pitchcrew-theme', 'dark'));
  await open('sources');
  await page.getByRole('switch', { name: 'Watch Fixture Company', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByRole('textbox', { name: 'Company name', exact: true }).fill('Edited fixture');
  await page.getByRole('tab', { name: 'Accounts', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true });
  await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click();
  expect(await page.getByRole('textbox', { name: 'Company name', exact: true }).inputValue()).toBe(
    'Edited fixture',
  );
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await dialog.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await page
    .getByRole('button', { name: 'Remove source Fixture Company; keep its leads', exact: true })
    .click();
  const remove = page.getByRole('dialog', { name: 'Remove Fixture Company?', exact: true });
  await remove.getByText(/Jobs already added to your pipeline stay/).waitFor();
  expect((await host.daemon.service.jobSources.list()).map((entry) => entry.id)).toContain(
    source.id,
  );
  await remove.getByRole('button', { name: 'Keep source', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}, 30000);

test('external agent access is opt-in, exposes a copyable configuration and revokes from Settings', async () => {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await host.request('/external-mcp/access', 'PUT', { enabled: false, write: false });
  await open('accounts');
  const enabled = page.getByRole('switch', { name: 'Allow external agents', exact: true });
  const write = page.getByRole('switch', { name: 'Allow changes and crew messages', exact: true });
  await enabled.waitFor();
  await expect.poll(() => enabled.isEnabled(), { timeout: 10000 }).toBe(true);
  expect(await enabled.isChecked()).toBe(false);
  expect(await write.isDisabled()).toBe(true);
  await enabled.click();
  const configuration = page.getByLabel('Pitchcrew MCP configuration', { exact: true });
  await configuration.waitFor();
  const initial = await host.request<ExternalMcpInfo>('/external-mcp/access');
  expect(initial.result).toMatchObject({ enabled: true, write: false });
  expect(JSON.parse((await configuration.textContent())!)).toEqual(initial.result.configuration);
  await page.getByRole('button', { name: 'Copy Pitchcrew MCP configuration', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    JSON.stringify(initial.result.configuration, null, 2),
  );
  await write.click();
  await expect
    .poll(async () => (await host.request<ExternalMcpInfo>('/external-mcp/access')).result.write)
    .toBe(true);
  await enabled.click();
  await configuration.waitFor({ state: 'detached' });
  expect((await host.request<ExternalMcpInfo>('/external-mcp/access')).result).toMatchObject({
    enabled: false,
    write: false,
  });
  expect(await write.isDisabled()).toBe(true);
}, 30000);

test.each(['denied', 'unavailable'] as const)(
  'MCP configuration copy explains a %s clipboard and supports retry',
  async (availability) => {
    await host.request('/external-mcp/access', 'PUT', { enabled: true, write: false });
    await page.addInitScript((availability) => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value:
          availability === 'unavailable'
            ? undefined
            : {
                writeText: async () => {
                  throw new DOMException('Write denied', 'NotAllowedError');
                },
              },
      });
    }, availability);
    await open('accounts');
    const copy = page.getByRole('button', {
      name: 'Copy Pitchcrew MCP configuration',
      exact: true,
    });
    await copy.click();
    const guidance = page.getByText('Could not copy. Select the text and copy it manually.', {
      exact: true,
    });
    await guidance.waitFor();
    expect(await copy.getAttribute('data-copied')).toBeNull();
    const expected = await page
      .getByLabel('Pitchcrew MCP configuration', { exact: true })
      .textContent();
    expect(expected).toContain('mcpServers');
    await page.evaluate(() => Reflect.deleteProperty(navigator, 'clipboard'));
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await copy.click();
    await expect.poll(() => copy.getAttribute('data-copied')).toBe('true');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
    expect(await guidance.count()).toBe(0);
    await host.request('/external-mcp/access', 'PUT', { enabled: false, write: false });
  },
  30000,
);
