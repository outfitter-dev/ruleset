#!/usr/bin/env bun
import { Command } from 'commander';
import { compileCommand } from './commands/compile.js';
import { initCommand } from './commands/init.js';
import { importCommand } from './commands/import.js';
import { installCommand } from './commands/install.js';
import { listCommand } from './commands/list.js';
import { promoteCommand } from './commands/promote.js';
// import { syncCommand } from './commands/sync.js'; // Disabled for v0.2.0
import { updateCommand } from './commands/update.js';

// Pre-parse global flags anywhere in argv for env setup
function preParseGlobalFlags(argv: string[]) {
  // Recognize --json (and allow --no-json to disable)
  if (argv.includes('--json')) {
    process.env.RULESETS_LOG_FORMAT = 'json';
  }
  // Recognize --quiet to minimize logs
  if (argv.includes('--quiet') || argv.includes('-q')) {
    process.env.RULESETS_LOG_LEVEL = 'error';
  }
  // Recognize --log-level <level>
  const idx = argv.indexOf('--log-level');
  if (idx !== -1 && argv[idx + 1]) {
    process.env.RULESETS_LOG_LEVEL = argv[idx + 1];
  }
}

preParseGlobalFlags(process.argv.slice(2));

const program = new Command();

program
  .name('rulesets')
  .description('AI rules compiler - manage and compile rulesets for AI tools')
  .version('0.2.0')
  .option('--json', 'Output JSON logs for machine consumption', false)
  .option('--log-level <level>', 'Log level: debug|info|warn|error', 'info')
  .option('-q, --quiet', 'Quiet mode: only errors are printed', false)
  .enablePositionalOptions();

program.hook('preAction', (thisCommand) => {
  const opts = thisCommand.optsWithGlobals();
  // Only apply if provided explicitly on CLI (not defaults)
  const getSrc = (
    thisCommand as unknown as {
      getOptionValueSource?: (name: string) => string | undefined;
    }
  ).getOptionValueSource;
  const src = (name: string) =>
    typeof getSrc === 'function' ? getSrc.call(thisCommand, name) : undefined;

  if (opts.json && src('json') === 'cli') {
    process.env.RULESETS_LOG_FORMAT = 'json';
  }
  if (opts.logLevel && src('logLevel') === 'cli') {
    process.env.RULESETS_LOG_LEVEL = opts.logLevel;
  }
  if (opts.quiet && src('quiet') === 'cli') {
    process.env.RULESETS_LOG_LEVEL = 'error';
  }
});

program.addCommand(initCommand());
program.addCommand(installCommand());
program.addCommand(updateCommand());
// program.addCommand(syncCommand()); // Disabled for v0.2.0
program.addCommand(importCommand());
program.addCommand(promoteCommand());
program.addCommand(listCommand());
program.addCommand(compileCommand());

program.parse();
