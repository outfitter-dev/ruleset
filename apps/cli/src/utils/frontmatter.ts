export type FrontmatterResult = {
  frontmatter: Record<string, unknown>;
  body: string;
};

const FRONTMATTER_DELIMITER = "---";

export function parseFrontmatter(content: string): FrontmatterResult {
  if (!content.startsWith(FRONTMATTER_DELIMITER)) {
    return { frontmatter: {}, body: content };
  }

  const lines = content.split("\n");
  let closingIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === FRONTMATTER_DELIMITER) {
      closingIndex = i;
      break;
    }
  }

  if (closingIndex === -1) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterSegment = lines.slice(1, closingIndex).join("\n");
  const body = lines.slice(closingIndex + 1).join("\n");

  try {
    const parsed = Bun.YAML.parse(frontmatterSegment);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { frontmatter: parsed as Record<string, unknown>, body };
    }
    return { frontmatter: {}, body };
  } catch {
    return { frontmatter: {}, body: content };
  }
}

export function stringifyFrontmatter(
  frontmatter: Record<string, unknown>
): string {
  const serialized = Bun.YAML.stringify(frontmatter, null, 0).trimEnd();
  return `${FRONTMATTER_DELIMITER}\n${serialized}\n${FRONTMATTER_DELIMITER}\n\n`;
}

export function detectHandlebarsExpressions(markdown: string): boolean {
  const lines = markdown.split("\n");
  let inFence = false;

  for (const line of lines) {
    const trimmed = line.trimStart();
    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }

    let searchIndex = line.indexOf("{{");
    while (searchIndex !== -1) {
      if (searchIndex > 0 && line.charAt(searchIndex - 1) === "\\") {
        searchIndex = line.indexOf("{{", searchIndex + 2);
        continue;
      }
      return true;
    }
  }

  return false;
}
