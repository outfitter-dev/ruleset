import path from "node:path";

import {
  type CompileArtifact,
  type CompileTarget,
  createResultErr,
  createResultOk,
  type JsonValue,
  type RulesetDiagnostic,
  type RulesetDiagnostics,
  type RulesetDocument,
  type RulesetProjectConfig,
  type RulesetRuntimeContext,
} from "@rulesets/types";

import { readProviderConfig } from "./utils";

export const PROVIDER_VERSION = "0.4.0-dev";

export type RendererFormat = "markdown" | "xml";

const FILE_EXTENSION_PATTERN = /\.[^.]+$/;

export const hasCapability = (
  target: CompileTarget | undefined,
  capabilityId: string
): boolean =>
  Boolean(
    target?.capabilities?.some((capability) => capability === capabilityId)
  );

export const selectRenderedArtifact = (params: {
  rendered?: CompileArtifact;
  document: RulesetDocument;
  target: CompileTarget;
}): CompileArtifact => {
  const { rendered, document, target } = params;

  if (rendered) {
    return {
      target: {
        ...target,
        ...rendered.target,
      },
      contents: rendered.contents,
      diagnostics: rendered.diagnostics,
    };
  }

  return {
    target,
    contents: document.source.contents,
    diagnostics: document.diagnostics ?? [],
  };
};

export const mergeDiagnostics = (
  base: RulesetDiagnostics,
  extra: RulesetDiagnostics
): RulesetDiagnostics => {
  if (extra.length === 0) {
    return base;
  }
  if (base.length === 0) {
    return extra;
  }
  return [...base, ...extra];
};

export const createResultFromArtifact = (
  artifact: CompileArtifact,
  diagnostics?: RulesetDiagnostics
) => {
  if (diagnostics && diagnostics.length > 0) {
    return createResultErr(mergeDiagnostics(artifact.diagnostics, diagnostics));
  }

  return createResultOk<CompileArtifact>({
    ...artifact,
    diagnostics: artifact.diagnostics,
  });
};

const sanitizeSegments = (segments: readonly string[]): string[] =>
  segments.filter((segment) => segment && segment !== "." && segment !== "..");

export const deriveDocumentSegments = (
  document: RulesetDocument,
  context: RulesetRuntimeContext
): string[] => {
  const sourcePath = document.source.path;
  if (sourcePath) {
    const relative = path
      .relative(context.cwd, sourcePath)
      .replace(/\\+/g, "/");
    const segments = relative.split("/");
    const sanitized = sanitizeSegments(segments);
    if (sanitized.length > 0) {
      return sanitized;
    }
  }

  const sourceId = document.source.id;
  if (sourceId) {
    const segments = sourceId.replace(/\\+/g, "/").split("/");
    const sanitized = sanitizeSegments(segments);
    if (sanitized.length > 0) {
      return sanitized;
    }
  }

  return [];
};

const ensureExtension = (
  fileName: string,
  format: RendererFormat,
  fallbackExtension: string
): string => {
  const parsed = path.parse(fileName);
  const extension = format === "xml" ? ".xml" : parsed.ext || fallbackExtension;
  const safeExtension = extension.startsWith(".") ? extension : `.${extension}`;
  const baseName = parsed.name || fileName.replace(FILE_EXTENSION_PATTERN, "");
  return `${baseName}${safeExtension}`;
};

export const buildDefaultOutputPath = (params: {
  context: RulesetRuntimeContext;
  target: CompileTarget;
  providerId: string;
  document: RulesetDocument;
  format: RendererFormat;
  fallbackDir?: string;
  fallbackExtension?: string;
}): string => {
  const {
    context,
    target,
    providerId,
    document,
    format,
    fallbackDir,
    fallbackExtension = ".md",
  } = params;

  const segments = deriveDocumentSegments(document, context);

  const directorySegments = segments.length > 1 ? segments.slice(0, -1) : [];
  const rawFileName =
    segments.length > 0 ? (segments.at(-1) ?? providerId) : providerId;
  const safeFileName = ensureExtension(rawFileName, format, fallbackExtension);

  const relativePath = path.join(...directorySegments, safeFileName);
  const scopeDir = fallbackDir ?? providerId;

  return path.normalize(path.join(target.outputPath, scopeDir, relativePath));
};

export const mergeProviderConfig = (
  document: RulesetDocument,
  projectConfig: RulesetProjectConfig | undefined,
  providerId: string
): Record<string, JsonValue> => {
  const merged: Record<string, JsonValue> = {};

  const projectProvider = projectConfig?.providers?.[providerId];
  if (projectProvider) {
    for (const [key, value] of Object.entries(projectProvider)) {
      if (key === "config") {
        continue;
      }
      if (value !== undefined) {
        merged[key] = value as JsonValue;
      }
    }

    if (projectProvider.config) {
      Object.assign(
        merged,
        projectProvider.config as Record<string, JsonValue>
      );
    }
  }

  const frontmatterConfig = readProviderConfig(document, providerId);
  if (frontmatterConfig) {
    Object.assign(merged, frontmatterConfig);
  }

  return merged;
};

const isProbablyDirectory = (candidate: string): boolean => {
  if (candidate.endsWith("/") || candidate.endsWith(path.sep)) {
    return true;
  }

  return path.extname(candidate) === "";
};

export const resolveConfiguredOutputPath = (params: {
  context: RulesetRuntimeContext;
  fallbackPath: string;
  configuredPath?: JsonValue;
  format: RendererFormat;
  fallbackExtension?: string;
}): string => {
  const { context, fallbackPath, configuredPath, format, fallbackExtension } =
    params;

  if (
    typeof configuredPath !== "string" ||
    configuredPath.trim().length === 0
  ) {
    return fallbackPath;
  }

  const raw = configuredPath.trim();
  const resolved = path.isAbsolute(raw)
    ? path.normalize(raw)
    : path.resolve(context.cwd, raw);

  if (!isProbablyDirectory(raw)) {
    return path.normalize(resolved);
  }

  const parsedFallback = path.parse(fallbackPath);
  const baseName = ensureExtension(
    parsedFallback.base,
    format,
    fallbackExtension ?? (parsedFallback.ext || ".md")
  );

  return path.normalize(path.join(resolved, baseName));
};

export const createDiagnostic = (params: {
  message: string;
  hint?: string;
  tags?: readonly string[];
  level?: RulesetDiagnostic["level"];
}): RulesetDiagnostic => {
  const { message, hint, tags, level = "error" } = params;
  return {
    level,
    message,
    hint,
    tags: tags ? [...tags] : undefined,
  };
};
