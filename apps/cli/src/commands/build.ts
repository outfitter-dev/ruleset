import { promises as fsPromises } from "node:fs";
import path, { resolve } from "node:path";

import { loadProjectConfig } from "@ruleset/core";
import {
  type CompilationEvent,
  compileRulesetsStream,
  type WatchExecutor,
  watchRulesets,
} from "@ruleset/orchestrator";
import {
  createDefaultProviders,
  type ProviderEntry,
} from "@ruleset/providers";
import {
  type CompilationInput,
  type CompilationOutput,
  type CompileArtifact,
  type CompileTarget,
  RULESETS_VERSION_TAG,
  type RulesetDiagnostic,
  type RulesetDiagnostics,
  type RulesetRuntimeContext,
  type RulesetSource,
  type RulesetSourceEntry,
} from "@ruleset/types";
import chalk from "chalk";
import { Command } from "commander";
import { collectDependencyWatchPaths } from "../utils/dependency-watch";
import { type LogLevel, logger } from "../utils/logger";
import { addLoggingOptions } from "../utils/options";
import { createSpinner } from "../utils/spinner";

const DEFAULT_WATCH_DEBOUNCE_MS = 150;

/**
 * Creates the `rules build` command. Builds source rules into provider-specific
 * artifacts and can optionally watch for changes.
 */
export function buildCommand(): Command {
  const command = new Command("build")
    .description("Build source rules to provider formats")
    .argument("[source]", "Source file or directory", "./.ruleset/rules")
    .option("-o, --output <dir>", "Output directory", "./.ruleset/dist")
    .option(
      "-p, --provider <id>",
      "Specific provider to build for (preferred)"
    )
    .option("-d, --destination <dest>", "Deprecated alias for --provider")
    .option("-w, --watch", "Watch for changes and rebuild")
    .option(
      "--write",
      "Write built artifacts to provider-specific output paths (default: only writes to dist/)"
    )
    .option(
      "--dry-run",
      "Show what would be built without writing any files"
    )
    .option("--why", "Show detailed diagnostics with explanations")
    .option("--explain", "Alias for --why, shows detailed diagnostics")
    .action(async (source: string, options, cmd) => {
      const usedDefaultSource = cmd.args.length === 0;
      await runBuild(source, options, usedDefaultSource);
    });

  return addLoggingOptions(command, { includeDeprecatedJsonAlias: true });
}

/** Options supported by the CLI build command. */
type BuildOptions = {
  output: string;
  provider?: string;
  destination?: string; // Deprecated alias, kept for backwards compatibility
  watch?: boolean;
  write?: boolean;
  dryRun?: boolean;
  why?: boolean;
  explain?: boolean;
};

/**
 * Entry point for the build command. Handles non-watch and watch flows, and
 * renders user-friendly status messages through the CLI spinner.
 */
