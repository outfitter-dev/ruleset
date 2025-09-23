import { promises as fs } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { load } from 'js-yaml';
import type { GlobalConfig } from '../config/global-config';
import type { Logger } from '../interfaces';
import { sanitizePath } from '../utils/security';
import { withFileLock } from '../utils/file-lock';

export type PresetRule = {
  name: string;
  source: string;
  description?: string;
  version?: string;
};

export type PresetDefinition = {
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  rules: PresetRule[];
};

const presetFilePathSymbol = Symbol('presetFilePath');
type PresetWithMetadata = PresetDefinition & { [presetFilePathSymbol]?: string };

export type PresetInstallRecord = {
  presetName: string;
  presetVersion: string;
  installedRules: Array<{
    name: string;
    sourcePath: string;
    targetPath: string;
    installedAt: string;
  }>;
  installedAt: string;
  lastUpdate?: string;
};

/**
 * Manages preset operations including installation, updates, and discovery
 */
export class PresetManager {
  private readonly globalConfig: GlobalConfig;
  private readonly projectDir: string;
  private readonly trackingFile: string;

  constructor(globalConfig: GlobalConfig, projectDir: string = process.cwd()) {
    this.globalConfig = globalConfig;
    this.projectDir = projectDir;
    this.trackingFile = join(projectDir, '.ruleset', 'preset-tracking.json');
  }

