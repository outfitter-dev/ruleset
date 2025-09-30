import {
  GlobalConfig,
  InstallationManager,
  PresetManager,
} from "@rulesets/lib";
import chalk from "chalk";
import { Command } from "commander";
import { logger } from "../utils/logger";
import { addLoggingOptions } from "../utils/options";
import { createSpinner } from "../utils/spinner";

export function installCommand(): Command {
  const command = new Command("install")
    .description(
      "Install a ruleset from npm/GitHub or install rules from a preset"
    )
    .argument(
      "[package]",
      "Package name, GitHub URL, or preset name (when using --preset)"
    )
    .option("-g, --global", "Install globally")
    .option("-d, --dev", "Save as development dependency")
    .option("--preset", "Install rules from a preset instead of a package")
    .option(
      "--overwrite",
      "Overwrite existing rule files when installing from preset"
    )
    .option(
      "--target-dir <path>",
      "Target directory for preset rules (default: .ruleset/rules)"
    )
    .action(async (packageName: string | undefined, options) => {
      await runInstallCommand(packageName, options);
    });

  return addLoggingOptions(command, { includeDeprecatedJsonAlias: true });
}

type InstallCommandOptions = {
  global?: boolean;
  dev?: boolean;
  preset?: boolean;
  overwrite?: boolean;
  targetDir?: string;
};

async function runInstallCommand(
  packageName: string | undefined,
  options: InstallCommandOptions
): Promise<void> {
  const resolvedName = ensurePackageName(packageName);

  if (options.preset) {
    await installFromPreset(resolvedName, options);
    return;
  }

  await installFromRegistry(resolvedName, options);
}

function ensurePackageName(name: string | undefined): string {
  if (!name || name.trim().length === 0) {
    logger.error("Package name or preset name is required");
    process.exit(1);
  }

  return name.trim();
}

async function installFromPreset(
  presetName: string,
  options: InstallCommandOptions
): Promise<void> {
  const spinner = createSpinner(`Installing preset '${presetName}'...`);

  try {
    const config = GlobalConfig.getInstance();
    const presetManager = new PresetManager(config);
    const result = await presetManager.installPreset(presetName, {
      targetDir: options.targetDir,
      overwrite: options.overwrite,
      logger,
    });

    spinner.succeed(
      chalk.green(
        `Successfully installed preset '${presetName}' (${result.presetVersion})`
      )
    );

    const ruleNames = extractRuleNames(result.installedRules);
    if (ruleNames.length > 0) {
      logger.info(chalk.dim(`Rules installed: ${ruleNames.join(", ")}`));
      logger.info(
        chalk.dim(`Target directory: ${options.targetDir || ".ruleset/rules"}`)
      );
    }
  } catch (error) {
    spinner.fail(chalk.red(`Failed to install preset '${presetName}'`));
    reportFailure(error);
  }
}

async function installFromRegistry(
  packageName: string,
  options: InstallCommandOptions
): Promise<void> {
  const spinner = createSpinner(`Installing ${packageName}...`);

  try {
    const config = GlobalConfig.getInstance();
    const installer = new InstallationManager(config);

    const result = await installer.installRuleset(packageName, {
      global: options.global,
      dev: options.dev,
    });

    spinner.succeed(chalk.green(`Successfully installed ${packageName}`));

    if (Array.isArray(result.destinations) && result.destinations.length > 0) {
      logger.info(chalk.dim(`Providers: ${result.destinations.join(", ")}`));
    }

    if (Array.isArray(result.rules) && result.rules.length > 0) {
      logger.info(chalk.dim(`Rules: ${result.rules.join(", ")}`));
    }
  } catch (error) {
    spinner.fail(chalk.red(`Failed to install ${packageName}`));
    reportFailure(error);
  }
}

function extractRuleNames(rules: unknown[]): string[] {
  const names: string[] = [];

  for (const rule of rules) {
    if (typeof rule !== "object" || rule === null || !("name" in rule)) {
      continue;
    }

    const value = (rule as { name?: unknown }).name;
    if (typeof value === "string" && value.trim().length > 0) {
      names.push(value);
    }
  }

  return names;
}

function reportFailure(error: unknown): void {
  logger.error(error instanceof Error ? error : new Error(String(error)));
  process.exit(1);
}
