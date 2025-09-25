import { identityTransform, runTransforms } from "@rulesets/transform";
import type {
  CompileArtifact,
  CompileTarget,
  RulesetDiagnostics,
  RulesetDocument,
} from "@rulesets/types";
import { createResultOk, type Result } from "@rulesets/types";

export type RendererOptions = {
  readonly transforms?: readonly (typeof identityTransform)[];
};

export type RendererContext = {
  readonly target: CompileTarget;
  readonly document: RulesetDocument;
  readonly diagnostics: RulesetDiagnostics;
};

export type RenderResult = Result<CompileArtifact>;

export type RulesetRenderer = (
  document: RulesetDocument,
  target: CompileTarget,
  options?: RendererOptions
) => RenderResult;

export const createPassthroughRenderer =
  (): RulesetRenderer => (document, target, options) => {
    const pipeline = options?.transforms ?? [identityTransform];
    const transformed = runTransforms(document, ...pipeline);

    const artifact: CompileArtifact = {
      target,
      contents: transformed.document.source.contents,
      diagnostics: transformed.diagnostics,
    };

    return createResultOk(artifact);
  };

export const renderDocument: RulesetRenderer = (document, target, options) =>
  createPassthroughRenderer()(document, target, options);
