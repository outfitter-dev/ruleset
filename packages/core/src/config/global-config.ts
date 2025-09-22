import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { withFileLock } from '../utils/file-lock';

/**
 * Manages global configuration for rulesets
 */
export class GlobalConfig {
  private static instance: GlobalConfig;
  private readonly globalDir: string;

  private constructor() {
    // Default to ~/.ruleset
    this.globalDir = process.env.RULESETS_HOME || join(homedir(), '.ruleset');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): GlobalConfig {
    if (!GlobalConfig.instance) {
      GlobalConfig.instance = new GlobalConfig();
    }
    return GlobalConfig.instance;
  }

  /**
   * Get the global rulesets directory
   */
  getGlobalDirectory(): string {
    return this.globalDir;
  }

  /**
   * Get the path to the sets directory
   */
  getSetsDirectory(): string {
    return join(this.globalDir, 'sets');
  }

  /**
   * Get the path to the packs directory
   */
  getPacksDirectory(): string {
    return join(this.globalDir, 'packs');
  }

  /**
   * Get the path to the commands directory
   */
  getCommandsDirectory(): string {
    return join(this.globalDir, 'commands');
  }

  /**
   * Get the path to the global config file
   */
  getConfigPath(): string {
    return join(this.globalDir, 'config.json');
  }

  /**
   * Ensure the global config exists
   */
  async ensureConfigExists(): Promise<void> {
    const configPath = this.getConfigPath();

    // Use file locking to prevent concurrent initialization
    await withFileLock(configPath, async () => {
      try {
        await fs.access(configPath);
      } catch {
        // Create default config
        await fs.mkdir(this.globalDir, { recursive: true });
        await fs.mkdir(this.getSetsDirectory(), { recursive: true });
        await fs.mkdir(this.getPacksDirectory(), { recursive: true });
        await fs.mkdir(this.getCommandsDirectory(), { recursive: true });

        const defaultConfig = {
          version: '0.1.0',
          installedRulesets: [],
          packs: [],
        };

        await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));
      }
    });
  }
}
