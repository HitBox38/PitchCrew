import { describe, expect, it } from 'vitest';
import { actionEvent, analyticsPage, sanitizeEvent } from '../helpers.ts';

describe('analytics content boundary', () => {
  it('uses only known page names and removes thread names and search filters', () => {
    expect(analyticsPage('/chat/private-agent')).toBe('chat');
    expect(analyticsPage('/profile')).toBe('profile');
    expect(analyticsPage('/unknown/secret')).toBeUndefined();
    const event = sanitizeEvent({
      event: '$pageview',
      properties: {
        page: 'chat',
        distinct_id: 'anonymous-id',
        token: 'phc_fixture123',
        $current_url: 'http://127.0.0.1/chat/private-agent?secret=value',
        $referrer: 'https://sensitive.example',
        $initial_current_url: 'secret',
        $set: { email: 'private@example.invalid' },
        $set_once: { name: 'Private' },
        content: 'private conversation',
      },
    });
    expect(event?.properties).toEqual({
      page: 'chat',
      $pathname: '/chat',
      distinct_id: 'anonymous-id',
      token: 'phc_fixture123',
      $process_person_profile: false,
      $geoip_disable: true,
    });
    expect(
      sanitizeEvent({ event: '$pageview', properties: { page: '__proto__' } })?.properties,
    ).not.toHaveProperty('page');
  });

  it('drops automatic events and unknown values rather than trusting SDK or body properties', () => {
    for (const event of ['$autocapture', '$snapshot', '$exception', '$opt_in'])
      expect(sanitizeEvent({ event, properties: { secret: 'private' } })).toBeNull();
    const tracked = actionEvent('/cards/private-id/move', 'POST', {
      state: 'submitted',
      note: 'Private tracking note',
      url: 'https://job.example',
    })!;
    expect(
      sanitizeEvent({
        event: tracked.event,
        properties: { ...tracked.properties, cardId: 'private-id' },
      })?.properties,
    ).toEqual({
      state: 'submitted',
      $process_person_profile: false,
      $geoip_disable: true,
    });
    expect(
      sanitizeEvent({ event: 'application_status_changed', properties: { state: 'secret' } })
        ?.properties,
    ).not.toHaveProperty('state');
  });

  it('tracks deliberate mutations and excludes reads, previews, connector tokens and source content', () => {
    expect(actionEvent('/cards', 'POST', { company: 'Private company' })).toEqual({
      event: 'job_created',
    });
    expect(actionEvent('/roles/private-role/chat', 'POST', { content: 'Private chat' })).toEqual({
      event: 'chat_sent',
    });
    const restored = actionEvent('/roles/private-role/restore', 'POST', { name: 'Private name' })!;
    expect(restored).toEqual({ event: 'agent_restored' });
    expect(
      sanitizeEvent({ event: restored.event, properties: { roleId: 'private-role' } })?.properties,
    ).toEqual({ $process_person_profile: false, $geoip_disable: true });
    expect(
      actionEvent('/approvals/private-id/decide', 'POST', { approved: true, digest: 'secret' }),
    ).toEqual({
      event: 'approval_decided',
      properties: { kind: 'packet', approved: true },
    });
    expect(actionEvent('/routines/private-id', 'PUT', { prompt: 'Private schedule' })).toEqual({
      event: 'routine_saved',
    });
    for (const [path, method] of [
      ['/snapshot', 'GET'],
      ['/tracking/import/preview', 'POST'],
      ['/connectors/github/connect', 'POST'],
      ['/skills/preview', 'POST'],
      ['/roles/private-role', 'GET'],
    ])
      expect(actionEvent(path, method, { token: 'private' })).toBeUndefined();
  });

  it('tracks current chat and feature routes without including private IDs, queries or input', () => {
    for (const [path, event] of [
      ['/conversations/private-thread/messages', 'chat_sent'],
      ['/conversations', 'conversation_created'],
      ['/conversations/private-thread/continue', 'chat_continued'],
      ['/user-input/private-question/answer', 'user_question_answered'],
      ['/user-input/private-question/cancel', 'user_question_cancelled'],
      ['/pipeline-reviews/private-review/followup', 'pipeline_followup_saved'],
    ]) {
      expect(
        actionEvent(path, 'POST', { content: 'Private', selected: ['Private'], text: 'Private' }),
      ).toEqual({ event });
      expect(actionEvent(path, 'GET', {})).toBeUndefined();
    }
    for (const action of ['open', 'close', 'take', 'release']) {
      const route = ['take', 'release'].includes(action) ? 'control' : action;
      expect(
        actionEvent(`/browser/private-agent/${route}?threadId=private-thread`, 'POST', {
          operation: action,
          leaseId: 'private',
          url: 'https://private.example',
        }),
      ).toEqual({ event: 'browser_session_changed', properties: { action } });
    }
    for (const route of ['input', 'viewport', 'sites', 'stream'])
      expect(
        actionEvent(`/browser/private-agent/${route}?threadId=private`, 'POST', {
          text: 'Private',
        }),
      ).toBeUndefined();
    expect(
      actionEvent('/browser/private-agent/control?threadId=private', 'POST', {
        operation: 'renew',
      }),
    ).toBeUndefined();
  });

  it('allows bounded release context and feature enums while stripping arbitrary content', () => {
    expect(
      sanitizeEvent({
        event: 'browser_session_changed',
        properties: {
          app_version: '0.2.0',
          analytics_schema: 2,
          renderer: 'electron',
          action: 'take',
          threadId: 'private',
          roleId: 'private',
          text: 'private',
          url: 'https://private.example',
        },
      })?.properties,
    ).toEqual({
      app_version: '0.2.0',
      analytics_schema: 2,
      renderer: 'electron',
      action: 'take',
      $process_person_profile: false,
      $geoip_disable: true,
    });
    expect(
      sanitizeEvent({
        event: 'browser_session_changed',
        properties: {
          app_version: 'private-version',
          analytics_schema: 123,
          renderer: 'private-runtime',
          action: 'private',
        },
      })?.properties,
    ).toEqual({ $process_person_profile: false, $geoip_disable: true });
  });
});
