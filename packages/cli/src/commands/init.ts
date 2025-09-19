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
          const configPath = join(process.cwd(), '.rulesets');
          const configFile = join(configPath, 'config.json');

          await fs.mkdir(configPath, { recursive: true });

          const config = {
            version: '0.1.0',
            destinations: ['cursor', 'windsurf', 'claude-code'],
            sources: ['./rules'],
            output: './.rulesets/dist',
          };

          await fs.writeFile(configFile, JSON.stringify(config, null, 2));

          await fs.mkdir(join(process.cwd(), 'rules'), {
            recursive: true,
          });

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
            join(process.cwd(), 'rules', 'project-conventions.md'),
            exampleRule
          );

          spinner.succeed(
            chalk.green('Rulesets initialized in current project')
          );
          logger.info(chalk.dim(`Configuration: ${configFile}`));
          logger.info(
            chalk.dim('Example rule: ./rules/project-conventions.md')
          );
        }
      } catch (error) {
        spinner.fail(chalk.red('Failed to initialize Rulesets'));
        logger.error(error instanceof Error ? error : String(error));
        process.exit(1);
      }
    });
}
