import { states } from '@pitchcrew/core/states';
import { viewPaths, type View } from '../navigation.ts';
import type { AnalyticsEvent, AnalyticsProperties } from './types.ts';

const events: AnalyticsEvent[] = [
  '$pageview',
  'job_created',
  'application_registered',
  'applications_imported',
  'application_status_changed',
  'workflow_started',
  'chat_sent',
  'conversation_created',
  'chat_continued',
  'user_question_answered',
  'user_question_cancelled',
  'browser_session_changed',
  'pipeline_followup_saved',
  'app_update_download_requested',
  'app_update_install_requested',
  'agent_created',
  'agent_saved',
  'agent_retired',
  'agent_restored',
  'skill_saved',
  'skill_deleted',
  'routine_saved',
  'routine_deleted',
  'profile_saved',
  'job_sources_scanned',
  'packet_export_requested',
  'approval_decided',
  'packet_exported',
  'onboarding_updated',
];

export function analyticsPage(path: string): View | undefined {
  if (/^\/chat(?:\/[^/]+)?$/.test(path)) return 'chat';
  return (Object.keys(viewPaths) as View[]).find((view) => viewPaths[view] === path);
}

/** Rebuild properties from a closed vocabulary, including SDK-generated properties. */
export function sanitizeEvent<T extends { event: string; properties: Record<string, unknown> }>(
  event: T | null,
): T | null {
  if (!event || !events.includes(event.event as AnalyticsEvent)) return null;
  const input = event.properties;
  const properties: Record<string, unknown> = {
    $process_person_profile: false,
    $geoip_disable: true,
  };
  for (const key of ['token', 'distinct_id', '$session_id', '$window_id', '$lib', '$lib_version'])
    if (typeof input[key] === 'string') properties[key] = input[key];
  if (
    typeof input.app_version === 'string' &&
    /^\d{1,5}\.\d{1,5}\.\d{1,5}$/.test(input.app_version)
  )
    properties.app_version = input.app_version;
  if (['browser', 'electron'].includes(input.renderer as string))
    properties.renderer = input.renderer;
  if (input.analytics_schema === 2) properties.analytics_schema = 2;
  if (
    event.event === 'browser_session_changed' &&
    ['open', 'close', 'take', 'release'].includes(input.action as string)
  )
    properties.action = input.action;
  if (
    event.event === '$pageview' &&
    typeof input.page === 'string' &&
    Object.hasOwn(viewPaths, input.page)
  ) {
    properties.page = input.page;
    properties.$pathname = viewPaths[input.page as View];
  }
  if (event.event === 'application_status_changed' && states.includes(input.state as never))
    properties.state = input.state;
  if (event.event === 'approval_decided') {
    if (['packet', 'computer', 'role', 'skill'].includes(input.kind as string))
      properties.kind = input.kind;
    if (typeof input.approved === 'boolean') properties.approved = input.approved;
  }
  if (event.event === 'onboarding_updated') {
    if (['welcome', 'setup', 'dismissed', 'completed'].includes(input.status as string))
      properties.status = input.status;
    if (input.step === 0 || input.step === 1) properties.step = input.step;
  }
  return { ...event, properties };
}

export function actionEvent(
  path: string,
  method: string,
  body: unknown,
): { event: AnalyticsEvent; properties?: AnalyticsProperties } | undefined {
  // Match only the route. Thread IDs and all other query values never enter event properties.
  path = path.split('?')[0];
  const input = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  if (method === 'POST') {
    const exact: Record<string, AnalyticsEvent> = {
      '/cards': 'job_created',
      '/tracking/external': 'application_registered',
      '/tracking/import/apply': 'applications_imported',
      '/roles': 'agent_created',
      '/skills': 'skill_saved',
      '/routines': 'routine_saved',
      '/job-sources/scan': 'job_sources_scanned',
      '/conversations': 'conversation_created',
    };
    if (exact[path]) return { event: exact[path] };
    if (/^\/cards\/[^/]+\/move$/.test(path))
      return {
        event: 'application_status_changed',
        properties: { state: typeof input.state === 'string' ? input.state : undefined },
      };
    if (/^\/cards\/[^/]+\/run$/.test(path)) return { event: 'workflow_started' };
    if (/^\/roles\/[^/]+\/chat$/.test(path)) return { event: 'chat_sent' };
    if (/^\/conversations\/[^/]+\/messages$/.test(path)) return { event: 'chat_sent' };
    if (/^\/conversations\/[^/]+\/continue$/.test(path)) return { event: 'chat_continued' };
    if (/^\/user-input\/[^/]+\/answer$/.test(path)) return { event: 'user_question_answered' };
    if (/^\/user-input\/[^/]+\/cancel$/.test(path)) return { event: 'user_question_cancelled' };
    if (/^\/pipeline-reviews\/[^/]+\/followup$/.test(path))
      return { event: 'pipeline_followup_saved' };
    const browser = /^\/browser\/[^/]+\/(open|close|control)$/.exec(path);
    const browserAction = browser?.[1] === 'control' ? input.operation : browser?.[1];
    if (['open', 'close', 'take', 'release'].includes(browserAction as string))
      return {
        event: 'browser_session_changed',
        properties: { action: browserAction as AnalyticsProperties['action'] },
      };
    if (/^\/roles\/[^/]+\/retire$/.test(path)) return { event: 'agent_retired' };
    if (/^\/roles\/[^/]+\/restore$/.test(path)) return { event: 'agent_restored' };
    if (/^\/cards\/[^/]+\/approval$/.test(path)) return { event: 'packet_export_requested' };
    if (/^\/approvals\/[^/]+\/export$/.test(path)) return { event: 'packet_exported' };
    const decision =
      /^\/(approvals|computer-approvals|proposals|skill-proposals)\/[^/]+\/decide$/.exec(path);
    if (decision)
      return {
        event: 'approval_decided',
        properties: {
          kind: (
            {
              approvals: 'packet',
              'computer-approvals': 'computer',
              proposals: 'role',
              'skill-proposals': 'skill',
            } as const
          )[decision[1] as 'approvals'],
          approved: typeof input.approved === 'boolean' ? input.approved : undefined,
        },
      };
  }
  if (method === 'PUT') {
    if (path === '/profile') return { event: 'profile_saved' };
    if (path === '/onboarding')
      return {
        event: 'onboarding_updated',
        properties: {
          status: typeof input.status === 'string' ? input.status : undefined,
          step: typeof input.step === 'number' ? input.step : undefined,
        },
      };
    if (/^\/roles\/[^/]+$/.test(path)) return { event: 'agent_saved' };
  }
  if (/^\/(skills|routines)\/[^/]+$/.test(path) && ['PUT', 'DELETE'].includes(method))
    return {
      event: `${path.startsWith('/skills/') ? 'skill' : 'routine'}_${method === 'DELETE' ? 'deleted' : 'saved'}`,
    };
}
