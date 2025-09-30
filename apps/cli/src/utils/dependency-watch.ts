import path from "node:path";

import type { RulesetProjectConfig } from "@rulesets/types";

const DEFAULT_DEPENDENCY_PATHS = [
  ".ruleset/partials",
  ".ruleset/_mixins",
  ".ruleset/templates",
];

export type DependencyWatchContext = {
  readonly cwd: string;
  readonly projectConfig?: RulesetProjectConfig;
};

const toAbsolutePath = (cwd: string, target: string): string =>
  path.isAbsolute(target) ? path.resolve(target) : path.resolve(cwd, target);

export const collectDependencyWatchPaths = ({
  cwd,
  projectConfig,
}: DependencyWatchContext): Set<string> => {
  const paths = new Set<string>();
  const add = (value: string | undefined) => {
    if (!value) {
      return;
    }
    paths.add(toAbsolutePath(cwd, value));
  };

  for (const relative of DEFAULT_DEPENDENCY_PATHS) {
    add(relative);
  }

  // Add sources.partials directories
  const sources = projectConfig?.sources;
  if (sources?.partials) {
    for (const partialPath of sources.partials) {
      add(partialPath);
    }
  }

  if (projectConfig?.paths?.partials) {
    add(projectConfig.paths.partials);
  }

  if (projectConfig?.paths?.templates) {
    add(projectConfig.paths.templates);
  }

  return paths;
};

export const isPathWithin = (ancestor: string, candidate: string): boolean => {
  const normalizedAncestor = path.resolve(ancestor);
  const normalizedCandidate = path.resolve(candidate);
  if (normalizedAncestor === normalizedCandidate) {
    return true;
  }
  const relative = path.relative(normalizedAncestor, normalizedCandidate);
  return (
    relative === "" || !(relative.startsWith("..") || path.isAbsolute(relative))
  );
};

export const shouldInvalidateCache = (
  changedPaths: Iterable<string> | undefined,
  dependencyPaths: Iterable<string>
): boolean => {
  if (!changedPaths) {
    return false;
  }

  const dependencies = Array.from(new Set(dependencyPaths));
  if (dependencies.length === 0) {
    return false;
  }

  for (const changed of changedPaths) {
    const resolvedChanged = path.resolve(changed);
    for (const dependency of dependencies) {
      if (isPathWithin(dependency, resolvedChanged)) {
        return true;
      }
    }
  }

  return false;
};
