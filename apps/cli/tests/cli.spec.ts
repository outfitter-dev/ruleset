import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const CLI_CWD = join(process.cwd());
const TEMP_HOME = mkdtempSync(join(tmpdir(), "rulesets-cli-test-"));
const VERSION_RE = /\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/;
const NON_WS_RE = /\S/;
const BUN_EXECUTABLE = process.env.BUN ?? "bun";

// Determine the correct CLI path based on where tests are run from
const appsCliSuffix = join("apps", "cli");
const packagesCliSuffix = join("packages", "cli");
const isInCliWorkspace =
  CLI_CWD.endsWith(appsCliSuffix) || CLI_CWD.endsWith(packagesCliSuffix);
const repoRoot = isInCliWorkspace ? dirname(dirname(CLI_CWD)) : CLI_CWD;
const cliCandidates = [
  join(repoRoot, "apps/cli/src/index.ts"),
  join(repoRoot, "packages/cli/src/index.ts"),
];
const CLI_SRC =
  cliCandidates.find((candidate) => existsSync(candidate)) ?? cliCandidates[0];
const cliPath = CLI_SRC;
const HOME_ENV_VAR = "HOME";

function runCli(args: string[], opts: { cwd?: string } = {}) {
  // Use the built CLI to avoid module resolution issues
  const res = spawnSync(BUN_EXECUTABLE, [cliPath, ...args], {
    cwd: opts.cwd ?? CLI_CWD,
    env: { ...process.env, [HOME_ENV_VAR]: TEMP_HOME },
    encoding: "utf-8",
  });
  return {
    code: typeof res.status === "number" ? res.status : 1,
    stdout: res.stdout?.toString() ?? "",
    stderr: res.stderr?.toString() ?? "",
  };
}

afterAll(() => {
  // Clean up temp HOME used by the CLI during tests
  rmSync(TEMP_HOME, { recursive: true, force: true });
});

