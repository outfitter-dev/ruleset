import path from "node:path";

import {
  type CapabilityDescriptor,
  type CompileArtifact,
  createResultOk,
  RULESET_CAPABILITIES,
} from "@rulesets/types";

import type { ProviderCompileInput, ProviderEntry } from "./index";
import { defineProvider } from "./index";

const PROVIDER_VERSION = "0.4.0-dev";
const LEADING_CURRENT_DIR = /^\.\//;

const normalizeRelativePath = (contextCwd: string, documentPath?: string) => {
  if (!documentPath) {
    return;
  }
  const relative = path.relative(contextCwd, documentPath);
  return relative.replace(/\\+/g, "/");
};

const DEFAULT_CAPABILITIES: readonly CapabilityDescriptor[] = Object.freeze([
  RULESET_CAPABILITIES.MARKDOWN_RENDER,
  RULESET_CAPABILITIES.OUTPUT_FILESYSTEM,
  RULESET_CAPABILITIES.DIAGNOSTICS_STRUCTURED,
]);

const createMarkdownProvider = (providerId: string): ProviderEntry =>
  defineProvider({
    handshake: {
      providerId,
      version: PROVIDER_VERSION,
      capabilities: DEFAULT_CAPABILITIES,
    },
    compile: ({ document, context, target }: ProviderCompileInput) => {
      const normalizedRelative = normalizeRelativePath(
        context.cwd,
        document.source.path
      );

      const fileName = normalizedRelative
        ? normalizedRelative.replace(LEADING_CURRENT_DIR, "")
        : `${document.source.id}.md`;

      const destinationPath = path.join(
        target.outputPath,
        providerId,
        fileName
      );

      const artifact: CompileArtifact = {
        target: {
          ...target,
          outputPath: destinationPath,
        },
        contents: document.source.contents,
        diagnostics: document.diagnostics ?? [],
      };

      return createResultOk(artifact);
    },
  });

export const createDefaultProviders = (): ProviderEntry[] =>
  ["cursor", "windsurf", "claude-code", "agents-md", "copilot", "codex"].map(
    (providerId) => createMarkdownProvider(providerId)
  );
