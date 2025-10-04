import path from "node:path";

import {
  type CompileTarget,
  type JsonValue,
  RULESET_CAPABILITIES,
} from "@ruleset/types";

import { hasCapability } from "../shared";
import { createSimpleFilesystemProvider } from "./simple";

const PROVIDER_ID = "windsurf";

const WINDSURF_CAPABILITIES = Object.freeze([
  RULESET_CAPABILITIES.MARKDOWN_RENDER,
  RULESET_CAPABILITIES.OUTPUT_SECTIONS,
  RULESET_CAPABILITIES.OUTPUT_FILESYSTEM,
  RULESET_CAPABILITIES.DIAGNOSTICS_STRUCTURED,
]);

const normalizeFormat = (value: unknown): "markdown" | "xml" | undefined => {
  if (typeof value !== "string") {
    return;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "xml") {
    return "xml";
  }
  if (normalized === "markdown") {
    return "markdown";
  }
  return;
};

const resolveFormat = (
  target: CompileTarget,
  config: Record<string, JsonValue>
) => {
  const configuredFormat = normalizeFormat(config.format);
  if (configuredFormat) {
    return configuredFormat;
  }
  return hasCapability(target, "output:sections") ? "xml" : "markdown";
};

export const createWindsurfProvider = () =>
  createSimpleFilesystemProvider({
    providerId: PROVIDER_ID,
    capabilities: WINDSURF_CAPABILITIES,
    formatResolver: ({ target, config }) => resolveFormat(target, config),
    canonicalOutput: {
      basePath: ({ artifact }) => path.dirname(artifact.target.outputPath),
    },
  });

export type WindsurfProvider = ReturnType<typeof createWindsurfProvider>;
