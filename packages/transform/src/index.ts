import type {
  RulesetDependency,
  RulesetDiagnostics,
  RulesetDocument,
} from "@rulesets/types";

export type RulesetTransform = (document: RulesetDocument) => RulesetDocument;

export type TransformResult = {
  readonly document: RulesetDocument;
  readonly diagnostics: RulesetDiagnostics;
};

export const identityTransform: RulesetTransform = (document) => document;

export const composeTransforms = (
  ...transforms: readonly RulesetTransform[]
): RulesetTransform => {
  if (transforms.length === 0) {
    return identityTransform;
  }

  return (document) =>
    transforms.reduce((acc, transform) => transform(acc), document);
};

export const runTransforms = (
  document: RulesetDocument,
  ...transforms: readonly RulesetTransform[]
): TransformResult => {
  const transformed = composeTransforms(...transforms)(document);
  const enriched = attachDerivedDependencies(transformed);
  return {
    document: enriched,
    diagnostics: [],
  };
};

const PARTIAL_SYNTAX = /\{\{\s*>\s*([^\s}]+)[^}]*\}\}/g;

const trimQuotes = (identifier: string): string =>
  identifier.replace(/^['"]+|['"]+$/g, "");

const collectPartialDependencies = (
  contents: string
): readonly RulesetDependency[] => {
  PARTIAL_SYNTAX.lastIndex = 0;
  const matches = new Map<string, RulesetDependency>();
  let execResult: RegExpExecArray | null = PARTIAL_SYNTAX.exec(contents);
  while (execResult !== null) {
    const rawIdentifier = trimQuotes(execResult[1]?.trim() ?? "");
    if (!rawIdentifier) {
      execResult = PARTIAL_SYNTAX.exec(contents);
      continue;
    }
    const key = `partial:${rawIdentifier}`;
    if (!matches.has(key)) {
      matches.set(key, {
        kind: "partial",
        identifier: rawIdentifier,
      });
    }
    execResult = PARTIAL_SYNTAX.exec(contents);
  }
  return [...matches.values()];
};

const mergeDependencies = (
  existing: readonly RulesetDependency[] | undefined,
  derived: readonly RulesetDependency[]
): readonly RulesetDependency[] | undefined => {
  if ((!existing || existing.length === 0) && derived.length === 0) {
    return existing;
  }

  const merged = new Map<string, RulesetDependency>();

  if (existing) {
    for (const dependency of existing) {
      const key = `${dependency.kind}:${dependency.identifier}`;
      merged.set(key, dependency);
    }
  }

  for (const dependency of derived) {
    const key = `${dependency.kind}:${dependency.identifier}`;
    if (!merged.has(key)) {
      merged.set(key, dependency);
    }
  }

  return merged.size === 0 ? existing : [...merged.values()];
};

const attachDerivedDependencies = (
  document: RulesetDocument
): RulesetDocument => {
  const derived = collectPartialDependencies(document.source.contents);
  const dependencies = mergeDependencies(document.dependencies, derived);

  if (dependencies === document.dependencies) {
    return document;
  }

  if (!dependencies) {
    return document;
  }

  return {
    ...document,
    dependencies,
  };
};
