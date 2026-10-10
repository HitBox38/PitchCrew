export type Platform = 'mac' | 'windows' | 'linux';
export type InstallerId = 'mac-arm64' | 'mac-x64' | 'windows-x64' | 'linux-appimage' | 'linux-deb';

export interface Installer {
  id: InstallerId;
  platform: Platform;
  label: string;
  detail: string;
  filename: string | null;
  url: string;
  size: number | null;
}

export interface Release {
  installers: Installer[];
  available: boolean;
}
