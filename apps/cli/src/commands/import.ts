import { promises as fs } from "node:fs";
import { basename, join, resolve } from "node:path";
import {
  isPathWithinBoundary,
  isPathWithinBoundaryReal,
  sanitizePath,
} from "@rulesets/lib";
import chalk from "chalk";
import { Command } from "commander";
import {
  detectHandlebarsExpressions,
  parseFrontmatter,
  stringifyFrontmatter,
} from "../utils/frontmatter.js";
import { logger } from "../utils/logger.js";
import { createSpinner } from "../utils/spinner.js";

const DEFAULT_TARGET_DIR = "./.ruleset/rules";
const DEFAULT_RULE_VERSION = "0.2.0";
const EXTENSION_REGEX = /\.[^.]+$/;

function slugify(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const slug = trimmed.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "imported-rule";
}

async function ensureDirectory(path: string): Promise<void> {
  await fs.mkdir(path, { recursive: true });
}

async function resolveTargetPath(
  targetDir: string,
  slug: string
): Promise<string> {
  await ensureDirectory(targetDir);
  return join(targetDir, `${slug}.md`);
}

export function importCommand(): Command {
  return new Command("import")
    .description("Copy an external Markdown file into .ruleset/rules/")
    .argument("<source>", "Path to the source Markdown file")
    .option("--target <dir>", "Target rules directory", DEFAULT_TARGET_DIR)
    .option("--slug <slug>", "Override the generated filename slug")
    .option("--enable-template", "Set rule.template: true when copying", false)
    .option("--force", "Overwrite existing files", false)
    .action(async (source: string, options) => {
      await runImport(source, options);
    });
}

type ImportOptions = {
  target: string;
  slug?: string;
  enableTemplate?: boolean;
  force?: boolean;
};

async function runImport(
  source: string,
  options: ImportOptions
): Promise<void> {
  const spinner = createSpinner("Importing rule...");

  try {
    const cwd = process.cwd();
    const { sourcePath, targetRoot } = resolveImportPaths(
      source,
      options.target,
      cwd
    );

    await assertTargetWithinWorkspace(targetRoot, cwd, options.target);

    const { normalizedBody, hasHandlebars } =
      await readNormalizedBody(sourcePath);
    const templateEnabled = hasHandlebars || Boolean(options.enableTemplate);

    const slug = createSlug(sourcePath, options.slug);
    const targetPath = await resolveTargetPath(targetRoot, slug);

    await ensureTargetWritable(targetPath, Boolean(options.force));

    const content = buildRuleContent(templateEnabled, normalizedBody);

    await fs.writeFile(targetPath, content, { encoding: "utf8" });

    spinner.succeed(
      chalk.green(
        `Imported ${chalk.cyan(basename(sourcePath))} -> ${chalk.cyan(
          targetPath
        )}`
      )
    );

    if (shouldWarnOnTemplate(hasHandlebars, options.enableTemplate)) {
      logger.warn(
        chalk.yellow(
          "Detected `{{` braces; rule.template has been enabled automatically. Escape the braces (e.g. \\{{) to keep templating disabled."
        )
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown import failure";
    spinner.fail(chalk.red(`Failed to import rule: ${message}`));
    logger.error(error instanceof Error ? error : new Error(String(error)));
    process.exitCode = 1;
  }
}

function resolveImportPaths(
  source: string,
  target: string,
  cwd: string
): { sourcePath: string; targetRoot: string } {
  return {
    sourcePath: resolve(cwd, sanitizePath(source)),
    targetRoot: resolve(cwd, sanitizePath(target)),
  };
}

async function assertTargetWithinWorkspace(
  targetRoot: string,
  cwd: string,
  targetInput: string
): Promise<void> {
  if (!isPathWithinBoundary(targetRoot, cwd)) {
    throw new Error(
      `Target directory '${targetInput}' is outside the project workspace.`
    );
  }

  if (!(await isPathWithinBoundaryReal(targetRoot, cwd))) {
    throw new Error(
      `Target directory '${targetInput}' resolves outside the project workspace.`
    );
  }
}

async function readNormalizedBody(sourcePath: string): Promise<{
  normalizedBody: string;
  hasHandlebars: boolean;
}> {
  const rawContent = await fs.readFile(sourcePath, "utf8");
  const { body: originalBody } = parseFrontmatter(rawContent);
  const trimmedBody = originalBody.trimStart();
  const normalizedBody = trimmedBody.length > 0 ? `${trimmedBody}\n` : "";
  const hasHandlebars = detectHandlebarsExpressions(normalizedBody);
  return { normalizedBody, hasHandlebars };
}

function createSlug(sourcePath: string, requestedSlug?: string): string {
  if (requestedSlug) {
    return slugify(requestedSlug);
  }

  const baseName = basename(sourcePath).replace(EXTENSION_REGEX, "");
  return slugify(baseName);
}

async function ensureTargetWritable(
  targetPath: string,
  forceOverwrite: boolean
): Promise<void> {
  if (forceOverwrite) {
    return;
  }

  try {
    await fs.access(targetPath);
    throw new Error(
      `Target file already exists: ${targetPath}. Use --force to overwrite.`
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

function buildRuleContent(
  templateEnabled: boolean,
  normalizedBody: string
): string {
  const frontmatter: Record<string, unknown> = {
    rule: {
      version: DEFAULT_RULE_VERSION,
      template: templateEnabled,
    },
  };
  return `${stringifyFrontmatter(frontmatter)}${normalizedBody}`;
}

function shouldWarnOnTemplate(
  hasHandlebars: boolean,
  enableTemplate?: boolean
): boolean {
  return hasHandlebars && !enableTemplate;
}
