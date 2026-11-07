export interface SignInTerminalStart {
  action: 'start';
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string | undefined>;
  timeout: number;
}
export type SignInTerminalInput =
  | SignInTerminalStart
  | { action: 'write'; data: string }
  | { action: 'resize'; cols: number; rows: number }
  | { action: 'cancel' };
export type SignInTerminalFailure = 'start' | 'cancelled' | 'expired' | 'output' | 'input';
export type SignInTerminalOutput =
  | { type: 'ready' }
  | { type: 'output'; data: string }
  | { type: 'done'; code: number | null; failure?: SignInTerminalFailure };

export const terminalOutputLimit = 256_000;
export const terminalTranscriptLimit = 16_000;
