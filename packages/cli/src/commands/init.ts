import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { GlobalConfig } from '@rulesets/core';
import chalk from 'chalk';
import { Command } from 'commander';
import { logger } from '../utils/logger';
import { createSpinner } from '../utils/spinner';
// import { fileURLToPath } from 'node:url';

// const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function initCommand(): Command {
  return new Command('init')
    .description('Initialize Rulesets in the current project')
    .option('--json', 'Output JSON logs for machine consumption')
    .option('--log-level <level>', 'Log level: debug|info|warn|error')
    .option('-q, --quiet', 'Quiet mode: only errors are printed')
    .option('-g, --global', 'Initialize global configuration')
    .action(async (options) => {
      const spinner = createSpinner('Initializing Rulesets...');

      try {
        if (options.global) {
          const config = await GlobalConfig.getInstance();
          await config.ensureConfigExists();

          spinner.succeed(chalk.green('Global configuration initialized'));
          logger.info(
            chalk.dim(`Configuration file: ${config.getConfigPath()}`)
          );
        } else {
          const configPath = join(process.cwd(), '.ruleset');
          const configFile = join(configPath, 'config.toml');

          await fs.mkdir(configPath, { recursive: true });

          const configToml = `version = "0.1.0"\n` +
            `sources = ["./.ruleset/rules"]\n` +
            `output = "./.ruleset/dist"\n` +
            `destinations = ["cursor", "windsurf", "claude-code"]\n`;

          await fs.writeFile(configFile, configToml);

          await fs.mkdir(join(configPath, 'rules'), { recursive: true });
          await fs.mkdir(join(configPath, 'dist'), { recursive: true });

          const exampleRule = `---
name: project-conventions
description: Project coding conventions
destinations:
  include: ["cursor", "windsurf", "claude-code"]
---

# Project Conventions

## Code Style

- Use TypeScript with strict mode enabled
- Follow ESLint and Prettier configurations
- Write comprehensive tests for all features

## Git Workflow

- Use conventional commits
- Create feature branches from main
- Write descriptive PR descriptions
`;

          await fs.writeFile(
            join(configPath, 'rules', 'project-conventions.rule.md'),
            exampleRule
          );

          spinner.succeed(
            chalk.green('Rulesets initialized in current project')
          );
          logger.info(chalk.dim(`Configuration: ${configFile}`));
          logger.info(
            chalk.dim('Example rule: ./.ruleset/rules/project-conventions.rule.md')
          );
        }
      } catch (error) {
        spinner.fail(chalk.red('Failed to initialize Rulesets'));
        logger.error(error instanceof Error ? error : String(error));
        process.exit(1);
      }
    });
}
