import path from "node:path";

import {
  createResultOk,
  type JsonValue,
  RULESET_CAPABILITIES,
  type RulesetDiagnostics,
} from "@rulesets/types";

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

const PROVIDER_ID = "codex-agent";
const CAPABILITIES = Object.freeze([
  RULESET_CAPABILITIES.MARKDOWN_RENDER,
  RULESET_CAPABILITIES.OUTPUT_FILESYSTEM,
  RULESET_CAPABILITIES.DIAGNOSTICS_STRUCTURED,
]);
const DEFAULT_FILE_NAME = "AGENTS.md";
const SECTION_PREFIX = "## Source:";

type AggregatedEntry = {
  readonly label: string;
  readonly contents: string;
  readonly diagnostics: RulesetDiagnostics;
};

const isTruthful = (value: JsonValue | undefined): boolean | undefined => {
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

const describeSource = (
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

export const createCodexAgentProvider = () => {
  const documents = new Map<string, AggregatedEntry>();
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
      const label = describeSource(input.document, input.context.cwd);

      documents.set(documentKey, {
        label,
        contents: artifact.contents.trimEnd(),
        diagnostics: artifact.diagnostics,
      });

      const orderedEntries = Array.from(documents.values()).sort((a, b) =>
        a.label.localeCompare(b.label)
      );

      const mergedContents = orderedEntries
        .map((entry) => `${SECTION_PREFIX} ${entry.label}\n\n${entry.contents}`)
        .join("\n\n");

      const aggregatedDiagnostics = orderedEntries.flatMap(
        (entry) => entry.diagnostics
      );

      const includeContent = isTruthful(providerConfig.enabled) !== false;

      return createResultOk({
        target: {
          ...artifact.target,
          outputPath: resolvedOutput,
        },
        contents: includeContent ? mergedContents.concat("\n") : "",
        diagnostics: aggregatedDiagnostics,
      });
    },
  });
};

export type CodexAgentProvider = ReturnType<typeof createCodexAgentProvider>;
