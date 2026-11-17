import { Board } from '@pitchcrew/board';
import type { BrowserAction, ComputerApproval } from '@pitchcrew/core';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ComputerManager, createBrowserDriver } from '../src/computer.ts';
import {
  accessModeAllows,
  classifyAction,
  type ActionClass,
  type ActionTarget,
} from '../src/computer/access-modes.ts';
import { readActionTarget } from '../src/computer/action-target.ts';

vi.mock('node:dns/promises', () => ({ lookup: async () => [{ address: '8.8.8.8', family: 4 }] }));

const target = (overrides: Partial<ActionTarget> = {}): ActionTarget => ({
  control: 'button',
  name: 'Next',
  names: [],
  value: '',
  href: '',
  form: '',
  small: false,
  credential: false,
  ...overrides,
});
const click = { kind: 'click', selector: '#target' } as const;
const enter = { kind: 'press', selector: '#target', key: 'Enter' } as const;
const space = { kind: 'press', selector: '#target', key: 'Space' } as const;

describe('browser action classes', () => {
  it.each<[string, BrowserAction, ActionTarget | undefined, ActionClass]>([
    [
      'reads a public page',
      { kind: 'navigate', url: 'https://example.com/jobs' },
      undefined,
      'read',
    ],
    [
      'opens a recognized application page',
      {
        kind: 'navigate',
        url: 'https://jobs.lever.co/northwind/00000000-0000-4000-8000-000000000000/apply',
      },
      undefined,
      'read',
    ],
    ['asks before plain HTTP', { kind: 'navigate', url: 'http://example.com' }, undefined, 'risky'],
    [
      'asks before a destructive-looking address',
      { kind: 'navigate', url: 'https://example.com/account/delete' },
      undefined,
      'risky',
    ],
    ['scrolls', { kind: 'scroll', selector: 'body', deltaX: 0, deltaY: 400 }, undefined, 'read'],
    ['hovers', { kind: 'hover', selector: '#menu' }, undefined, 'read'],
    [
      'fills a field',
      { kind: 'fill', selector: '#name', value: 'Pat' },
      target({ control: 'field' }),
      'edit',
    ],
    [
      'never fills a credential on its own',
      { kind: 'fill', selector: '#password', value: 'x' },
      target({ control: 'field', credential: true }),
      'risky',
    ],
    [
      'selects an option',
      { kind: 'select', selector: '#team', value: 'Platform' },
      undefined,
      'edit',
    ],
    ['clicks a routine button', click, target(), 'interaction'],
    [
      'clicks a routine button that saves',
      click,
      target({ name: 'Save and continue' }),
      'interaction',
    ],
    ['closes a cookie banner', click, target({ name: 'Accept all cookies' }), 'interaction'],
    ['cancels a dialog', click, target({ name: 'Cancel' }), 'interaction'],
    ['applies filters', click, target({ name: 'Apply filters' }), 'interaction'],
    ['deletes', click, target({ name: 'Delete draft' }), 'risky'],
    ['cancels a subscription', click, target({ name: 'Cancel subscription' }), 'risky'],
    ['accepts an offer', click, target({ name: 'Accept offer' }), 'risky'],
    ['sends an invitation', click, target({ name: 'Connect' }), 'submission'],
    ['posts publicly', click, target({ name: 'Post' }), 'submission'],
    ['replies', click, target({ name: 'Reply' }), 'submission'],
    ['follows a company', click, target({ name: 'Follow' }), 'risky'],
    ['shares a job', click, target({ name: 'Share' }), 'risky'],
    [
      'asks before an unnamed button, which may be a send arrow',
      click,
      target({ name: '' }),
      'submission',
    ],
    ['submits', click, target({ name: 'Submit application' }), 'submission'],
    ['sends a message', click, target({ name: 'Send message' }), 'submission'],
    ['applies', click, target({ name: 'Easy Apply' }), 'submission'],
    [
      'follows a read-only link',
      click,
      target({ control: 'link', name: 'Platform Engineer', href: 'https://example.com/jobs/1' }),
      'interaction',
    ],
    [
      'asks before a destructive link',
      click,
      target({
        control: 'link',
        name: 'Remove my data',
        href: 'https://example.com/account/delete',
      }),
      'risky',
    ],
    [
      'asks before a sign-out link',
      click,
      target({ control: 'link', name: 'Sign out', href: 'https://example.com/session' }),
      'risky',
    ],
    [
      'submits a POST form',
      click,
      target({ control: 'submit', name: 'Finish', form: 'post' }),
      'submission',
    ],
    [
      'submits a form the page sends itself',
      click,
      target({ control: 'submit', name: 'Done', form: 'script' }),
      'submission',
    ],
    [
      'sends from the last step of a form',
      click,
      target({ control: 'submit', name: 'Review and submit', form: 'post' }),
      'submission',
    ],
    [
      'moves a POST form to its next step',
      click,
      target({ control: 'submit', name: 'Next', form: 'post' }),
      'risky',
    ],
    [
      'saves a step the page sends itself',
      click,
      target({ control: 'submit', name: 'Save and continue', form: 'script' }),
      'risky',
    ],
    [
      'moves to the next step in Hebrew',
      click,
      target({ control: 'submit', name: 'המשך', form: 'script' }),
      'risky',
    ],
    [
      'searches through a small form the page sends itself',
      click,
      target({ control: 'submit', name: 'Search jobs', form: 'script', small: true }),
      'risky',
    ],
    [
      'searches in Hebrew',
      click,
      target({ control: 'submit', name: 'חיפוש', form: 'script', small: true }),
      'risky',
    ],
    [
      'never treats a search-named button of an application form as a search',
      click,
      target({ control: 'submit', name: 'Find', form: 'post', small: false }),
      'submission',
    ],
    [
      'asks before a link that says it submits, whatever its address',
      click,
      target({ control: 'link', name: 'Submit application', href: 'https://example.com/jobs/1' }),
      'submission',
    ],
    [
      'follows an Apply link to a recognized application page',
      click,
      target({
        control: 'link',
        name: 'Apply now',
        href: 'https://jobs.lever.co/northwind/00000000-0000-4000-8000-000000000000/apply',
      }),
      'interaction',
    ],
    [
      'asks before an Apply link to an unrecognized application address',
      click,
      target({ control: 'link', name: 'Apply', href: 'https://careers.example/jobs/1/apply' }),
      'submission',
    ],
    [
      'asks before a link the page sends as a POST',
      click,
      target({ control: 'submit', name: 'Withdraw', form: 'post' }),
      'submission',
    ],
    [
      'asks before a symbol-only button, which may be a send arrow',
      click,
      target({ name: '➤', names: ['➤'] }),
      'submission',
    ],
    [
      'reads every name: a submit button labelled as a step but showing Submit asks',
      click,
      target({
        control: 'submit',
        name: 'Next step',
        names: ['Next step', 'Submit application'],
        form: 'post',
      }),
      'submission',
    ],
    [
      'asks Auto before a name with letters from another script, even mixed with Latin',
      click,
      target({ name: 'LINEで送る', names: ['LINEで送る'] }),
      'risky',
    ],
    [
      'judges the native submit button around a clicked role element',
      click,
      target({
        name: 'Details',
        enclosing: [target({ control: 'submit', name: 'Send application', form: 'post' })],
      }),
      'submission',
    ],
    [
      'asks before Enter in a search-like form whose button sends',
      enter,
      target({
        control: 'field',
        name: 'Query',
        form: 'search',
        defaultButton: target({ control: 'submit', name: 'Send', form: 'search' }),
      }),
      'submission',
    ],
    [
      'asks before Enter in a dialog form whose default button sends',
      enter,
      target({
        control: 'field',
        name: 'Message',
        form: 'dialog',
        defaultButton: target({ control: 'submit', name: 'Send', form: 'dialog' }),
      }),
      'submission',
    ],
    [
      'asks before Enter in a GET form whose default button posts the application',
      enter,
      target({
        control: 'field',
        form: 'get',
        defaultButton: target({ control: 'submit', name: 'Send application', form: 'post' }),
      }),
      'submission',
    ],
    [
      'searches with Enter when the default button searches',
      enter,
      target({
        control: 'field',
        name: 'Keywords',
        form: 'search',
        defaultButton: target({ control: 'submit', name: 'Search', form: 'search' }),
      }),
      'interaction',
    ],
    [
      'cannot judge an unnamed submit control of a POST form',
      click,
      target({ control: 'submit', name: '', form: 'post' }),
      'submission',
    ],
    [
      'searches a site',
      click,
      target({ control: 'submit', name: '', form: 'search' }),
      'interaction',
    ],
    [
      'navigates through an explicit GET form',
      click,
      target({ control: 'submit', name: 'Update results', form: 'get' }),
      'risky',
    ],
    [
      'closes a dialog form',
      click,
      target({ control: 'submit', name: 'Close', form: 'dialog' }),
      'interaction',
    ],
    [
      'confirms a deletion in a dialog form',
      click,
      target({ control: 'submit', name: 'Delete', form: 'dialog' }),
      'risky',
    ],
    ['resets a form', click, target({ control: 'reset', name: 'Reset', form: 'post' }), 'risky'],
    ['ticks a box', click, target({ control: 'choice', name: 'I agree' }), 'edit'],
    ['picks a listbox option', click, target({ control: 'choice', name: 'Remote' }), 'edit'],
    ['opens a tab', click, target({ control: 'toggle', name: 'Benefits' }), 'interaction'],
    ['focuses a field', click, target({ control: 'field', name: 'Email', form: 'post' }), 'edit'],
    [
      'judges a container by the riskiest control inside it',
      click,
      target({
        control: 'other',
        name: 'Review your answers',
        nested: [target({ control: 'submit', name: 'Finish', form: 'post' })],
      }),
      'submission',
    ],
    [
      'clicks a container of routine controls',
      click,
      target({
        control: 'other',
        name: 'Platform Engineer Remote',
        nested: [
          target({
            control: 'link',
            name: 'Platform Engineer',
            href: 'https://example.com/jobs/1',
          }),
        ],
      }),
      'interaction',
    ],
    [
      'asks before clicking a whole page section',
      click,
      target({ control: 'other', nested: null }),
      'submission',
    ],
    ['allows a third party', click, target({ name: 'Allow' }), 'risky'],
    ['signs in with another account', click, target({ name: 'Continue as Pat' }), 'risky'],
    ['sends in Spanish', click, target({ name: 'Enviar solicitud' }), 'submission'],
    ['submits in German', click, target({ name: 'Bewerbung absenden' }), 'submission'],
    ['submits in Hebrew', click, target({ name: 'הגשת מועמדות' }), 'submission'],
    ['sends in Hebrew', click, target({ name: 'שלח' }), 'submission'],
    ['continues in Hebrew', click, target({ name: 'המשך' }), 'interaction'],
    ['deletes in German', click, target({ name: 'Löschen' }), 'risky'],
    ['sends in Russian', click, target({ name: 'Отправить' }), 'submission'],
    ['cannot read another script', click, target({ name: 'エントリー' }), 'risky'],
    ['opens a numbered page', click, target({ name: '2' }), 'interaction'],
    ['asks when the element cannot be read', click, undefined, 'submission'],
    [
      'treats a marked submission as one whatever it targets',
      { ...click, purpose: 'submission', exportApprovalId: '00000000-0000-4000-8000-000000000000' },
      target(),
      'submission',
    ],
    [
      'submits a POST form with Enter',
      enter,
      target({ control: 'field', form: 'post' }),
      'submission',
    ],
    [
      'searches with Enter',
      enter,
      target({ control: 'field', name: 'Search', form: 'search' }),
      'interaction',
    ],
    [
      'navigates with Enter in a GET form',
      enter,
      target({ control: 'field', form: 'get' }),
      'risky',
    ],
    ['presses Enter outside a form', enter, target({ control: 'field' }), 'risky'],
    ['sends from an editable region', enter, target({ control: 'multiline' }), 'submission'],
    ['activates a button with Enter', enter, target(), 'interaction'],
    ['asks for Enter when the element cannot be read', enter, undefined, 'submission'],
    ['types a space', space, target({ control: 'field', form: 'post' }), 'edit'],
    ['ticks a box with Space', space, target({ control: 'choice', name: 'I agree' }), 'edit'],
    ['activates a risky button with Space', space, target({ name: 'Delete' }), 'risky'],
    ['moves focus', { kind: 'press', selector: '#target', key: 'Tab' }, undefined, 'interaction'],
    [
      'presses Escape',
      { kind: 'press', selector: '#target', key: 'Escape' },
      undefined,
      'interaction',
    ],
    ['drags', { kind: 'drag', selector: '#from', targetSelector: '#to' }, undefined, 'risky'],
    [
      'continues an uncertain submission',
      {
        kind: 'dialog',
        decision: 'accept',
        submissionAttemptId: '00000000-0000-4000-8000-000000000000',
      },
      undefined,
      'submission',
    ],
  ])('%s', (_name, action, read, expected) => {
    expect(classifyAction(action, read)).toBe(expected);
  });

  it.each<[BrowserAction, { type: string; message: string } | undefined, ActionClass]>([
    [
      { kind: 'dialog', decision: 'dismiss' },
      { type: 'confirm', message: 'Submit your application?' },
      'interaction',
    ],
    [{ kind: 'dialog', decision: 'accept' }, { type: 'alert', message: 'Saved.' }, 'interaction'],
    [
      { kind: 'dialog', decision: 'accept' },
      { type: 'alert', message: 'Click OK to delete.' },
      'risky',
    ],
    [
      { kind: 'dialog', decision: 'accept' },
      { type: 'confirm', message: 'Leave this page?' },
      'risky',
    ],
    [{ kind: 'dialog', decision: 'accept' }, { type: 'beforeunload', message: '' }, 'risky'],
    [
      { kind: 'dialog', decision: 'accept' },
      { type: 'confirm', message: 'Submit your application?' },
      'submission',
    ],
    [{ kind: 'dialog', decision: 'accept' }, undefined, 'risky'],
    [
      { kind: 'dialog', decision: 'accept' },
      { type: 'confirm', message: 'Your application will be submitted. Continue?' },
      'submission',
    ],
    [
      { kind: 'dialog', decision: 'accept' },
      { type: 'confirm', message: 'Confirm submission?' },
      'submission',
    ],
    [
      { kind: 'dialog', decision: 'accept' },
      { type: 'confirm', message: 'Once submitted, you cannot edit your application. Continue?' },
      'submission',
    ],
    [
      { kind: 'dialog', decision: 'accept' },
      { type: 'confirm', message: 'Your message will be sent. OK?' },
      'submission',
    ],
    [
      { kind: 'dialog', decision: 'accept' },
      { type: 'beforeunload', message: 'Changes you made may not be saved.' },
      'risky',
    ],
  ])('decides %j on %j', (action, dialog, expected) => {
    expect(classifyAction(action, undefined, dialog)).toBe(expected);
  });

  it('lets each mode approve only its classes, and never a submission', () => {
    const classes: ActionClass[] = ['read', 'edit', 'interaction', 'risky', 'submission'];
    const allowed = (mode: 'edits' | 'auto' | 'full') =>
      classes.filter((kind) => accessModeAllows(mode, kind));
    expect(allowed('edits')).toEqual(['read', 'edit']);
    expect(allowed('auto')).toEqual(['read', 'edit', 'interaction']);
    expect(allowed('full')).toEqual(['read', 'edit', 'interaction', 'risky']);
  });
});

