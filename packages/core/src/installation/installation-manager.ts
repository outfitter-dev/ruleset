import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import type { GlobalConfig } from '../config/global-config';
import { RulesetManager } from '../rulesets/ruleset-manager';
import { isValidPackageName } from '../utils/security';

export type InstallationRecord = {
  version: string;
  source: 'global' | 'remote' | 'local';
  destinations: string[];
  installedAt: string;
  lastSync?: string;
};

export type InstallResult = {
  success: boolean;
  installedTo?: string[];
  reason?: string;
  version?: string;
};

// TLDR: Tracks installed rulesets and local modifications (mixd-v0)
type TrackedData = {
  installed: Record<string, InstallationRecord>;
  modifications: Record<string, unknown[]>;
};

/**
 * Manages installation and syncing of rulesets
 */
export class InstallationManager {
  private readonly projectDir: string;
  private readonly trackingFile: string;
  private readonly globalConfig: GlobalConfig;
  private readonly rulesetManager: RulesetManager;

  constructor(globalConfig: GlobalConfig, projectDir: string = process.cwd()) {
    this.projectDir = projectDir;
    this.trackingFile = join(projectDir, '.ruleset', 'installed.json');
    this.globalConfig = globalConfig;
    const globalDir = this.globalConfig.getGlobalDirectory();
    this.rulesetManager = new RulesetManager(this.globalConfig, { globalDir });
  }

  /**
   * Install a ruleset from npm or GitHub (simplified for v0.1)
   */
  async installRuleset(
    packageName: string,
    options: { global?: boolean; dev?: boolean } = {}
  ): Promise<{ destinations?: string[]; rules?: string[] }> {
    // Validate package name for security
    if (!isValidPackageName(packageName)) {
      throw new Error(
        `Invalid package name '${packageName}'. Package names must be valid npm packages or GitHub repos.`
      );
    }

    // Compose the ruleset content from the global store
    const composed = await this.rulesetManager.compose(packageName);
    const content = composed.rules;

    // Default destinations for v0.1
    const destinations = ['cursor', 'windsurf', 'claude-code'];

    // Write to each destination
    const writes: Promise<boolean>[] = [];
    for (const dest of destinations) {
      writes.push(this.installToDestination(dest, content, packageName));
    }
    await Promise.all(writes);

    // Track installation
    const tracking = await this.loadTracking();
    tracking.installed[packageName] = {
      version: composed.metadata.set.version,
      source: options.global ? 'global' : 'local',
      destinations,
      installedAt: new Date().toISOString(),
    };
    await this.saveTracking(tracking);

    return { destinations, rules: [packageName] };
  }

  /**
   * Sync all installed rulesets
   */
  async syncAllRulesets(
    options: { global?: boolean; force?: boolean } = {}
  ): Promise<{
    synced: number;
    updated: number;
    skipped: number;
    errors?: string[];
  }> {
    const tracking = await this.loadTracking();
    const results = {
      synced: 0,
      updated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Process each installed ruleset
    for (const [name, record] of Object.entries(tracking.installed)) {
      try {
        // Get the current composed ruleset
        const composed = await this.rulesetManager.getRuleset(name);
        const newContent = composed.rules;

        // Check if content has changed by comparing version or content hash
        const needsUpdate =
          options.force ||
          composed.metadata.set.version !== record.version ||
          this.contentHasChanged(name, newContent, record);

        if (needsUpdate) {
          // Re-install to all destinations
          for (const dest of record.destinations) {
            await this.installToDestination(dest, newContent, name);
          }

          // Update tracking
          tracking.installed[name] = {
            ...record,
            version: composed.metadata.set.version,
            installedAt: new Date().toISOString(),
          };

          results.updated++;
        } else {
          results.skipped++;
        }

        results.synced++;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        results.errors?.push(`Failed to sync ${name}: ${message}`);
      }
    }

    // Save updated tracking
    await this.saveTracking(tracking);

    return results;
  }

  /**
   * Check if content has changed
   */
  private contentHasChanged(
    _name: string,
    _newContent: string,
    _record: InstallationRecord
  ): boolean {
    // Simple implementation: check if content hash differs
    // In a real implementation, you'd store and compare content hashes
    // For now, just check version differences
    return false;
  }

  /**
   * Get all installed rulesets
   */
  async getInstalledRulesets(): Promise<Record<string, InstallationRecord>> {
    const tracking = await this.loadTracking();
    return tracking.installed;
  }

  private async loadTracking(): Promise<TrackedData> {
    try {
      const content = await fs.readFile(this.trackingFile, 'utf-8');
      const data = JSON.parse(content);
      return {
        installed: data.installed || {},
        modifications: data.modifications || {},
      };
    } catch {
      return { installed: {}, modifications: {} };
    }
  }

  private async saveTracking(data: TrackedData): Promise<void> {
    await fs.mkdir(dirname(this.trackingFile), { recursive: true });

    const content = JSON.stringify(
      {
        _comment: 'Auto-generated by rulesets CLI - do not edit manually',
        installed: data.installed,
        modifications: data.modifications,
      },
      null,
      2
    );

    await fs.writeFile(this.trackingFile, content, 'utf-8');
  }

  private async installToDestination(
    destination: string,
    content: string,
    rulesetName: string
  ): Promise<boolean> {
    const destinationPaths: Record<string, string> = {
      'claude-code': '.claude/CLAUDE.md',
      cursor: '.cursor/rules/ruleset.md',
      windsurf: '.windsurf/rules/ruleset.md',
      'agents-md': 'AGENTS.md',
      copilot: '.github/copilot/instructions.md',
    };

    const relativePath = destinationPaths[destination];
    if (!relativePath) {
      return false;
    }

    const fullPath = join(this.projectDir, relativePath);
    const dir = dirname(fullPath);

    await fs.mkdir(dir, { recursive: true });

    // Check if file exists and append if needed
    let existingContent = '';
    try {
      existingContent = await fs.readFile(fullPath, 'utf-8');
    } catch {
      // File doesn't exist
    }

    // Add separator if appending
    const separator = existingContent.length > 0 ? '\n\n---\n\n' : '';
    const header = `<!-- RULESET: ${rulesetName} -->\n`;

    // Remove old version if exists
    if (existingContent.includes(`<!-- RULESET: ${rulesetName} -->`)) {
      // Escape special regex characters in rulesetName to prevent injection
      const escapedRulesetName = rulesetName.replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&'
      );
      const regex = new RegExp(
        `<!-- RULESET: ${escapedRulesetName} -->.*?(?=<!-- RULESET:|$)`,
        'gs'
      );
      existingContent = existingContent.replace(regex, '');
    }

    const finalContent = `${existingContent}${separator}${header}${content}`;
    await fs.writeFile(fullPath, `${finalContent.trim()}\n`, 'utf-8');

    return true;
  }
}
