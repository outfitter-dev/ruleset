import type { JsonValue } from "@ruleset/types";
import type { ParsedDoc } from "../interfaces";

export const extractFrontmatter = (
  parsed: ParsedDoc
): Record<string, JsonValue> | undefined => {
  const frontmatter = parsed.source.frontmatter;
  if (
    frontmatter &&
    typeof frontmatter === "object" &&
    !Array.isArray(frontmatter)
  ) {
    return frontmatter as Record<string, JsonValue>;
  }
  return;
};