async function runBuild(
  source: string,
  options: BuildOptions,
  usedDefaultSource: boolean
): Promise<void> {
  // Validate flag combinations
  if (options.dryRun && options.write) {
    logger.error(
      chalk.red("Cannot use --write and --dry-run together")
    );
    process.exit(1);
  }

  const spinner = createSpinner(
    options.dryRun ? "Analyzing rulesets..." : "Building rulesets..."
  );
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
          : "No providers available to build with"
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

  type PreparedBuild = {
    input: CompilationInput;
    watchRoots: Set<string>;
    hadSources: boolean;
    emptyMessage?: string;
  };

  const prepareBuild = async (): Promise<PreparedBuild> => {
    const projectConfigResult = await loadProjectConfig({ startPath: cwd });
    const configWatchPaths = new Set<string>();
    if (projectConfigResult.path) {
      configWatchPaths.add(path.dirname(projectConfigResult.path));
    }

    // Extract rules sources from config
    const configSources: readonly RulesetSourceEntry[] =
      projectConfigResult.config.sources?.rules ?? [];
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

    const dependencyRoots = collectDependencyWatchPaths({
      cwd,
      projectConfig: projectConfigResult.config,
    });

    const watchRoots = new Set<string>();
    for (const dir of directories) {
      watchRoots.add(path.resolve(dir));
    }
    for (const configPath of configWatchPaths) {
      watchRoots.add(path.resolve(configPath));
    }
    for (const dependencyRoot of dependencyRoots) {
      watchRoots.add(dependencyRoot);
    }

    const compilationInput: CompilationInput = {
      context,
      sources,
      targets,
      projectConfig: projectConfigResult.config,
      projectConfigPath: projectConfigResult.path,
    };

    const hadSources = sources.length > 0;
    let emptyMessage: string | undefined;
    if (!hadSources) {
      emptyMessage = usedDefaultSource
        ? "No rules files found to build"
        : `No matching rules found for ${source}`;
    }

    return {
      input: compilationInput,
      watchRoots,
      hadSources,
      emptyMessage,
    };
  };

  const runInitialBuild = async () => {
    const prepared = await prepareBuild();

    if (!prepared.hadSources) {
      spinner.warn(
        chalk.yellow(prepared.emptyMessage ?? "No rules files found to build")
      );
      return;
    }

    const startTime = Date.now();
    const reporter = createProgressReporter({
      spinner,
      cwd,
      phase: "initial",
    });

    const output = await runBuildWithProgress(
      prepared.input,
      { providers },
      reporter
    );

    if (!options.dryRun) {
      await writeArtifacts(output.artifacts, cwd, {
        writeToProviderPaths: options.write ?? false,
      });
    }
    const explainMode = options.why || options.explain;
    reportDiagnostics(output.diagnostics, { explain: explainMode });

    const duration = Date.now() - startTime;
    const summary =
      output.artifacts.length === 0
        ? "No artifacts produced"
        : options.dryRun
          ? `Would produce ${output.artifacts.length} artifact${
              output.artifacts.length === 1 ? "" : "s"
            }`
          : `Produced ${output.artifacts.length} artifact${
              output.artifacts.length === 1 ? "" : "s"
            }`;

    spinner.succeed(chalk.green(`${summary} in ${duration}ms`));
  };

  if (!options.watch) {
    try {
      await runInitialBuild();
    } catch (error) {
      spinner.fail(chalk.red("Failed to build rulesets"));
      logger.error(error instanceof Error ? error : String(error));
      process.exit(1);
    }
    return;
  }

  const executeWatch: WatchExecutor = async (phase, changedPaths) => {
    const prepared = await prepareBuild();
    const watchPaths = new Set<string>(prepared.watchRoots);
    if (watchPaths.size === 0) {
      watchPaths.add(cwd);
    }

    const phaseLabel =
      phase === "initial" ? "Building rulesets..." : "Rebuilding...";
    spinner.start(phaseLabel);

    const reporter = createProgressReporter({
      spinner,
      cwd,
      phase,
    });

    const startTime = Date.now();
    const output = await runBuildWithProgress(
      prepared.input,
      {
        providers,
        invalidatePaths:
          changedPaths && changedPaths.size > 0
            ? Array.from(changedPaths)
            : undefined,
      },
      reporter
    );

    if (!options.dryRun) {
      await writeArtifacts(output.artifacts, cwd, {
        writeToProviderPaths: options.write ?? false,
      });
    }
    const explainMode = options.why || options.explain;
    reportDiagnostics(output.diagnostics, { explain: explainMode });

    const duration = Date.now() - startTime;
    const summary =
      output.artifacts.length === 0
        ? "No artifacts produced"
        : options.dryRun
          ? `Would produce ${output.artifacts.length} artifact${
              output.artifacts.length === 1 ? "" : "s"
            }`
          : `Produced ${output.artifacts.length} artifact${
              output.artifacts.length === 1 ? "" : "s"
            }`;

    if (!prepared.hadSources) {
      spinner.warn(
        chalk.yellow(prepared.emptyMessage ?? "No rules files found to build")
      );
    } else if (phase === "initial") {
      spinner.succeed(chalk.green(`${summary} in ${duration}ms`));
    } else {
      spinner.succeed(chalk.green(`${summary} (watch) in ${duration}ms`));
    }

    return {
      output,
      watchPaths: Array.from(watchPaths),
    };
  };

  const iterator = watchRulesets(executeWatch, {
    debounceMs: DEFAULT_WATCH_DEBOUNCE_MS,
  })[Symbol.asyncIterator]();

  let iteratorClosed = false;
  const stopIterator = async () => {
    if (iteratorClosed) {
      return;
    }
    iteratorClosed = true;
    if (typeof iterator.return === "function") {
      try {
        await iterator.return();
      } catch {
        // ignore iterator return errors during shutdown
      }
    }
    spinner.stop();
  };

  process.once("SIGINT", () => {
    stopIterator().finally(() => {
      process.exit(0);
    });
  });

  logger.info(chalk.dim("Watching for changes (press Ctrl+C to exit)..."));

  try {
    while (true) {
      const { done } = await iterator.next();
      if (done) {
        break;
      }
    }
  } catch (error) {
    await stopIterator();
    spinner.fail(chalk.red("Failed to build rulesets"));
    logger.error(error instanceof Error ? error : String(error));
    process.exit(1);
  }

  await stopIterator();
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

  const matchers = globs.map((pattern) => new Bun.Glob(pattern));

  return (file, baseDir) => {
    const relative =
      path.relative(baseDir, file).replace(/\\/g, "/") || path.basename(file);
    return matchers.some((glob) => glob.match(relative));
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

type BuildProgressReporter = {
  handle(event: CompilationEvent): Promise<void> | void;
  complete(): void;
};

type BuildRunOptions = {
  providers: readonly ProviderEntry[];
  invalidatePaths?: readonly string[];
};

const LOG_LEVEL_ORDER: readonly LogLevel[] = [
  "debug",
  "info",
  "warn",
  "error",
] as const;

const levelIndex = (level: LogLevel): number => LOG_LEVEL_ORDER.indexOf(level);

const resolveLogLevel = (): LogLevel => {
  const raw = (process.env.RULESETS_LOG_LEVEL ?? "").toLowerCase();
  return raw === "debug" || raw === "info" || raw === "warn" || raw === "error"
    ? (raw as LogLevel)
    : "info";
};

type DiagnosticCounts = {
  error: number;
  warning: number;
  info: number;
};

const summarizeDiagnosticsCounts = (
  diagnostics: RulesetDiagnostics | undefined
): DiagnosticCounts | undefined => {
  if (!diagnostics || diagnostics.length === 0) {
    return;
  }
  const counts: DiagnosticCounts = { error: 0, warning: 0, info: 0 };
  for (const diagnostic of diagnostics) {
    counts[diagnostic.level] += 1;
  }
  return counts;
};

const diagnosticsCountsToText = (
  counts: DiagnosticCounts | undefined
): string | undefined => {
  if (!counts) {
    return;
  }
  const parts: string[] = [];
  if (counts.error > 0) {
    parts.push(`${counts.error} error${counts.error === 1 ? "" : "s"}`);
  }
  if (counts.warning > 0) {
    parts.push(`${counts.warning} warning${counts.warning === 1 ? "" : "s"}`);
  }
  if (counts.info > 0) {
    parts.push(`${counts.info} info${counts.info === 1 ? "" : "s"}`);
  }
  return parts.join(", ") || undefined;
};

type ProgressReporterOptions = {
  spinner: ReturnType<typeof createSpinner>;
  cwd: string;
  phase: "initial" | "incremental";
};

const runBuildWithProgress = async (
  input: CompilationInput,
  options: BuildRunOptions,
  reporter: BuildProgressReporter
): Promise<CompilationOutput> => {
  let finalOutput: CompilationOutput | undefined;
  try {
    for await (const event of compileRulesetsStream(input, options)) {
      await reporter.handle(event);
      if (event.kind === "pipeline:end") {
        finalOutput = event.output;
      }
    }
  } finally {
    reporter.complete();
  }

  return (
    finalOutput ?? {
      artifacts: [],
      diagnostics: [],
    }
  );
};

const createProgressReporter = ({
  spinner,
  cwd,
  phase,
}: ProgressReporterOptions): BuildProgressReporter => {
  const logLevel = resolveLogLevel();
  const infoEnabled = levelIndex(logLevel) <= levelIndex("info");
  const debugEnabled = logLevel === "debug";
  const jsonMode = process.env.RULESETS_LOG_FORMAT === "json";
  let pipelineStartTimestamp = Date.now();

  const toRelative = (value: string | undefined): string | undefined => {
    if (!value) {
      return;
    }
    const relative = path.relative(cwd, value);
    const normalized = relative.length === 0 ? "./" : relative;
    return normalized.replace(/\\/g, "/");
  };

  const describeSource = (source: RulesetSource): string =>
    source.id || toRelative(source.path) || "(anonymous source)";

  const describeTarget = (target: CompileTarget): string => target.providerId;

  const serializeSource = (source: RulesetSource) => ({
    id: source.id,
    path: toRelative(source.path),
    template: source.template === true ? true : undefined,
  });

  const serializeTarget = (target: CompileTarget) => ({
    providerId: target.providerId,
    outputPath: toRelative(target.outputPath),
    capabilities: target.capabilities,
  });

  const serializeArtifact = (artifact: CompileArtifact | undefined) => {
    if (!artifact) {
      return;
    }
    return {
      target: serializeTarget(artifact.target),
      diagnostics: artifact.diagnostics,
    };
  };

  const toSerializableEvent = (event: CompilationEvent) => {
    const base = { kind: event.kind, phase } as Record<string, unknown>;
    switch (event.kind) {
      case "pipeline:start":
        return {
          ...base,
          timestamp: event.timestamp,
        };
      case "pipeline:end":
        return {
          ...base,
          timestamp: event.timestamp,
          durationMs: event.timestamp - pipelineStartTimestamp,
          artifactCount: event.output.artifacts.length,
          diagnosticsCount: event.output.diagnostics.length,
        };
      case "source:start":
        return {
          ...base,
          source: serializeSource(event.source),
        };
      case "source:parsed":
      case "source:validated":
      case "source:transformed":
        return {
          ...base,
          source: serializeSource(event.source),
          diagnostics: event.diagnostics,
          diagnosticsSummary: summarizeDiagnosticsCounts(event.diagnostics),
        };
      case "target:start":
        return {
          ...base,
          source: serializeSource(event.source),
          target: serializeTarget(event.target),
        };
      case "target:capabilities":
        return {
          ...base,
          source: serializeSource(event.source),
          target: serializeTarget(event.target),
          required: event.required,
        };
      case "target:cached":
        return {
          ...base,
          source: serializeSource(event.source),
          target: serializeTarget(event.target),
          cached: true,
          artifact: serializeArtifact(event.artifact),
        };
      case "target:rendered":
      case "target:compiled":
        return {
          ...base,
          source: serializeSource(event.source),
          target: serializeTarget(event.target),
          ok: event.ok,
          diagnostics: event.diagnostics,
          diagnosticsSummary: summarizeDiagnosticsCounts(event.diagnostics),
          artifact: serializeArtifact(event.artifact),
        };
      case "target:skipped":
        return {
          ...base,
          source: serializeSource(event.source),
          target: serializeTarget(event.target),
          reason: event.reason,
          diagnostics: event.diagnostics,
          missingCapabilities: event.missingCapabilities,
        };
      case "artifact:emitted":
        return {
          ...base,
          source: serializeSource(event.source),
          artifact: serializeArtifact(event.artifact),
        };
      default:
        return base;
    }
  };

  const emitStructured = (payload: Record<string, unknown>) => {
    if (jsonMode && infoEnabled) {
      process.stdout.write(
        `${JSON.stringify({
          level: "info",
          ts: new Date().toISOString(),
          event: payload,
        })}\n`
      );
    } else if (!jsonMode && debugEnabled) {
      logger.debug(chalk.dim(`[event] ${JSON.stringify(payload)}`));
    }
  };

  const logInfo = (message: string) => {
    if (infoEnabled && !jsonMode) {
      logger.info(message);
    }
  };

  return {
    handle(event) {
      if (event.kind === "pipeline:start") {
        pipelineStartTimestamp = event.timestamp;
      }

      const payload = toSerializableEvent(event);
      emitStructured(payload);

      switch (event.kind) {
        case "pipeline:start": {
          const baseText =
            phase === "initial"
              ? "Scanning sources..."
              : "Scanning for changes...";
          spinner.text = baseText;
          break;
        }
        case "source:start": {
          const label = describeSource(event.source);
          spinner.text = `Reading ${label}`;
          break;
        }
        case "source:parsed": {
          const label = describeSource(event.source);
          spinner.text = `Parsed ${label}`;
          if (!jsonMode && debugEnabled) {
            const summary = diagnosticsCountsToText(
              summarizeDiagnosticsCounts(event.diagnostics)
            );
            if (summary) {
              logger.debug(chalk.dim(`[parse] ${label} (${summary})`));
            }
          }
          break;
        }
        case "source:validated": {
          const label = describeSource(event.source);
          spinner.text = `Validated ${label}`;
          break;
        }
        case "source:transformed": {
          const label = describeSource(event.source);
          spinner.text = `Transformed ${label}`;
          break;
        }
        case "target:start": {
          const label = `${describeSource(event.source)} → ${describeTarget(event.target)}`;
          spinner.text = `Building ${label}`;
          break;
        }
        case "target:capabilities": {
          const label = `${describeSource(event.source)} → ${describeTarget(event.target)}`;
          spinner.text = `Checking capabilities ${label}`;
          break;
        }
        case "target:cached": {
          const label = `${describeSource(event.source)} → ${describeTarget(event.target)}`;
          spinner.text = `Cache hit ${label}`;
          const summary = diagnosticsCountsToText(
            summarizeDiagnosticsCounts(event.artifact?.diagnostics)
          );
          const message = summary ? `${label} (${summary})` : label;
          logInfo(chalk.cyan(`Cache hit ${message}`));
          break;
        }
        case "target:rendered": {
          const label = `${describeSource(event.source)} → ${describeTarget(event.target)}`;
          spinner.text = `Rendered ${label}`;
          if (!jsonMode && debugEnabled) {
            const summary = diagnosticsCountsToText(
              summarizeDiagnosticsCounts(event.diagnostics)
            );
            if (summary) {
              logger.debug(chalk.dim(`[render] ${label} (${summary})`));
            }
          }
          break;
        }
        case "target:compiled": {
          const label = `${describeSource(event.source)} → ${describeTarget(event.target)}`;
          const summary = diagnosticsCountsToText(
            summarizeDiagnosticsCounts(event.diagnostics)
          );
          const message = summary ? `${label} (${summary})` : label;
          if (event.ok) {
            spinner.text = `Built ${label}`;
            logInfo(chalk.green(`Built ${message}`));
          } else {
            spinner.text = `Failed ${label}`;
            logger.error(chalk.red(`Provider failed ${message}`));
          }
          break;
        }
        case "target:skipped": {
          const label = `${describeSource(event.source)} → ${describeTarget(event.target)}`;
          spinner.text = `Skipped ${label}`;
          const reason = event.reason.replace(/-/g, " ");
          logger.warn(chalk.yellow(`Skipped ${label}: ${reason}`));
          if (
            event.missingCapabilities &&
            event.missingCapabilities.length > 0
          ) {
            logger.warn(
              chalk.yellow(
                `Missing capabilities: ${event.missingCapabilities.join(", ")}`
              )
            );
          }
          break;
        }
        case "artifact:emitted": {
          const label = `${describeSource(
            event.source
          )} → ${describeTarget(event.artifact.target)}`;
          spinner.text = `Emitted ${label}`;
          if (!jsonMode && debugEnabled) {
            logger.debug(chalk.dim(`[artifact] ${label}`));
          }
          break;
        }
        case "pipeline:end": {
          spinner.text = "Finalizing build";
          break;
        }
        default:
          break;
      }
    },
    complete() {
      // Placeholder for future cleanup hooks.
    },
  };
};

type WriteArtifactsOptions = {
  writeToProviderPaths: boolean;
};

async function writeArtifacts(
  artifacts: readonly CompileArtifact[],
  cwd: string,
  options: WriteArtifactsOptions
) {
  const distDir = path.resolve(cwd, ".ruleset", "dist");

  for (const artifact of artifacts) {
    const destPath = artifact.target.outputPath;
    const isInDistDir = path.resolve(destPath).startsWith(distDir);

    // Always write staging artifacts (in .ruleset/dist/)
    // Only write canonical artifacts (outside .ruleset/dist/) if --write is enabled
    if (isInDistDir || options.writeToProviderPaths) {
      await fsPromises.mkdir(path.dirname(destPath), { recursive: true });
      await fsPromises.writeFile(destPath, artifact.contents, "utf8");

      const relativePath = path.relative(cwd, destPath);
      const label = isInDistDir ? "staged" : "wrote";
      logger.info(chalk.dim(`${label}: ${relativePath}`));
    } else {
      const relativePath = path.relative(cwd, destPath);
      logger.info(chalk.dim(`skipped: ${relativePath} (use --write to output)`));
    }
  }
}

function getDiagnosticIcon(level: RulesetDiagnostic["level"]): string {
  if (level === "error") {
    return "✗";
  }
  if (level === "warning") {
    return "⚠";
  }
  return "ℹ";
}

function getDiagnosticColor(level: RulesetDiagnostic["level"]) {
  if (level === "error") {
    return chalk.red;
  }
  if (level === "warning") {
    return chalk.yellow;
  }
  return chalk.blue;
}

function reportDiagnostics(
  diagnostics: readonly RulesetDiagnostic[],
  options?: { explain?: boolean }
) {
  if (diagnostics.length === 0) {
    return;
  }

  const explain = options?.explain ?? false;

  if (explain) {
    // Detailed output with explanations
    logger.info(chalk.cyan.bold("\n═══ Detailed Diagnostics ═══\n"));

    let count = 0;
    for (const diagnostic of diagnostics) {
      count++;
      const icon = getDiagnosticIcon(diagnostic.level);
      const levelColor = getDiagnosticColor(diagnostic.level);

      logger.info(
        levelColor.bold(
          `${icon} [${diagnostic.level.toUpperCase()}] ${diagnostic.message}`
        )
      );

      if (diagnostic.location) {
        logger.info(
          chalk.dim(
            `   Location: line ${diagnostic.location.line}, column ${diagnostic.location.column}`
          )
        );
      }

      if (diagnostic.hint) {
        logger.info(chalk.green(`   💡 Hint: ${diagnostic.hint}`));
      }

      if (diagnostic.tags && diagnostic.tags.length > 0) {
        logger.info(chalk.dim(`   Tags: ${diagnostic.tags.join(", ")}`));
      }

      // Add explanations based on common diagnostic patterns
      const explanation = getExplanation(diagnostic);
      if (explanation) {
        logger.info(chalk.cyan(`   ℹ️  Explanation: ${explanation}`));
      }

      if (count < diagnostics.length) {
        logger.info(""); // Add space between diagnostics
      }
    }

    logger.info(chalk.cyan.bold("\n═══════════════════════════\n"));

    // Summary
    const errors = diagnostics.filter((d) => d.level === "error").length;
    const warnings = diagnostics.filter((d) => d.level === "warning").length;
    const info = diagnostics.filter((d) => d.level === "info").length;

    const summary: string[] = [];
    if (errors > 0) {
      summary.push(chalk.red(`${errors} error${errors === 1 ? "" : "s"}`));
    }
    if (warnings > 0) {
      summary.push(
        chalk.yellow(`${warnings} warning${warnings === 1 ? "" : "s"}`)
      );
    }
    if (info > 0) {
      summary.push(chalk.blue(`${info} info message${info === 1 ? "" : "s"}`));
    }

    if (summary.length > 0) {
      logger.info(`Summary: ${summary.join(", ")}`);
    }
  } else {
    // Simple output
    logger.info(chalk.dim("Diagnostics:"));
    for (const diagnostic of diagnostics) {
      const icon = getDiagnosticIcon(diagnostic.level);
      const color = getDiagnosticColor(diagnostic.level);
      logger.info(`  ${color(icon)} ${diagnostic.message}`);
    }
  }
}

/**
 * Generate explanations for common diagnostic patterns
 */
function getExplanation(diagnostic: RulesetDiagnostic): string | undefined {
  const message = diagnostic.message.toLowerCase();

  if (message.includes("capability") && message.includes("missing")) {
    return "The provider doesn't support this feature. Consider using a different provider or disabling this capability requirement.";
  }

  if (message.includes("frontmatter") || message.includes("yaml")) {
    return "There's an issue with the YAML frontmatter at the top of your rule file. Check for syntax errors like incorrect indentation or missing colons.";
  }

  if (message.includes("handlebars") || message.includes("template")) {
    return "This error relates to Handlebars template processing. Ensure all variables are defined and template syntax is correct.";
  }

  if (message.includes("partial") && message.includes("not found")) {
    return "The referenced partial file doesn't exist in .ruleset/partials/. Create the file or check the partial name for typos.";
  }

  if (message.includes("provider") && message.includes("unknown")) {
    return "The specified provider isn't recognized. Check available providers with 'rules list --providers' or verify the provider ID.";
  }

  if (message.includes("permission") || message.includes("access denied")) {
    return "The operation requires write permissions. Check that you have access to modify files in the target directory.";
  }

  if (message.includes("syntax") || message.includes("parse")) {
    return "There's a syntax error in your rule file. Review the file for unclosed tags, mismatched brackets, or invalid Markdown.";
  }

  if (message.includes("validation") || message.includes("schema")) {
    return "The configuration doesn't match the expected schema. Refer to the documentation for the correct structure.";
  }

  if (message.includes("dependency") || message.includes("import")) {
    return "There's an issue with file dependencies or imports. Ensure all referenced files exist and paths are correct.";
  }

  return;
}
