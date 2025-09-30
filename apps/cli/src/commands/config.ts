import { loadProjectConfig, saveProjectConfig } from "@rulesets/lib";
import type { RulesetProjectConfig } from "@rulesets/types";
import chalk from "chalk";
import { Command } from "commander";
import { logger } from "../utils/logger";
import { addLoggingOptions } from "../utils/options";
import { createSpinner } from "../utils/spinner";

const NUMERIC_KEY_REGEX = /^\d+$/;
const NUMERIC_VALUE_REGEX = /^-?\d+(\.\d+)?$/;

type ConfigAction = "get" | "set" | "unset" | "list";

type ConfigOptions = {
  global?: boolean;
  configFormat?: "yaml" | "json" | "jsonc" | "toml";
};

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

export function configCommand(): Command {
  const command = new Command("config")
    .description("Get or set configuration options")
    .argument("[key]", "Configuration key (e.g., providers.cursor.enabled)")
    .argument("[value]", "Value to set (omit to get current value)")
    .option("-g, --global", "Edit global configuration (not implemented yet)")
    .option("--unset", "Remove a configuration value", false)
    .option("--list", "List all configuration values", false)
    .option(
      "--config-format <format>",
      "Config file format when creating new config",
      "yaml"
    )
    .action(
      async (
        key: string | undefined,
        value: string | undefined,
        options: ConfigOptions & { unset?: boolean; list?: boolean }
      ) => {
        if (options.global) {
          logger.error(
            chalk.red("Global configuration editing not yet implemented")
          );
          process.exit(1);
        }

        let action: ConfigAction;
        if (options.list) {
          action = "list";
        } else if (options.unset) {
          action = "unset";
        } else if (value !== undefined) {
          action = "set";
        } else {
          action = "get";
        }

        await handleConfigAction(action, key, value, options);
      }
    );

  return addLoggingOptions(command, { includeDeprecatedJsonAlias: true });
}

