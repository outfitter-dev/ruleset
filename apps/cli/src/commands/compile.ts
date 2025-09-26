import { promises as fs } from "node:fs";
import path, { resolve } from "node:path";

import { loadProjectConfig } from "@rulesets/core";
import { compileRulesets } from "@rulesets/orchestrator";
import {
  createDefaultProviders,
  type ProviderEntry,
} from "@rulesets/providers";
import {
  type CompilationInput,
  type CompileArtifact,
  type CompileTarget,
  RULESETS_VERSION_TAG,
  type RulesetRuntimeContext,
  type RulesetSource,
  type RulesetSourceEntry,
} from "@rulesets/types";
import chalk from "chalk";
import { Command } from "commander";
import picomatch from "picomatch";
import { logger } from "../utils/logger";
import { createSpinner } from "../utils/spinner";

// Compile source rules from a file or directory into per-provider outputs

/**
 * Creates the `rulesets compile` sub-command. The command compiles source rules
 * into provider-specific artefacts and can optionally watch for changes.
 */
export function compileCommand(): Command {
  return new Command("compile")
    .description("Compile source rules to provider formats")
    .option("--json", "Output JSON logs for machine consumption")
    .option("--log-level <level>", "Log level: debug|info|warn|error")
    .option("-q, --quiet", "Quiet mode: only errors are printed")
    .argument("[source]", "Source file or directory", "./.ruleset/rules")
    .option("-o, --output <dir>", "Output directory", "./.ruleset/dist")
    .option(
      "-p, --provider <id>",
      "Specific provider to compile for (preferred)"
    )
    .option("-d, --destination <dest>", "Deprecated alias for --provider")
    .option("-w, --watch", "Watch for changes and recompile")
    .action(async (source: string, options, command) => {
      const usedDefaultSource = command.args.length === 0;
      await runCompile(source, options, usedDefaultSource);
    });
}

/** Options supported by the CLI compile command. */
type CompileOptions = {
  output: string;
  provider?: string;
  destination?: string; // Deprecated alias, kept for backwards compatibility
  watch?: boolean;
};

/**
 * Entry point for the compile command. Handles non-watch and watch flows, and
 * renders user-friendly status messages through the CLI spinner.
 */
async function runCompile(
  source: string,
  options: CompileOptions,
  usedDefaultSource: boolean
): Promise<void> {
  const spinner = createSpinner("Compiling rulesets...");
  const targetProvider = options.provider ?? options.destination;

  if (options.destination && !options.provider) {
    logger.warn(
      chalk.dim("`--destination` is deprecated; use `--provider` instead.")
    );
  }
  try {
    if (options.watch) {
      throw new Error(
        "Watch mode is temporarily unavailable while the compiler is being rewritten."
      );
    }

    const cwd = process.cwd();
    const outputDir = resolve(cwd, options.output);

    const projectConfigResult = await loadProjectConfig({ startPath: cwd });
    const configSources = projectConfigResult.config.sources ?? [];
    const hasConfiguredSources = configSources.length > 0;

    const projectSources: readonly RulesetSourceEntry[] = (() => {
      if (!usedDefaultSource) {
        return [source];
      }

      if (hasConfiguredSources) {
        return configSources;
      }

      return [source];
    })();

    const sourceSelections = resolveSourceSelections(projectSources, cwd);
    const projectRuleConfig = projectConfigResult.config.rule;
    const globalRuleGlobs = Array.isArray(projectRuleConfig?.globs)
      ? projectRuleConfig?.globs
      : undefined;
    const defaultTemplate = projectRuleConfig?.template === true;

    const fileSelections = new Map<string, SourceSelection>();
    for (const selection of sourceSelections) {
      const selectionFiles = await collectRuleFiles(selection.path, {
        globs: mergeGlobPatterns(globalRuleGlobs, selection.globs),
      });
      for (const file of selectionFiles) {
        if (!fileSelections.has(file)) {
          fileSelections.set(file, selection);
        }
      }
    }

    const files = Array.from(fileSelections.keys()).sort();
    if (files.length === 0) {
      spinner.warn(chalk.yellow("No rules files found to compile"));
      return;
    }

    const sources = await buildSources(
      files,
      cwd,
      fileSelections,
      defaultTemplate
    );
    const defaultProviders = createDefaultProviders();
    const providerIds =
      targetProvider !== undefined && targetProvider.length > 0
        ? [targetProvider]
        : defaultProviders.map((provider) => provider.handshake.providerId);
    const uniqueProviderIds = Array.from(new Set(providerIds));
    const providers = selectProviders(uniqueProviderIds, defaultProviders);

    const missingProviders = uniqueProviderIds.filter(
      (providerId) =>
        !providers.some(
          (provider) => provider.handshake.providerId === providerId
        )
    );

    if (providers.length === 0) {
      const list = uniqueProviderIds.join(", ");
      spinner.fail(
        chalk.red(
          list.length > 0
            ? `No providers found matching: ${list}`
            : "No providers available to compile with"
        )
      );
      process.exit(1);
    }

    if (missingProviders.length > 0) {
      logger.warn(
        chalk.yellow(
          `Skipping unknown provider${missingProviders.length > 1 ? "s" : ""}: ${missingProviders.join(", ")}`
        )
      );
    }

    const targets = buildTargets(outputDir, providers);
    const context = buildRuntimeContext(cwd);
    const compilationInput: CompilationInput = {
      context,
      sources,
      targets,
      projectConfig: projectConfigResult.config,
      projectConfigPath: projectConfigResult.path,
    };

    const output = await compileRulesets(compilationInput, {
      providers,
    });

    await writeArtifacts(output.artifacts, cwd);

    reportDiagnostics(output.artifacts, output.diagnostics, spinner);
  } catch (error) {
    spinner.fail(chalk.red("Failed to compile rulesets"));
    logger.error(error instanceof Error ? error : String(error));
    process.exit(1);
  }
}
// --- helpers -----------------------------------------------------------------

