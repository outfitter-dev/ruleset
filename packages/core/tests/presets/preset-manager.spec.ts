import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dump } from "js-yaml";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GlobalConfig } from "../../src/config/global-config";
import {
  type PresetDefinition,
  PresetManager,
} from "../../src/presets/preset-manager";

describe("PresetManager", () => {
  let tempDir: string;
  let globalConfig: GlobalConfig;
  let presetManager: PresetManager;
  let projectDir: string;

  beforeEach(async () => {
    // Create temporary directories
    tempDir = await fs.mkdtemp(join(tmpdir(), "preset-test-"));
    projectDir = join(tempDir, "project");
    await fs.mkdir(projectDir, { recursive: true });

    // Set up GlobalConfig with test directory
    process.env.RULESETS_HOME = join(tempDir, "global");
    GlobalConfig.resetForTest(); // Reset singleton for test
    globalConfig = GlobalConfig.getInstance();
    await globalConfig.ensureConfigExists();

    presetManager = new PresetManager(globalConfig, projectDir);
  });

  afterEach(async () => {
    // Clean up
    await fs.rm(tempDir, { recursive: true, force: true });
    process.env.RULESETS_HOME = undefined;
    GlobalConfig.resetForTest();
  });

  describe("listAvailablePresets", () => {
    it("should return empty array when no presets exist", async () => {
      const presets = await presetManager.listAvailablePresets();
      expect(presets).toEqual([]);
    });

    it("should discover presets from global directory", async () => {
      const globalPresetsDir = globalConfig.getPresetsDirectory();
      await fs.mkdir(globalPresetsDir, { recursive: true });

      const preset: PresetDefinition = {
        name: "test-preset",
        version: "1.0.0",
        description: "A test preset",
        author: "Test Author",
        rules: [
          {
            name: "coding-standards",
            source: "https://example.com/rules/coding-standards.md",
            description: "Basic coding standards",
          },
        ],
      };

      await fs.writeFile(
        join(globalPresetsDir, "test-preset.yaml"),
        dump(preset),
        "utf-8"
      );

      const presets = await presetManager.listAvailablePresets();
      expect(presets).toHaveLength(1);
      expect(presets[0].name).toBe("test-preset");
      expect(presets[0].version).toBe("1.0.0");
      expect(presets[0].rules).toHaveLength(1);
    });

    it("should discover presets from project directory", async () => {
      const projectPresetsDir = join(projectDir, ".ruleset", "presets");
      await fs.mkdir(projectPresetsDir, { recursive: true });

      const preset: PresetDefinition = {
        name: "project-preset",
        version: "2.0.0",
        description: "A project-specific preset",
        rules: [
          {
            name: "project-standards",
            source: "file://./rules/project-standards.md",
          },
        ],
      };

      await fs.writeFile(
        join(projectPresetsDir, "project-preset.yml"),
        dump(preset),
        "utf-8"
      );

      const presets = await presetManager.listAvailablePresets();
      expect(presets).toHaveLength(1);
      expect(presets[0].name).toBe("project-preset");
      expect(presets[0].version).toBe("2.0.0");
    });

    it("should ignore invalid preset files", async () => {
      const globalPresetsDir = globalConfig.getPresetsDirectory();
      await fs.mkdir(globalPresetsDir, { recursive: true });

      // Invalid preset (missing required fields)
      const invalidPreset = {
        name: "invalid-preset",
        // missing version and rules
      };

      await fs.writeFile(
        join(globalPresetsDir, "invalid.yaml"),
        dump(invalidPreset),
        "utf-8"
      );

      // Valid preset
      const validPreset: PresetDefinition = {
        name: "valid-preset",
        version: "1.0.0",
        rules: [],
      };

      await fs.writeFile(
        join(globalPresetsDir, "valid.yaml"),
        dump(validPreset),
        "utf-8"
      );

      const presets = await presetManager.listAvailablePresets();
      expect(presets).toHaveLength(1);
      expect(presets[0].name).toBe("valid-preset");
    });
  });

  describe("installPreset", () => {
    let samplePreset: PresetDefinition;

    beforeEach(async () => {
      // Create a sample preset
      const globalPresetsDir = globalConfig.getPresetsDirectory();
      await fs.mkdir(globalPresetsDir, { recursive: true });

      samplePreset = {
        name: "sample-preset",
        version: "1.0.0",
        description: "Sample preset for testing",
        rules: [
          {
            name: "rule1",
            source: "data:text/plain,# Rule 1\nThis is rule 1 content",
            description: "First rule",
          },
        ],
      };

      await fs.writeFile(
        join(globalPresetsDir, "sample-preset.yaml"),
        dump(samplePreset),
        "utf-8"
      );

      // Mock fetch for data: URLs
      const dataTextPlainPrefixLength = 16; // "data:text/plain,".length
      globalThis.fetch = (url: string) => {
        if (url.startsWith("data:text/plain,")) {
          const content = decodeURIComponent(
            url.slice(dataTextPlainPrefixLength)
          );
          return Promise.resolve({
            ok: true,
            text: async () => content,
          } as Response);
        }
        throw new Error(`Unsupported URL: ${url}`);
      };
    });

    it("should install rules from a preset", async () => {
      const result = await presetManager.installPreset("sample-preset");

      expect(result.presetName).toBe("sample-preset");
      expect(result.presetVersion).toBe("1.0.0");
      expect(result.installedRules).toHaveLength(1);
      expect(result.installedRules[0].name).toBe("rule1");

      // Check that rule file was created
      const ruleFile = join(projectDir, ".ruleset", "rules", "rule1.md");
      const content = await fs.readFile(ruleFile, "utf-8");
      expect(content).toBe("# Rule 1\nThis is rule 1 content");
    });

    it("should skip existing rules when overwrite is false", async () => {
      const targetDir = join(projectDir, ".ruleset", "rules");
      await fs.mkdir(targetDir, { recursive: true });

      // Create existing rule file
      const existingFile = join(targetDir, "rule1.md");
      await fs.writeFile(existingFile, "# Existing Rule 1", "utf-8");

      const result = await presetManager.installPreset("sample-preset", {
        overwrite: false,
      });

      expect(result.installedRules).toHaveLength(0);

      // Check that existing content wasn't overwritten
      const content = await fs.readFile(existingFile, "utf-8");
      expect(content).toBe("# Existing Rule 1");
    });

    it("should overwrite existing rules when overwrite is true", async () => {
      const targetDir = join(projectDir, ".ruleset", "rules");
      await fs.mkdir(targetDir, { recursive: true });

      // Create existing rule file
      const existingFile = join(targetDir, "rule1.md");
      await fs.writeFile(existingFile, "# Existing Rule 1", "utf-8");

      const result = await presetManager.installPreset("sample-preset", {
        overwrite: true,
      });

      expect(result.installedRules).toHaveLength(1);

      // Check that content was overwritten
      const content = await fs.readFile(existingFile, "utf-8");
      expect(content).toBe("# Rule 1\nThis is rule 1 content");
    });

    it("should throw error for non-existent preset", async () => {
      await expect(
        presetManager.installPreset("non-existent-preset")
      ).rejects.toThrow("Preset 'non-existent-preset' not found");
    });

    it("should use custom target directory", async () => {
      const customTarget = join(projectDir, "custom-rules");

      const result = await presetManager.installPreset("sample-preset", {
        targetDir: customTarget,
      });

      expect(result.installedRules[0].targetPath).toBe(
        join(customTarget, "rule1.md")
      );

      // Check file exists in custom directory
      const ruleFile = join(customTarget, "rule1.md");
      await expect(fs.stat(ruleFile)).resolves.toBeDefined();
    });

    it("should resolve relative rule sources against the preset file", async () => {
      const globalPresetsDir = globalConfig.getPresetsDirectory();
      const rulesDir = join(globalPresetsDir, "corp-rules");
      await fs.mkdir(rulesDir, { recursive: true });

      const localRulePath = join(rulesDir, "corp.md");
      const localRuleContent = "# Corp Standards\nFollow the corp preset.";
      await fs.writeFile(localRulePath, localRuleContent, "utf-8");

      const presetWithRelativeSource: PresetDefinition = {
        name: "corp-preset",
        version: "3.0.0",
        rules: [
          {
            name: "corp",
            source: "./corp-rules/corp.md",
            description: "Corporate baseline rules",
          },
        ],
      };

      await fs.writeFile(
        join(globalPresetsDir, "corp-preset.yaml"),
        dump(presetWithRelativeSource),
        "utf-8"
      );

      const result = await presetManager.installPreset("corp-preset");

      expect(result.installedRules).toHaveLength(1);
      const installedRulePath = join(
        projectDir,
        ".ruleset",
        "rules",
        "corp.md"
      );
      const installedContent = await fs.readFile(installedRulePath, "utf-8");
      expect(installedContent).toBe(localRuleContent);
    });
  });

  describe("getInstalledPresets", () => {
    it("should return empty object when no presets installed", async () => {
      const installed = await presetManager.getInstalledPresets();
      expect(installed).toEqual({});
    });

    it("should track installed presets", async () => {
      // Set up preset
      const globalPresetsDir = globalConfig.getPresetsDirectory();
      await fs.mkdir(globalPresetsDir, { recursive: true });

      const preset: PresetDefinition = {
        name: "tracked-preset",
        version: "1.0.0",
        rules: [
          {
            name: "tracked-rule",
            source: "data:text/plain,# Tracked Rule",
          },
        ],
      };

      await fs.writeFile(
        join(globalPresetsDir, "tracked-preset.yaml"),
        dump(preset),
        "utf-8"
      );

      // Mock fetch
      globalThis.fetch = async () =>
        ({
          ok: true,
          text: async () => "# Tracked Rule",
        }) as Response;

      // Install preset
      await presetManager.installPreset("tracked-preset");

      // Check tracking
      const installed = await presetManager.getInstalledPresets();
      expect(installed["tracked-preset"]).toBeDefined();
      expect(installed["tracked-preset"].presetName).toBe("tracked-preset");
      expect(installed["tracked-preset"].presetVersion).toBe("1.0.0");
      expect(installed["tracked-preset"].installedRules).toHaveLength(1);
    });
  });
});
