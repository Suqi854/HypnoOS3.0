export const EXTENSION_ID = 'hypnoos3';
export const RUNTIME_KEY = '__HYPNOOS3_RUNTIME__';
export const SETTINGS_KEY = 'hypnoos3';
export const CHAT_STATE_KEY = 'hypnoos3State';
export const PROMPT_ID = 'hypnoos3-runtime-state';
export const UI_BASELINE = Object.freeze({
  source: 'HypnoOS2.0 genericized HApp5 UI',
  upstreamCommit: 'db71f7715f86aa2be0210c1602843c66c2792139',
  artifactSha256: 'd7cd4a890092dd5726837c66da26a701db89463e5016e5400a8e388670efd623',
});

export const SCHEMA_IDS = Object.freeze({
  profile: 'HypnoProfile/v1',
  rolePack: 'RolePack/v1',
  adapter: 'WorldAdapter/v1',
  state: 'HypnoState/v1',
  operation: 'PendingOperation/v1',
  companion: 'CompanionBookMeta/v1',
  app: 'PhoneAppModule/v1',
});

export const MAX_AVATAR_BYTES = 8 * 1024 * 1024;
export const MAX_AVATAR_DIMENSION = 4096;
export const ALLOWED_AVATAR_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
export const DIRECT_API_SECRET_KEY = 'hypnoos3:direct-api-key';
