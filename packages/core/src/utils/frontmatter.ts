export type ExtractBodyOptions = {
  hasFrontmatter: boolean;
  trim?: boolean;
};

/**
 * Removes YAML frontmatter from a Markdown document and returns the remaining body.
 * When `hasFrontmatter` is false, the content is returned unchanged (optionally trimmed).
 */
export function extractBodyFromContent(
  content: string,
  { hasFrontmatter, trim = false }: ExtractBodyOptions
): string {
  const applyTrim = (value: string): string => (trim ? value.trim() : value);

  if (!hasFrontmatter) {
    return applyTrim(content);
  }

  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") {
    return applyTrim(content);
  }

  for (let i = 1; i < lines.length; i++) {
    if (lines[i]?.trim() === "---") {
      const body = lines.slice(i + 1).join("\n");
      return applyTrim(body);
    }
  }

  return applyTrim(content);
}
