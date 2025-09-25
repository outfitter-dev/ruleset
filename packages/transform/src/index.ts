import type { RulesetDiagnostics, RulesetDocument } from "@rulesets/types";

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
): TransformResult => ({
  document: composeTransforms(...transforms)(document),
  diagnostics: [],
});
