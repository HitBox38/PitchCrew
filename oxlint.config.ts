import { defineConfig, type OxlintOverride } from 'oxlint';
import { workspaces } from './scripts/workspace-manifests.ts';

const appShadcnRules: OxlintOverride['rules'] = {
  'shadcn/no-arbitrary-values': ['error', { deny: ['color'] }],
  'shadcn/require-static-classes': 'error',
  'shadcn/no-restyle': [
    'error',
    { deny: [], contracts: [{ pattern: '^Button$', deny: ['bg-*'] }] },
  ],
};

const shadcnRules: Record<string, OxlintOverride['rules']> = {
  '@pitchcrew/design-system': {
    'shadcn/no-raw-colors': 'error',
    'shadcn/no-inline-styles': 'error',
  },
  '@pitchcrew/ui': {
    ...appShadcnRules,
    'shadcn/no-raw-colors': ['error', { allow: ['text-button'] }],
  },
  '@pitchcrew/landing': {
    ...appShadcnRules,
    'shadcn/no-raw-colors': ['error', { allow: ['text-link'] }],
  },
};

export default defineConfig({
  plugins: ['typescript', 'react', 'jsx-a11y', 'import'],
  jsPlugins: ['@shadcn/lint'],
  settings: { shadcn: { componentImports: ['^@pitchcrew/design-system/'] } },
  categories: { correctness: 'error' },
  rules: {
    // Asset query imports such as Vite's ?url acquire their default export during bundling.
    'import/default': 'off',
    'func-style': ['error', 'expression'],
    'prefer-arrow-callback': 'error',
    'no-unused-vars': 'error',
    'jsx-a11y/label-has-associated-control': [
      'error',
      { controlComponents: ['Input', 'Textarea', 'Checkbox'] },
    ],
  },
  ignorePatterns: [
    '**/dist/**',
    '**/.next/**',
    '**/next-env.d.ts',
    '**/node_modules/**',
    '.agents/**',
  ],
  overrides: workspaces.flatMap(({ directory, name, dependencies }) => {
    const peers = workspaces.filter((workspace) => workspace.name !== name);
    const privateSources = {
      group: [
        ...peers.flatMap((peer) => {
          const source = `**/${peer.directory.split('/').at(-1)}/src`;
          return [source, `${source}/**`];
        }),
        ...(name === '@pitchcrew/ui' ? [] : ['@/**']),
      ],
      message: 'Import a workspace through its public package exports.',
    };
    const undeclared = peers.filter((peer) => !dependencies.has(peer.name));
    const provider = {
      group: ['@pitchcrew/adapters', '@pitchcrew/adapters/**', '**/adapters/src/**'],
      message: 'Only the orchestrator consumes the runtime adapters.',
    };
    const sharedPatterns =
      name === '@pitchcrew/orchestrator' || name === '@pitchcrew/adapters' ? [] : [provider];
    const paths =
      name === '@pitchcrew/ui'
        ? [
            {
              name: '@pitchcrew/core',
              allowTypeImports: true,
              message:
                'Use a browser-safe core subpath for runtime values. The root loads server schemas.',
            },
          ]
        : [];
    const src = `${directory}/src`;
    const overrides: OxlintOverride[] = [
      {
        files: [`${src}/**`],
        excludeFiles: ['**/__tests__/**'],
        rules: {
          'import/no-cycle': ['error', { allowUnsafeDynamicCyclicDependency: true }],
          'no-restricted-imports': [
            'error',
            {
              paths,
              patterns: [
                ...sharedPatterns,
                privateSources,
                {
                  group: undeclared.flatMap((peer) => [peer.name, `${peer.name}/**`]),
                  message: 'Declare workspace dependencies in the consuming package.',
                },
              ],
            },
          ],
        },
      },
      {
        // Colocated contract tests can compare client and server implementations.
        files: [`${src}/**/__tests__/**`],
        rules: { 'no-restricted-imports': ['error', { paths, patterns: sharedPatterns }] },
      },
    ];
    const styleRules = shadcnRules[name];
    if (styleRules) {
      overrides.push({
        files: [`${src}/**`],
        excludeFiles: ['**/__tests__/**', '**/*.test.*', '**/*.spec.*'],
        rules: styleRules,
      });
    }
    return overrides;
  }),
});
