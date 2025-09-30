import { promises as fs } from "node:fs";
import path from "node:path";
import TOML from "@iarna/toml";
import { load as yamlLoad } from "js-yaml";
import JSON5 from "json5";
import {
  RULESET_SCHEMA_IDS,
  rulesetProjectConfigSchema,
  type RulesetProjectConfig,
} from "@rulesets/types";

export type ProjectConfigFormat = "yaml" | "json" | "jsonc" | "toml";

type RawProjectConfig = Record<string, unknown>;

export type ProjectConfig = RulesetProjectConfig;

export type ProjectConfigResult = {
  /** Absolute path to the resolved configuration file (if found). */
  path?: string;
  /** The format derived from the file extension. */
  format?: ProjectConfigFormat;
  /** Parsed configuration object (falls back to empty object). */
  config: ProjectConfig;
};

export type LoadProjectConfigOptions = {
  /** Starting directory or file from which to locate `.ruleset/`. Defaults to `process.cwd()`. */
  startPath?: string;
  /** Explicit path to a configuration file. Bypasses discovery when provided. */
  configPath?: string;
};

type Candidate = {
  filename: string;
  format: ProjectConfigFormat;
};

const DEFAULT_CANDIDATES: readonly Candidate[] = [
  { filename: "config.yaml", format: "yaml" },
  { filename: "config.yml", format: "yaml" },
  { filename: "config.json", format: "json" },
  { filename: "config.jsonc", format: "jsonc" },
  { filename: "config.toml", format: "toml" },
];

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

async function findRulesetRoot(startPath: string): Promise<string | undefined> {
  let current = path.resolve(startPath);
  const stats = await fs.stat(current).catch(() => undefined);
  if (stats?.isFile()) {
    current = path.dirname(current);
  }

  const root = path.parse(current).root;

  while (true) {
    const candidate = path.join(current, ".ruleset");
    const exists = await fs
      .stat(candidate)
      .then((stat) => stat.isDirectory())
      .catch(() => false);
    if (exists) {
      return current;
    }
    if (current === root) {
      return;
    }
    current = path.dirname(current);
  }
}

function ensurePlainObject(value: unknown): RawProjectConfig {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as RawProjectConfig;
  }
  return {};
}

function parseConfigContents(
  contents: string,
  format: ProjectConfigFormat
): RawProjectConfig {
  switch (format) {
    case "yaml":
      return ensurePlainObject(yamlLoad(contents));
    case "json":
      return ensurePlainObject(JSON.parse(contents));
    case "jsonc":
      return ensurePlainObject(JSON5.parse(contents));
    case "toml":
      return ensurePlainObject(TOML.parse(contents));
    default: {
      const exhaustive: never = format;
      throw new Error(`Unsupported project config format: ${exhaustive}`);
    }
  }
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: pending refactor for config resolution
async function resolveConfigPath(
  options: LoadProjectConfigOptions
): Promise<{ path: string; format: ProjectConfigFormat } | undefined> {
  if (options.configPath) {
    const explicit = path.resolve(options.configPath);
    const exists = await pathExists(explicit);
    if (!exists) {
      throw new Error(
        `Specified project config not found: ${options.configPath}`
      );
    }
    const ext = path.extname(explicit).toLowerCase();
    let format: ProjectConfigFormat | undefined;
    if (ext === ".yaml" || ext === ".yml") {
      format = "yaml";
    } else if (ext === ".json") {
      format = "json";
    } else if (ext === ".jsonc") {
      format = "jsonc";
    } else if (ext === ".toml") {
      format = "toml";
    }
    if (!format) {
      throw new Error(
        `Unsupported project config extension: ${path.basename(explicit)}`
      );
    }
    return { path: explicit, format };
  }

  const start = options.startPath
    ? path.resolve(options.startPath)
    : process.cwd();
  const rulesetRoot = await findRulesetRoot(start);

  const baseDir = rulesetRoot ?? start;
  const rulesetDir = rulesetRoot
    ? path.join(rulesetRoot, ".ruleset")
    : path.join(baseDir, ".ruleset");

  const dirExists = await fs
    .stat(rulesetDir)
    .then((stat) => stat.isDirectory())
    .catch(() => false);
  if (!dirExists) {
    return;
  }

  for (const candidate of DEFAULT_CANDIDATES) {
    const candidatePath = path.join(rulesetDir, candidate.filename);
    if (await pathExists(candidatePath)) {
      return { path: candidatePath, format: candidate.format };
    }
  }

  return;
}

/**
 * Loads the project configuration, searching standard locations under `.ruleset/`.
 * Returns an empty configuration when no file is present.
 *
 * If no sources are configured, defaults to { rules: ['.ruleset/rules', '.agents/rules'] }.
 */
export async function loadProjectConfig(
  options: LoadProjectConfigOptions = {}
): Promise<ProjectConfigResult> {
  const resolved = await resolveConfigPath(options);
  if (!resolved) {
    // Return default config with default sources when no config file is found
    const defaultConfig: RulesetProjectConfig = {
      sources: {
        rules: [".ruleset/rules", ".agents/rules"],
      },
    };
    return { config: defaultConfig };
  }

  const contents = await fs.readFile(resolved.path, "utf8");
  const rawConfig = parseConfigContents(contents, resolved.format);

  const schemaResult = rulesetProjectConfigSchema.safeParse(rawConfig);
  if (!schemaResult.success) {
    const formattedIssues = schemaResult.error.issues
      .map((issue) => {
        const pathSegments = issue.path.length > 0 ? issue.path : ["projectConfig"];
        const pathLabel = pathSegments
          .map((segment, index) =>
            typeof segment === "number"
              ? `[${segment}]`
              : index === 0
                ? segment
                : `.${segment}`
          )
          .join("");
        return `${pathLabel || "projectConfig"} ${issue.message}`;
      })
      .join("\n  • ");

    const locationHint = resolved.path ? ` (${resolved.path})` : "";
    throw new Error(
      `Invalid project config${locationHint}:\n  • ${formattedIssues}\nSee ${RULESET_SCHEMA_IDS.projectConfig} for the schema reference.`
    );
  }

  const typedConfig = schemaResult.data;

  // Apply defaults if no sources configured
  const hasRules = typedConfig.sources?.rules && typedConfig.sources.rules.length > 0;
  const hasPartials = typedConfig.sources?.partials && typedConfig.sources.partials.length > 0;
  const sourcesEmpty = !hasRules && !hasPartials;

  const finalConfig: RulesetProjectConfig = sourcesEmpty
    ? {
        ...typedConfig,
        sources: {
          rules: [".ruleset/rules", ".agents/rules"],
        },
      }
    : typedConfig;

  return {
    path: resolved.path,
    format: resolved.format,
    config: finalConfig,
  };
}

/**
 * Options for saving project configuration.
 */
export type SaveProjectConfigOptions = {
  /** Path to the configuration file. If not provided, will use discovery to find existing config. */
  configPath?: string;
  /** Starting directory for config discovery if configPath not provided. Defaults to process.cwd() */
  startPath?: string;
  /** Format to use when creating a new config file. Defaults to 'yaml' */
  format?: ProjectConfigFormat;
  /** Whether to create parent directories if they don't exist. Defaults to true */
  createDirs?: boolean;
};

/**
 * Serializes config to the appropriate format string.
 */
function serializeConfig(
  config: ProjectConfig,
  format: ProjectConfigFormat
): string {
  // Remove default values to keep config minimal
  const minimalConfig = { ...config };

  // Remove default sources if they match defaults
  const sources = minimalConfig.sources;
  if (sources) {
    const rulesMatch =
      sources.rules?.length === 2 &&
      sources.rules[0] === ".ruleset/rules" &&
      sources.rules[1] === ".agents/rules";
    const noPartials = !sources.partials || sources.partials.length === 0;

    if (rulesMatch && noPartials) {
      delete minimalConfig.sources;
    }
  }

  switch (format) {
    case "yaml": {
      const { dump } = require("js-yaml");
      return dump(minimalConfig, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
        sortKeys: false
      });
    }
    case "json":
      return JSON.stringify(minimalConfig, null, 2) + "\n";
    case "jsonc":
      // For JSONC, we use regular JSON but could add comments in the future
      return JSON.stringify(minimalConfig, null, 2) + "\n";
    case "toml": {
      const { stringify } = require("@iarna/toml");
      return stringify(minimalConfig as any);
    }
    default:
      throw new Error(`Unsupported config format: ${format}`);
  }
}

