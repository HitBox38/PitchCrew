module.exports = {
  appId: 'dev.pitchcrew.app',
  productName: 'Pitchcrew',
  directories: { app: 'dist/installer/app', output: 'dist/releases' },
  files: ['dist/**', 'assets/**', 'package.json'],
  extraResources: [
    { from: 'dist/installer/runtime', to: 'runtime' },
    // electron-builder excludes a source tree's root node_modules by default.
    { from: 'dist/installer/runtime/node_modules', to: 'runtime/node_modules' },
  ],
  electronVersion: require('./package.json').devDependencies.electron,
  npmRebuild: false,
  compression: 'normal',
  publish: null,
  artifactName: 'Pitchcrew-${version}-${os}-${arch}.${ext}',
  win: { target: 'nsis', icon: 'packages/desktop/assets/icon.png', signExecutable: false },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    include: 'packages/desktop/installer/installer.nsh',
  },
  mac: {
    target: 'dmg',
    category: 'public.app-category.productivity',
    identity: null,
    icon: 'packages/desktop/assets/icon.png',
  },
  linux: {
    target: ['AppImage', 'deb'],
    category: 'Office',
    icon: 'packages/desktop/assets/icon.png',
    maintainer: 'Tomer Norman <HitBox38@users.noreply.github.com>',
  },
};
