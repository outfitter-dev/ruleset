import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CompiledDoc } from "../../interfaces";
import { CodexProvider } from "../codex-provider";

describe("CodexProvider", () => {
  let provider: CodexProvider;
  let tempDir: string;

  beforeEach(async () => {
    provider = new CodexProvider();
    tempDir = await fs.mkdtemp(path.join(tmpdir(), "codex-provider-test-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("name", () => {
    it('should return "codex"', () => {
      expect(provider.name).toBe("codex");
    });
  });

  describe("configSchema", () => {
    it("should return valid JSON schema", () => {
      const schema = provider.configSchema();
      expect(schema).toHaveProperty("type", "object");
      expect(schema.properties).toHaveProperty("outputPath");
      expect(schema.properties).toHaveProperty("enableSharedAgents");
      expect(schema.properties).toHaveProperty("agentsOutputPath");
    });
  });

  describe("write", () => {
    it("should write to default .codex/AGENTS.md path", async () => {
      const compiledDoc: CompiledDoc = {
        source: {
          content: "test content",
          frontmatter: { rule: { version: "1.0" } },
        },
        ast: {
          sections: [],
          imports: [],
          variables: [],
          markers: [],
        },
        output: {
          content: "# Test Rules\n\nThis is a test.",
          metadata: { title: "Test" },
        },
        context: {
          destinationId: "codex",
          config: {},
        },
      };

      const mockLogger = {
        info: (_msg: string, _meta?: any) => {
          // Mock logger info - no-op in tests
        },
        debug: (_msg: string, _meta?: any) => {
          // Mock logger debug - no-op in tests
        },
        error: (_error: Error | string, _meta?: any) => {
          // Mock logger error - no-op in tests
        },
      };

      await provider.write({
        compiled: compiledDoc,
        destPath: tempDir,
        config: {},
        logger: mockLogger,
      });

      const codexFile = path.join(tempDir, ".codex", "AGENTS.md");
      const sharedFile = path.join(tempDir, "AGENTS.md");

      // Check both files exist
      expect(
        await fs
          .access(codexFile)
          .then(() => true)
          .catch(() => false)
      ).toBe(true);
      expect(
        await fs
          .access(sharedFile)
          .then(() => true)
          .catch(() => false)
      ).toBe(true);

      // Check content
      const codexContent = await fs.readFile(codexFile, "utf-8");
      const sharedContent = await fs.readFile(sharedFile, "utf-8");

      expect(codexContent).toBe("# Test Rules\n\nThis is a test.");
      expect(sharedContent).toBe("# Test Rules\n\nThis is a test.");
    });

    it("should write to custom output path when configured", async () => {
      const compiledDoc: CompiledDoc = {
        source: {
          content: "test content",
          frontmatter: { rule: { version: "1.0" } },
        },
        ast: {
          sections: [],
          imports: [],
          variables: [],
          markers: [],
        },
        output: {
          content: "# Custom Rules\n\nCustom content.",
          metadata: { title: "Custom" },
        },
        context: {
          destinationId: "codex",
          config: {},
        },
      };

      const mockLogger = {
        info: (_msg: string, _meta?: any) => {
          // Mock logger info - no-op in tests
        },
        debug: (_msg: string, _meta?: any) => {
          // Mock logger debug - no-op in tests
        },
        error: (_error: Error | string, _meta?: any) => {
          // Mock logger error - no-op in tests
        },
      };

      const customCodexPath = "custom-codex/rules.md";
      const customAgentsPath = "custom-agents.md";

      await provider.write({
        compiled: compiledDoc,
        destPath: tempDir,
        config: {
          outputPath: customCodexPath,
          agentsOutputPath: customAgentsPath,
        },
        logger: mockLogger,
      });

      const codexFile = path.join(tempDir, customCodexPath);
      const sharedFile = path.join(tempDir, customAgentsPath);

      // Check both files exist
      expect(
        await fs
          .access(codexFile)
          .then(() => true)
          .catch(() => false)
      ).toBe(true);
      expect(
        await fs
          .access(sharedFile)
          .then(() => true)
          .catch(() => false)
      ).toBe(true);

      // Check content
      const codexContent = await fs.readFile(codexFile, "utf-8");
      const sharedContent = await fs.readFile(sharedFile, "utf-8");

      expect(codexContent).toBe("# Custom Rules\n\nCustom content.");
      expect(sharedContent).toBe("# Custom Rules\n\nCustom content.");
    });

    it("should skip shared AGENTS.md when disabled", async () => {
      const compiledDoc: CompiledDoc = {
        source: {
          content: "test content",
          frontmatter: { rule: { version: "1.0" } },
        },
        ast: {
          sections: [],
          imports: [],
          variables: [],
          markers: [],
        },
        output: {
          content: "# Codex Only Rules\n\nOnly for Codex.",
          metadata: { title: "Codex Only" },
        },
        context: {
          destinationId: "codex",
          config: {},
        },
      };

      const mockLogger = {
        info: (_msg: string, _meta?: any) => {
          // Mock logger info - no-op in tests
        },
        debug: (_msg: string, _meta?: any) => {
          // Mock logger debug - no-op in tests
        },
        error: (_error: Error | string, _meta?: any) => {
          // Mock logger error - no-op in tests
        },
      };

      await provider.write({
        compiled: compiledDoc,
        destPath: tempDir,
        config: {
          enableSharedAgents: false,
        },
        logger: mockLogger,
      });

      const codexFile = path.join(tempDir, ".codex", "AGENTS.md");
      const sharedFile = path.join(tempDir, "AGENTS.md");

      // Check only Codex file exists
      expect(
        await fs
          .access(codexFile)
          .then(() => true)
          .catch(() => false)
      ).toBe(true);
      expect(
        await fs
          .access(sharedFile)
          .then(() => true)
          .catch(() => false)
      ).toBe(false);

      // Check content
      const codexContent = await fs.readFile(codexFile, "utf-8");
      expect(codexContent).toBe("# Codex Only Rules\n\nOnly for Codex.");
    });

    it("should handle absolute paths correctly", async () => {
      const compiledDoc: CompiledDoc = {
        source: {
          content: "test content",
          frontmatter: { rule: { version: "1.0" } },
        },
        ast: {
          sections: [],
          imports: [],
          variables: [],
          markers: [],
        },
        output: {
          content: "# Absolute Path Rules\n\nAbsolute paths.",
          metadata: { title: "Absolute" },
        },
        context: {
          destinationId: "codex",
          config: {},
        },
      };

      const mockLogger = {
        info: (_msg: string, _meta?: any) => {
          // Mock logger info - no-op in tests
        },
        debug: (_msg: string, _meta?: any) => {
          // Mock logger debug - no-op in tests
        },
        error: (_error: Error | string, _meta?: any) => {
          // Mock logger error - no-op in tests
        },
      };

      const absoluteCodexPath = path.join(tempDir, "absolute-codex.md");
      const absoluteAgentsPath = path.join(tempDir, "absolute-agents.md");

      await provider.write({
        compiled: compiledDoc,
        destPath: "/some/random/path", // This should be ignored due to absolute paths
        config: {
          outputPath: absoluteCodexPath,
          agentsOutputPath: absoluteAgentsPath,
        },
        logger: mockLogger,
      });

      // Check both files exist at absolute paths
      expect(
        await fs
          .access(absoluteCodexPath)
          .then(() => true)
          .catch(() => false)
      ).toBe(true);
      expect(
        await fs
          .access(absoluteAgentsPath)
          .then(() => true)
          .catch(() => false)
      ).toBe(true);

      // Check content
      const codexContent = await fs.readFile(absoluteCodexPath, "utf-8");
      const sharedContent = await fs.readFile(absoluteAgentsPath, "utf-8");

      expect(codexContent).toBe("# Absolute Path Rules\n\nAbsolute paths.");
      expect(sharedContent).toBe("# Absolute Path Rules\n\nAbsolute paths.");
    });

    it("should handle empty content gracefully", async () => {
      const compiledDoc: CompiledDoc = {
        source: {
          content: "",
          frontmatter: undefined,
        },
        ast: {
          sections: [],
          imports: [],
          variables: [],
          markers: [],
        },
        output: {
          content: "",
          metadata: {},
        },
        context: {
          destinationId: "codex",
          config: {},
        },
      };

      const mockLogger = {
        info: (_msg: string, _meta?: any) => {
          // Mock logger info - no-op in tests
        },
        debug: (_msg: string, _meta?: any) => {
          // Mock logger debug - no-op in tests
        },
        error: (_error: Error | string, _meta?: any) => {
          // Mock logger error - no-op in tests
        },
      };

      await provider.write({
        compiled: compiledDoc,
        destPath: tempDir,
        config: {},
        logger: mockLogger,
      });

      const codexFile = path.join(tempDir, ".codex", "AGENTS.md");
      const sharedFile = path.join(tempDir, "AGENTS.md");

      // Check both files exist
      expect(
        await fs
          .access(codexFile)
          .then(() => true)
          .catch(() => false)
      ).toBe(true);
      expect(
        await fs
          .access(sharedFile)
          .then(() => true)
          .catch(() => false)
      ).toBe(true);

      // Check content is empty
      const codexContent = await fs.readFile(codexFile, "utf-8");
      const sharedContent = await fs.readFile(sharedFile, "utf-8");

      expect(codexContent).toBe("");
      expect(sharedContent).toBe("");
    });
  });
});