/**
 * Saves project configuration to disk.
 *
 * @param config - The configuration to save
 * @param options - Options for saving
 * @returns The path where the config was saved and the format used
 */
export async function saveProjectConfig(
  config: ProjectConfig,
  options: SaveProjectConfigOptions = {}
): Promise<{ path: string; format: ProjectConfigFormat }> {
  const {
    configPath,
    startPath = process.cwd(),
    format: preferredFormat = "yaml",
    createDirs = true,
  } = options;

  let targetPath: string;
  let targetFormat: ProjectConfigFormat;

  if (configPath) {
    // Use explicit path
    targetPath = path.resolve(configPath);

    // Determine format from extension or use preferred
    const ext = path.extname(targetPath).toLowerCase();
    if (ext === ".yaml" || ext === ".yml") {
      targetFormat = "yaml";
    } else if (ext === ".json") {
      targetFormat = "json";
    } else if (ext === ".jsonc") {
      targetFormat = "jsonc";
    } else if (ext === ".toml") {
      targetFormat = "toml";
    } else {
      targetFormat = preferredFormat;
    }
  } else {
    // Try to find existing config
    const existing = await loadProjectConfig({ startPath });

    if (existing.path) {
      // Update existing config
      targetPath = existing.path;
      targetFormat = existing.format || preferredFormat;
    } else {
      // Create new config in .ruleset directory
      const projectRoot = await findRulesetRoot(startPath);
      const configDir = projectRoot
        ? path.join(projectRoot, ".ruleset")
        : path.join(startPath, ".ruleset");

      if (createDirs) {
        await fs.mkdir(configDir, { recursive: true });
      }

      targetPath = path.join(configDir, `config.${preferredFormat === "yaml" ? "yaml" : preferredFormat}`);
      targetFormat = preferredFormat;
    }
  }

  // Validate config before saving
  const schemaResult = rulesetProjectConfigSchema.safeParse(config);
  if (!schemaResult.success) {
    const issues = schemaResult.error.issues
      .map(issue => `${issue.path.join(".")} ${issue.message}`)
      .join(", ");
    throw new Error(`Invalid configuration: ${issues}`);
  }

  // Serialize and save
  const serialized = serializeConfig(config, targetFormat);

  // Ensure parent directory exists
  if (createDirs) {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
  }

  await fs.writeFile(targetPath, serialized, "utf8");

  return {
    path: targetPath,
    format: targetFormat,
  };
}