describe("rulesets CLI smoke", () => {
  it("prints version", () => {
    const { code, stdout } = runCli(["--version"]);
    expect(code).toBe(0);
    expect(stdout).toMatch(VERSION_RE);
  });

  it("prints help", () => {
    const { code, stdout } = runCli(["--help"]);
    expect(code).toBe(0);
    expect(stdout).toContain("rulesets");
  });

  it("emits JSON logs in --json mode", () => {
    const { code, stdout } = runCli(["--json", "list"]);
    expect(code).toBe(0);
    const lines = stdout
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    const first = JSON.parse(lines[0]);
    expect(first).toHaveProperty("level");
    // Look for a friendly message indicating empty state
    const hasEmptyMsg = lines.some((l) => {
      try {
        const obj = JSON.parse(l);
        return (
          typeof obj.message === "string" &&
          obj.message.includes("No rulesets installed")
        );
      } catch {
        return false;
      }
    });
    expect(hasEmptyMsg).toBe(true);
  });

  it("supports --json after subcommand", () => {
    const { code, stdout } = runCli(["list", "--json"]);
    expect(code).toBe(0);
    const firstLine = stdout.split("\n").find((l) => l.trim().length > 0);
    expect(firstLine).toBeTruthy();
    // Should be parseable JSON
    JSON.parse(firstLine as string);
  });

  it("honors --quiet to suppress info logs", () => {
    const { code, stdout } = runCli(["list", "--quiet"]);
    expect(code).toBe(0);
    expect(stdout).not.toContain("Installed Rulesets");
    expect(stdout.trim().length === 0 || !NON_WS_RE.test(stdout)).toBeTruthy();
  });

  // TODO(gt-v0.4): Re-enable compile smoke tests once the new orchestrator-backed
  // pipeline is finished. The interim CLI flow uses a simplified provider stub.
  const legacyCompileCases = [
    { ext: ".ruleset.md", label: "legacy .ruleset.md extension" },
    { ext: ".md", label: "plain .md with rule frontmatter" },
  ] as const;

  for (const { ext, label } of legacyCompileCases) {
    it(`compiles a rules directory to output (${label})`, () => {
      const tmp = mkdtempSync(join(tmpdir(), "rulesets-cli-compile-"));
      const rulesDir = join(tmp, ".ruleset", "rules");
      mkdirSync(rulesDir, { recursive: true });

      const fileName = `example${ext}`;
      const filePath = join(rulesDir, fileName);
      const content = `---\nrule:\n  version: "0.4.0"\n---\n\n# ${label}\n`;
      writeFileSync(filePath, content);

      const outDirRel = join(".ruleset", "dist");
      const outDirAbs = join(tmp, outDirRel);
      const { code, stdout } = runCli(
        ["compile", "--output", outDirRel, "--provider", "cursor", "--json"],
        { cwd: tmp }
      );

      expect(code).toBe(0);

      const entries = stdout
        .split("\n")
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(
          (value): value is { event?: { kind?: string } } => value !== null
        );

      expect(entries.length).toBeGreaterThan(0);

      const eventKinds = entries
        .map((entry) => entry.event?.kind)
        .filter((kind): kind is string => typeof kind === "string");

      expect(eventKinds).toContain("pipeline:start");
      expect(eventKinds.at(-1)).toBe("pipeline:end");

      const cursorOutput = join(
        outDirAbs,
        "cursor",
        ".ruleset",
        "rules",
        fileName
      );
      expect(existsSync(cursorOutput)).toBe(true);
      const compiled = readFileSync(cursorOutput, "utf-8");
      expect(compiled).toContain(`# ${label}`);

      rmSync(tmp, { recursive: true, force: true });
    });
  }

  it("warns when using deprecated --destination alias", () => {
    const tmp = mkdtempSync(join(tmpdir(), "rulesets-cli-compile-alias-"));
    const rulesDir = join(tmp, ".ruleset", "rules");
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(
      join(rulesDir, "alias.md"),
      `---\nrule:\n  version: '0.2.0'\n---\n\n# Alias Test\n`
    );

    const outDirRel = join(".ruleset", "dist");
    const { code, stderr } = runCli(
      ["compile", "--output", outDirRel, "--destination", "cursor", "--json"],
      { cwd: tmp }
    );

    expect(code).toBe(0);

    const warningEntry = stderr
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .find((entry) => entry && entry.level === "warn");

    expect(warningEntry).toBeDefined();
    expect(warningEntry?.message).toContain("`--destination` is deprecated");
  });

  it("compiles using project-configured sources", () => {
    const tmp = mkdtempSync(join(tmpdir(), "rulesets-cli-config-sources-"));
    const configDir = join(tmp, ".ruleset");
    const primaryRules = join(configDir, "rules");
    const docsRules = join(tmp, "docs", "rules");
    mkdirSync(primaryRules, { recursive: true });
    mkdirSync(docsRules, { recursive: true });

    const configToml =
      `version = "0.2.0"\n` +
      `sources = ["./docs/rules", "./.ruleset/rules"]\n` +
      "\n[cursor]\n" +
      "enabled = true\n";
    writeFileSync(join(configDir, "config.toml"), configToml);

    writeFileSync(
      join(primaryRules, "project.md"),
      `---\nrule:\n  version: '0.2.0'\n---\n\n# Primary Rule\n`
    );

    writeFileSync(
      join(docsRules, "guide.md"),
      `---\nrule:\n  version: '0.2.0'\n---\n\n# Guide\n`
    );

    // Inline partial should be ignored automatically
    writeFileSync(join(primaryRules, "@footer.md"), "# Footer");

    const outDirRel = join(".ruleset", "dist");
    const outDirAbs = join(tmp, outDirRel);
    const { code } = runCli(
      ["compile", "--output", outDirRel, "--provider", "cursor", "--json"],
      { cwd: tmp }
    );

    expect(code).toBe(0);

    const outputs = join(outDirAbs, "cursor");
    expect(existsSync(join(outputs, ".ruleset", "rules", "project.md"))).toBe(
      true
    );
    expect(existsSync(join(outputs, "docs", "rules", "guide.md"))).toBe(true);
    expect(existsSync(join(outputs, ".ruleset", "rules", "@footer.md"))).toBe(
      false
    );

    rmSync(tmp, { recursive: true, force: true });
  });

  it("respects rule.globs filters from project config", () => {
    const tmp = mkdtempSync(join(tmpdir(), "rulesets-cli-globs-"));
    const configDir = join(tmp, ".ruleset");
    const rulesDir = join(configDir, "rules");
    mkdirSync(rulesDir, { recursive: true });

    const configToml =
      `version = "0.2.0"\n` +
      `sources = ["./.ruleset/rules"]\n` +
      "\n[rule]\n" +
      `globs = ["**/allowed.md", "**/special.md"]\n` +
      "\n[cursor]\n" +
      "enabled = true\n";
    writeFileSync(join(configDir, "config.toml"), configToml);

    writeFileSync(
      join(rulesDir, "allowed.md"),
      `---\nrule:\n  version: '0.2.0'\n---\n\n# Allowed\n`
    );

    writeFileSync(
      join(rulesDir, "special.md"),
      `---\nrule:\n  version: '0.2.0'\n---\n\n# Special\n`
    );

    writeFileSync(
      join(rulesDir, "ignored.md"),
      `---\nrule:\n  version: '0.2.0'\n---\n\n# Ignored\n`
    );

    const outDirRel = join(".ruleset", "dist");
    const outDirAbs = join(tmp, outDirRel);
    const { code } = runCli(
      ["compile", "--output", outDirRel, "--provider", "cursor", "--json"],
      { cwd: tmp }
    );

    expect(code).toBe(0);

    const outputs = join(outDirAbs, "cursor");
    expect(existsSync(join(outputs, ".ruleset", "rules", "allowed.md"))).toBe(
      true
    );
    expect(existsSync(join(outputs, ".ruleset", "rules", "special.md"))).toBe(
      true
    );
    expect(existsSync(join(outputs, ".ruleset", "rules", "ignored.md"))).toBe(
      false
    );

    rmSync(tmp, { recursive: true, force: true });
  });
});

