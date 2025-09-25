import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { withFileLock } from "../utils/file-lock";

/**
 * Manages global configuration for rulesets
 */
export class GlobalConfig {
  private static instance: GlobalConfig | undefined;
  private readonly globalDir: string;
  private readonly configFile: string;

  /**
   * Determines the default global configuration directory following XDG /
   * platform conventions unless `RULESETS_HOME` is explicitly provided.
   */
  private static resolveDefaultGlobalDir(): string {
    const envHome = process.env.RULESETS_HOME;
    if (envHome && envHome.trim().length > 0) {
      return envHome;
    }

    if (process.platform === "win32") {
      const appData =
        process.env.APPDATA || join(homedir(), "AppData", "Roaming");
      return join(appData, "ruleset");
    }

    if (process.platform === "darwin") {
      return join(homedir(), "Library", "Application Support", "ruleset");
    }

    const xdgHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
    return join(xdgHome, "ruleset");
  }

  private constructor() {
    this.globalDir = GlobalConfig.resolveDefaultGlobalDir();
    this.configFile = join(this.globalDir, "config.toml");
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
   * Test-only helper to reset the cached singleton so environment overrides are picked up.
   */
  static resetForTest(): void {
    GlobalConfig.instance = undefined;
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
    return join(this.globalDir, "sets");
  }

  /**
   * Get the path to the packs directory
   */
  getPacksDirectory(): string {
    return join(this.globalDir, "packs");
  }

  /**
   * Get the path to the commands directory
   */
  getCommandsDirectory(): string {
    return join(this.globalDir, "commands");
  }

  /**
   * Get the path to the global rules directory
   */
  getRulesDirectory(): string {
    return join(this.globalDir, "rules");
  }

  /**
   * Get the path to the global presets directory
   */
  getPresetsDirectory(): string {
    return join(this.globalDir, "presets");
  }

  /**
   * Get the path to the global config file
   */
  getConfigPath(): string {
    return this.configFile;
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
        await fs.mkdir(this.getRulesDirectory(), { recursive: true });
        await fs.mkdir(this.getPresetsDirectory(), { recursive: true });

        const defaultConfig = `version = "0.1.0"\ninstalledRulesets = []\npacks = []\n`;

        await fs.writeFile(configPath, defaultConfig);
      }
    });
  }
}
