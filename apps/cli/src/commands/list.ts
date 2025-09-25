import { existsSync, promises as fs, type Stats } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import {
  GlobalConfig,
  loadProjectConfig,
  PresetManager,
  RulesetManager,
  sanitizePath,
} from "@rulesets/lib";
import chalk from "chalk";
import { Command } from "commander";
import picomatch from "picomatch";
import { parseFrontmatter } from "../utils/frontmatter";
import { logger } from "../utils/logger";

const SUPPORTED_SOURCE_EXTENSIONS = [".ruleset.md", ".md", ".mdc"] as const;

type ListedRuleset = {
  name?: string;
  version?: string;
  description?: string;
  destinations?: string[];
  path?: string;
  providers?: string[];
};

function hasSupportedExtension(path: string): boolean {
  const lower = path.toLowerCase();
  return SUPPORTED_SOURCE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function printGlobal(rulesets: ListedRuleset[]): void {
  if (rulesets.length === 0) {
    return;
  }
  logger.info(chalk.cyan("Global:"));
  for (const ruleset of rulesets) {
    logger.info(
      `  ${chalk.green("•")} ${chalk.bold(ruleset.name ?? "unknown")}${
        ruleset.version ? `@${ruleset.version}` : ""
      }`
    );
    if (ruleset.description) {
      logger.info(`    ${chalk.dim(ruleset.description)}`);
    }
    if (ruleset.destinations?.length) {
      logger.info(
        `    ${chalk.dim("Providers:")} ${ruleset.destinations.join(", ")}`
      );
    }
  }
  logger.info("");
}

function printLocal(rulesets: ListedRuleset[]): void {
  if (rulesets.length === 0) {
    return;
  }
  logger.info(chalk.cyan("Local:"));
  for (const ruleset of rulesets) {
    logger.info(
      `  ${chalk.green("•")} ${chalk.bold(ruleset.name ?? "unknown")}${
        ruleset.version ? `@${ruleset.version}` : ""
      }`
    );
    if (ruleset.path) {
      logger.info(
        `    ${chalk.dim("Path:")} ${relative(process.cwd(), ruleset.path)}`
      );
    }
    if (ruleset.description) {
      logger.info(`    ${chalk.dim(ruleset.description)}`);
    }
    if (ruleset.providers?.length) {
      logger.info(
        `    ${chalk.dim("Providers:")} ${ruleset.providers.join(", ")}`
      );
    } else if (ruleset.destinations?.length) {
      logger.info(
        `    ${chalk.dim("Providers:")} ${ruleset.destinations.join(", ")}`
      );
    }
  }
  logger.info("");
}

async function runList(options: {
  global?: boolean;
  local?: boolean;
  presets?: boolean;
}): Promise<void> {
  try {
    const config = await GlobalConfig.getInstance();
    const manager = new RulesetManager(config);
    const presetManager = new PresetManager(config);

    if (options.presets) {
      // Show presets information
      logger.info(chalk.bold("\nAvailable Presets:\n"));

      const availablePresets = await presetManager.listAvailablePresets();
      const installedPresets = await presetManager.getInstalledPresets();

      if (availablePresets.length === 0) {
        logger.info(chalk.yellow("No presets available"));
        logger.info(
          chalk.dim(
            "\nCreate preset files in ~/.config/ruleset/presets/ or .ruleset/presets/"
          )
        );
      } else {
        for (const preset of availablePresets) {
          const isInstalled = preset.name in installedPresets;
          const installRecord = installedPresets[preset.name];

          logger.info(
            `  ${chalk.green("•")} ${chalk.bold(preset.name)}@${preset.version}${
              isInstalled ? chalk.dim(" (installed)") : ""
            }`
          );

          if (preset.description) {
            logger.info(`    ${chalk.dim(preset.description)}`);
          }

          if (preset.author) {
            logger.info(`    ${chalk.dim("Author:")} ${preset.author}`);
          }

          if (preset.rules.length > 0) {
            const ruleNames = preset.rules.map((rule) => rule.name).join(", ");
            logger.info(
              `    ${chalk.dim("Rules:")} ${ruleNames} (${preset.rules.length} total)`
            );
          }

          if (isInstalled && installRecord) {
            const installedCount = installRecord.installedRules.length;
            const installedDate = new Date(
              installRecord.installedAt
            ).toLocaleDateString();
            logger.info(
              `    ${chalk.dim("Installed:")} ${installedCount} rules on ${installedDate}`
            );

            if (installRecord.lastUpdate) {
              const updateDate = new Date(
                installRecord.lastUpdate
              ).toLocaleDateString();
              logger.info(`    ${chalk.dim("Last updated:")} ${updateDate}`);
            }
          }

          logger.info(""); // Empty line between presets
        }
      }

      return; // Exit early when showing presets
    }

    logger.info(chalk.bold("\nInstalled Rulesets:\n"));

    const globalRulesets =
      options.global || !options.local
        ? ((await manager.listGlobalRulesets()) as ListedRuleset[])
        : [];

    const projectContext = await loadProjectConfig();
    const localRulesets =
      options.local || !options.global
        ? await discoverLocalRules(process.cwd(), projectContext)
        : [];

    if (globalRulesets.length > 0) {
      printGlobal(globalRulesets);
    }

    if (localRulesets.length > 0) {
      printLocal(localRulesets);
    }

    const allRulesets = [...globalRulesets, ...localRulesets];

    if (allRulesets.length === 0) {
      logger.info(chalk.yellow("No rulesets installed"));
      logger.info(
        chalk.dim('\nRun "rulesets install <package>" to install a ruleset')
      );
      logger.info(
        chalk.dim(
          'Or "rulesets install --preset <name>" to install from a preset'
        )
      );
      logger.info(chalk.dim('Or "rulesets init" to create a local ruleset'));
    }

    printProjectSources(projectContext);

    // Show preset summary if not explicitly showing only rulesets
    if (!(options.global || options.local)) {
      try {
        const installedPresets = await presetManager.getInstalledPresets();
        if (Object.keys(installedPresets).length > 0) {
          logger.info(chalk.bold("\nInstalled Presets:\n"));
          for (const [name, record] of Object.entries(installedPresets)) {
            logger.info(
              `  ${chalk.green("•")} ${chalk.bold(name)}@${record.presetVersion}`
            );
            if (record.installedRules.length > 0) {
              const ruleNames = record.installedRules
                .map((installedRule) => installedRule.name)
                .join(", ");
              logger.info(`    ${chalk.dim("Rules:")} ${ruleNames}`);
            }
          }
          logger.info("");
          logger.info(
            chalk.dim(
              'Run "rulesets list --presets" to see all available presets'
            )
          );
        }
      } catch {
        // Ignore preset errors when listing rulesets
      }
    }
  } catch (error) {
    logger.error(chalk.red("Failed to list rulesets"));
    logger.error(error instanceof Error ? error : String(error));
    process.exit(1);
  }
}

function createGlobMatchers(
  projectConfig: Record<string, unknown>
): picomatch.Matcher[] | undefined {
  const ruleSection = projectConfig.rule;
  if (
    !ruleSection ||
    typeof ruleSection !== "object" ||
    Array.isArray(ruleSection)
  ) {
    return;
  }

  const globs = (ruleSection as Record<string, unknown>).globs;
  if (!Array.isArray(globs)) {
    return;
  }

  const patterns = globs
    .map((value) => (typeof value === "string" ? value.trim() : null))
    .filter((value): value is string => Boolean(value && value.length > 0));

  if (patterns.length === 0) {
    return;
  }

  return patterns.map((pattern) =>
    picomatch(pattern, { dot: true, posixSlashes: true })
  );
}

async function listRuleFiles(
  resolvedSource: string,
  matchers?: picomatch.Matcher[]
): Promise<string[]> {
  const results: string[] = [];

  let stats: Stats;
  try {
    stats = await fs.stat(resolvedSource);
  } catch (error) {
    // Directory doesn't exist, return empty results
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return results;
    }
    throw error;
  }
  if (!stats.isDirectory()) {
    if (!hasSupportedExtension(resolvedSource)) {
      return results;
    }
    if (basename(resolvedSource).startsWith("@")) {
      return results;
    }
    if (matchers) {
      const rel = basename(resolvedSource);
      if (!matchers.some((matcher) => matcher(rel))) {
        return results;
      }
    }
    results.push(resolvedSource);
    return results;
  }

  const stack = [resolvedSource];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.isFile() || entry.name.startsWith("@")) {
        continue;
      }
      if (!hasSupportedExtension(full)) {
        continue;
      }
      if (matchers) {
        const rel = relative(resolvedSource, full).split(sep).join("/");
        if (!matchers.some((matcher) => matcher(rel))) {
          continue;
        }
      }
      results.push(full);
    }
  }

  return results;
}

