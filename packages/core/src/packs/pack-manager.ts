import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import type { JsonMap } from '@iarna/toml';
import { stringify as tomlStringify } from '@iarna/toml';
import { GlobalConfig } from '../config/global-config';
import { InstallationManager } from '../installation/installation-manager';
import {
  Pack,
  type PackConfiguration,
  type PackDefinition,
  type PackIncludes,
  type PackMetadata,
} from './pack';

export type PackManagerOptions = {
  globalDir?: string;
  projectDir?: string;
};

export type PackInstallResult = {
  success: boolean;
  installedSets?: string[];
  destinations?: string[];
  conflicts?: string[];
  errors?: string[];
};

export type PackInstallOptions = {
  force?: boolean;
  resolveConflicts?: 'override' | 'skip' | 'merge';
  preserveLocal?: boolean;
};

export type PackUpdateDefinition = {
  version?: string;
  description?: string;
  sets?: string[];
  commands?: string[];
  configuration?: PackConfiguration;
};

export type PackTrackingEntry = {
  version: string;
  installedSets: string[];
  destinations: string[];
  installedAt: string;
};

export class PackManager {
  private readonly globalDir: string;
  private readonly projectDir: string;
  private readonly packsDir: string;
  private installationManager: InstallationManager | null = null;
  private readonly packCache: Map<string, Pack> = new Map();

  constructor(options: PackManagerOptions = {}) {
    this.globalDir =
      options.globalDir || join(process.env.HOME || '', '.ruleset');
    this.projectDir = options.projectDir || process.cwd();
    this.packsDir = join(this.globalDir, 'packs');
  }

  private async getInstallationManager(): Promise<InstallationManager> {
    if (!this.installationManager) {
      const config = await GlobalConfig.getInstance();
      this.installationManager = new InstallationManager(
        config,
        this.projectDir
      );
    }
    return this.installationManager;
  }

  /**
   * List all available packs
   */
  async listPacks(): Promise<Pack[]> {
    const packs: Pack[] = [];

    try {
      // Ensure packs directory exists
      await fs.mkdir(this.packsDir, { recursive: true });

      const files = await fs.readdir(this.packsDir);
      const packFiles = files.filter((f) => f.endsWith('.toml'));

      for (const file of packFiles) {
        const packPath = join(this.packsDir, file);
        const pack = await this.loadPack(packPath);
        if (pack) {
          packs.push(pack);
        }
      }
    } catch (_error) {
      // Swallow errors and return what we have
    }

    return packs;
  }

  /**
   * Get a specific pack by name
   */
  async getPack(name: string): Promise<Pack | undefined> {
    // Check cache first
    if (this.packCache.has(name)) {
      return this.packCache.get(name);
    }

    const packPath = join(this.packsDir, `${name}.toml`);

    try {
      const pack = await this.loadPack(packPath);
      if (pack) {
        this.packCache.set(name, pack);
        return pack;
      }
    } catch {
      // Pack doesn't exist
    }

    return;
  }

