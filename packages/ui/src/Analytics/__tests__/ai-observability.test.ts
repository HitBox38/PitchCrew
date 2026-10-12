import { describe, expect, it, vi } from 'vitest';
import { createAnalytics } from '../client.ts';
import { sanitizeEvent } from '../helpers.ts';

const properties = {
  $ai_trace_id: 'b7cf24c4-2c2e-4fda-85d3-b4b45c6a1798',
  mode: 'chat',
  outcome: 'completed',
  $ai_latency: 2.5,
};
describe('AI renderer consent and content boundary', () => {
  it('accepts reviewed native traces while removing SDK and content injection', () => {
    const event = sanitizeEvent({
      event: '$ai_trace',
      properties: {
        ...properties,
        distinct_id: 'anonymous-sdk-id',
        $current_url: 'private route',
        $ai_input_state: { prompt: 'Private question' },
        $ai_output_state: 'Private answer',
        $set: { email: 'private@example.invalid' },
        run_id: 'private run',
      },
    });
    expect(event?.properties).toEqual({
      ...properties,
      $ai_trace_name: 'chat_turn',
      observation_level: 'runtime_boundary',
      $ai_is_error: false,
      distinct_id: 'anonymous-sdk-id',
      $process_person_profile: false,
      $geoip_disable: true,
    });
  });
  it('rejects AI diagnostics immediately when diagnostic consent is disabled', async () => {
    const sdk = {
      init: vi.fn(),
      capture: vi.fn(),
      opt_in_capturing: vi.fn(),
      opt_out_capturing: vi.fn(),
    };
    let consent = true;
    const client = createAnalytics(
      async () => sdk,
      () => true,
      () => consent,
    );
    await client.setEnabled(true, { token: 'phc_fixture', host: 'https://eu.i.posthog.com' });
    client.captureDiagnostic('$ai_trace', properties);
    expect(sdk.capture).toHaveBeenCalledOnce();
    consent = false;
    client.captureDiagnostic('$ai_trace', properties);
    expect(sdk.capture).toHaveBeenCalledOnce();
    expect(sanitizeEvent({ event: '$ai_trace', properties }, false)).toBeNull();
  });
  it('does not reinterpret unsupported generation metadata as a captured runtime span', () => {
    expect(
      sanitizeEvent({
        event: '$ai_generation',
        properties: { ...properties, $ai_input_tokens: 8 },
      }),
    ).toBeNull();
  });
});
