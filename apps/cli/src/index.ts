#!/usr/bin/env bun
import { Command } from "commander";
import { compileCommand } from "./commands/compile.js";
import { configCommand } from "./commands/config.js";
import { historyCommand } from "./commands/history.js";
import { importCommand } from "./commands/import.js";
import { initCommand } from "./commands/init.js";
import { installCommand } from "./commands/install.js";
import { listCommand } from "./commands/list.js";
import { promoteCommand } from "./commands/promote.js";
// import { syncCommand } from './commands/sync.js'; // Disabled for v0.2.0
import { updateCommand } from "./commands/update.js";
import { withHistoryTracking } from "./utils/history.js";
import { addLoggingOptions } from "./utils/options.js";

// Pre-parse global flags anywhere in argv for env setup
const findOptionValue = (argv: string[], flag: string): string | undefined => {
  const direct = argv.indexOf(flag);
  if (direct !== -1 && argv[direct + 1]) {
    return argv[direct + 1];
  }
  const withEquals = argv.find((arg) => arg.startsWith(`${flag}=`));
  if (withEquals) {
    const [, value = ""] = withEquals.split("=", 2);
    return value.length > 0 ? value : undefined;
  }
  return;
};

function preParseGlobalFlags(argv: string[]) {
  const format = findOptionValue(argv, "--format");
  if (format) {
    process.env.RULESETS_LOG_FORMAT = format;
  } else if (argv.includes("--json")) {
    process.env.RULESETS_LOG_FORMAT = "json";
  }

  if (argv.includes("--quiet") || argv.includes("-q")) {
    process.env.RULESETS_LOG_LEVEL = "error";
  }

  const logLevel = findOptionValue(argv, "--log-level");
  if (logLevel) {
    process.env.RULESETS_LOG_LEVEL = logLevel;
  }
}

preParseGlobalFlags(process.argv.slice(2));

const program = new Command()
  .name("rules")
  .description("AI rules compiler - manage and compile rules for AI tools")
  .version("0.2.0")
  .enablePositionalOptions();

addLoggingOptions(program, {
  includeDefaultFormat: true,
});

program.hook("preAction", (thisCommand) => {
  const opts = thisCommand.optsWithGlobals();
  // Only apply if provided explicitly on CLI (not defaults)
  const getSrc = (
    thisCommand as unknown as {
      getOptionValueSource?: (name: string) => string | undefined;
    }
  ).getOptionValueSource;
  const src = (name: string) =>
    typeof getSrc === "function" ? getSrc.call(thisCommand, name) : undefined;

  const formatSrc = src("format");
  if (opts.format && formatSrc === "cli") {
    process.env.RULESETS_LOG_FORMAT = opts.format;
  }

  if (opts.json && src("json") === "cli") {
    process.env.RULESETS_LOG_FORMAT = "json";
  }
  if (opts.logLevel && src("logLevel") === "cli") {
    process.env.RULESETS_LOG_LEVEL = opts.logLevel;
  }
  if (opts.quiet && src("quiet") === "cli") {
    process.env.RULESETS_LOG_LEVEL = "error";
  }
});

// Add commands with history tracking
program.addCommand(withHistoryTracking(initCommand()));
program.addCommand(withHistoryTracking(installCommand()));
program.addCommand(withHistoryTracking(updateCommand()));
// program.addCommand(syncCommand()); // Disabled for v0.2.0
program.addCommand(withHistoryTracking(importCommand()));
program.addCommand(withHistoryTracking(promoteCommand()));
program.addCommand(withHistoryTracking(listCommand()));
program.addCommand(withHistoryTracking(configCommand()));
program.addCommand(withHistoryTracking(compileCommand()));
program.addCommand(historyCommand()); // History command doesn't track itself

program.parse();
