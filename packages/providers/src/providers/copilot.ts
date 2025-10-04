import path from "node:path";

import { type CompileTarget, RULESET_CAPABILITIES } from "@ruleset/types";

import { hasCapability } from "../shared";
import { createSimpleFilesystemProvider } from "./simple";

const PROVIDER_ID = "copilot";

const COPILOT_CAPABILITIES = Object.freeze([
  RULESET_CAPABILITIES.MARKDOWN_RENDER,
  RULESET_CAPABILITIES.OUTPUT_FILESYSTEM,
  RULESET_CAPABILITIES.DIAGNOSTICS_STRUCTURED,
]);

const resolveFormat = (target: CompileTarget): "markdown" | "xml" =>
  hasCapability(target, "output:sections") ? "xml" : "markdown";

export const createCopilotProvider = () =>
  createSimpleFilesystemProvider({
    providerId: PROVIDER_ID,
    capabilities: COPILOT_CAPABILITIES,
    formatResolver: ({ target }) => resolveFormat(target),
    canonicalOutput: {
      basePath: ({ artifact }) => path.dirname(artifact.target.outputPath),
    },
  });

export type CopilotProvider = ReturnType<typeof createCopilotProvider>;
