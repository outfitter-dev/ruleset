import path from "node:path";

import {
  createResultOk,
  type JsonValue,
  RULESET_CAPABILITIES,
  type RulesetDiagnostics,
} from "@ruleset/types";

import {
  defineProvider,
  PROVIDER_SDK_VERSION,
  type ProviderCompileInput,
  type ProviderCompileResult,
} from "../index";
import {
  mergeProviderConfig,
  PROVIDER_VERSION,
  resolveConfiguredOutputPath,
  selectRenderedArtifact,
} from "../shared";

const PROVIDER_ID = "cline";
const CAPABILITIES = Object.freeze([
  RULESET_CAPABILITIES.MARKDOWN_RENDER,
  RULESET_CAPABILITIES.OUTPUT_FILESYSTEM,
  RULESET_CAPABILITIES.DIAGNOSTICS_STRUCTURED,
]);
const DEFAULT_FILE_NAME = ".clinerules";
const SECTION_SEPARATOR = "\n\n---\n\n";

type AggregatedDocument = {
  readonly label: string;
  readonly contents: string;
  readonly diagnostics: RulesetDiagnostics;
};

const isTruthy = (value: JsonValue | undefined): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }

  return;
};

const buildLabel = (
  document: ProviderCompileInput["document"],
  contextCwd: string
): string => {
  const sourcePath = document.source.path;
  if (sourcePath) {
    const relative = path.relative(contextCwd, sourcePath).replace(/\\+/g, "/");
    if (relative.length > 0) {
      return relative;
    }
  }

  if (document.source.id) {
    return document.source.id;
  }

  return "anonymous";
};

export const createClineProvider = () => {
  const aggregatedDocuments = new Map<string, AggregatedDocument>();
  let anonymousCounter = 0;

  return defineProvider({
    handshake: {
      providerId: PROVIDER_ID,
      version: PROVIDER_VERSION,
      sdkVersion: PROVIDER_SDK_VERSION,
      capabilities: CAPABILITIES,
      sandbox: { mode: "in-process" },
      runtime: { bun: ">=1.0.0" },
    },
    compile: (input: ProviderCompileInput): ProviderCompileResult => {
      const providerConfig = mergeProviderConfig(
        input.document,
        input.projectConfig,
        PROVIDER_ID
      );

      const fallbackPath = path.join(input.context.cwd, DEFAULT_FILE_NAME);
      const resolvedOutput = resolveConfiguredOutputPath({
        context: input.context,
        fallbackPath,
        configuredPath: providerConfig.outputPath,
        format: "markdown",
        fallbackExtension: DEFAULT_FILE_NAME,
      });

      const artifact = selectRenderedArtifact({
        document: input.document,
        rendered: input.rendered,
        target: {
          ...input.target,
          outputPath: resolvedOutput,
        },
      });

      const documentKey =
        input.document.source.path ??
        input.document.source.id ??
        `anonymous-${++anonymousCounter}`;

      const label = buildLabel(input.document, input.context.cwd);
      aggregatedDocuments.set(documentKey, {
        label,
        contents: artifact.contents.trimEnd(),
        diagnostics: artifact.diagnostics,
      });

      const aggregatedList = Array.from(aggregatedDocuments.values()).sort(
        (a, b) => a.label.localeCompare(b.label)
      );

      const aggregatedContents = aggregatedList
        .map((entry) => `# Source: ${entry.label}\n\n${entry.contents}`)
        .join(SECTION_SEPARATOR)
        .concat("\n");
      const aggregatedDiagnostics = aggregatedList.flatMap(
        (entry) => entry.diagnostics
      );

      // If explicitly disabled, return empty content but keep the file addressable.
      const shouldEmitContent = isTruthy(providerConfig.enabled) !== false;

      return createResultOk({
        target: {
          ...artifact.target,
          outputPath: resolvedOutput,
        },
        contents: shouldEmitContent ? aggregatedContents : "",
        diagnostics: aggregatedDiagnostics,
      });
    },
  });
};

export type ClineProvider = ReturnType<typeof createClineProvider>;
