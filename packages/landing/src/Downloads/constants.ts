import type { InstallerId, Platform } from './types';

export const platforms: { id: Platform; label: string }[] = [
  { id: 'mac', label: 'macOS' },
  { id: 'windows', label: 'Windows' },
  { id: 'linux', label: 'Linux' },
];

export const installerDefinitions: {
  id: InstallerId;
  platform: Platform;
  label: string;
  detail: string;
  pattern: RegExp;
}[] = [
  {
    id: 'mac-arm64',
    platform: 'mac',
    label: 'Apple Silicon',
    detail: 'M-series Macs · .dmg',
    pattern: /^Pitchcrew-[\d.]+-mac-arm64\.dmg$/,
  },
  {
    id: 'mac-x64',
    platform: 'mac',
    label: 'Intel',
    detail: 'Intel Macs · .dmg',
    pattern: /^Pitchcrew-[\d.]+-mac-x64\.dmg$/,
  },
  {
    id: 'windows-x64',
    platform: 'windows',
    label: 'Windows x64',
    detail: '64-bit installer · .exe',
    pattern: /^Pitchcrew-[\d.]+-win-x64\.exe$/,
  },
  {
    id: 'linux-appimage',
    platform: 'linux',
    label: 'AppImage',
    detail: 'Linux x64 · .AppImage',
    pattern: /^Pitchcrew-[\d.]+-linux-(x64|x86_64)\.AppImage$/,
  },
  {
    id: 'linux-deb',
    platform: 'linux',
    label: 'Debian / Ubuntu',
    detail: 'Linux x64 · .deb',
    pattern: /^Pitchcrew-[\d.]+-linux-(x64|amd64)\.deb$/,
  },
];
