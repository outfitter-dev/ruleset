import { promises as fs } from "node:fs";
import { basename, join, resolve } from "node:path";
import {
  isPathWithinBoundary,
  isPathWithinBoundaryReal,
  sanitizePath,
} from "@ruleset/lib";
import chalk from "chalk";
import { Command } from "commander";
import {
  parseFrontmatter,
  stringifyFrontmatter,
} from "../utils/frontmatter.js";
import { logger } from "../utils/logger.js";
import { createSpinner } from "../utils/spinner.js";

const DEFAULT_PARTIALS_DIR = "./.ruleset/partials";
const DEFAULT_RULE_VERSION = "0.2.0";
const EXTENSION_REGEX = /\.[^.]+$/;

function slugify(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const slug = trimmed.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "partial";
}

export function promoteCommand(): Command {
  return new Command("promote")
    .description("Convert a rule file into a reusable partial")
    .argument("<source>", "Path to the source rule file")
    .option(
      "--partials-dir <dir>",
      "Directory where partials live",
      DEFAULT_PARTIALS_DIR
    )
    .option("--name <name>", "Name of the generated partial")
    .option("--force", "Overwrite existing partials", false)
    .action(async (source: string, options) => {
      await runPromote(source, options);
    });
}

type PromoteOptions = {
  partialsDir: string;
  name?: string;
  force?: boolean;
};

async function runPromote(
  source: string,
  options: PromoteOptions
): Promise<void> {
  const spinner = createSpinner("Promoting rule to partial...");

  try {
    const cwd = process.cwd();
    const sourcePath = resolve(cwd, sanitizePath(source));
    const partialsRoot = resolve(cwd, sanitizePath(options.partialsDir));

    let sourceWithinBoundary = isPathWithinBoundary(sourcePath, cwd);
    if (!sourceWithinBoundary) {
      sourceWithinBoundary = await isPathWithinBoundaryReal(sourcePath, cwd);
    }
    if (!sourceWithinBoundary) {
      throw new Error(
        `Source path '${source}' is outside the project workspace.`
      );
    }

    const partialsWithinReal = await isPathWithinBoundaryReal(
      partialsRoot,
      cwd
    );
    if (!partialsWithinReal) {
      throw new Error(
        `Partials directory '${options.partialsDir}' resolves outside the project workspace.`
      );
    }

    const rawContent = await fs.readFile(sourcePath, "utf8");
    const { frontmatter, body } = parseFrontmatter(rawContent);
    const trimmedBody = body.trim();

    if (!trimmedBody) {
      throw new Error("Source rule file has no body content to promote.");
    }

    const partialName = options.name
      ? slugify(options.name)
      : slugify(basename(sourcePath).replace(EXTENSION_REGEX, ""));
    const partialPath = join(partialsRoot, `${partialName}.md`);

    if (!options.force) {
      try {
        await fs.access(partialPath);
        throw new Error(
          `Partial already exists at ${partialPath}. Use --force to overwrite.`
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
          throw error;
        }
      }
    }

    await fs.mkdir(partialsRoot, { recursive: true });
    await fs.writeFile(partialPath, `${trimmedBody}\n`, { encoding: "utf8" });

    const ruleFrontmatter = { ...frontmatter };
    const ruleSection =
      typeof ruleFrontmatter.rule === "object" && ruleFrontmatter.rule !== null
        ? (ruleFrontmatter.rule as Record<string, unknown>)
        : {};
    ruleSection.version = ruleSection.version ?? DEFAULT_RULE_VERSION;
    ruleSection.template = true;
    ruleFrontmatter.rule = ruleSection;

    const newBody = `{{> ${partialName} }}\n`;
    const updatedContent = `${stringifyFrontmatter(ruleFrontmatter)}${newBody}`;
    await fs.writeFile(sourcePath, updatedContent, { encoding: "utf8" });

    spinner.succeed(
      chalk.green(
        `Promoted ${chalk.cyan(sourcePath)} to partial ${chalk.cyan(partialPath)}`
      )
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown promotion failure";
    spinner.fail(chalk.red(`Failed to promote rule: ${message}`));
    logger.error(error instanceof Error ? error : new Error(String(error)));
    process.exitCode = 1;
  }
}
