import type { RuntimeConnectionField, RuntimeId } from '@pitchcrew/core';

const choices: Record<string, readonly string[]> = {
  GOOSE_PROVIDER: ['openai', 'anthropic', 'google', 'ollama', 'openrouter'],
  HERMES_INFERENCE_PROVIDER: [
    'openrouter',
    'anthropic',
    'openai-api',
    'gemini',
    'nous',
    'xai',
    'lmstudio',
  ],
  CLAUDE_CODE_USE_BEDROCK: ['0', '1'],
  CLAUDE_CODE_USE_VERTEX: ['0', '1'],
  CLAUDE_CODE_USE_FOUNDRY: ['0', '1'],
  GOOGLE_GENAI_USE_VERTEXAI: ['false', 'true', '0', '1'],
};

const secret = (name: string, label: string): RuntimeConnectionField => ({
  name,
  label,
  secret: true,
});
const setting = (name: string, label: string, description?: string): RuntimeConnectionField => ({
  name,
  label,
  secret: false,
  ...(description ? { description } : {}),
  ...(choices[name] ? { choices: [...choices[name]] } : {}),
});
const openai = secret('OPENAI_API_KEY', 'OpenAI API key');
const anthropic = secret('ANTHROPIC_API_KEY', 'Anthropic API key');
const google = [
  secret('GEMINI_API_KEY', 'Gemini API key'),
  secret('GOOGLE_API_KEY', 'Google API key'),
];
const openrouter = secret('OPENROUTER_API_KEY', 'OpenRouter API key');
const xai = secret('XAI_API_KEY', 'xAI API key');
const endpoint = setting(
  'OPENAI_BASE_URL',
  'OpenAI-compatible base URL',
  'Use the endpoint supported by this CLI. This does not add a custom provider definition.',
);
const providerKeys = [openai, anthropic, ...google, openrouter, xai];

/** Only native authentication controls, never tool, shell, config or startup overrides. */
const fields: Record<RuntimeId, readonly RuntimeConnectionField[]> = {
  demo: [],
  codex: [secret('CODEX_API_KEY', 'Codex API key'), endpoint],
  'claude-code': [
    anthropic,
    secret('ANTHROPIC_AUTH_TOKEN', 'Anthropic auth token'),
    setting('ANTHROPIC_BASE_URL', 'Anthropic-compatible base URL'),
    setting(
      'CLAUDE_CODE_USE_BEDROCK',
      'Use Amazon Bedrock',
      'Set to 1 to use native Bedrock authentication.',
    ),
    setting(
      'CLAUDE_CODE_USE_VERTEX',
      'Use Google Vertex',
      'Set to 1 to use native Vertex authentication.',
    ),
    setting(
      'CLAUDE_CODE_USE_FOUNDRY',
      'Use Microsoft Foundry',
      'Set to 1 to use native Foundry authentication.',
    ),
  ],
  'gemini-cli': [
    ...google,
    setting(
      'GOOGLE_GENAI_USE_VERTEXAI',
      'Use Vertex AI',
      'Set to true to select native Vertex authentication.',
    ),
    setting('GOOGLE_CLOUD_PROJECT', 'Google Cloud project'),
    setting('GOOGLE_CLOUD_LOCATION', 'Google Cloud location'),
  ],
  opencode: providerKeys,
  'copilot-cli': [
    secret('COPILOT_GITHUB_TOKEN', 'Copilot GitHub token'),
    secret('GH_TOKEN', 'GitHub CLI token'),
    secret('GITHUB_TOKEN', 'GitHub token'),
  ],
  'cursor-agent': [
    secret('CURSOR_API_KEY', 'Cursor API key'),
    secret('CURSOR_AUTH_TOKEN', 'Cursor auth token'),
  ],
  goose: [
    ...providerKeys,
    setting(
      'GOOSE_PROVIDER',
      'Default provider',
      'openai, anthropic, google, ollama or openrouter',
    ),
    setting('GOOSE_MODEL', 'Default model'),
    setting('OLLAMA_HOST', 'Ollama server URL'),
  ],
  'kiro-cli': [secret('KIRO_API_KEY', 'Kiro API key')],
  grok: [xai],
  pi: [...providerKeys, endpoint],
  'oh-my-pi': [...providerKeys, endpoint],
  hermes: [
    ...providerKeys,
    secret('NOUS_API_KEY', 'Nous API key'),
    setting(
      'HERMES_INFERENCE_PROVIDER',
      'Default provider',
      'openrouter, anthropic, openai-api, gemini, nous, xai or lmstudio',
    ),
    endpoint,
  ],
};

export const runtimeConnectionFields = (runtime: RuntimeId): RuntimeConnectionField[] =>
  fields[runtime].map((field) => ({
    ...field,
    ...(field.choices ? { choices: [...field.choices] } : {}),
  }));
export const runtimeConnectionSecretNames = new Set(
  Object.values(fields)
    .flat()
    .filter((field) => field.secret)
    .map((field) => field.name),
);

export const validateRuntimeConnectionValue = (runtime: RuntimeId, name: string, value: string) => {
  if (!fields[runtime].some((field) => field.name === name))
    throw new Error('This authentication variable is not supported by the selected runtime.');
  if (value.length > 16_384 || /[\r\n\0]/.test(value))
    throw new Error('Authentication values must be a single line of at most 16,384 characters.');
  if (!value) return;
  if (name.endsWith('BASE_URL') || name === 'OLLAMA_HOST') {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error('Enter a valid HTTP or HTTPS endpoint URL.');
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.hash ||
      url.search
    )
      throw new Error(
        'Use an HTTP or HTTPS endpoint without credentials, query parameters or a fragment.',
      );
  }
  if (choices[name] && !choices[name].includes(value))
    throw new Error('Choose one of the supported values shown for this authentication setting.');
};
