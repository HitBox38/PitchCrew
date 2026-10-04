import type { BackgroundServicePlatform } from '@pitchcrew/core';

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Everything the background service touches outside its own process. Tests supply a fake so they
 * can assert exact definitions and commands without calling schtasks, launchctl or systemctl.
 */
export interface ServiceHost {
  run(command: string, args: readonly string[]): Promise<CommandResult>;
  /** Returns null when the file does not exist. */
  readFile(path: string): Promise<Buffer | null>;
  /** Creates parent folders as needed. */
  writeFile(path: string, data: string | Buffer): Promise<void>;
  makeFolder(path: string): Promise<void>;
  /** Removes a file or folder recursively; missing paths are ignored. */
  remove(path: string): Promise<void>;
  isAlive(pid: number): boolean;
  /** Whether a Pitchcrew daemon answers on the loopback port. */
  answers(port: number): Promise<boolean>;
  kill(pid: number): void;
  sleep(ms: number): Promise<void>;
}

/** Resolved values baked into a service definition. All paths are absolute. */
export interface ServiceSpec {
  platform: BackgroundServicePlatform;
  directory: string;
  port: number;
  repository: string;
  /** The Node executable that runs the daemon. */
  node: string;
  /** The orchestrator CLI entry point. */
  cli: string;
  /** The user's home folder. */
  home: string;
  /** Linux: XDG_CONFIG_HOME or ~/.config. */
  configHome: string;
  /** macOS and Linux: PATH for runtime CLIs, which service managers otherwise reduce. */
  path: string;
  /** macOS: the user's numeric ID for the gui/<uid> launchd domain. */
  uid: number;
  /** Windows: the account the logon trigger and task run as. */
  user: string;
  /** Windows: the system folder holding conhost.exe. */
  systemRoot: string;
}

/** What a platform driver learns from its service manager. */
export interface Inspection {
  installed: boolean;
  enabled: boolean;
  /** The service manager has the definition loaded (launchd). */
  loaded?: boolean;
  /** null when only the daemon lock can tell. */
  running: boolean | null;
  pid: number | null;
  /** Daemon arguments read back from the installed definition. */
  args: string[] | null;
  detail: string;
}

export interface PlatformDriver {
  /** Definition file written by install. */
  file: string;
  /** Path or name shown to the user. */
  definition: string;
  render(): string | Buffer;
  inspect(): Promise<Inspection>;
  register(changed: boolean, before: Inspection, daemonPid: number | null): Promise<void>;
  unregister(before: Inspection, daemonPid: number | null): Promise<void>;
  start(before: Inspection): Promise<void>;
  stop(before: Inspection, daemonPid: number | null): Promise<void>;
}