type CollectRuleFilesOptions = {
  globs?: readonly string[];
};

const mergeGlobPatterns = (
  ...patternLists: (readonly string[] | undefined)[]
): readonly string[] | undefined => {
  const merged = patternLists.flatMap((patterns) => patterns ?? []);
  if (merged.length === 0) {
    return;
  }
  return Array.from(new Set(merged));
};

const normalizeGlobFilter = (
  globs: readonly string[] | undefined
): ((file: string, baseDir: string) => boolean) => {
  if (!globs || globs.length === 0) {
    return () => true;
  }

  const matchers = globs.map((pattern) =>
    picomatch(pattern, { dot: true, posixSlashes: true })
  );

  return (file, baseDir) => {
    const relative =
      path.relative(baseDir, file).replace(/\\/g, "/") || path.basename(file);
    return matchers.some((matches) => matches(relative));
  };
};

async function collectRuleFiles(
  entryPath: string,
  options: CollectRuleFilesOptions = {}
): Promise<string[]> {
  const result: string[] = [];
  const filter = normalizeGlobFilter(options.globs);
  const stats = await fs.stat(entryPath).catch(() => null);
  if (!stats) {
    return result;
  }
  if (stats.isFile()) {
    if (isRuleFile(entryPath)) {
      const baseDir = path.dirname(entryPath);
      if (filter(entryPath, baseDir)) {
        result.push(entryPath);
      }
    }
    return result;
  }

  const stack = [entryPath];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith("@")) {
          stack.push(full);
        }
        continue;
      }
      if (
        entry.isFile() &&
        !entry.name.startsWith("@") &&
        isRuleFile(full) &&
        filter(full, entryPath)
      ) {
        result.push(full);
      }
    }
  }

  return result.sort();
}

type SourceSelection = {
  path: string;
  globs?: readonly string[];
  template?: boolean;
};

const resolveSourceSelections = (
  entries: readonly RulesetSourceEntry[],
  cwd: string
): SourceSelection[] =>
  entries.map((entry) => {
    if (typeof entry === "string") {
      return { path: resolve(cwd, entry) };
    }
    return {
      path: resolve(cwd, entry.path),
      globs: entry.globs,
      template: entry.template,
    };
  });

function isRuleFile(filePath: string): boolean {
  const normalized = filePath.toLowerCase();
  return (
    normalized.endsWith(".ruleset.md") ||
    normalized.endsWith(".rule.md") ||
    normalized.endsWith(".md")
  );
}

async function buildSources(
  files: string[],
  cwd: string,
  selections: Map<string, SourceSelection>,
  defaultTemplate: boolean
): Promise<RulesetSource[]> {
  const sources: RulesetSource[] = [];
  for (const file of files) {
    const contents = await fs.readFile(file, "utf8");
    const relative = path.relative(cwd, file);
    const id = relative.replace(/\\/g, "/");
    const normalized = id.toLowerCase();
    const format: RulesetSource["format"] = normalized.endsWith(".ruleset.md")
      ? "ruleset"
      : "rule";
    const selection = selections.get(file);
    const templateFlag =
      selection?.template === true || defaultTemplate === true;
    sources.push({
      id,
      path: file,
      contents,
      format,
      template: templateFlag ? true : undefined,
    });
  }
  return sources;
}

function buildTargets(
  outputDir: string,
  providers: readonly ProviderEntry[]
): CompileTarget[] {
  return providers.map((provider) => ({
    providerId: provider.handshake.providerId,
    outputPath: outputDir,
  }));
}

function buildRuntimeContext(cwd: string): RulesetRuntimeContext {
  const cacheDir = path.join(cwd, ".ruleset", "cache");
  return {
    version: RULESETS_VERSION_TAG,
    cwd,
    cacheDir,
    env: new Map(
      Object.entries(process.env).map(([key, value]) => [key, value ?? ""])
    ),
  };
}

function selectProviders(
  providerIds: readonly string[],
  defaults: readonly ProviderEntry[]
): ProviderEntry[] {
  if (providerIds.length === 0) {
    return [...defaults];
  }

  const registry = new Map(
    defaults.map((provider) => [provider.handshake.providerId, provider])
  );

  return providerIds
    .map((id) => registry.get(id))
    .filter((provider): provider is ProviderEntry => provider !== undefined);
}

async function writeArtifacts(
  artifacts: readonly CompileArtifact[],
  cwd: string
) {
  for (const artifact of artifacts) {
    const destPath = artifact.target.outputPath;
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.writeFile(destPath, artifact.contents, "utf8");
    logger.info(chalk.dim(`Wrote ${path.relative(cwd, destPath)}`));
  }
}

function reportDiagnostics(
  artifacts: readonly CompileArtifact[],
  diagnostics: readonly { level: string; message: string }[],
  spinner: { succeed: (msg: string) => void; warn: (msg: string) => void }
) {
  if (artifacts.length === 0) {
    spinner.warn(chalk.yellow("No artifacts were produced"));
  } else {
    spinner.succeed(chalk.green(`Produced ${artifacts.length} artifact(s)`));
  }

  if (diagnostics.length > 0) {
    logger.info(chalk.dim("Diagnostics:"));
    for (const diagnostic of diagnostics) {
      logger.info(`  [${diagnostic.level}] ${diagnostic.message}`);
    }
  }
}
