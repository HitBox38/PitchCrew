/** Operating systems with a per-user background service integration. */
export type BackgroundServicePlatform = 'windows' | 'macos' | 'linux';

/** What the OS service manager and the daemon lock report about the background service. */
export interface BackgroundServiceStatus {
  platform: BackgroundServicePlatform | null;
  installed: boolean;
  /** Registered to start when the user logs in. */
  enabled: boolean;
  running: boolean;
  pid: number | null;
  /** Data folder and port baked into the installed definition. */
  directory: string | null;
  port: number | null;
  /** Service definition file or task name. */
  definition: string | null;
  logFile: string | null;
  detail: string;
}

/** Settings view of the background service, relative to the daemon answering the request. */
export interface BackgroundServiceInfo {
  status: BackgroundServiceStatus;
  /** This daemon process was started by the background service. */
  startedByService: boolean;
  /** The installed service runs this data folder and port. */
  matches: boolean;
  /** This daemon uses a data folder or port other than the defaults. */
  customLocation: boolean;
  repository: string;
  commands: { install: string; uninstall: string; status: string; logs: string };
}
