import type { Role } from '../components/clay/Pebble';

export type Phase = 'idle' | 'scout' | 'writer' | 'reviewer' | 'done';

export interface Agent {
  role: Role;
  name: string;
  runtime: string;
  capability: string;
  /** Start and end of this morning's Forma run as a share of the groove, or none yet. */
  run?: { from: number; to: number };
  working: string;
  finished: string;
  idle: string;
}

export type AgentState = 'idle' | 'working' | 'done';