const fictionalPage = `<!doctype html><title>Fictional careers</title>
<a id="read" href="/jobs/123">Platform Engineer</a>
<a id="delete-link" href="/account/delete">Remove my data</a>
<a id="script-submit" href="#" onclick="return false">Submit</a>
<button id="next" type="button" onclick="document.querySelector('#result').textContent='Next page'"><span id="next-label">Next</span></button>
<button id="delete" type="button" onclick="document.querySelector('#result').textContent='Deleted'">Delete draft</button>
<button id="icon" type="button"><svg width="10" height="10"></svg></button>
<fictional-send id="component"></fictional-send>
<div id="composer-box">Write to the recruiter <fictional-send></fictional-send></div>
<script>customElements.define('fictional-send', class extends HTMLElement { connectedCallback() { this.attachShadow({ mode: 'open' }).innerHTML = '<button>Send message</button>'; } });</script>
<form id="search" role="search" action="/search"><input id="q" name="q"><button id="search-go" aria-label="Search"></button></form>
<form id="filters" method="get" action="/jobs"><select id="team" name="team"><option>All</option><option>Platform</option></select><button id="filter-go">Update results</button></form>
<form id="application" method="post" action="/apply" onsubmit="event.preventDefault();fetch('/apply',{method:'POST',body:'application'})">
  <label>Name <input id="name" name="name" oninput="fetch('/autosave',{method:'POST',body:this.value})"></label>
  <label id="agree-label"><input id="agree" type="checkbox"> I agree</label>
  <input id="password" type="password">
  <textarea id="letter" name="letter"></textarea>
  <input id="send" type="submit">
</form>
<form id="spa"><input id="email" name="email"><button id="spa-next">Next</button>
  <div id="footer"><button type="button">Back</button><button id="spa-send">Send application</button></div></form>
<nav>${Array.from({ length: 45 }, (_, index) => `<a href="/jobs?page=${index + 1}">${index + 1}</a>`).join('')}</nav>
<div id="message" contenteditable="true"></div>
<iframe id="widget" title="Fictional chat widget" srcdoc="<form method='post' action='/apply'><button id='framed-send'>Send application</button></form>"></iframe>
<form method="post" action="/apply"><button id="role-host" type="submit"><span id="inner" role="button" aria-label="Details">i</span> Send application</button></form>
<a id="rails" href="/applications/1" data-method="post">Withdraw</a>
<form id="interest" onsubmit="event.preventDefault()"><input id="interest-email" name="email" type="email"><input id="location" name="location_search"><button id="interest-go">I'm interested</button></form>
<button id="review" type="button" onclick="if (confirm('Your application will be submitted. Continue?')) fetch('/apply',{method:'POST',body:'confirmed'})">Review</button>
<output id="result"></output>`;

