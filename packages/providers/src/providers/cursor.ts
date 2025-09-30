import path from "node:path";

import { type CompileTarget, RULESET_CAPABILITIES } from "@rulesets/types";

import { hasCapability } from "../shared";
import { createSimpleFilesystemProvider } from "./simple";

const CURSOR_CAPABILITIES = Object.freeze([
  RULESET_CAPABILITIES.MARKDOWN_RENDER,
  RULESET_CAPABILITIES.OUTPUT_FILESYSTEM,
  RULESET_CAPABILITIES.DIAGNOSTICS_STRUCTURED,
]);

const resolveFormat = (target: CompileTarget): "markdown" | "xml" =>
  hasCapability(target, "output:sections") ? "xml" : "markdown";

export const createCursorProvider = () =>
  createSimpleFilesystemProvider({
    providerId: "cursor",
    capabilities: CURSOR_CAPABILITIES,
    formatResolver: ({ target }) => resolveFormat(target),
    canonicalOutput: {
      basePath: ({ artifact }) => path.dirname(artifact.target.outputPath),
    },
  });

export type CursorProvider = ReturnType<typeof createCursorProvider>;
