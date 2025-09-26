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

export const RENDERER_FORMAT_MARKDOWN = "markdown" as const;
export const RENDERER_FORMAT_XML = "xml" as const;

export type BuiltinRendererFormat =
  | typeof RENDERER_FORMAT_MARKDOWN
  | typeof RENDERER_FORMAT_XML;

export type RendererFormat = BuiltinRendererFormat | (string & {});

export type RendererFormatDescriptor = {
  readonly id: RendererFormat;
  readonly handler: RendererFormatHandler;
  readonly description?: string;
};

export type RendererFormatHandlerInput = {
  readonly artifact: CompileArtifact;
  readonly options?: RendererOptions;
};

export type RendererFormatHandler = (
  input: RendererFormatHandlerInput
) => RenderResult;

export type XmlRendererOptions = {
  readonly rootTag?: string;
  readonly indentation?: string;
  readonly includeDeclaration?: boolean;
};

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
  readonly format?: RendererFormat;
  readonly xml?: XmlRendererOptions;
  readonly formats?: readonly RendererFormatDescriptor[];
  readonly handlebars?: HandlebarsRendererOptions;
};

export type RenderResult = Result<CompileArtifact>;

export type RulesetRenderer = (
  document: RulesetDocument,
  target: CompileTarget,
  options?: RendererOptions
) => RenderResult;

const builtinRendererFormatHandlers = new Map<
  RendererFormat,
  RendererFormatHandler
>();

const rendererFormatRegistry = new Map<RendererFormat, RendererFormatHandler>();

const registerBuiltinRendererFormat = (
  descriptor: RendererFormatDescriptor
) => {
  builtinRendererFormatHandlers.set(descriptor.id, descriptor.handler);
  rendererFormatRegistry.set(descriptor.id, descriptor.handler);
};

export const registerRendererFormat = (
  descriptor: RendererFormatDescriptor
): void => {
  rendererFormatRegistry.set(descriptor.id, descriptor.handler);
};

export const unregisterRendererFormat = (formatId: RendererFormat): boolean => {
  if (!rendererFormatRegistry.has(formatId)) {
    return false;
  }

  if (builtinRendererFormatHandlers.has(formatId)) {
    const handler = builtinRendererFormatHandlers.get(formatId);
    if (handler) {
      rendererFormatRegistry.set(formatId, handler);
    }
    return true;
  }

  return rendererFormatRegistry.delete(formatId);
};

export const listRendererFormats = (): readonly RendererFormat[] =>
  Array.from(rendererFormatRegistry.keys());

/** @internal – exposed for tests to ensure deterministic registry state. */
export const resetRendererFormatsForTest = (): void => {
  rendererFormatRegistry.clear();
  for (const [formatId, handler] of builtinRendererFormatHandlers.entries()) {
    rendererFormatRegistry.set(formatId, handler);
  }
};

const HANDLEBARS_CAPABILITY_PREFIX = "render:handlebars";
const DEFAULT_XML_ROOT = "ruleset";
const DEFAULT_SECTION_PREFIX = "section";
const XML_TAG_START_PATTERN = /^[a-z_]/;

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';

const resolveFormatHandler = (
  format: RendererFormat,
  options?: RendererOptions
): RendererFormatHandler | undefined => {
  if (options?.formats) {
    for (const entry of options.formats) {
      if (entry.id === format) {
        return entry.handler;
      }
    }
  }

  return rendererFormatRegistry.get(format);
};

const normalizeFormatErrorDiagnostics = (
  error: unknown,
  format: RendererFormat
): RulesetDiagnostics => {
  if (Array.isArray(error)) {
    return error as RulesetDiagnostics;
  }

  if (error instanceof Error) {
    return [
      {
        level: "error",
        message: error.message,
        hint: error.stack,
        tags: ["renderer", "format", format],
      },
    ];
  }

  if (error && typeof error === "object") {
    const candidate = error as { message?: unknown; help?: unknown };
    const messageCandidate = candidate.message;
    const helpCandidate = candidate.help;
    const message =
      typeof messageCandidate === "string"
        ? messageCandidate
        : `Renderer format "${format}" failed.`;
    const hint = typeof helpCandidate === "string" ? helpCandidate : undefined;
    return [
      {
        level: "error",
        message,
        hint,
        tags: ["renderer", "format", format],
      },
    ];
  }

  if (typeof error === "string") {
    return [
      {
        level: "error",
        message: error,
        tags: ["renderer", "format", format],
      },
    ];
  }

  return [
    {
      level: "error",
      message: `Renderer format "${format}" failed with an unknown error.`,
      tags: ["renderer", "format", format],
    },
  ];
};

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