function extractProviders(frontmatter: Record<string, unknown>): string[] {
  const providers = new Set<string>();
  for (const [key, value] of Object.entries(frontmatter)) {
    if (key === "rule" || key === "rulesets" || key === "description") {
      continue;
    }
    if (typeof value === "boolean") {
      if (value) {
        providers.add(key);
      }
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const enabled = (value as Record<string, unknown>).enabled;
      if (enabled === false) {
        continue;
      }
      providers.add(key);
    }
  }
  return Array.from(providers).sort();
}

async function discoverLocalRules(
  projectDir: string,
  projectConfigResult: Awaited<ReturnType<typeof loadProjectConfig>>
): Promise<ListedRuleset[]> {
  const projectConfig =
    projectConfigResult.config && typeof projectConfigResult.config === "object"
      ? (projectConfigResult.config as Record<string, unknown>)
      : {};

  const configuredSources = Array.isArray(projectConfig.sources)
    ? projectConfig.sources
        .map((value) => (typeof value === "string" ? value.trim() : null))
        .filter((value): value is string => Boolean(value && value.length > 0))
    : undefined;

  const candidateSources =
    configuredSources && configuredSources.length > 0
      ? configuredSources
      : ["./.ruleset/rules"];

  const matchers = createGlobMatchers(projectConfig);
  const seen = new Set<string>();
  const results: ListedRuleset[] = [];

  for (const rawSource of candidateSources) {
    const sanitized = sanitizePath(rawSource);
    const resolved = resolve(projectDir, sanitized);

    const files = await listRuleFiles(resolved, matchers);
    for (const file of files) {
      if (seen.has(file)) {
        continue;
      }
      seen.add(file);
      try {
        const content = await fs.readFile(file, "utf8");
        const { frontmatter } = parseFrontmatter(content);
        if (
          !frontmatter ||
          typeof frontmatter !== "object" ||
          Array.isArray(frontmatter)
        ) {
          continue;
        }

        const ruleSection =
          frontmatter.rule &&
          typeof frontmatter.rule === "object" &&
          !Array.isArray(frontmatter.rule)
            ? (frontmatter.rule as Record<string, unknown>)
            : undefined;

        const hasRule = Boolean(ruleSection || frontmatter.rulesets);
        if (!hasRule) {
          continue;
        }

        const nameFromRule = (
          ruleSection?.name ??
          frontmatter.name ??
          basename(file)
        ).toString();

        const info: ListedRuleset = {
          name: nameFromRule,
          version:
            typeof ruleSection?.version === "string"
              ? ruleSection.version
              : undefined,
          description:
            typeof frontmatter.description === "string"
              ? frontmatter.description
              : undefined,
          providers: extractProviders(frontmatter as Record<string, unknown>),
          path: file,
        };

        results.push(info);
      } catch {
        // Skip unreadable files
      }
    }
  }

  return results.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
}