describe("rules import and promote", () => {
  it("imports a Markdown file and enables templating when braces are detected", () => {
    const tmp = mkdtempSync(join(tmpdir(), "rulesets-cli-import-"));
    const sourceFile = join(tmp, "external.md");
    writeFileSync(sourceFile, "# Example\n\nValue: {{token}}\n");

    const { code, stderr } = runCli(["import", sourceFile], { cwd: tmp });
    expect(code).toBe(0);

    const importedFile = join(tmp, ".ruleset", "rules", "external.md");
    expect(existsSync(importedFile)).toBe(true);
    const importedContent = readFileSync(importedFile, "utf-8");
    expect(importedContent).toContain("rule:");
    expect(importedContent).toContain("version: 0.2.0");
    expect(importedContent).toContain("template: true");
    expect(importedContent).toContain("Value: {{token}}");
    expect(stderr).toContain("rule.template has been enabled automatically");

    rmSync(tmp, { recursive: true, force: true });
  });

  it("promotes a rule into a partial and rewrites the source file", () => {
    const tmp = mkdtempSync(join(tmpdir(), "rulesets-cli-promote-"));
    const rulesDir = join(tmp, ".ruleset", "rules");
    mkdirSync(rulesDir, { recursive: true });
    const rulePath = join(rulesDir, "guide.md");
    writeFileSync(
      rulePath,
      "---\nrule:\n  version: 0.2.0\n  template: false\n---\n\n# Getting Started\n\nFollow these steps.\n"
    );

    const { code } = runCli(
      ["promote", rulePath, "--name", "getting-started"],
      { cwd: tmp }
    );
    expect(code).toBe(0);

    const partialPath = join(tmp, ".ruleset", "partials", "getting-started.md");
    expect(existsSync(partialPath)).toBe(true);
    const partialContent = readFileSync(partialPath, "utf-8");
    expect(partialContent).toContain("# Getting Started");
    expect(partialContent).toContain("Follow these steps.");

    const updatedRule = readFileSync(rulePath, "utf-8");
    expect(updatedRule).toContain("template: true");
    expect(updatedRule).toContain("{{> getting-started }}");

    rmSync(tmp, { recursive: true, force: true });
  });
});

