import type { useConnectorSettings } from '@/ConnectorSettings/hooks/useConnectorSettings.ts';
import type { Action } from '@/WorkspaceStore/index.ts';
import type { Snapshot } from '@pitchcrew/core';

export interface ConnectorSettingsProps {
  data: Snapshot;
  action: Action;
  working: boolean;
}
export type ConnectorSettingsModel = NonNullable<ReturnType<typeof useConnectorSettings>>;

export type ConnectAccountDialogProps = Pick<
  ConnectorSettingsModel,
  | 'editing'
  | 'close'
  | 'connect'
  | 'token'
  | 'setToken'
  | 'google'
  | 'clientId'
  | 'setClientId'
  | 'clientSecret'
  | 'setClientSecret'
  | 'error'
  | 'working'
  | 'customGoogle'
  | 'setCustomGoogle'
>;

export type ConnectedAccountsProps = Pick<
  ConnectorSettingsModel,
  'data' | 'working' | 'action' | 'open'
>;

export type GoogleConnectionSetupProps = GoogleCredentialsProps &
  Pick<ConnectorSettingsModel, 'google' | 'customGoogle' | 'setCustomGoogle'>;

export type GoogleCredentialsProps = Pick<
  ConnectorSettingsModel,
  'clientId' | 'setClientId' | 'clientSecret' | 'setClientSecret'
>;