  /**
   * Install a pack with all its rulesets
   */
  async installPack(
    packName: string,
    destinations: string[],
    options: PackInstallOptions = {}
  ): Promise<PackInstallResult> {
    const pack = await this.getPack(packName);

    if (!pack) {
      return {
        success: false,
        errors: [`Pack '${packName}' not found`],
      };
    }

    // Validate pack
    const validationErrors = await pack.validate();
    if (validationErrors.length > 0) {
      return {
        success: false,
        errors: validationErrors,
      };
    }

    const installManager = await this.getInstallationManager();

    // Optional conflict detection
    if (!options.force) {
      const conflicts = await this.detectConflicts(
        pack,
        installManager,
        options.resolveConflicts
      );
      if (conflicts.length > 0) {
        return {
          success: false,
          conflicts,
          errors: [
            `Conflicts detected with existing rulesets: ${conflicts.join(', ')}`,
          ],
        };
      }
    }

    const { installedSets, errors } = await this.installPackSets(
      pack,
      installManager
    );

    // Apply pack configuration
    if (Object.keys(pack.configuration).length > 0) {
      await this.applyPackConfiguration(packName, pack.configuration);
    }

    // Track pack installation
    await this.trackPackInstallation(
      packName,
      pack,
      installedSets,
      destinations
    );

    return {
      success: installedSets.length > 0,
      installedSets,
      destinations,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private async detectConflicts(
    pack: Pack,
    installManager: InstallationManager,
    resolveBehavior: PackInstallOptions['resolveConflicts']
  ): Promise<string[]> {
    const conflicts: string[] = [];
    if (resolveBehavior !== 'skip') {
      return conflicts;
    }

    const installed = await installManager.getInstalledRulesets();
    for (const setName of pack.includes.sets) {
      if (installed[setName]) {
        conflicts.push(setName);
      }
    }
    return conflicts;
  }

  private async installPackSets(
    pack: Pack,
    installManager: InstallationManager
  ): Promise<{ installedSets: string[]; errors: string[] }> {
    const installedSets: string[] = [];
    const errors: string[] = [];
    for (const setName of pack.includes.sets) {
      try {
        const result = await installManager.installRuleset(setName, {
          global: false,
          dev: false,
        });
        if (result.destinations) {
          installedSets.push(setName);
        } else {
          errors.push(`Failed to install ${setName}: No destinations`);
        }
      } catch (error: unknown) {
        errors.push(
          `Error installing ${setName}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
    return { installedSets, errors };
  }

  /**
   * Create a new pack
   */
  async createPack(
    name: string,
    definition: Partial<PackDefinition>
  ): Promise<boolean> {
    const packPath = join(this.packsDir, `${name}.toml`);

    // Check if pack already exists
    const existingPack = await this.getPack(name);
    if (existingPack) {
      throw new Error(`Pack '${name}' already exists`);
    }

    // Ensure packs directory exists
    await fs.mkdir(this.packsDir, { recursive: true });

    // Create pack definition - extract from the mixed input structure
    const inputDef = definition as Partial<PackDefinition> &
      Record<string, unknown>;
    const packMetadata: PackMetadata = {
      name: (inputDef.name as string) || name,
      version: (inputDef.version as string) || '1.0.0',
      description: inputDef.description as string | undefined,
      author: inputDef.author as string | undefined,
      tags: inputDef.tags as string[] | undefined,
    };

    const fullDefinition: PackDefinition = {
      pack: packMetadata,
    };

    // Add includes if any
    if (inputDef.sets || inputDef.commands || inputDef.packs) {
      const includes: Partial<PackIncludes> = {};
      if (inputDef.sets) {
        includes.sets = inputDef.sets as string[];
      }
      if (inputDef.commands) {
        includes.commands = inputDef.commands as string[];
      }
      if (inputDef.packs) {
        includes.packs = inputDef.packs as string[];
      }
      fullDefinition.includes = includes as PackIncludes;
    }

    // Add configuration if any
    if (
      definition.configuration &&
      Object.keys(definition.configuration).length > 0
    ) {
      fullDefinition.configuration = definition.configuration;
    }

    // Write to file
    const content = tomlStringify(fullDefinition as JsonMap);
    await fs.writeFile(packPath, content, 'utf-8');

    // Clear cache to force reload
    this.packCache.delete(name);

    return true;
  }

  /**
   * Update an existing pack
   */
  async updatePack(
    name: string,
    updates: PackUpdateDefinition
  ): Promise<boolean> {
    const pack = await this.getPack(name);
    if (!pack) {
      throw new Error(`Pack '${name}' not found`);
    }

    // Update pack properties
    if (updates.version) {
      pack.metadata.version = updates.version;
    }
    if (updates.description) {
      pack.metadata.description = updates.description;
    }
    if (updates.sets) {
      pack.includes.sets = updates.sets;
    }
    if (updates.commands) {
      pack.includes.commands = updates.commands;
    }
    if (updates.configuration) {
      pack.configuration = {
        ...pack.configuration,
        ...updates.configuration,
      };
    }

    // Save updated pack
    const packPath = join(this.packsDir, `${name}.toml`);
    const content = pack.export();
    await fs.writeFile(packPath, content, 'utf-8');

    // Clear cache
    this.packCache.delete(name);

    return true;
  }

  /**
   * Remove a pack
   */
  async removePack(name: string): Promise<boolean> {
    const packPath = join(this.packsDir, `${name}.toml`);

    try {
      await fs.unlink(packPath);
      this.packCache.delete(name);

      // Also remove tracking
      await this.removePackTracking(name);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get installed packs
   */
  async getInstalledPacks(): Promise<Record<string, PackTrackingEntry>> {
    const trackingFile = join(this.projectDir, '.ruleset', 'packs.json');

    try {
      const content = await fs.readFile(trackingFile, 'utf-8');
      return JSON.parse(content) as Record<string, PackTrackingEntry>;
    } catch {
      return {} as Record<string, PackTrackingEntry>;
    }
  }

  // Private helper methods

  private async loadPack(packPath: string): Promise<Pack | null> {
    try {
      const pack = new Pack(packPath);
      await pack.load();
      return pack;
    } catch (_error) {
      // Silently return null if pack doesn't exist or can't be loaded
      return null;
    }
  }

  private async applyPackConfiguration(
    packName: string,
    configuration: PackConfiguration
  ): Promise<void> {
    // Store pack configuration for future reference
    const configFile = join(this.projectDir, '.ruleset', 'pack-config.json');

    let existingConfig: Record<string, PackConfiguration> = {};
    try {
      const content = await fs.readFile(configFile, 'utf-8');
      existingConfig = JSON.parse(content);
    } catch {
      // File doesn't exist yet
    }

    existingConfig[packName] = configuration;

    await fs.mkdir(dirname(configFile), { recursive: true });
    await fs.writeFile(
      configFile,
      JSON.stringify(existingConfig, null, 2),
      'utf-8'
    );
  }

  private async trackPackInstallation(
    packName: string,
    pack: Pack,
    installedSets: string[],
    destinations: string[]
  ): Promise<void> {
    const trackingFile = join(this.projectDir, '.ruleset', 'packs.json');

    let tracking: Record<string, PackTrackingEntry> = {};
    try {
      const content = await fs.readFile(trackingFile, 'utf-8');
      tracking = JSON.parse(content) as Record<string, PackTrackingEntry>;
    } catch {
      // File doesn't exist yet
    }

    tracking[packName] = {
      version: pack.metadata.version,
      installedSets,
      destinations,
      installedAt: new Date().toISOString(),
    };

    await fs.mkdir(dirname(trackingFile), { recursive: true });
    await fs.writeFile(
      trackingFile,
      JSON.stringify(tracking, null, 2),
      'utf-8'
    );
  }

  private async removePackTracking(packName: string): Promise<void> {
    const trackingFile = join(this.projectDir, '.ruleset', 'packs.json');

    try {
      const content = await fs.readFile(trackingFile, 'utf-8');
      const tracking = JSON.parse(content);
      delete tracking[packName];
      await fs.writeFile(
        trackingFile,
        JSON.stringify(tracking, null, 2),
        'utf-8'
      );
    } catch {
      // File doesn't exist or other error
    }
  }
}

// Helper type exports
export type {
  Pack,
  PackConfiguration,
  PackDefinition,
  PackMetadata,
} from './pack';
