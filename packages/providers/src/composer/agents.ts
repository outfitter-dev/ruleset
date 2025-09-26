import { promises as fs } from "node:fs";
import path from "node:path";

import type { RulesetDiagnostic, RulesetDiagnostics } from "@rulesets/types";
import { glob } from "glob";

import { createDiagnostic } from "../shared";

export type AgentsComposerOptions = {
  readonly baseDir: string;
  readonly includeGlobs?: readonly string[];
  readonly deduplicateHeadings?: boolean;
};

export type AgentsComposerResult = {
  readonly content: string;
  readonly sources: readonly string[];
  readonly diagnostics: RulesetDiagnostics;
};

const DEFAULT_INCLUDE_GLOBS = [
  ".ruleset/rules/**/*.md",
  ".agents/rules/**/*.md",
] as const;

const AGENTS_HEADER = "# AGENTS";

const SOURCE_HEADER = (relativePath: string) =>
  `<!-- Source: ${relativePath} -->`;

const HEADING_PATTERN = /^#{1,6}\s+/;
const NEWLINE_PATTERN = /\r?\n/;
const MULTI_NEWLINES_PATTERN = /\n{3,}/g;

const isHeading = (line: string): boolean => HEADING_PATTERN.test(line.trim());

const headingKey = (line: string): string =>
  line.trim().replace(HEADING_PATTERN, "").toLowerCase();

const normalizeGlobs = (globs?: readonly string[]): readonly string[] => {
  if (!globs || globs.length === 0) {
    return DEFAULT_INCLUDE_GLOBS;
  }
  const normalized: string[] = [];
  for (const entry of globs) {
    if (typeof entry === "string" && entry.trim().length > 0) {
      normalized.push(entry.trim());
    }
  }
  return normalized.length === 0 ? DEFAULT_INCLUDE_GLOBS : normalized;
};

const readFileSafe = async (filePath: string): Promise<string | undefined> => {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return;
  }
};

const dedupeHeadings = (content: string, seen: Set<string>): string => {
  const lines = content.split(NEWLINE_PATTERN);
  const result: string[] = [];
  for (const line of lines) {
    if (isHeading(line)) {
      const key = headingKey(line);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
    }
    result.push(line);
  }
  return result.join("\n");
};

export class AgentsComposer {
  async compose(options: AgentsComposerOptions): Promise<AgentsComposerResult> {
    const includeGlobs = normalizeGlobs(options.includeGlobs);
    const cwd = options.baseDir;
    const diagnostics: RulesetDiagnostic[] = [];

    const matches = await glob([...includeGlobs], {
      cwd,
      absolute: true,
      ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
    });

    const stringMatches = matches.map((entry) => String(entry));
    const uniqueMatches = Array.from(new Set(stringMatches)).sort();

    if (uniqueMatches.length === 0) {
      diagnostics.push(
        createDiagnostic({
          level: "warning",
          message: "No rules matched for agents composer globs.",
          hint: `Checked patterns: ${includeGlobs.join(", ")}`,
          tags: ["provider", "agents-md", "composer"],
        })
      );
      return {
        content: `${AGENTS_HEADER}\n\nNo rule files found for composition.\n`,
        sources: [],
        diagnostics,
      };
    }

    const pieces: string[] = [];
    pieces.push(
      AGENTS_HEADER,
      "",
      `> This file is composed from ${uniqueMatches.length} rule files.`,
      ""
    );

    const seenHeadings = new Set<string>();
    const dedupe = options.deduplicateHeadings !== false;

    for (const absolutePath of uniqueMatches) {
      const contents = await readFileSafe(absolutePath);
      if (!contents) {
        diagnostics.push(
          createDiagnostic({
            level: "warning",
            message: `Failed to read rule file: ${absolutePath}`,
            tags: ["provider", "agents-md", "composer"],
          })
        );
        continue;
      }

      const relative = path.relative(cwd, absolutePath);
      pieces.push(SOURCE_HEADER(relative), "");

      const trimmed = contents.trim();
      const maybeDeduped = dedupe
        ? dedupeHeadings(trimmed, seenHeadings)
        : trimmed;
      pieces.push(maybeDeduped, "");
    }

    const content = `${pieces
      .join("\n")
      .replace(MULTI_NEWLINES_PATTERN, "\n\n")
      .trimEnd()}\n`;

    return {
      content,
      sources: uniqueMatches,
      diagnostics,
    };
  }
}

export const createAgentsComposer = () => new AgentsComposer();
