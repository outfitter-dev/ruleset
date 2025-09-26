import type { FSWatcher } from "node:fs";
import { promises as fsPromises, watch as watchFs } from "node:fs";
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

const DEFAULT_WATCH_DEBOUNCE_MS = 150;

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
  const cwd = process.cwd();
  const outputDir = resolve(cwd, options.output);

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

  const context = buildRuntimeContext(cwd);
  const targets = buildTargets(outputDir, providers);

  const performCompilation = async (
    phase: "initial" | "incremental"
  ): Promise<{
    directories: Set<string>;
    configWatchPaths: Set<string>;
    hadSources: boolean;
  }> => {
    const startTime = Date.now();
    const projectConfigResult = await loadProjectConfig({ startPath: cwd });
    const configWatchPaths = new Set<string>();
    if (projectConfigResult.path) {
      configWatchPaths.add(path.dirname(projectConfigResult.path));
    }

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

    const { directories, sources } = await gatherSources(
      sourceSelections,
      cwd,
      globalRuleGlobs,
      defaultTemplate
    );

    if (sources.length === 0) {
      const message = usedDefaultSource
        ? "No rules files found to compile"
        : `No matching rules found for ${source}`;
      spinner.warn(chalk.yellow(message));
      return { directories, configWatchPaths, hadSources: false };
    }

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
    reportDiagnostics(output.diagnostics);

    const duration = Date.now() - startTime;
    const summary =
      output.artifacts.length === 0
        ? "No artifacts produced"
        : `Produced ${output.artifacts.length} artifact${
            output.artifacts.length === 1 ? "" : "s"
          }`;

    if (phase === "initial") {
      spinner.succeed(chalk.green(`${summary} in ${duration}ms`));
    } else {
      spinner.succeed(chalk.green(`${summary} (watch) in ${duration}ms`));
    }

    return { directories, configWatchPaths, hadSources: true };
  };

  try {
    const initialResult = await performCompilation("initial");

    if (!options.watch) {
      return;
    }

    const normalizePath = (value: string) => path.resolve(value);

    const buildWatchPaths = (
      directories: Set<string>,
      configPaths: Set<string>
    ): Set<string> => {
      const combined = new Set<string>();
      for (const dir of directories) {
        combined.add(normalizePath(dir));
      }
      for (const configPath of configPaths) {
        combined.add(normalizePath(configPath));
      }
      return combined;
    };

    const watchManager = createWatchManager(() => triggerRecompile());

    const updateWatchers = (
      directories: Set<string>,
      configPaths: Set<string>
    ) => {
      const desired = buildWatchPaths(directories, configPaths);
      if (desired.size === 0) {
        desired.add(normalizePath(cwd));
      }
      watchManager.update(desired);
    };

    updateWatchers(initialResult.directories, initialResult.configWatchPaths);

    logger.info(chalk.dim("Watching for changes (press Ctrl+C to exit)..."));

    let rebuildInProgress = false;
    let pendingRebuild = false;

    const scheduleRecompile = () => {
      if (rebuildInProgress) {
        pendingRebuild = true;
        return;
      }

      rebuildInProgress = true;
      pendingRebuild = false;
      spinner.start("Recompiling...");

      performCompilation("incremental")
        .then((result) => {
          updateWatchers(result.directories, result.configWatchPaths);
        })
        .catch((error) => {
          spinner.fail(chalk.red("Failed to compile rulesets"));
          logger.error(error instanceof Error ? error : String(error));
        })
        .finally(() => {
          rebuildInProgress = false;
          if (pendingRebuild) {
            pendingRebuild = false;
            scheduleRecompile();
          }
        });
    };

    function triggerRecompile() {
      scheduleRecompile();
    }

    const cleanup = () => {
      watchManager.dispose();
    };

    process.once("SIGINT", () => {
      cleanup();
      process.exit(0);
    });

    await new Promise<void>(() => {
      // Keep process alive until watch mode is terminated.
    });
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
  options: CollectRuleFilesOptions = {},
  directories?: Set<string>
): Promise<string[]> {
  const result: string[] = [];
  const filter = normalizeGlobFilter(options.globs);
  const stats = await fsPromises.stat(entryPath).catch(() => null);
  if (!stats) {
    directories?.add(path.dirname(entryPath));
    return result;
  }
  if (stats.isFile()) {
    if (isRuleFile(entryPath)) {
      const baseDir = path.dirname(entryPath);
      directories?.add(baseDir);
      if (filter(entryPath, baseDir)) {
        result.push(entryPath);
      }
    }
    return result;
  }

  directories?.add(entryPath);
  const stack = [entryPath];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    directories?.add(current);
    const entries = await fsPromises.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith("@")) {
          directories?.add(full);
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
        directories?.add(path.dirname(full));
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

type GatheredSources = {
  readonly files: readonly string[];
  readonly directories: Set<string>;
  readonly sources: RulesetSource[];
};

async function gatherSources(
  selections: SourceSelection[],
  cwd: string,
  globalRuleGlobs: readonly string[] | undefined,
  defaultTemplate: boolean
): Promise<GatheredSources> {
  const fileSelections = new Map<string, SourceSelection>();
  const directories = new Set<string>();

  for (const selection of selections) {
    const selectionFiles = await collectRuleFiles(
      selection.path,
      { globs: mergeGlobPatterns(globalRuleGlobs, selection.globs) },
      directories
    );
    for (const file of selectionFiles) {
      if (!fileSelections.has(file)) {
        fileSelections.set(file, selection);
      }
    }
  }

  const files = Array.from(fileSelections.keys()).sort();
  const sources = await buildSources(
    files,
    cwd,
    fileSelections,
    defaultTemplate
  );
  return { files, directories, sources };
}

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
    const contents = await fsPromises.readFile(file, "utf8");
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
    await fsPromises.mkdir(path.dirname(destPath), { recursive: true });
    await fsPromises.writeFile(destPath, artifact.contents, "utf8");
    logger.info(chalk.dim(`Wrote ${path.relative(cwd, destPath)}`));
  }
}