describe('browser access modes on a page', () => {
  let browser: Browser;
  let page: Page;
  let directory: string;
  let board: Board;
  let manager: ComputerManager;
  const posted: string[] = [];
  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'pitchcrew-browser-modes-'));
    board = new Board(join(directory, 'board.db'));
    browser = await chromium.launch({ headless: true });
    const driver = await createBrowserDriver(browser);
    const context = browser.contexts()[0];
    page = context.pages()[0];
    await context.route('**/*', async (route) => {
      if (route.request().method() === 'POST') {
        posted.push(
          `${new URL(route.request().url()).pathname}:${route.request().postData() ?? ''}`,
        );
        await route.fulfill({ contentType: 'text/plain', body: 'received' });
      } else await route.fulfill({ contentType: 'text/html', body: fictionalPage });
    });
    manager = new ComputerManager(board, directory, async () => driver);
  }, 30000);
  afterAll(async () => {
    await manager?.close();
    await browser?.close();
    board?.close();
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it('reads what each element would do without running page code', async () => {
    await page.goto('https://careers.example/fictional');
    const read = (selector: string, kind: 'click' | 'Enter' = 'click') =>
      readActionTarget(
        page,
        kind === 'click' ? { kind: 'click', selector } : { kind: 'press', selector, key: 'Enter' },
      );
    expect(await read('#next-label')).toEqual({
      control: 'button',
      name: 'Next',
      names: ['Next'],
      value: '',
      href: '',
      form: '',
      small: false,
      credential: false,
      nested: [],
    });
    expect(await read('#read')).toMatchObject({
      control: 'link',
      href: 'https://careers.example/jobs/123',
    });
    expect(await read('#script-submit')).toMatchObject({ control: 'button', name: 'Submit' });
    expect(await read('#icon')).toMatchObject({ control: 'button', name: '' });
    expect(await read('#component')).toMatchObject({
      control: 'other',
      name: 'Send message',
      nested: [{ control: 'submit', name: 'Send message' }],
    });
    expect(await read('#search-go')).toMatchObject({
      control: 'submit',
      name: 'Search',
      form: 'search',
    });
    expect(await read('#q', 'Enter')).toMatchObject({ control: 'field', form: 'search' });
    expect(await read('#filter-go')).toMatchObject({ control: 'submit', form: 'get' });
    expect(await read('#send')).toMatchObject({ control: 'submit', name: 'Submit', form: 'post' });
    expect(await read('#agree-label')).toMatchObject({ control: 'choice', name: 'I agree' });
    expect(await read('#footer')).toMatchObject({
      control: 'other',
      nested: [
        { control: 'button', name: 'Back' },
        { control: 'submit', name: 'Send application' },
      ],
    });
    expect(await read('body')).toMatchObject({ nested: null });
    // Controls inside a nested web component's shadow root count too.
    expect(await read('#composer-box')).toMatchObject({
      control: 'other',
      nested: [{ control: 'submit', name: 'Send message' }],
    });
    // A click on an embedded frame lands in a document the server cannot read.
    expect(await read('#widget')).toMatchObject({ control: 'other', nested: null });
    // The native submit button around a role element is what the browser activates.
    expect(await read('#inner')).toMatchObject({
      control: 'button',
      name: 'Details',
      enclosing: [{ control: 'submit', form: 'post' }],
    });
    expect(await read('#rails')).toMatchObject({
      control: 'submit',
      name: 'Withdraw',
      form: 'post',
    });
    // An email field makes a short form an application, not a search.
    expect(await read('#interest-go')).toMatchObject({
      control: 'submit',
      form: 'script',
      small: false,
    });
    expect(await read('#q', 'Enter')).toMatchObject({
      defaultButton: { control: 'submit', name: 'Search', form: 'search' },
    });
    expect(await read('#password')).toMatchObject({ control: 'field', credential: true });
    expect(await read('#letter')).toMatchObject({ control: 'multiline', form: 'post' });
    expect(await read('#spa-next')).toMatchObject({
      control: 'submit',
      name: 'Next',
      form: 'script',
    });
    expect(await read('#message')).toMatchObject({ control: 'multiline', form: '' });
    expect(await read('button')).toBeUndefined();
    expect(await page.locator('#result').textContent()).toBe('');
    expect(posted).toEqual([]);
  });

  it('runs Full access without the write guard and still asks before sending', async () => {
    const scope = { runId: 'full-access-run', roleId: 'submitter', cardId: null };
    manager.browsers.bind({ ...scope, taskId: 'full-task', mode: 'full' });
    const request = (action: BrowserAction) => manager.request(scope, action, 'Fictional step');
    const execute = (id: string) =>
      manager.execute(scope.runId, id, new AbortController().signal, () => {}, 0);
    const navigation = await request({ kind: 'navigate', url: 'http://careers.example/fictional' });
    expect(navigation).toMatchObject({ status: 'approved', automatic: true, mode: 'full' });
    await execute(navigation.id);
    const fill = await request({ kind: 'fill', selector: '#name', value: 'Fictional Person' });
    expect(fill).toMatchObject({ status: 'approved', automatic: true, mode: 'full' });
    // Steps nobody reviews keep their page text but store no screenshot.
    expect(fill.page.screenshot).toBe('');
    expect(fill.page.text).toContain('Platform Engineer');
    await execute(fill.id);
    // The page's own autosave goes through: a mode, unlike task-site preparation, adds no guard.
    await expect.poll(() => posted).toContain('/autosave:Fictional Person');
    const remove = await request({ kind: 'click', selector: '#delete' });
    expect(remove).toMatchObject({ status: 'approved', mode: 'full' });
    await execute(remove.id);
    expect(await page.locator('#result').textContent()).toBe('Deleted');
    for (const action of [
      { kind: 'click', selector: '#send' },
      { kind: 'press', selector: '#name', key: 'Enter' },
      { kind: 'click', selector: '#spa-send' },
      { kind: 'press', selector: '#message', key: 'Enter' },
      {
        kind: 'click',
        selector: '#next',
        purpose: 'submission',
        exportApprovalId: '00000000-0000-4000-8000-000000000000',
      },
    ] as BrowserAction[]) {
      const asked = await request(action).catch((error: Error) => error);
      if (asked instanceof Error) {
        // A marked submission needs this card's exported packet before it can even ask.
        expect(asked.message).toMatch(/export/i);
        continue;
      }
      expect(asked).toMatchObject({ status: 'pending' });
      expect(asked.automatic).toBeUndefined();
      expect(asked.mode).toBeUndefined();
      expect(asked.page.screenshot).not.toBe('');
      manager.decide(asked.id, false);
    }
    expect(posted.filter((entry) => entry.startsWith('/apply'))).toEqual([]);
    // A step button of a form the page sends itself only moves on; Full access allows it.
    const step = await request({ kind: 'click', selector: '#spa-next' });
    expect(step).toMatchObject({ status: 'approved', automatic: true, mode: 'full' });
    await manager.stop(scope.runId);
    expect(board.get<ComputerApproval>('computer_approval', step.id).status).toBe('rejected');
  });

  it('asks in Full access before sending through frames, role elements, POST links, short forms and confirmations', async () => {
    await page.goto('https://careers.example/fictional');
    const scope = { runId: 'full-access-edges-run', roleId: 'submitter', cardId: null };
    manager.browsers.bind({ ...scope, taskId: 'full-edges-task', mode: 'full' });
    const request = (action: BrowserAction) => manager.request(scope, action, 'Fictional step');
    for (const action of [
      { kind: 'click', selector: '#widget' },
      { kind: 'click', selector: '#framed-send', frame: '#widget' },
      { kind: 'click', selector: '#inner' },
      { kind: 'click', selector: '#rails' },
      { kind: 'click', selector: '#interest-go' },
      { kind: 'click', selector: '#composer-box' },
    ] as BrowserAction[]) {
      const asked = await request(action);
      expect(asked, JSON.stringify(action)).toMatchObject({ status: 'pending' });
      manager.decide(asked.id, false);
    }
    // A confirmation about sending asks; cancelling it runs on its own.
    const dialogOpened = page.waitForEvent('dialog');
    const confirmed = page.evaluate(() => confirm('Your application will be submitted. Continue?'));
    await dialogOpened;
    const accept = await request({ kind: 'dialog', decision: 'accept' });
    expect(accept).toMatchObject({ status: 'pending' });
    manager.decide(accept.id, false);
    const dismiss = await request({ kind: 'dialog', decision: 'dismiss' });
    expect(dismiss).toMatchObject({ status: 'approved', automatic: true, mode: 'full' });
    await manager.execute(scope.runId, dismiss.id, new AbortController().signal, () => {}, 0);
    expect(await confirmed).toBe(false);
    expect(posted.filter((entry) => entry.startsWith('/apply'))).toEqual([]);
    await manager.stop(scope.runId);
  });

  it('runs Auto for routine steps and asks before risky ones', async () => {
    const scope = { runId: 'auto-run', roleId: 'submitter', cardId: null };
    manager.browsers.bind({ ...scope, taskId: 'auto-task', mode: 'auto' });
    const request = (action: BrowserAction) => manager.request(scope, action, 'Fictional step');
    const next = await request({ kind: 'click', selector: '#next' });
    expect(next).toMatchObject({ status: 'approved', automatic: true, mode: 'auto' });
    await manager.execute(scope.runId, next.id, new AbortController().signal, () => {}, 0);
    expect(await page.locator('#result').textContent()).toBe('Next page');
    for (const action of [
      { kind: 'click', selector: '#delete' },
      { kind: 'click', selector: '#icon' },
      { kind: 'click', selector: '#delete-link' },
      { kind: 'click', selector: '#filter-go' },
      { kind: 'click', selector: '#spa-next' },
      { kind: 'navigate', url: 'http://careers.example/fictional' },
    ] as BrowserAction[]) {
      const asked = await request(action);
      expect(asked).toMatchObject({ status: 'pending' });
      manager.decide(asked.id, false);
    }
    const search = await request({ kind: 'press', selector: '#q', key: 'Enter' });
    expect(search).toMatchObject({ status: 'approved', mode: 'auto' });
    await manager.stop(scope.runId);
  });

  it('runs Accept edits for browsing and form edits only', async () => {
    const scope = { runId: 'edits-run', roleId: 'submitter', cardId: null };
    manager.browsers.bind({ ...scope, taskId: 'edits-task', mode: 'edits' });
    const request = (action: BrowserAction) => manager.request(scope, action, 'Fictional step');
    const select = await request({ kind: 'select', selector: '#team', value: 'Platform' });
    expect(select).toMatchObject({ status: 'approved', automatic: true, mode: 'edits' });
    await manager.execute(scope.runId, select.id, new AbortController().signal, () => {}, 0);
    expect(await page.locator('#team').inputValue()).toBe('Platform');
    for (const action of [
      { kind: 'click', selector: '#next' },
      { kind: 'press', selector: '#q', key: 'Tab' },
    ] as BrowserAction[]) {
      const asked = await request(action);
      expect(asked).toMatchObject({ status: 'pending' });
      manager.decide(asked.id, false);
    }
    const scroll = await request({ kind: 'scroll', selector: 'body', deltaX: 0, deltaY: 200 });
    expect(scroll).toMatchObject({ status: 'approved', mode: 'edits' });
    expect(board.get<ComputerApproval>('computer_approval', scroll.id).mode).toBe('edits');
    await manager.stop(scope.runId);
  });

  it('accepts a plain alert in Auto on its own', async () => {
    await page.goto('https://careers.example/fictional');
    const scope = { runId: 'auto-alert-run', roleId: 'submitter', cardId: null };
    manager.browsers.bind({ ...scope, taskId: 'auto-alert-task', mode: 'auto' });
    const dialogOpened = page.waitForEvent('dialog');
    const alerted = page.evaluate(() => alert('Saved.'));
    await dialogOpened;
    const accept = await manager.request(scope, { kind: 'dialog', decision: 'accept' }, 'OK');
    expect(accept).toMatchObject({ status: 'approved', automatic: true, mode: 'auto' });
    await manager.execute(scope.runId, accept.id, new AbortController().signal, () => {}, 0);
    await alerted;
    await manager.stop(scope.runId);
  });

  it('never runs an automatic approval on a changed page', async () => {
    await page.goto('https://careers.example/fictional');
    const scope = { runId: 'recheck-run', roleId: 'submitter', cardId: null };
    manager.browsers.bind({ ...scope, taskId: 'recheck-task', mode: 'auto' });
    const next = await manager.request(scope, { kind: 'click', selector: '#next' }, 'Next');
    expect(next).toMatchObject({ status: 'approved', mode: 'auto' });
    // Relabelling the button changes the page, so the approval cannot be used on it.
    await page.locator('#next-label').evaluate((node) => (node.textContent = 'Delete everything'));
    await expect(
      manager.execute(scope.runId, next.id, new AbortController().signal, () => {}, 0),
    ).rejects.toThrow(/page changed/);
    expect(board.get<ComputerApproval>('computer_approval', next.id).status).toBe('failed');
    expect(await page.locator('#result').textContent()).not.toBe('Next page');
    await manager.stop(scope.runId);
  });
});

