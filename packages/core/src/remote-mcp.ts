export interface RemoteMcpRequest {
  id: string;
  code: string;
  name: string;
  redirectHost: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string;
}

export interface RemoteMcpClient {
  id: string;
  name: string;
  write: boolean;
  createdAt: string;
  expiresAt: string;
  lastUsedAt?: string;
}

export interface RemoteMcpInfo {
  state: 'off' | 'starting' | 'ready' | 'failed';
  url: string | null;
  error: string;
  tunnelAvailable: boolean;
  requests: RemoteMcpRequest[];
  clients: RemoteMcpClient[];
}