function reportDiagnostics(
  diagnostics: readonly { level: string; message: string }[]
) {
  if (diagnostics.length > 0) {
    logger.info(chalk.dim("Diagnostics:"));
    for (const diagnostic of diagnostics) {
      logger.info(`  [${diagnostic.level}] ${diagnostic.message}`);
    }
  }
}

type WatchManager = {
  update(paths: Iterable<string>): void;
  dispose(): void;
};

const createWatchManager = (
  onChange: () => void,
  options: { debounceMs?: number } = {}
): WatchManager => {
  const watchers = new Map<string, FSWatcher>();
  const debounceMs = options.debounceMs ?? DEFAULT_WATCH_DEBOUNCE_MS;
  let debounceTimer: NodeJS.Timeout | undefined;

  const schedule = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      onChange();
    }, debounceMs);
  };

  const attachWatcher = (watchPath: string) => {
    if (watchers.has(watchPath)) {
      return;
    }

    try {
      const watcher = watchFs(watchPath, { recursive: false }, () => {
        schedule();
      });

      watcher.on("error", () => {
        watcher.close();
        watchers.delete(watchPath);
      });

      watchers.set(watchPath, watcher);
    } catch {
      // Ignore paths that cannot be watched (may not exist yet).
    }
  };

  const update = (paths: Iterable<string>) => {
    const desired = new Set<string>();
    for (const value of paths) {
      desired.add(value);
    }

    for (const [watchPath, watcher] of watchers) {
      if (!desired.has(watchPath)) {
        watcher.close();
        watchers.delete(watchPath);
      }
    }

    for (const watchPath of desired) {
      attachWatcher(watchPath);
    }
  };

  const dispose = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    for (const watcher of watchers.values()) {
      watcher.close();
    }
    watchers.clear();
  };

  return { update, dispose };
};