const mergeDiagnostics = (
  base: RulesetDiagnostics,
  additional?: RulesetDiagnostics
): RulesetDiagnostics => {
  if (!additional || additional.length === 0) {
    return base;
  }

  if (base.length === 0) {
    return additional;
  }

  return [...base, ...additional];
};

const normalizeLineEndings = (value: string): string =>
  value.replace(/\r\n?/g, "\n");

const trimLines = (lines: string[]): string[] => {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start]?.trim() === "") {
    start += 1;
  }

  while (end > start && lines[end - 1]?.trim() === "") {
    end -= 1;
  }

  return lines.slice(start, end);
};

const toSnakeCase = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const ensureValidTag = (
  candidate: string,
  fallback: string
): { tag: string; adjusted: boolean } => {
  if (!candidate) {
    return { tag: fallback, adjusted: true };
  }

  if (!XML_TAG_START_PATTERN.test(candidate)) {
    return { tag: `${fallback}_${candidate}`, adjusted: true };
  }

  return { tag: candidate, adjusted: false };
};

type ParsedMarkdownSection = {
  readonly rawName?: string;
  readonly contentLines: string[];
};

type NormalizedSection = {
  readonly tagName: string;
  readonly content: string;
  readonly rawName?: string;
};

const HEADLINE_PATTERN = /^(#{2,6})\s+(.+?)\s*$/;

const parseMarkdownSections = (markdown: string): ParsedMarkdownSection[] => {
  const lines = normalizeLineEndings(markdown).split("\n");
  const sections: ParsedMarkdownSection[] = [];

  let current: ParsedMarkdownSection | undefined;

  const flushCurrent = () => {
    if (!current) {
      return;
    }
    sections.push({
      rawName: current.rawName,
      contentLines: [...current.contentLines],
    });
    current = undefined;
  };

  for (const line of lines) {
    const match = HEADLINE_PATTERN.exec(line);
    if (match) {
      flushCurrent();
      current = {
        rawName: match[2]?.trim(),
        contentLines: [],
      };
      continue;
    }

    if (!current) {
      current = { rawName: undefined, contentLines: [] };
    }

    current.contentLines.push(line);
  }

  flushCurrent();

  return sections;
};

const ensureUniqueTag = (
  baseTag: string,
  usage: Map<string, number>
): { tag: string; suffixApplied: boolean } => {
  const current = usage.get(baseTag) ?? 0;
  if (current === 0) {
    usage.set(baseTag, 1);
    return { tag: baseTag, suffixApplied: false };
  }

  const next = current + 1;
  usage.set(baseTag, next);
  return { tag: `${baseTag}_${next}`, suffixApplied: true };
};

const deriveSectionTag = (
  rawName: string | undefined,
  fallback: string,
  usage: Map<string, number>
): { tagName: string; diagnostics: RulesetDiagnostics } => {
  const diagnostics: RulesetDiagnostic[] = [];
  const desired = rawName !== undefined ? toSnakeCase(rawName) : "preamble";

  const { tag: baseTag, adjusted } = ensureValidTag(desired, fallback);
  const { tag: uniqueTag, suffixApplied } = ensureUniqueTag(baseTag, usage);

  if (adjusted && rawName !== undefined) {
    diagnostics.push({
      level: "info",
      message: `Section heading "${rawName}" normalised to <${uniqueTag}> for XML output.`,
      tags: ["renderer", "xml", "section-name"],
    });
  }

  if (suffixApplied && rawName !== undefined) {
    diagnostics.push({
      level: "warning",
      message: `Duplicate section tag detected for heading "${rawName}". Using <${uniqueTag}>.`,
      tags: ["renderer", "xml", "section-name"],
    });
  }

  return { tagName: uniqueTag, diagnostics };
};

const normalizeSections = (
  parsed: ParsedMarkdownSection[]
): { sections: NormalizedSection[]; diagnostics: RulesetDiagnostics } => {
  const diagnostics: RulesetDiagnostic[] = [];
  const sections: NormalizedSection[] = [];
  const usage = new Map<string, number>();

  for (const section of parsed) {
    const trimmedLines = trimLines(section.contentLines);
    const content = trimmedLines.join("\n");

    if (section.rawName === undefined && content === "") {
      continue;
    }

    const fallback = `${DEFAULT_SECTION_PREFIX}_${sections.length + 1}`;
    const { tagName, diagnostics: tagDiagnostics } = deriveSectionTag(
      section.rawName,
      fallback,
      usage
    );

    diagnostics.push(...tagDiagnostics);

    sections.push({
      tagName,
      content,
      rawName: section.rawName,
    });
  }

  if (sections.length === 0) {
    sections.push({
      tagName: "body",
      content: normalizeLineEndings(
        parsed.map((s) => s.contentLines.join("\n")).join("\n")
      ).trim(),
      rawName: undefined,
    });
  }

  return { sections, diagnostics };
};

const wrapInCdata = (value: string): string =>
  value.length === 0
    ? "<![CDATA[]]>"
    : `<![CDATA[${value.replace(/]]>/g, "]] ]><![CDATA[>")}]]>`;

const convertMarkdownToXml = (
  markdown: string,
  options: XmlRendererOptions | undefined
): { xml: string; diagnostics: RulesetDiagnostics } => {
  const parsedSections = parseMarkdownSections(markdown);
  const { sections, diagnostics: sectionDiagnostics } =
    normalizeSections(parsedSections);

  const diagnostics: RulesetDiagnostic[] = [...sectionDiagnostics];

  const rootCandidate = toSnakeCase(options?.rootTag ?? DEFAULT_XML_ROOT);
  const { tag: rootTag, adjusted } = ensureValidTag(
    rootCandidate,
    DEFAULT_XML_ROOT
  );

  if (adjusted && (options?.rootTag ?? DEFAULT_XML_ROOT) !== rootTag) {
    diagnostics.push({
      level: "info",
      message: `XML root tag normalised to <${rootTag}>.`,
      tags: ["renderer", "xml", "root-tag"],
    });
  }

  const indentation = options?.indentation ?? "  ";
  const includeDeclaration = options?.includeDeclaration !== false;

  const lines: string[] = [];
  if (includeDeclaration) {
    lines.push(XML_DECLARATION);
  }

  lines.push(`<${rootTag}>`);

  for (const section of sections) {
    lines.push(`${indentation}<${section.tagName}>`);
    if (section.content !== "") {
      const cdata = wrapInCdata(section.content);
      lines.push(`${indentation}${indentation}${cdata}`);
    }
    lines.push(`${indentation}</${section.tagName}>`);
  }

  lines.push(`</${rootTag}>`);

  return {
    xml: lines.join("\n"),
    diagnostics,
  };
};

const markdownFormatHandler: RendererFormatHandler = ({ artifact }) =>
  createResultOk({
    ...artifact,
  });

const xmlFormatHandler: RendererFormatHandler = ({ artifact, options }) => {
  const result = convertMarkdownToXml(artifact.contents, options?.xml);
  return createResultOk({
    ...artifact,
    contents: result.xml,
    diagnostics: result.diagnostics,
  });
};

registerBuiltinRendererFormat({
  id: RENDERER_FORMAT_MARKDOWN,
  handler: markdownFormatHandler,
  description: "Default markdown passthrough",
});

registerBuiltinRendererFormat({
  id: RENDERER_FORMAT_XML,
  handler: xmlFormatHandler,
  description: "XML section emitter",
});

const applyOutputFormat = (
  artifact: CompileArtifact,
  options: RendererOptions | undefined
): RenderResult => {
  const format: RendererFormat = options?.format ?? RENDERER_FORMAT_MARKDOWN;
  const handler = resolveFormatHandler(format, options);

  if (!handler) {
    if (format === RENDERER_FORMAT_MARKDOWN) {
      return createResultOk(artifact);
    }

    const diagnostics = mergeDiagnostics(
      artifact.diagnostics,
      normalizeFormatErrorDiagnostics(
        `Renderer format "${format}" is not registered.`,
        format
      )
    );
    return createResultErr(diagnostics);
  }

  try {
    const result = handler({ artifact, options });

    if (!result.ok) {
      const diagnostics = mergeDiagnostics(
        artifact.diagnostics,
        normalizeFormatErrorDiagnostics(result.error, format)
      );
      return createResultErr(diagnostics);
    }

    const normalizedArtifact: CompileArtifact = {
      ...artifact,
      ...result.value,
      diagnostics: mergeDiagnostics(
        artifact.diagnostics,
        result.value.diagnostics
      ),
    };

    return createResultOk(normalizedArtifact);
  } catch (error) {
    const diagnostics = mergeDiagnostics(
      artifact.diagnostics,
      normalizeFormatErrorDiagnostics(error, format)
    );
    return createResultErr(diagnostics);
  }
};

const createPassthroughResult = (
  document: RulesetDocument,
  target: CompileTarget,
  options: RendererOptions | undefined,
  diagnostics: RulesetDiagnostics
): RenderResult => {
  const artifact: CompileArtifact = {
    target,
    contents: document.source.contents,
    diagnostics,
  };
  return applyOutputFormat(artifact, options);
};

type HandlebarsRenderParams = {
  readonly document: RulesetDocument;
  readonly target: CompileTarget;
  readonly options?: RendererOptions;
  readonly handlebarsOptions?: HandlebarsRendererOptions;
  readonly diagnostics: RulesetDiagnostics;
};

const renderUsingHandlebars = ({
  document,
  target,
  options,
  handlebarsOptions,
  diagnostics,
}: HandlebarsRenderParams): RenderResult => {
  const { head, body } = splitFrontmatter(document.source.contents);
  const runtime = Handlebars.create();

  registerDefaultHelpers(runtime);
  registerHelpers(runtime, handlebarsOptions?.helpers);
  registerPartials(runtime, handlebarsOptions?.partials);

  const strict = handlebarsOptions?.strict ?? true;
  const noEscape = handlebarsOptions?.noEscape ?? false;
  const context = handlebarsOptions?.context ?? {};
  const label = handlebarsOptions?.label ?? target.providerId;

  try {
    const template = runtime.compile(body, { strict, noEscape });
    const renderedBody = template(context);
    const contents =
      head && head.length > 0 ? `${head}\n${renderedBody}` : renderedBody;

    const artifact: CompileArtifact = {
      target,
      contents,
      diagnostics,
    };
    return applyOutputFormat(artifact, options);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? "unknown error");
    const hint = error instanceof Error ? error.stack : undefined;

    const diagnostic: RulesetDiagnostic = {
      level: "error",
      message: `Handlebars rendering failed for ${label}: ${message}`,
      hint,
      tags: ["renderer", "handlebars", target.providerId],
    };

    return createResultErr(mergeDiagnostics(diagnostics, [diagnostic]));
  }
};

export const createPassthroughRenderer =
  (): RulesetRenderer => (document, target, options) => {
    const pipeline = options?.transforms ?? [identityTransform];
    const transformed = runTransforms(document, ...pipeline);

    return createPassthroughResult(
      transformed.document,
      target,
      options,
      transformed.diagnostics
    );
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
      return createPassthroughResult(
        transformed.document,
        target,
        options,
        aggregatedDiagnostics
      );
    }

    return renderUsingHandlebars({
      document: transformed.document,
      target,
      options,
      handlebarsOptions,
      diagnostics: aggregatedDiagnostics,
    });
  };

export const renderDocument: RulesetRenderer = createHandlebarsRenderer();