  /**
   * List all available presets (global + project)
   */
  async listAvailablePresets(): Promise<PresetDefinition[]> {
    const presets: PresetDefinition[] = [];

    // Global presets
    const globalPresetsDir = this.globalConfig.getPresetsDirectory();
    try {
      await this.discoverPresets(globalPresetsDir, presets);
    } catch {
      // Global presets dir might not exist yet
    }

    // Project presets
    const projectPresetsDir = join(this.projectDir, '.ruleset', 'presets');
    try {
      await this.discoverPresets(projectPresetsDir, presets);
    } catch {
      // Project presets dir might not exist
    }

    return presets.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Install rules from a preset
   */
  async installPreset(
    presetName: string,
    options: {
      targetDir?: string;
      overwrite?: boolean;
      logger?: Logger;
    } = {}
  ): Promise<PresetInstallRecord> {
    const { targetDir = join(this.projectDir, '.ruleset', 'rules'), overwrite = false, logger } = options;

    // Find the preset
    const presets = await this.listAvailablePresets();
    const preset = presets.find(p => p.name === presetName) as PresetWithMetadata | undefined;
    if (!preset) {
      throw new Error(`Preset '${presetName}' not found. Available presets: ${presets.map(p => p.name).join(', ')}`);
    }

    logger?.info(`Installing preset '${preset.name}' (${preset.version})`);

    // Ensure target directory exists
    await fs.mkdir(targetDir, { recursive: true });

    const installedRules: PresetInstallRecord['installedRules'] = [];

    const presetBaseDir = preset[presetFilePathSymbol] ? dirname(preset[presetFilePathSymbol] as string) : undefined;

    for (const rule of preset.rules) {
      logger?.info(`Installing rule: ${rule.name}`);

      const targetPath = join(targetDir, `${rule.name}.md`);

      // Check if file exists and handle overwrite
      if (!overwrite) {
        try {
          await fs.access(targetPath);
          logger?.warn(`Rule '${rule.name}' already exists, skipping (use --overwrite to replace)`);
          continue;
        } catch {
          // File doesn't exist, we can proceed
        }
      }

      // Download or copy the rule content
      const content = await this.fetchRuleContent(rule.source, { logger, relativeTo: presetBaseDir });

      // Write the rule file
      await fs.writeFile(targetPath, content, 'utf-8');

      installedRules.push({
        name: rule.name,
        sourcePath: rule.source,
        targetPath,
        installedAt: new Date().toISOString(),
      });
    }

    // Track the installation
    const installRecord: PresetInstallRecord = {
      presetName: preset.name,
      presetVersion: preset.version,
      installedRules,
      installedAt: new Date().toISOString(),
    };

    await this.updateTrackingRecord(presetName, installRecord);

    logger?.info(`Successfully installed ${installedRules.length} rules from preset '${preset.name}'`);
    return installRecord;
  }

  /**
   * Update installed presets
   */
  async updatePresets(
    options: {
      presetNames?: string[];
      writeBack?: boolean;
      logger?: Logger;
    } = {}
  ): Promise<{
    updated: PresetInstallRecord[];
    skipped: string[];
    errors: Array<{ preset: string; error: string }>;
  }> {
    const { presetNames, writeBack = false, logger } = options;
    const tracking = await this.loadTracking();

    const updated: PresetInstallRecord[] = [];
    const skipped: string[] = [];
    const errors: Array<{ preset: string; error: string }> = [];

    const targetsToUpdate = presetNames ?
      presetNames.filter(name => name in tracking) :
      Object.keys(tracking);

    if (targetsToUpdate.length === 0) {
      logger?.info('No presets to update');
      return { updated, skipped, errors };
    }

    // Find current preset definitions
    const availablePresets = await this.listAvailablePresets();

    for (const presetName of targetsToUpdate) {
      try {
        const currentRecord = tracking[presetName];
        const currentPreset = availablePresets.find(p => p.name === presetName);

        if (!currentPreset) {
          logger?.warn(`Preset '${presetName}' no longer available, skipping`);
          skipped.push(presetName);
          continue;
        }

        // Check if update is needed
        if (currentPreset.version === currentRecord.presetVersion && !writeBack) {
          logger?.info(`Preset '${presetName}' is already up to date (${currentPreset.version})`);
          skipped.push(presetName);
          continue;
        }

        logger?.info(`Updating preset '${presetName}' from ${currentRecord.presetVersion} to ${currentPreset.version}`);

        // Re-install the preset with overwrite enabled
        const newRecord = await this.installPreset(presetName, {
          overwrite: true,
          logger,
        });

        updated.push(newRecord);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger?.error(`Failed to update preset '${presetName}': ${message}`);
        errors.push({ preset: presetName, error: message });
      }
    }

    return { updated, skipped, errors };
  }

  /**
   * Get tracking information for installed presets
   */
  async getInstalledPresets(): Promise<Record<string, PresetInstallRecord>> {
    return await this.loadTracking();
  }

  private async discoverPresets(dir: string, presets: PresetDefinition[]): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
        try {
          const presetPath = join(dir, entry.name);
          const content = await fs.readFile(presetPath, 'utf-8');
          const preset = load(content) as PresetDefinition;

          // Validate preset structure
          if (this.isValidPreset(preset)) {
            const presetWithMeta = { ...preset } as PresetWithMetadata;
            Object.defineProperty(presetWithMeta, presetFilePathSymbol, {
              value: presetPath,
              enumerable: false,
            });
            presets.push(presetWithMeta);
          }
        } catch (error) {
          // Skip invalid preset files
        }
      }
    }
  }

  private isValidPreset(obj: unknown): obj is PresetDefinition {
    if (!obj || typeof obj !== 'object') return false;

    const preset = obj as Record<string, unknown>;
    return (
      typeof preset.name === 'string' &&
      typeof preset.version === 'string' &&
      Array.isArray(preset.rules) &&
      preset.rules.every((rule: unknown) =>
        rule &&
        typeof rule === 'object' &&
        typeof (rule as Record<string, unknown>).name === 'string' &&
        typeof (rule as Record<string, unknown>).source === 'string'
      )
    );
  }

  private async fetchRuleContent(
    source: string,
    options: { logger?: Logger; relativeTo?: string } = {}
  ): Promise<string> {
    const { logger, relativeTo } = options;
    const trimmedSource = source.trim();

    if (trimmedSource.startsWith('data:text/plain,')) {
      // Handle data URLs for testing
      return decodeURIComponent(trimmedSource.slice(16));
    } else if (trimmedSource.startsWith('http://') || trimmedSource.startsWith('https://')) {
      // Fetch from URL
      try {
        const response = await fetch(trimmedSource);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.text();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to fetch rule from ${trimmedSource}: ${message}`);
      }
    } else if (trimmedSource.startsWith('file://')) {
      // Local file URL
      const sanitizedFileUrl = sanitizePath(trimmedSource);
      const filePath = sanitizePath(sanitizedFileUrl.slice(7)); // Remove 'file://'
      return await fs.readFile(filePath, 'utf-8');
    } else {
      // Assume it's a local path relative to the preset file location
      const sanitizedRelative = sanitizePath(trimmedSource);
      const baseDir = relativeTo ?? this.projectDir;
      const resolvedPath = isAbsolute(sanitizedRelative)
        ? sanitizedRelative
        : resolve(baseDir, sanitizedRelative);

      try {
        return await fs.readFile(resolvedPath, 'utf-8');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const prefix = relativeTo ? `preset-relative path '${sanitizedRelative}'` : `path '${sanitizedRelative}'`;
        throw new Error(`Failed to read rule from ${prefix}: ${message}`);
      }
    }
  }

  private async loadTracking(): Promise<Record<string, PresetInstallRecord>> {
    try {
      const content = await fs.readFile(this.trackingFile, 'utf-8');
      const data = JSON.parse(content);
      return data.presets || {};
    } catch {
      return {};
    }
  }

  private async updateTrackingRecord(presetName: string, record: PresetInstallRecord): Promise<void> {
    await withFileLock(this.trackingFile, async () => {
      const tracking = await this.loadTracking();
      tracking[presetName] = record;

      await fs.mkdir(dirname(this.trackingFile), { recursive: true });
      const content = JSON.stringify(
        {
          _comment: 'Auto-generated by rulesets CLI - do not edit manually',
          presets: tracking,
        },
        null,
        2
      );

      await fs.writeFile(this.trackingFile, content, 'utf-8');
    });
  }
}