describe("preset functionality", () => {
  it("lists presets when --presets flag is used", () => {
    const tmp = mkdtempSync(join(tmpdir(), "rulesets-cli-list-presets-"));
    const presetsDir = join(tmp, ".ruleset", "presets");
    mkdirSync(presetsDir, { recursive: true });

    // Create a sample preset
    const presetContent = `name: test-preset
version: 1.0.0
description: A test preset
author: Test Author
rules:
  - name: coding-standards
    source: https://example.com/rules/coding-standards.md
    description: Basic coding standards
  - name: security-guide
    source: https://example.com/rules/security.md
    description: Security guidelines
`;
    writeFileSync(join(presetsDir, "test-preset.yaml"), presetContent);

    const { code, stdout } = runCli(["list", "--presets", "--json"], {
      cwd: tmp,
    });
    expect(code).toBe(0);
    expect(stdout).toContain("Available Presets:");
    expect(stdout).toContain("test-preset@1.0.0");
    expect(stdout).toContain("A test preset");
    expect(stdout).toContain("Test Author");
    expect(stdout).toContain("coding-standards, security-guide (2 total)");

    rmSync(tmp, { recursive: true, force: true });
  });

  it("installs rules from a preset", () => {
    const tmp = mkdtempSync(join(tmpdir(), "rulesets-cli-install-preset-"));
    const presetsDir = join(tmp, ".ruleset", "presets");
    const rulesDir = join(tmp, ".ruleset", "rules");
    mkdirSync(presetsDir, { recursive: true });

    // Create a test preset with a data: URL for easy testing
    const presetContent = `name: install-test-preset
version: 1.0.0
description: Preset for installation testing
rules:
  - name: test-rule
    source: "data:text/plain,# Test Rule\\n\\nThis is a test rule from a preset."
    description: A simple test rule
`;
    writeFileSync(join(presetsDir, "install-test-preset.yaml"), presetContent);

    const { code, stdout } = runCli(
      ["install", "--preset", "install-test-preset", "--json"],
      { cwd: tmp }
    );

    expect(code).toBe(0);
    expect(stdout).toContain(
      "Successfully installed 1 rules from preset 'install-test-preset'"
    );
    expect(stdout).toContain("install-test-preset");

    // Check that the rule file was created
    const ruleFile = join(rulesDir, "test-rule.md");
    expect(existsSync(ruleFile)).toBe(true);
    const ruleContent = readFileSync(ruleFile, "utf-8");
    expect(ruleContent).toContain("# Test Rule");
    expect(ruleContent).toContain("This is a test rule from a preset.");

    // Check tracking file exists
    const trackingFile = join(tmp, ".ruleset", "preset-tracking.json");
    expect(existsSync(trackingFile)).toBe(true);

    rmSync(tmp, { recursive: true, force: true });
  });

  it("fails gracefully when preset does not exist", () => {
    const tmp = mkdtempSync(
      join(tmpdir(), "rulesets-cli-install-nonexistent-")
    );

    const { code, stderr } = runCli(
      ["install", "--preset", "nonexistent-preset", "--json"],
      { cwd: tmp }
    );

    expect(code).toBe(1);
    expect(stderr).toContain("Preset 'nonexistent-preset' not found");

    rmSync(tmp, { recursive: true, force: true });
  });

  it("updates installed presets", () => {
    const tmp = mkdtempSync(join(tmpdir(), "rulesets-cli-update-preset-"));
    const presetsDir = join(tmp, ".ruleset", "presets");
    mkdirSync(presetsDir, { recursive: true });

    // First install a preset
    const presetContent = `name: update-test-preset
version: 1.0.0
description: Preset for update testing
rules:
  - name: update-test-rule
    source: "data:text/plain,# Update Test Rule v1.0.0\\n\\nThis is version 1.0.0"
    description: A rule for testing updates
`;
    writeFileSync(join(presetsDir, "update-test-preset.yaml"), presetContent);

    // Install the preset
    const { code } = runCli(
      ["install", "--preset", "update-test-preset", "--json"],
      { cwd: tmp }
    );
    expect(code).toBe(0);

    // Update the preset to version 2.0.0
    const updatedPresetContent = `name: update-test-preset
version: 2.0.0
description: Updated preset for update testing
rules:
  - name: update-test-rule
    source: "data:text/plain,# Update Test Rule v2.0.0\\n\\nThis is version 2.0.0 - updated!"
    description: An updated rule for testing updates
`;
    writeFileSync(
      join(presetsDir, "update-test-preset.yaml"),
      updatedPresetContent
    );

    // Run update command
    const updateResult = runCli(["update", "--json"], { cwd: tmp });
    expect(updateResult.code).toBe(0);
    expect(updateResult.stdout).toContain(
      "Successfully installed 1 rules from preset 'update-test-preset'"
    );
    expect(updateResult.stdout).toContain("update-test-preset (2.0.0)");

    // Check that the rule file was updated
    const ruleFile = join(tmp, ".ruleset", "rules", "update-test-rule.md");
    const updatedContent = readFileSync(ruleFile, "utf-8");
    expect(updatedContent).toContain("# Update Test Rule v2.0.0");
    expect(updatedContent).toContain("This is version 2.0.0 - updated!");

    rmSync(tmp, { recursive: true, force: true });
  });
});
