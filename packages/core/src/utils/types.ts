/**
 * Type utilities for the Rulesets project using type-fest.
 * These utilities provide common type transformations and patterns used throughout the codebase.
 */

import type {
  ConditionalExcept,
  ConditionalPick,
  LiteralUnion,
  Opaque,
  PartialDeep,
  ReadonlyDeep,
  RequiredDeep,
} from "type-fest";

/**
 * Configuration objects that may have partial values during construction
 * but are required when validated.
 */
export type PartialConfig<T> = PartialDeep<T>;
export type ValidatedConfig<T> = RequiredDeep<T>;

/**
 * Immutable configuration objects that should not be modified after creation.
 */
export type ImmutableConfig<T> = ReadonlyDeep<T>;

/**
 * Provider names with support for custom providers while providing autocompletion
 * for known providers.
 */
export type ProviderName = LiteralUnion<
  | "cursor"
  | "windsurf"
  | "claude-code"
  | "roo-code"
  | "cline"
  | "codex-cli"
  | "codex-agent"
  | "agents",
  string
>;

/**
 * File paths that are guaranteed to be absolute paths.
 */
export type AbsolutePath = Opaque<string, "AbsolutePath">;

/**
 * Relative file paths for internal operations.
 */
export type RelativePath = Opaque<string, "RelativePath">;

/**
 * Semantic version strings.
 */
export type SemVer = Opaque<string, "SemVer">;

/**
 * Pick properties that have string values.
 */
export type StringProperties<T> = ConditionalPick<T, string>;

/**
 * Omit properties that have undefined values.
 */
export type DefinedProperties<T> = ConditionalExcept<T, undefined>;

/**
 * Common metadata structure used across different contexts.
 */
export type BaseMetadata = {
  readonly version?: SemVer;
  readonly created?: Date;
  readonly updated?: Date;
  readonly tags?: readonly string[];
};

/**
 * Generic result type for operations that can fail.
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Helper function to create a successful result.
 */
export function success<T>(data: T): Result<T, never> {
  return { success: true, data };
}

/**
 * Helper function to create an error result.
 */
export function failure<E>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Type guard to check if a result is successful.
 */
export function isSuccess<T, E>(
  result: Result<T, E>
): result is { success: true; data: T } {
  return result.success;
}

/**
 * Type guard to check if a result is an error.
 */
export function isFailure<T, E>(
  result: Result<T, E>
): result is { success: false; error: E } {
  return !result.success;
}