it('rechecks the class of an automatic action on the unchanged page before it runs', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pitchcrew-browser-modes-recheck-'));
  const board = new Board(join(directory, 'board.db'));
  let target: ActionTarget = {
    control: 'button',
    name: 'Next',
    names: ['Next'],
    value: '',
    href: '',
    form: '',
    small: false,
    credential: false,
    nested: [],
  };
  const perform = vi.fn(async () => {});
  const manager = new ComputerManager(board, directory, async () => ({
    snapshot: async () => ({
      url: 'https://example.com',
      title: '',
      text: '',
      screenshot: '',
      digest: 'same',
    }),
    actionTarget: async () => target,
    perform,
    close: async () => {},
  }));
  const scope = { runId: 'scripted-recheck', roleId: 'submitter', cardId: null };
  try {
    manager.bindBrowser({ ...scope, taskId: 'scripted-task', mode: 'auto' });
    const next = await manager.request(scope, { kind: 'click', selector: '#next' }, 'Next');
    expect(next).toMatchObject({ status: 'approved', mode: 'auto' });
    // Same fingerprint, but the element now sends: the mode no longer allows it.
    target = { ...target, control: 'submit', name: 'Send message', names: [], form: 'post' };
    await expect(
      manager.execute(scope.runId, next.id, new AbortController().signal, () => {}, 0),
    ).rejects.toThrow('Browser permission changed');
    expect(perform).not.toHaveBeenCalled();
    expect(board.get<ComputerApproval>('computer_approval', next.id).status).toBe('failed');
  } finally {
    await manager.close();
    board.close();
    await rm(directory, { recursive: true, force: true });
  }
});