async function handleConfigAction(
  action: ConfigAction,
  key: string | undefined,
  value: string | undefined,
  options: ConfigOptions
): Promise<void> {
  const spinner = createSpinner("Loading configuration...");

  try {
    const configResult = await loadProjectConfig({ startPath: process.cwd() });
    spinner.stop();

    switch (action) {
      case "list": {
        await handleList(configResult.config);
        break;
      }
      case "get": {
        if (!key) {
          logger.error(chalk.red("Configuration key is required"));
          process.exit(1);
        }
        await handleGet(configResult.config, key);
        break;
      }
      case "set": {
        if (!key || value === undefined) {
          logger.error(chalk.red("Both key and value are required for set"));
          process.exit(1);
        }
        await handleSet(configResult, key, value, options);
        break;
      }
      case "unset": {
        if (!key) {
          logger.error(chalk.red("Configuration key is required"));
          process.exit(1);
        }
        await handleUnset(configResult, key, options);
        break;
      }
      default:
        // This should be unreachable
        logger.error(`Internal error: Unhandled action: ${action}`);
        process.exit(1);
    }
  } catch (error) {
    spinner.fail(chalk.red("Failed to process configuration"));
    logger.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function handleList(config: RulesetProjectConfig): void {
  logger.info(chalk.cyan("Project Configuration:"));

  const formatValue = (value: unknown, indent = "  "): void => {
    if (value === null || value === undefined) {
      return;
    }

    if (typeof value === "object" && !Array.isArray(value)) {
      for (const [k, v] of Object.entries(value)) {
        if (v === undefined || v === null) {
          continue;
        }

        if (typeof v === "object" && !Array.isArray(v)) {
          logger.info(`${indent}${chalk.green(k)}:`);
          formatValue(v, `${indent}  `);
        } else {
          logger.info(`${indent}${chalk.green(k)}: ${formatPrimitive(v)}`);
        }
      }
    } else {
      logger.info(`${indent}${formatPrimitive(value)}`);
    }
  };

  formatValue(config);
}

function formatPrimitive(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((v) => JSON.stringify(v)).join(", ")}]`;
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function handleGet(config: RulesetProjectConfig, key: string): void {
  const value = getValueByPath(config, key);

  if (value === undefined) {
    logger.info(chalk.dim(`${key}: (not set)`));
  } else {
    logger.info(`${chalk.green(key)}: ${formatPrimitive(value)}`);
  }
}

async function handleSet(
  configResult: {
    config: RulesetProjectConfig;
    path?: string;
    format?: string;
  },
  key: string,
  value: string,
  options: ConfigOptions
): Promise<void> {
  const spinner = createSpinner(`Setting ${key}...`);

  try {
    const newConfig = setValueByPath(
      configResult.config,
      key,
      parseValue(value)
    );

    await saveProjectConfig(newConfig, {
      configPath: configResult.path,
      format: options.configFormat,
      startPath: process.cwd(),
    });

    spinner.succeed(chalk.green(`Set ${key} = ${value}`));

    if (!configResult.path) {
      logger.info(
        chalk.dim(
          `Created new config file at .ruleset/config.${options.configFormat || "yaml"}`
        )
      );
    }
  } catch (error) {
    spinner.fail(chalk.red(`Failed to set ${key}`));
    throw error;
  }
}

async function handleUnset(
  configResult: {
    config: RulesetProjectConfig;
    path?: string;
    format?: string;
  },
  key: string,
  options: ConfigOptions
): Promise<void> {
  const spinner = createSpinner(`Unsetting ${key}...`);

  try {
    const newConfig = unsetValueByPath(configResult.config, key);

    await saveProjectConfig(newConfig, {
      configPath: configResult.path,
      format: options.configFormat,
      startPath: process.cwd(),
    });

    spinner.succeed(chalk.green(`Unset ${key}`));
  } catch (error) {
    spinner.fail(chalk.red(`Failed to unset ${key}`));
    throw error;
  }
}

function getValueByPath(obj: JsonObject, path: string): unknown {
  const keys = path.split(".");
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return;
    }

    // Handle array indices
    if (NUMERIC_KEY_REGEX.test(key)) {
      current = current[Number.parseInt(key, 10)];
    } else {
      current = current[key];
    }
  }

  return current;
}

function setValueByPath(
  obj: JsonObject,
  path: string,
  value: unknown
): JsonObject {
  const keys = path.split(".");
  const result = JSON.parse(JSON.stringify(obj || {})); // Deep clone

  let current = result;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];

    if (current[key] === undefined || current[key] === null) {
      // Create object or array based on next key
      const nextKey = keys[i + 1];
      current[key] = NUMERIC_KEY_REGEX.test(nextKey) ? [] : {};
    }

    current = current[key];
  }

  const lastKey = keys.at(-1);

  // Handle array indices
  if (NUMERIC_KEY_REGEX.test(lastKey)) {
    current[Number.parseInt(lastKey, 10)] = value;
  } else {
    current[lastKey] = value;
  }

  return result;
}

function unsetValueByPath(obj: JsonObject, path: string): JsonObject {
  const keys = path.split(".");
  const result = JSON.parse(JSON.stringify(obj || {})); // Deep clone

  if (keys.length === 0) {
    return result;
  }

  let current = result;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];

    if (current[key] === undefined || current[key] === null) {
      return result; // Path doesn't exist
    }

    current = current[key];
  }

  const lastKey = keys.at(-1);
  delete current[lastKey];

  return result;
}

function parseValue(value: string): unknown {
  // Try to parse as JSON first
  try {
    return JSON.parse(value);
  } catch {
    // Not JSON
  }

  // Check for boolean
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }

  // Check for number
  if (NUMERIC_VALUE_REGEX.test(value)) {
    const num = Number.parseFloat(value);
    if (!Number.isNaN(num)) {
      return num;
    }
  }

  // Check for array notation
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (inner === "") {
      return [];
    }

    return inner.split(",").map((item) => parseValue(item.trim()));
  }

  // Return as string
  return value;
}
