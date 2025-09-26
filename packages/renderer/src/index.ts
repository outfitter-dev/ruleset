import {
  identityTransform,
  type RulesetTransform,
  runTransforms,
} from "@rulesets/transform";
import {
  type CompileArtifact,
  type CompileTarget,
  createResultErr,
  createResultOk,
  type Result,
  type RulesetDiagnostic,
  type RulesetDiagnostics,
  type RulesetDocument,
} from "@rulesets/types";
import Handlebars, { type HelperDelegate } from "handlebars";

export type HandlebarsTemplateContext = Record<string, unknown>;

export type HandlebarsHelper = HelperDelegate;

export type HandlebarsHelperMap = Readonly<Record<string, HelperDelegate>>;

export type HandlebarsRendererOptions = {
  readonly enabled?: boolean;
  readonly force?: boolean;
  readonly strict?: boolean;
  readonly noEscape?: boolean;
  readonly partials?: Readonly<Record<string, string>>;
  readonly helpers?: HandlebarsHelperMap;
  readonly context?: HandlebarsTemplateContext;
  readonly diagnostics?: RulesetDiagnostics;
  readonly label?: string;
};

export type RendererOptions = {
  readonly transforms?: readonly RulesetTransform[];
  readonly handlebars?: HandlebarsRendererOptions;
};

export type RenderResult = Result<CompileArtifact>;

export type RulesetRenderer = (
  document: RulesetDocument,
  target: CompileTarget,
  options?: RendererOptions
) => RenderResult;

const HANDLEBARS_CAPABILITY_PREFIX = "render:handlebars";

const hasHandlebarsCapability = (target: CompileTarget): boolean =>
  target.capabilities?.some((capability) =>
    capability.startsWith(HANDLEBARS_CAPABILITY_PREFIX)
  ) ?? false;

const shouldUseHandlebars = (
  target: CompileTarget,
  options?: HandlebarsRendererOptions
): boolean => {
  if (options?.force === true) {
    return true;
  }

  if (options?.enabled === false) {
    return false;
  }

  if (options?.enabled === true) {
    return true;
  }

  return hasHandlebarsCapability(target);
};

type FrontmatterSplit = {
  readonly head?: string;
  readonly body: string;
};

const splitFrontmatter = (contents: string): FrontmatterSplit => {
  const lines = contents.split("\n");
  if (lines[0]?.trim() !== "---") {
    return { body: contents };
  }

  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.trim() === "---") {
      const head = lines.slice(0, index + 1).join("\n");
      const body = lines.slice(index + 1).join("\n");
      return { head, body };
    }
  }

  return { body: contents };
};

const registerDefaultHelpers = (runtime: typeof Handlebars) => {
  runtime.registerHelper("uppercase", (value: unknown) =>
    typeof value === "string" ? value.toUpperCase() : value
  );

  runtime.registerHelper("lowercase", (value: unknown) =>
    typeof value === "string" ? value.toLowerCase() : value
  );

  runtime.registerHelper("json", (value: unknown) =>
    JSON.stringify(value, null, 2)
  );

  runtime.registerHelper(
    "if-provider",
    function ifProvider(this: Record<string, unknown>, ids: string, options) {
      const providerIds = ids
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      const currentProvider =
        typeof this.provider === "object" && this.provider !== null
          ? (this.provider as Record<string, unknown>)
          : undefined;
      const currentId =
        typeof currentProvider?.id === "string"
          ? currentProvider.id
          : undefined;

      if (currentId && providerIds.includes(currentId)) {
        return options.fn(this);
      }

      return options.inverse ? options.inverse(this) : "";
    }
  );
};

const registerHelpers = (
  runtime: typeof Handlebars,
  helpers: HandlebarsHelperMap | undefined
) => {
  if (!helpers) {
    return;
  }

  for (const [name, helper] of Object.entries(helpers)) {
    if (typeof helper === "function") {
      runtime.registerHelper(name, helper);
    }
  }
};

const registerPartials = (
  runtime: typeof Handlebars,
  partials: Readonly<Record<string, string>> | undefined
) => {
  if (!partials) {
    return;
  }

  for (const [name, template] of Object.entries(partials)) {
    if (typeof template === "string") {
      runtime.registerPartial(name, template);
    }
  }
};

const createRendererDiagnostics = (
  error: unknown,
  label: string | undefined,
  providerId: string
): RulesetDiagnostics => {
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");
  const hint = error instanceof Error ? error.stack : undefined;

  const contextLabel = label ?? providerId;

  const diagnostic: RulesetDiagnostic = {
    level: "error",
    message: `Handlebars rendering failed for ${contextLabel}: ${message}`,
    hint,
    tags: ["renderer", "handlebars", providerId],
  };

  return [diagnostic];
};

const mergeDiagnostics = (
  base: RulesetDiagnostics,
  additional?: RulesetDiagnostics
): RulesetDiagnostics => {
  if (!additional || additional.length === 0) {
    return base;
  }
  return [...base, ...additional];
};

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

export const createHandlebarsRenderer =
  (): RulesetRenderer => (document, target, options) => {
    const pipeline = options?.transforms ?? [identityTransform];
    const transformed = runTransforms(document, ...pipeline);
    const handlebarsOptions = options?.handlebars;
    const aggregatedDiagnostics = mergeDiagnostics(
      transformed.diagnostics,
      handlebarsOptions?.diagnostics
    );

    if (!shouldUseHandlebars(target, handlebarsOptions)) {
      const artifact: CompileArtifact = {
        target,
        contents: transformed.document.source.contents,
        diagnostics: aggregatedDiagnostics,
      };
      return createResultOk(artifact);
    }

    const { head, body } = splitFrontmatter(
      transformed.document.source.contents
    );
    const runtime = Handlebars.create();

    registerDefaultHelpers(runtime);
    registerHelpers(runtime, handlebarsOptions?.helpers);
    registerPartials(runtime, handlebarsOptions?.partials);

    const strict = handlebarsOptions?.strict ?? true;
    const noEscape = handlebarsOptions?.noEscape ?? false;
    const context = handlebarsOptions?.context ?? {};
    const label = handlebarsOptions?.label;

    try {
      const template = runtime.compile(body, { strict, noEscape });
      const renderedBody = template(context);
      const contents =
        head && head.length > 0 ? `${head}\n${renderedBody}` : renderedBody;
      const artifact: CompileArtifact = {
        target,
        contents,
        diagnostics: aggregatedDiagnostics,
      };
      return createResultOk(artifact);
    } catch (error) {
      const diagnostics = mergeDiagnostics(
        aggregatedDiagnostics,
        createRendererDiagnostics(error, label, target.providerId)
      );
      return createResultErr(diagnostics);
    }
  };

export const renderDocument: RulesetRenderer = createHandlebarsRenderer();
