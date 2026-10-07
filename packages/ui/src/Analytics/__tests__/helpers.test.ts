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
});
