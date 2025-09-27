import path from "node:path";

import {
  type CapabilityDescriptor,
  type CompileArtifact,
  createResultOk,
  RULESET_CAPABILITIES,
} from "@rulesets/types";

import {
  defineProvider,
  PROVIDER_SDK_VERSION,
  type ProviderCompileInput,
  type ProviderEntry,
} from "./index";
import { createAgentsMdProvider } from "./providers/agents-md";
import { createClaudeCodeProvider } from "./providers/claude-code";
import { createCodexProvider } from "./providers/codex";
import { createCopilotProvider } from "./providers/copilot";
import { createCursorProvider } from "./providers/cursor";
import { createRooCodeProvider } from "./providers/roo-code";
import { createWindsurfProvider } from "./providers/windsurf";

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
  RULESET_CAPABILITIES.OUTPUT_SECTIONS,
  RULESET_CAPABILITIES.OUTPUT_FILESYSTEM,
  RULESET_CAPABILITIES.DIAGNOSTICS_STRUCTURED,
]);

const createMarkdownProvider = (providerId: string): ProviderEntry =>
  defineProvider({
    handshake: {
      providerId,
      version: PROVIDER_VERSION,
      sdkVersion: PROVIDER_SDK_VERSION,
      capabilities: DEFAULT_CAPABILITIES,
      sandbox: { mode: "in-process" },
      runtime: { bun: ">=1.0.0" },
    },
    compile: ({
      document,
      context,
      target,
      rendered,
    }: ProviderCompileInput) => {
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
        contents: rendered?.contents ?? document.source.contents,
        diagnostics: rendered?.diagnostics ?? [],
      };

      return createResultOk(artifact);
    },
  });

const FACTORIES: Record<string, () => ProviderEntry> = {
  cursor: createCursorProvider,
  "agents-md": createAgentsMdProvider,
  "claude-code": createClaudeCodeProvider,
  copilot: createCopilotProvider,
  windsurf: createWindsurfProvider,
  codex: createCodexProvider,
  "roo-code": createRooCodeProvider,
};

const DEFAULT_PROVIDER_ORDER = [
  "cursor",
  "windsurf",
  "claude-code",
  "agents-md",
  "copilot",
  "codex",
  "roo-code",
];

export const createDefaultProviders = (): ProviderEntry[] =>
  DEFAULT_PROVIDER_ORDER.map((providerId) => {
    const factory = FACTORIES[providerId];
    if (factory) {
      return factory();
    }
    return createMarkdownProvider(providerId);
  });
