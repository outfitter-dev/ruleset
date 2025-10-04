import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { JsonValue } from "@ruleset/types";

/**
 * Command history entry
 */
export type HistoryEntry = {
  /** ISO timestamp when command was executed */
  timestamp: string;
  /** The command that was executed (e.g., 'compile', 'init') */
  command: string;
  /** Arguments passed to the command */
  args?: string[];
  /** Options/flags used */
  options?: Record<string, JsonValue>;
  /** Working directory where command was executed */
  cwd: string;
  /** Whether the command succeeded */
  success: boolean;
  /** Error message if command failed */
  error?: string;
  /** Duration in milliseconds */
  duration?: number;
  /** Rulesets version */
  version: string;
  /** Additional metadata */
  metadata?: Record<string, JsonValue>;
};

/**
 * Options for the GlobalHistory manager
 */
export type GlobalHistoryOptions = {
  /** Custom path for history file (defaults to ~/.config/rulesets/history.json) */
  historyPath?: string;
  /** Maximum number of history entries to keep (defaults to 1000) */
  maxEntries?: number;
  /** Whether to disable history tracking (defaults to false) */
  disabled?: boolean;
};

/**
 * Manages global command history for audit and debugging purposes
 */
export class GlobalHistory {
  private readonly historyPath: string;
  private readonly maxEntries: number;
  private readonly disabled: boolean;
  private history: HistoryEntry[] = [];
  private loaded = false;

  constructor(options: GlobalHistoryOptions = {}) {
    this.disabled = options.disabled ?? false;
    this.maxEntries = options.maxEntries ?? 1000;

    // Determine history file path
    if (options.historyPath) {
      this.historyPath = options.historyPath;
    } else {
      const configHome = process.env.XDG_CONFIG_HOME || path.join(homedir(), ".config");
      this.historyPath = path.join(configHome, "ruleset", "history.json");
    }
  }

  /**
   * Load history from disk
   */
  private async loadHistory(): Promise<void> {
    if (this.loaded || this.disabled) return;

    try {
      const content = await fs.readFile(this.historyPath, "utf8");
      const parsed = JSON.parse(content);

      if (Array.isArray(parsed)) {
        this.history = parsed.filter(this.isValidEntry);
      } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.history)) {
        this.history = parsed.history.filter(this.isValidEntry);
      } else {
        this.history = [];
      }
    } catch (error) {
      // File doesn't exist or is invalid, start with empty history
      this.history = [];
    }

    this.loaded = true;
  }

  /**
   * Validate a history entry
   */
  private isValidEntry(entry: unknown): entry is HistoryEntry {
    if (!entry || typeof entry !== "object") return false;

    const e = entry as Partial<HistoryEntry>;
    return (
      typeof e.timestamp === "string" &&
      typeof e.command === "string" &&
      typeof e.cwd === "string" &&
      typeof e.success === "boolean" &&
      typeof e.version === "string"
    );
  }

  /**
   * Save history to disk
   */
  private async saveHistory(): Promise<void> {
    if (this.disabled) return;

    try {
      // Ensure directory exists
      const dir = path.dirname(this.historyPath);
      await fs.mkdir(dir, { recursive: true });

      // Trim history if needed
      if (this.history.length > this.maxEntries) {
        // Keep the most recent entries
        this.history = this.history.slice(-this.maxEntries);
      }

      // Save to disk
      const content = JSON.stringify(
        { version: "1.0", history: this.history },
        null,
        2
      );
      await fs.writeFile(this.historyPath, content, "utf8");
    } catch (error) {
      // Silently fail - history is non-critical
      if (process.env.RULESETS_DEBUG === "true") {
        console.error("Failed to save history:", error);
      }
    }
  }

  /**
   * Add a command to history
   */
  async addCommand(entry: Omit<HistoryEntry, "timestamp">): Promise<void> {
    if (this.disabled) return;

    await this.loadHistory();

    const fullEntry: HistoryEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    this.history.push(fullEntry);
    await this.saveHistory();
  }

  /**
   * Get recent history entries
   */
  async getRecentHistory(limit = 10): Promise<HistoryEntry[]> {
    if (this.disabled) return [];

    await this.loadHistory();
    return this.history.slice(-limit).reverse();
  }

  /**
   * Get history for a specific command
   */
  async getCommandHistory(command: string, limit = 10): Promise<HistoryEntry[]> {
    if (this.disabled) return [];

    await this.loadHistory();
    return this.history
      .filter(entry => entry.command === command)
      .slice(-limit)
      .reverse();
  }

  /**
   * Get history for the current working directory
   */
  async getProjectHistory(cwd?: string, limit = 10): Promise<HistoryEntry[]> {
    if (this.disabled) return [];

    const targetCwd = cwd || process.cwd();
    await this.loadHistory();

    return this.history
      .filter(entry => entry.cwd === targetCwd)
      .slice(-limit)
      .reverse();
  }

  /**
   * Clear all history
   */
  async clearHistory(): Promise<void> {
    if (this.disabled) return;

    this.history = [];
    this.loaded = true;
    await this.saveHistory();
  }

  /**
   * Get statistics about command usage
   */
  async getStatistics(): Promise<{
    totalCommands: number;
    commandCounts: Record<string, number>;
    successRate: number;
    averageDuration: number;
    recentErrors: HistoryEntry[];
  }> {
    if (this.disabled) {
      return {
        totalCommands: 0,
        commandCounts: {},
        successRate: 0,
        averageDuration: 0,
        recentErrors: [],
      };
    }

    await this.loadHistory();

    const commandCounts: Record<string, number> = {};
    let successCount = 0;
    let totalDuration = 0;
    let durationCount = 0;
    const recentErrors: HistoryEntry[] = [];

    for (const entry of this.history) {
      commandCounts[entry.command] = (commandCounts[entry.command] || 0) + 1;

      if (entry.success) {
        successCount++;
      } else {
        recentErrors.push(entry);
      }

      if (entry.duration) {
        totalDuration += entry.duration;
        durationCount++;
      }
    }

    return {
      totalCommands: this.history.length,
      commandCounts,
      successRate: this.history.length > 0 ? successCount / this.history.length : 0,
      averageDuration: durationCount > 0 ? totalDuration / durationCount : 0,
      recentErrors: recentErrors.slice(-5).reverse(),
    };
  }

  /**
   * Check if history tracking is enabled
   */
  isEnabled(): boolean {
    return !this.disabled;
  }

  /**
   * Get the path to the history file
   */
  getHistoryPath(): string {
    return this.historyPath;
  }
}