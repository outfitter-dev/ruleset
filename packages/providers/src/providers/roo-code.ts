import path from "node:path";

import {
  createResultOk,
  type JsonValue,
  RULESET_CAPABILITIES,
} from "@rulesets/types";

import {
  defineProvider,
  PROVIDER_SDK_VERSION,
  type ProviderCompileInput,
  type ProviderCompileResult,
} from "../index";
import {
  deriveDocumentSegments,
  PROVIDER_VERSION,
  resolveConfiguredOutputPath,
  resolveFilesystemArtifact,
} from "../shared";

const PROVIDER_ID = "roo-code";

const CAPABILITIES = Object.freeze([
  RULESET_CAPABILITIES.MARKDOWN_RENDER,
  RULESET_CAPABILITIES.OUTPUT_FILESYSTEM,
  RULESET_CAPABILITIES.DIAGNOSTICS_STRUCTURED,
]);

type RooConfig = {
  readonly outputPath?: JsonValue;
  readonly mode?: JsonValue;
  readonly modes?: JsonValue;
  readonly includeCommon?: JsonValue;
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

const normalizeMode = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return;
  }
  return trimmed.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
};

const collectModes = (config: RooConfig): readonly string[] => {
  const candidates: JsonValue[] = [];
  if (config.mode !== undefined) {
    candidates.push(config.mode);
  }
  if (config.modes !== undefined) {
    if (Array.isArray(config.modes)) {
      candidates.push(...config.modes);
    } else {
      candidates.push(config.modes);
    }
  }

  const normalized = candidates
    .flatMap((candidate) => {
      if (typeof candidate === "string") {
        return [candidate];
      }
      if (Array.isArray(candidate)) {
        return candidate.filter(
          (entry): entry is string => typeof entry === "string"
        );
      }
      return [];
    })
    .map((value) => normalizeMode(value))
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(normalized));
};

const EXTENSION_PATTERN = /\.[^.]+$/;

const ensureExtension = (
  fileName: string,
  format: "markdown" | "xml"
): string => {
  const parsed = path.parse(fileName);
  const desiredExtension = format === "xml" ? ".xml" : parsed.ext || ".md";
  const safeExtension = desiredExtension.startsWith(".")
    ? desiredExtension
    : `.${desiredExtension}`;
  const baseName = parsed.name || fileName.replace(EXTENSION_PATTERN, "");
  return `${baseName}${safeExtension}`;
};

const buildFallbackPath = (
  contextCwd: string,
  format: "markdown" | "xml",
  segments: readonly string[],
  mode?: string
): string => {
  const directorySegments = segments.length > 1 ? segments.slice(0, -1) : [];
  const fileName = segments.length > 0 ? (segments.at(-1) ?? "rules") : "rules";
  const safeFileName = ensureExtension(fileName, format);
  const relativePath = path.join(...directorySegments, safeFileName);
  const baseDir = path.join(
    contextCwd,
    ".roo",
    mode ? `rules-${mode}` : "rules"
  );
  return path.join(baseDir, relativePath);
};

export const createRooCodeProvider = () =>
  defineProvider({
    handshake: {
      providerId: PROVIDER_ID,
      version: PROVIDER_VERSION,
      sdkVersion: PROVIDER_SDK_VERSION,
      capabilities: CAPABILITIES,
      sandbox: { mode: "in-process" },
      runtime: { bun: ">=1.0.0" },
    },
    compile: (input: ProviderCompileInput): ProviderCompileResult => {
      const { artifact, config, format } = resolveFilesystemArtifact({
        providerId: PROVIDER_ID,
        input,
        fallbackExtension: ".md",
      });

      const rooConfig = config as RooConfig;
      const modes = collectModes(rooConfig);
      const includeCommon =
        modes.length === 0 || isTruthy(rooConfig.includeCommon) === true;

      const segments = deriveDocumentSegments(input.document, input.context);
      const uniqueOutputPaths = new Set<string>();

      const pushPath = (outputPath: string) => {
        uniqueOutputPaths.add(path.normalize(outputPath));
      };

      if (includeCommon) {
        const fallbackCommonPath = buildFallbackPath(
          input.context.cwd,
          format,
          segments
        );
        const resolvedCommon = resolveConfiguredOutputPath({
          context: input.context,
          fallbackPath: fallbackCommonPath,
          configuredPath: rooConfig.outputPath,
          format,
          fallbackExtension: format === "xml" ? ".xml" : ".md",
        });
        pushPath(resolvedCommon);
      }

      for (const mode of modes) {
        const fallbackModePath = buildFallbackPath(
          input.context.cwd,
          format,
          segments,
          mode
        );
        pushPath(fallbackModePath);
      }

      const artifacts = Array.from(uniqueOutputPaths, (outputPath) => ({
        target: {
          ...artifact.target,
          outputPath,
        },
        contents: artifact.contents,
        diagnostics: artifact.diagnostics,
      }));

      if (artifacts.length === 0) {
        artifacts.push({
          target: {
            ...artifact.target,
            outputPath: buildFallbackPath(input.context.cwd, format, segments),
          },
          contents: artifact.contents,
          diagnostics: artifact.diagnostics,
        });
      }

      if (artifacts.length === 1) {
        return createResultOk(artifacts[0] ?? artifact);
      }

      return createResultOk(artifacts);
    },
  });

export type RooCodeProvider = ReturnType<typeof createRooCodeProvider>;
