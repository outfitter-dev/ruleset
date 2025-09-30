import { GlobalConfig, PresetManager } from "@rulesets/lib";
import chalk from "chalk";
import { Command } from "commander";
import { logger } from "../utils/logger";
import { addLoggingOptions } from "../utils/options";
import { createSpinner } from "../utils/spinner";

export function updateCommand(): Command {
  const command = new Command("update")
    .description("Update installed preset rules to their latest versions")
    .option(
      "--write-back",
      "Force update even if versions match (re-download rules)"
    )
    .argument(
      "[presets...]",
      "Specific preset names to update (default: update all)"
    )
    .action(async (presetNames: string[], options) => {
      const spinner = createSpinner("Updating presets...");

      try {
        const config = await GlobalConfig.getInstance();
        const presetManager = new PresetManager(config);

        const result = await presetManager.updatePresets({
          presetNames: presetNames.length > 0 ? presetNames : undefined,
          writeBack: options.writeBack,
          logger,
        });

        if (result.updated.length > 0) {
          spinner.succeed(
            chalk.green(
              `Successfully updated ${result.updated.length} preset(s)`
            )
          );

          for (const record of result.updated) {
            logger.info(
              `  ${chalk.green("•")} ${chalk.bold(record.presetName)} (${record.presetVersion})`
            );
            if (record.installedRules.length > 0) {
              const ruleNames = record.installedRules
                .map((installedRule) => installedRule.name)
                .join(", ");
              logger.info(`    ${chalk.dim("Rules:")} ${ruleNames}`);
            }
          }
        } else {
          spinner.succeed(chalk.yellow("No presets needed updating"));
        }

        if (result.skipped.length > 0) {
          logger.info(chalk.dim(`Skipped: ${result.skipped.join(", ")}`));
        }

        if (result.errors.length > 0) {
          logger.warn(
            chalk.yellow(`${result.errors.length} error(s) encountered:`)
          );
          for (const error of result.errors) {
            logger.error(`  ${chalk.red("✗")} ${error.preset}: ${error.error}`);
          }
        }

        // Exit with error code if all updates failed
        if (result.updated.length === 0 && result.errors.length > 0) {
          process.exit(1);
        }
      } catch (error) {
        spinner.fail(chalk.red("Failed to update presets"));
        logger.error(error instanceof Error ? error : String(error));
        process.exit(1);
      }
    });

  return addLoggingOptions(command, { includeDeprecatedJsonAlias: true });
}
