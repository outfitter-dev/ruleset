import { GlobalHistory, type HistoryEntry } from "@ruleset/core";
import chalk from "chalk";
import { Command } from "commander";
import { logger } from "../utils/logger";
import { addLoggingOptions } from "../utils/options";

type HistoryOptions = {
  limit?: number;
  command?: string;
  project?: boolean;
  stats?: boolean;
  clear?: boolean;
};

export function historyCommand(): Command {
  const command = new Command("history")
    .description("View command history and statistics")
    .option("-l, --limit <n>", "Number of entries to show", "10")
    .option("-c, --command <cmd>", "Show history for specific command")
    .option("-p, --project", "Show history for current project only")
    .option("-s, --stats", "Show statistics instead of history")
    .option("--clear", "Clear all history")
    .action(async (options: HistoryOptions) => {
      await handleHistory(options);
    });

  return addLoggingOptions(command, { includeDeprecatedJsonAlias: true });
}

async function handleHistory(options: HistoryOptions): Promise<void> {
  const history = new GlobalHistory();

  if (!history.isEnabled()) {
    logger.info(chalk.dim("History tracking is disabled"));
    return;
  }

  try {
    // Handle clear flag
    if (options.clear) {
      await history.clearHistory();
      logger.info(chalk.green("History cleared successfully"));
      return;
    }

    // Handle stats flag
    if (options.stats) {
      await showStatistics(history);
      return;
    }

    // Show history
    const limit = Number.parseInt(String(options.limit), 10) || 10;

    let entries: HistoryEntry[];
    if (options.command) {
      entries = await history.getCommandHistory(options.command, limit);
      logger.info(chalk.cyan(`Command history for '${options.command}':\n`));
    } else if (options.project) {
      entries = await history.getProjectHistory(process.cwd(), limit);
      logger.info(chalk.cyan(`Project history for ${process.cwd()}:\n`));
    } else {
      entries = await history.getRecentHistory(limit);
      logger.info(chalk.cyan("Recent command history:\n"));
    }

    if (entries.length === 0) {
      logger.info(chalk.dim("No history entries found"));
      return;
    }

    // Display entries
    for (const entry of entries) {
      displayHistoryEntry(entry);
    }

    logger.info(
      chalk.dim(`\nShowing ${entries.length} of ${limit} requested entries`)
    );
    logger.info(chalk.dim(`History file: ${history.getHistoryPath()}`));
  } catch (error) {
    logger.error(chalk.red("Failed to access history"));
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function displayHistoryEntry(entry: HistoryEntry): void {
  const timestamp = new Date(entry.timestamp).toLocaleString();
  const icon = entry.success ? chalk.green("✓") : chalk.red("✗");
  const command = chalk.bold(entry.command);
  const args = entry.args?.length ? chalk.dim(entry.args.join(" ")) : "";

  logger.info(`${icon} [${timestamp}] ${command} ${args}`);

  if (entry.options && Object.keys(entry.options).length > 0) {
    const opts = Object.entries(entry.options)
      .map(([key, value]) => `--${key}=${value}`)
      .join(" ");
    logger.info(`  ${chalk.dim("Options:")} ${opts}`);
  }

  if (entry.duration) {
    logger.info(`  ${chalk.dim("Duration:")} ${entry.duration}ms`);
  }

  if (entry.error) {
    logger.info(`  ${chalk.red("Error:")} ${entry.error}`);
  }

  logger.info(""); // Add spacing
}

const PERCENTAGE_MULTIPLIER = 100;
const BAR_CHART_MAX_WIDTH = 20;
const COMMAND_COLUMN_WIDTH = 12;
const COUNT_COLUMN_WIDTH = 4;
const PERCENTAGE_COLUMN_WIDTH = 5;

async function showStatistics(history: GlobalHistory): Promise<void> {
  const stats = await history.getStatistics();

  logger.info(chalk.cyan.bold("Command Statistics\n"));

  logger.info(chalk.green("Summary:"));
  logger.info(`  Total commands: ${stats.totalCommands}`);
  logger.info(
    `  Success rate: ${(stats.successRate * PERCENTAGE_MULTIPLIER).toFixed(1)}%`
  );
  logger.info(`  Average duration: ${stats.averageDuration.toFixed(0)}ms\n`);

  logger.info(chalk.green("Command usage:"));
  const sortedCommands = Object.entries(stats.commandCounts).sort(
    (a, b) => b[1] - a[1]
  );

  for (const [cmd, count] of sortedCommands) {
    const percentage = (
      (count / stats.totalCommands) *
      PERCENTAGE_MULTIPLIER
    ).toFixed(1);
    const bar = "█".repeat(
      Math.round((count / stats.totalCommands) * BAR_CHART_MAX_WIDTH)
    );
    logger.info(
      `  ${chalk.bold(cmd.padEnd(COMMAND_COLUMN_WIDTH))} ${count.toString().padStart(COUNT_COLUMN_WIDTH)} (${percentage.padStart(PERCENTAGE_COLUMN_WIDTH)}%) ${chalk.dim(bar)}`
    );
  }

  if (stats.recentErrors.length > 0) {
    logger.info(chalk.red("\nRecent errors:"));
    for (const error of stats.recentErrors) {
      const timestamp = new Date(error.timestamp).toLocaleString();
      logger.info(
        `  ${chalk.red("✗")} [${timestamp}] ${error.command}: ${error.error}`
      );
    }
  }
}
