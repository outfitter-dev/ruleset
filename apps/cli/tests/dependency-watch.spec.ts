import { describe, expect, it } from "bun:test";
import path from "node:path";

import {
  collectDependencyWatchPaths,
  isPathWithin,
  shouldInvalidateCache,
} from "../src/utils/dependency-watch";

describe("dependency watch utilities", () => {
  it("collects default dependency directories", () => {
    const cwd = "/project";
    const result = collectDependencyWatchPaths({ cwd });
    expect(result.has(path.resolve(cwd, ".ruleset/partials"))).toBe(true);
    expect(result.has(path.resolve(cwd, ".ruleset/_mixins"))).toBe(true);
    expect(result.has(path.resolve(cwd, ".ruleset/templates"))).toBe(true);
  });

  it("honours project-configured partial and template paths", () => {
    const cwd = "/project";
    const result = collectDependencyWatchPaths({
      cwd,
      projectConfig: {
        paths: {
          partials: "custom/partials",
          templates: "/absolute/templates",
        },
      },
    });

    expect(result.has(path.resolve(cwd, "custom/partials"))).toBe(true);
    expect(result.has(path.resolve("/absolute/templates"))).toBe(true);
  });

  it("determines when a path lies within another", () => {
    const ancestor = "/project/.ruleset/partials";
    expect(isPathWithin(ancestor, "/project/.ruleset/partials/footer.md")).toBe(
      true
    );
    expect(isPathWithin(ancestor, "/project/other/file.md")).toBe(false);
  });

  it("returns true when cache invalidation is required", () => {
    const dependencies = new Set<string>([
      path.resolve("/project/.ruleset/partials"),
    ]);
    const changed = new Set<string>([
      path.resolve("/project/.ruleset/partials/footer.md"),
    ]);
    expect(shouldInvalidateCache(changed, dependencies)).toBe(true);
  });

  it("returns false when changes are outside dependency directories", () => {
    const dependencies = new Set<string>([
      path.resolve("/project/.ruleset/partials"),
    ]);
    const changed = new Set<string>([
      path.resolve("/project/.ruleset/rules/example.rule.md"),
    ]);
    expect(shouldInvalidateCache(changed, dependencies)).toBe(false);
  });
});
