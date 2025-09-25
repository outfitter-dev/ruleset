import type { JsonValue } from "@rulesets/types";
import type { HelperDelegate } from "handlebars";
import Handlebars from "handlebars";
import type { CompiledDoc, ParsedDoc } from "../interfaces";
import type { Logger } from "../interfaces/logger";
import { extractBodyFromContent } from "../utils/frontmatter";

type ErrorWithCause = Error & { cause?: unknown };

/**
 * Optional configuration when compiling with the Handlebars compiler.
 */
export type HandlebarsCompileOptions = {
  logger?: Logger;
  projectConfig?: Record<string, unknown>;
  helpers?: Record<string, HelperDelegate>;
  partials?: Record<string, string>;
  strict?: boolean;
  noEscape?: boolean;
  providerInfo?: {
    id: string;
    name?: string;
  };
  registryInfo?: {
    destinations: string[];
  };
};

const toJsonRecord = (
  value: Record<string, unknown>
): Record<string, JsonValue> => value as Record<string, JsonValue>;

/**
 * Runtime context passed to templates while rendering.
 */
export type HandlebarsContext = {
  provider: {
    id: string;
    name?: string;
  };
  file: {
    name?: string;
    path?: string;
    frontmatter: Record<string, unknown>;
    metadata: {
      title?: unknown;
      description?: unknown;
      version?: string;
      created?: unknown;
      updated?: unknown;
      labels?: unknown;
      globs?: string[];
    };
  };
  project?: Record<string, unknown>;
  registry?: {
    destinations: string[];
  };
  timestamp: string;
};

function buildContext(
  parsedDoc: ParsedDoc,
  destinationId: string,
  options: HandlebarsCompileOptions
): HandlebarsContext {
  const frontmatter = parsedDoc.source.frontmatter ?? {};
  const project = options.projectConfig;
  const name =
    typeof frontmatter.name === "string" ? frontmatter.name : undefined;
  const provider = options.providerInfo ?? { id: destinationId };

  // Extract structured rule fields for easier template access
  const ruleValue = frontmatter.rule;
  const rule =
    ruleValue && typeof ruleValue === "object" && !Array.isArray(ruleValue)
      ? (ruleValue as Record<string, unknown>)
      : {};

  const extractedMetadata = {
    title: frontmatter.title,
    description: frontmatter.description,
    version: (typeof rule.version === "string"
      ? rule.version
      : frontmatter.version) as string | undefined,
    created: frontmatter.created,
    updated: frontmatter.updated,
    labels: frontmatter.labels,
    globs: Array.isArray(rule.globs)
      ? rule.globs.filter((g): g is string => typeof g === "string")
      : undefined,
  };

  return {
    provider: {
      id: provider.id,
      name: provider.name ?? provider.id,
    },
    file: {
      name,
      path: parsedDoc.source.path,
      frontmatter,
      metadata: extractedMetadata, // Structured access to common metadata fields
    },
    project,
    registry: options.registryInfo
      ? { destinations: [...options.registryInfo.destinations] }
      : undefined,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Minimal Handlebars-based compiler that can be used by advanced providers to
 * render templates today while we expand the AST in future releases.
 */
export class HandlebarsRulesetCompiler {
  private readonly helpers = new Map<string, HelperDelegate>();
  private readonly partials = new Map<string, string>();

  /**
   * Compiles a parsed Rulesets document using Handlebars templates.
   */
  compile(
    parsedDoc: ParsedDoc,
    destinationId: string,
    options: HandlebarsCompileOptions = {}
  ): CompiledDoc {
    const logger = options.logger;
    const body = extractBodyFromContent(parsedDoc.source.content, {
      hasFrontmatter: Boolean(parsedDoc.source.frontmatter),
    });

    const context = buildContext(parsedDoc, destinationId, options);
    const runtime = this.createRuntime(options);

    let compiledBody = body;
    try {
      const template = runtime.compile(body, {
        noEscape: options.noEscape ?? false,
        strict: options.strict ?? true,
      });
      compiledBody = template(context);
    } catch (error) {
      const sourcePath = parsedDoc.source.path ?? "<inline>"; // fallback for inline docs
      const originalError =
        error instanceof Error ? error : new Error(String(error));
      const contextualError = new Error(
        `Handlebars compilation failed for ${sourcePath}: ${originalError.message}`
      );
      // Add cause property for debugging
      (contextualError as ErrorWithCause).cause = originalError;
      logger?.error(contextualError, {
        sourcePath,
        destination: destinationId,
      });
      throw contextualError;
    }

    return {
      source: parsedDoc.source,
      ast: parsedDoc.ast,
      output: {
        content: compiledBody,
        metadata: parsedDoc.source.frontmatter ?? toJsonRecord({}),
      },
      context: {
        destinationId,
        config: toJsonRecord(options.projectConfig ?? {}),
      },
    };
  }

  /** Registers a custom helper available to all future compilations. */
  registerHelper(name: string, helper: HelperDelegate): void {
    this.helpers.set(name, helper);
  }

  /** Registers a global partial available to all compilations. */
  registerPartial(name: string, template: string): void {
    this.partials.set(name, template);
  }

  private createRuntime(options: HandlebarsCompileOptions): typeof Handlebars {
    const runtime = Handlebars.create();
    this.registerCoreHelpers(runtime);

    for (const [name, helper] of this.helpers) {
      runtime.registerHelper(name, helper);
    }

    for (const [name, template] of this.partials) {
      runtime.registerPartial(name, template);
    }

    if (options.helpers) {
      for (const [name, helper] of Object.entries(options.helpers)) {
        runtime.registerHelper(name, helper);
      }
    }

    if (options.partials) {
      for (const [name, template] of Object.entries(options.partials)) {
        runtime.registerPartial(name, template);
      }
    }

    return runtime;
  }

  private registerCoreHelpers(runtime: typeof Handlebars): void {
    runtime.registerHelper("uppercase", (value: unknown) =>
      typeof value === "string" ? value.toUpperCase() : (value ?? "")
    );

    runtime.registerHelper(
      "if-provider",
      function (this: HandlebarsContext, ids: string, options) {
        const match = ids.split(",").map((id) => id.trim());
        if (match.includes(this.provider.id)) {
          return options.fn(this);
        }
        return options.inverse ? options.inverse(this) : "";
      }
    );
  }
}
