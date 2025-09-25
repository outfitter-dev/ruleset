/**
 * Shared type definitions for the Rulesets v0.4 toolchain.
 *
 * These types are intentionally conservative placeholders that unblock
 * early package wiring. As the orchestrator solidifies, expand each
 * contract with concrete fields and invariants.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | {
      readonly [key: string]: JsonValue;
    };
export type RulesetVersionTag =
  | `${number}.${number}.${number}`
  | `${number}.${number}.${number}-${string}`;
export declare const RULESETS_VERSION_TAG: RulesetVersionTag;
export type RulesetSource = {
  readonly id: string;
  readonly path: string;
  readonly contents: string;
  readonly format: "rule" | "ruleset";
};
export type DiagnosticLevel = "error" | "warning" | "info";
export type DiagnosticLocation = {
  readonly line: number;
  readonly column: number;
  readonly offset?: number;
};
export type RulesetDiagnostic = {
  readonly level: DiagnosticLevel;
  readonly message: string;
  readonly location?: DiagnosticLocation;
  readonly hint?: string;
  readonly tags?: readonly string[];
};
export type RulesetDiagnostics = readonly RulesetDiagnostic[];
export type RulesetDocumentMetadata = {
  readonly frontMatter: Record<string, JsonValue>;
  readonly hash?: string;
};
export type RulesetDocument = {
  readonly source: RulesetSource;
  readonly metadata: RulesetDocumentMetadata;
  readonly ast: unknown;
};
export type CompileTarget = {
  readonly providerId: string;
  readonly outputPath: string;
  readonly capabilities?: readonly string[];
};
export type CompileArtifact = {
  readonly target: CompileTarget;
  readonly contents: string;
  readonly diagnostics: RulesetDiagnostics;
};
export type ResultOk<TValue> = {
  readonly ok: true;
  readonly value: TValue;
};
export type ResultErr<TError extends RulesetDiagnostics | Error> = {
  readonly ok: false;
  readonly error: TError;
};
export type Result<
  TValue,
  TError extends RulesetDiagnostics | Error = RulesetDiagnostics,
> = ResultOk<TValue> | ResultErr<TError>;
export declare const createResultOk: <TValue>(
  value: TValue
) => ResultOk<TValue>;
export declare const createResultErr: <
  TError extends RulesetDiagnostics | Error,
>(
  error: TError
) => ResultErr<TError>;
export type RulesetRuntimeContext = {
  readonly version: RulesetVersionTag;
  readonly cwd: string;
  readonly cacheDir: string;
  readonly env: ReadonlyMap<string, string>;
};
export type CompilationInput = {
  readonly context: RulesetRuntimeContext;
  readonly sources: readonly RulesetSource[];
  readonly targets: readonly CompileTarget[];
};
export type CompilationOutput = {
  readonly artifacts: readonly CompileArtifact[];
  readonly diagnostics: RulesetDiagnostics;
};
export type AsyncMaybe<T> = Promise<T> | T;
export type Task<TPayload = void> = () => AsyncMaybe<TPayload>;
export type CapabilityDescriptor = {
  readonly id: string;
  readonly description: string;
  readonly experimental?: boolean;
};
export declare const defineCapability: (
  descriptor: CapabilityDescriptor
) => CapabilityDescriptor;
//# sourceMappingURL=index.d.ts.map
