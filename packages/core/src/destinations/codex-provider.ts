import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  CompiledDoc,
  DestinationProvider,
  JSONSchema7,
  Logger,
  ParsedDoc,
} from "../interfaces";
import { buildHandlebarsOptions, readDestinationConfig } from "./utils";

type CodexConfig = {
  outputPath?: string;
  enableSharedAgents?: boolean;
  agentsOutputPath?: string;
};

export class CodexProvider implements DestinationProvider {
  get name(): string {
    return "codex";
  }

  configSchema(): JSONSchema7 {
    return {
      type: "object",
      properties: {
        outputPath: {
          type: "string",
          description: "Path where the .codex/AGENTS.md file should be written",
        },
        enableSharedAgents: {
          type: "boolean",
          description: "Whether to also write to shared AGENTS.md location",
          default: true,
        },
        agentsOutputPath: {
          type: "string",
          description: "Path where the shared AGENTS.md file should be written",
        },
      },
      additionalProperties: true,
    };
  }

  prepareCompilation({
    parsed,
    projectConfig: _projectConfig,
    logger,
  }: {
    parsed: ParsedDoc;
    projectConfig: Record<string, unknown>;
    logger: Logger;
  }) {
    const destinationConfig = readDestinationConfig(parsed, "codex");
    return buildHandlebarsOptions({
      destinationId: "codex",
      destinationConfig,
      logger,
    });
  }

  async write(ctx: {
    compiled: CompiledDoc;
    destPath: string;
    config: Record<string, unknown>;
    logger: Logger;
  }): Promise<void> {
    const { compiled, destPath, config, logger } = ctx;
    const cfg = config as CodexConfig;

    const basePath =
      path.extname(destPath).length > 0 ? path.dirname(destPath) : destPath;
    const resolvedBase = path.isAbsolute(basePath)
      ? basePath
      : path.resolve(basePath);

    // Write to .codex/AGENTS.md
    await this.writeCodexFile(cfg, resolvedBase, compiled, logger);

    // Also write to shared AGENTS.md location if enabled (default: true)
    const enableSharedAgents = cfg.enableSharedAgents !== false; // Default to true
    if (enableSharedAgents) {
      await this.writeSharedAgentsFile(cfg, resolvedBase, compiled, logger);
    }
  }

  private async writeCodexFile(
    cfg: CodexConfig,
    resolvedBase: string,
    compiled: CompiledDoc,
    logger: Logger
  ): Promise<void> {
    const rawCodexOutput =
      typeof cfg.outputPath === "string" ? cfg.outputPath.trim() : "";
    const codexOutputSpecifier =
      rawCodexOutput.length > 0 ? rawCodexOutput : ".codex/AGENTS.md";
    const codexOutputPath = path.isAbsolute(codexOutputSpecifier)
      ? codexOutputSpecifier
      : path.resolve(resolvedBase, codexOutputSpecifier);
    const codexDir = path.dirname(codexOutputPath);

    logger.info("Writing Codex rules", { outputPath: codexOutputPath });

    try {
      await fs.mkdir(codexDir, { recursive: true });
      await fs.writeFile(codexOutputPath, compiled.output.content, "utf-8");
      logger.debug("Codex write complete", {
        destinationId: compiled.context.destinationId,
        outputPath: codexOutputPath,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(err, {
        provider: "codex",
        op: "write",
        path: codexOutputPath,
      });
      throw err;
    }
  }

  private async writeSharedAgentsFile(
    cfg: CodexConfig,
    resolvedBase: string,
    compiled: CompiledDoc,
    logger: Logger
  ): Promise<void> {
    const rawAgentsOutput =
      typeof cfg.agentsOutputPath === "string"
        ? cfg.agentsOutputPath.trim()
        : "";
    const agentsOutputSpecifier =
      rawAgentsOutput.length > 0 ? rawAgentsOutput : "AGENTS.md";
    const agentsOutputPath = path.isAbsolute(agentsOutputSpecifier)
      ? agentsOutputSpecifier
      : path.resolve(resolvedBase, agentsOutputSpecifier);
    const agentsDir = path.dirname(agentsOutputPath);

    logger.info("Writing shared AGENTS rules", {
      outputPath: agentsOutputPath,
    });

    try {
      await fs.mkdir(agentsDir, { recursive: true });
      await fs.writeFile(agentsOutputPath, compiled.output.content, "utf-8");
      logger.debug("Shared AGENTS write complete", {
        destinationId: compiled.context.destinationId,
        outputPath: agentsOutputPath,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(err, {
        provider: "codex",
        op: "write-shared-agents",
        path: agentsOutputPath,
      });
      throw err;
    }
  }
}
