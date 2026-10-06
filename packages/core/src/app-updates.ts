export interface AppBuild {
  version: string;
  commit: string | null;
  packaged: boolean;
}

export interface AppUpdateInfo {
  current: AppBuild;
  automatic: boolean;
  status: 'idle' | 'available' | 'current' | 'unknown' | 'error' | 'disabled';
  checkedAt: string | null;
  latest: { commit: string; url: string } | null;
  message: string;
}
