import { promises as fs } from 'node:fs';
import { basename } from 'node:path';
import type { JsonMap } from '@iarna/toml';
import { parse as tomlParse, stringify as tomlStringify } from '@iarna/toml';
import { GlobalConfig } from '../config/global-config';
import { RESOURCE_LIMITS } from '../config/limits';
import type { ComposedRuleset } from '../rulesets/ruleset-manager';
import { RulesetManager } from '../rulesets/ruleset-manager';

// JSON-compatible types for TOML serialization
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

export type PackMetadata = {
  name: string;
  version: string;
  description?: string;
  author?: string;
  tags?: string[];
};

export type PackIncludes = {
  sets: string[];
  commands?: string[];
  packs?: string[]; // Allow packs to include other packs
};

export type PackConfiguration = Record<string, JSONValue>;

export type PackDefinition = {
  pack: PackMetadata;
  includes?: PackIncludes;
  configuration?: PackConfiguration;
};

export class Pack {
  name: string;
  path: string;
  metadata: PackMetadata = {
    name: '',
    version: '1.0.0',
  };
  includes: PackIncludes = {
    sets: [],
  };
  configuration: PackConfiguration = {};

  // biome-ignore lint/style/useReadonlyClassProperties: set to true after load()
  private _loaded: boolean;
  private _rulesetManager?: RulesetManager;

  constructor(packPath: string) {
    this.path = packPath;
    this.name = basename(packPath, '.toml');
    this._loaded = false;
  }

  /**
   * Load pack definition from TOML file
   */
  async load(): Promise<void> {
    if (this._loaded) {
      return;
    }

    try {
      const stats = await fs.stat(this.path);
      if (stats.size > RESOURCE_LIMITS.pack.maxFileSize) {
        throw new Error(
          `Pack file exceeds maximum size of ${RESOURCE_LIMITS.pack.maxFileSize} bytes`
        );
      }

      const content = await fs.readFile(this.path, 'utf-8');
      const parsed = tomlParse(content) as unknown as PackDefinition;

      // Load metadata
      if (parsed.pack) {
        this.metadata = {
          ...this.metadata,
          ...parsed.pack,
        };
      }

      // Load includes
      if (parsed.includes) {
        this.includes = {
          sets: parsed.includes.sets || [],
          commands: parsed.includes.commands,
          packs: parsed.includes.packs,
        };
      }

      // Load configuration - handle both flat and nested formats
      if (parsed.configuration) {
        // Flatten nested configuration (e.g., configuration.typescript.strict -> typescript.strict)
        this.configuration = this.flattenConfiguration(parsed.configuration);
      }

      this._loaded = true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load pack ${this.name}: ${message}`);
    }
  }

  /**
   * Validate pack definition
   */
  async validate(): Promise<string[]> {
    const errors: string[] = [];

    if (!this._loaded) {
      try {
        await this.load();
      } catch (error: unknown) {
        errors.push(error instanceof Error ? error.message : String(error));
        return errors;
      }
    }

    // Validate metadata - check both undefined and empty string cases
    const nameIsEmpty =
      !this.metadata.name ||
      this.metadata.name === '' ||
      (typeof this.metadata.name === 'string' &&
        this.metadata.name.trim() === '');

    if (nameIsEmpty) {
      errors.push('Pack name is required');
    }

    if (!this.isValidVersion(this.metadata.version)) {
      errors.push('Invalid version format');
    }

    // Validate includes
    if (!this.includes.sets || this.includes.sets.length === 0) {
      errors.push('Pack must include at least one ruleset');
    }

    // Check if included rulesets exist
    const manager = await this.getRulesetManager();
    for (const setName of this.includes.sets) {
      try {
        await manager.getRuleset(setName);
      } catch {
        errors.push(`Ruleset '${setName}' not found`);
      }
    }

    return errors;
  }

  /**
   * Resolve all included rulesets
   */
  async resolveRulesets(): Promise<ComposedRuleset[]> {
    if (!this._loaded) {
      await this.load();
    }

    const manager = await this.getRulesetManager();
    const resolved: ComposedRuleset[] = [];

    for (const setName of this.includes.sets) {
      try {
        const composed = await manager.compose(setName);
        resolved.push(composed);
      } catch (_error: unknown) {
        // Ignore resolve failures; validation covers missing rulesets
      }
    }

    return resolved;
  }

  /**
   * Merge pack configuration with existing configuration
   */
  mergeConfiguration(existing: PackConfiguration): PackConfiguration {
    return {
      ...existing,
      ...this.configuration,
    };
  }

  /**
   * Export pack definition as TOML
   */
  export(): string {
    const definition: PackDefinition = {
      pack: this.metadata,
    };

    if (
      this.includes.sets.length > 0 ||
      this.includes.commands ||
      this.includes.packs
    ) {
      const includes: Partial<PackIncludes> = {};
      if (this.includes.sets.length > 0) {
        includes.sets = this.includes.sets;
      }
      if (this.includes.commands && this.includes.commands.length > 0) {
        includes.commands = this.includes.commands;
      }
      if (this.includes.packs && this.includes.packs.length > 0) {
        includes.packs = this.includes.packs;
      }
      definition.includes = includes as PackIncludes;
    }

    if (Object.keys(this.configuration).length > 0) {
      definition.configuration = this.configuration;
    }

    return tomlStringify(definition as JsonMap);
  }

  /**
   * Flatten nested configuration object
   */
  private flattenConfiguration(
    config: unknown,
    prefix = ''
  ): PackConfiguration {
    const result: PackConfiguration = {};

    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return result;
    }

    for (const [key, value] of Object.entries(
      config as Record<string, unknown>
    )) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively flatten nested objects
        Object.assign(result, this.flattenConfiguration(value, fullKey));
      } else {
        result[fullKey] = value as JSONValue;
      }
    }

    return result;
  }

  /**
   * Get or create RulesetManager instance
   */
  private async getRulesetManager(): Promise<RulesetManager> {
    if (!this._rulesetManager) {
      const config = await GlobalConfig.getInstance();
      const globalDir = config.getGlobalDirectory();
      this._rulesetManager = new RulesetManager(config, { globalDir });
    }
    return this._rulesetManager;
  }

  private static readonly SEMVER_RE = /^\d+\.\d+\.\d+(-[\w.]+)?(\+[\w.]+)?$/;

  /**
   * Validate version string format
   */
  private isValidVersion(version: string): boolean {
    if (!version) {
      return false;
    }

    // Simple semver validation
    return Pack.SEMVER_RE.test(version);
  }
}