function printProjectSources(
  projectConfigResult: Awaited<ReturnType<typeof loadProjectConfig>>
): void {
  const cwd = process.cwd();
  const projectConfig =
    projectConfigResult.config && typeof projectConfigResult.config === "object"
      ? (projectConfigResult.config as Record<string, unknown>)
      : {};

  const configuredSources = Array.isArray(projectConfig.sources)
    ? projectConfig.sources
        .map((value) => (typeof value === "string" ? value.trim() : null))
        .filter((value): value is string => Boolean(value && value.length > 0))
    : undefined;

  const sources =
    configuredSources && configuredSources.length > 0
      ? configuredSources
      : ["./.ruleset/rules"];

  logger.info(chalk.bold("Project Sources:"));
  for (const raw of new Set(sources)) {
    const sanitized = sanitizePath(raw);
    const resolved = resolve(cwd, sanitized);
    const rel = relative(cwd, resolved) || sanitized;
    const status = existsSync(resolved)
      ? chalk.green("found")
      : chalk.yellow("missing");
    logger.info(`  ${chalk.cyan(rel)} ${chalk.dim(`(${status})`)}`);
  }

  const ruleSection =
    projectConfig.rule &&
    typeof projectConfig.rule === "object" &&
    !Array.isArray(projectConfig.rule)
      ? (projectConfig.rule as Record<string, unknown>)
      : undefined;
  const globs = Array.isArray(ruleSection?.globs)
    ? ruleSection?.globs
        .map((value) => (typeof value === "string" ? value.trim() : null))
        .filter((value): value is string => Boolean(value && value.length > 0))
    : [];

  if (globs.length > 0) {
    logger.info(chalk.dim(`  rule.globs: ${globs.join(", ")}`));
  }

  if (projectConfigResult.path) {
    const readable =
      relative(cwd, projectConfigResult.path) || projectConfigResult.path;
    const suffix = projectConfigResult.format
      ? ` (${projectConfigResult.format})`
      : "";
    logger.info(chalk.dim(`  config: ${readable}${suffix}`));
  }

  logger.info("");
}

export function listCommand(): Command {
  return new Command("list")
    .description("List installed rulesets and presets")
    .option("--json", "Output JSON logs for machine consumption")
    .option("--log-level <level>", "Log level: debug|info|warn|error")
    .option("-q, --quiet", "Quiet mode: only errors are printed")
    .option("-g, --global", "List global rulesets")
    .option("-l, --local", "List local project rulesets")
    .option("-p, --presets", "List available and installed presets")
    .action(async (options) => {
      await runList(options);
    });
}
