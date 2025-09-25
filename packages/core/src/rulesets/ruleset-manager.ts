import { promises as fs } from "node:fs";
import { join } from "node:path";
import { parse as tomlParse, stringify as tomlStringify } from "@iarna/toml";
import type { GlobalConfig } from "../config/global-config";

export type RulesetMetadata = {
  name: string;
  version: string;
  description?: string;
  author?: string;
  tags?: string[];
  extends?: string;
};

export type ComposedRuleset = {
  name: string;
  rules: string;
  metadata: {
    set: RulesetMetadata;
  };
};

export type RulesetManagerOptions = {
  globalDir?: string;
};

/**
 * Manages rulesets including composition and inheritance
 */
export class RulesetManager {
  private readonly globalDir: string;
  private readonly cache: Map<string, ComposedRuleset> = new Map();

  constructor(
    globalConfig: Pick<GlobalConfig, "getGlobalDirectory">,
    options: RulesetManagerOptions = {}
  ) {
    this.globalDir = options.globalDir || globalConfig.getGlobalDirectory();
  }

  /**
   * Get a ruleset by name
   */
  async getRuleset(name: string): Promise<ComposedRuleset> {
    // Check cache first
    const cached = this.cache.get(name);
    if (cached) {
      return cached;
    }

    const rulesetDir = join(this.globalDir, "sets", name);
    const metaPath = join(rulesetDir, "meta.toml");
    const rulesPath = join(rulesetDir, "rules.md");

    // Read metadata
    const metaContent = await fs.readFile(metaPath, "utf-8");
    const metadata = tomlParse(metaContent) as { set: RulesetMetadata };

    // Read rules
    const rules = await fs.readFile(rulesPath, "utf-8");

    const ruleset: ComposedRuleset = {
      name,
      rules,
      metadata: {
        set: metadata.set,
      },
    };

    this.cache.set(name, ruleset);
    return ruleset;
  }

  /**
   * Compose a ruleset with its parent rulesets
   */
  async compose(name: string): Promise<ComposedRuleset> {
    const ruleset = await this.getRuleset(name);

    // If ruleset extends another, merge them
    if (ruleset.metadata.set.extends) {
      const parent = await this.compose(ruleset.metadata.set.extends);

      // Merge rules (parent first, then child)
      ruleset.rules = `${parent.rules}\n\n${ruleset.rules}`;
    }

    return ruleset;
  }

  /**
   * List available rulesets
   */
  async listRulesets(): Promise<string[]> {
    const setsDir = join(this.globalDir, "sets");

    try {
      const entries = await fs.readdir(setsDir, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    } catch {
      return [];
    }
  }

  /**
   * List global rulesets
   */
  async listGlobalRulesets(): Promise<
    Array<{ name: string; path: string; version: string; description?: string }>
  > {
    const setsDir = join(this.globalDir, "sets");
    const results: Array<{
      name: string;
      path: string;
      version: string;
      description?: string;
    }> = [];

    try {
      const entries = await fs.readdir(setsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const metaPath = join(setsDir, entry.name, "meta.toml");
          try {
            const metaContent = await fs.readFile(metaPath, "utf-8");
            const metadata = tomlParse(metaContent) as RulesetMetadata;
            results.push({
              name: entry.name,
              path: join(setsDir, entry.name),
              version: metadata.version || "1.0.0",
              description: metadata.description,
            });
          } catch {
            // If no meta.toml, still include the ruleset with defaults
            results.push({
              name: entry.name,
              path: join(setsDir, entry.name),
              version: "1.0.0",
            });
          }
        }
      }
    } catch {
      // Return empty array if directory doesn't exist
      return [];
    }

    return results;
  }

  /**
   * List local rulesets
   */
  async listLocalRulesets(
    projectDir: string
  ): Promise<Array<{ name: string; path: string; destinations: string[] }>> {
    // For v0.1, check for local rules directory
    const rulesDir = join(projectDir, "rules");

    try {
      const entries = await fs.readdir(rulesDir);
      return entries
        .filter((entry) => entry.endsWith(".md"))
        .map((entry) => ({
          name: entry.replace(".md", ""),
          path: join(rulesDir, entry),
          destinations: ["cursor", "windsurf", "claude-code"],
        }));
    } catch {
      return [];
    }
  }

  /**
   * Create a new ruleset
   */
  async createRuleset(
    name: string,
    metadata: RulesetMetadata,
    rules: string
  ): Promise<void> {
    const rulesetDir = join(this.globalDir, "sets", name);

    // Create directory
    await fs.mkdir(rulesetDir, { recursive: true });

    // Write metadata
    const metaPath = join(rulesetDir, "meta.toml");
    const metaContent = tomlStringify({ set: metadata } as unknown as {
      set: RulesetMetadata;
    });
    await fs.writeFile(metaPath, metaContent, "utf-8");

    // Write rules
    const rulesPath = join(rulesetDir, "rules.md");
    await fs.writeFile(rulesPath, rules, "utf-8");

    // Clear cache
    this.cache.delete(name);
  }
}
