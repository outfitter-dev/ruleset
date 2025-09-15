/**
 * Resource limits and constants for the Rulesets system
 */

// File size constants (mixd-v0)
const KB = 1024;
const MB = KB * KB;

// Time constants (mixd-v0)
const SECOND = 1000; // milliseconds

// Tunable numeric limits (mixd-v0)
const PACK_MAX_FILE_SIZE_MB = 10;
const PACK_MAX_INCLUDES_DEPTH = 5;
const PACK_MAX_INCLUDES_COUNT = 50;

const RULESET_MAX_FILE_SIZE_MB = 5;
const RULESET_MAX_COMPOSITION_DEPTH = 10;
const RULESET_MAX_EXTENDS_COUNT = 20;
const RULESET_MAX_FRONTMATTER_DEPTH = 10;

const WATCHER_MAX_CONSECUTIVE_ERRORS = 5;
const ERROR_RESET_SECONDS = 30;

const FILE_LOCK_TIMEOUT_SECONDS = 5;
const FILE_LOCK_RETRY_DELAY_MS = 100;
const FILE_LOCK_STALE_SECONDS = 10;

const INSTALLATION_MAX_DESTINATIONS = 10;
const INSTALLATION_MAX_CONCURRENT_WRITES = 5;

export const RESOURCE_LIMITS = {
  // Pack system limits
  pack: {
    maxFileSize: PACK_MAX_FILE_SIZE_MB * MB,
    maxIncludesDepth: PACK_MAX_INCLUDES_DEPTH,
    maxIncludesCount: PACK_MAX_INCLUDES_COUNT,
    maxConfigurationSize: MB, // 1MB for configuration
  },

  // Ruleset limits
  ruleset: {
    maxFileSize: RULESET_MAX_FILE_SIZE_MB * MB,
    maxCompositionDepth: RULESET_MAX_COMPOSITION_DEPTH,
    maxExtendsCount: RULESET_MAX_EXTENDS_COUNT,
    maxFrontmatterDepth: RULESET_MAX_FRONTMATTER_DEPTH,
  },

  // Watch mode limits
  watcher: {
    maxConsecutiveErrors: WATCHER_MAX_CONSECUTIVE_ERRORS,
    errorResetTime: ERROR_RESET_SECONDS * SECOND,
    restartDelay: SECOND, // 1 second
    msToSeconds: SECOND, // conversion constant
  },

  // File locking
  fileLock: {
    timeout: FILE_LOCK_TIMEOUT_SECONDS * SECOND,
    retryDelay: FILE_LOCK_RETRY_DELAY_MS,
    staleThreshold: FILE_LOCK_STALE_SECONDS * SECOND,
  },

  // Installation limits
  installation: {
    maxDestinations: INSTALLATION_MAX_DESTINATIONS,
    maxConcurrentWrites: INSTALLATION_MAX_CONCURRENT_WRITES,
  },
} as const;

export const FILE_EXTENSIONS = {
  markdown: ['.md', '.mix.md'],
  toml: ['.toml'],
  json: ['.json', '.jsonc'],
} as const;

export const DESTINATION_IDS = [
  'cursor',
  'windsurf',
  'claude-code',
  'agents-md',
  'copilot',
] as const;

export type DestinationId = (typeof DESTINATION_IDS)[number];
