import type { HelperDelegate } from 'handlebars';
import Handlebars from 'handlebars';
import type { CompiledDoc, ParsedDoc } from '../interfaces';
import type { Logger } from '../interfaces/logger';
import { extractBodyFromContent } from '../utils/frontmatter';

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
};

/**
 * Runtime context passed to templates while rendering.
 */
export type HandlebarsContext = {
  provider: {
    id: string;
  };
  file: {
    name?: string;
    path?: string;
    frontmatter: Record<string, unknown>;
  };
  project?: Record<string, unknown>;
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
    typeof frontmatter.name === 'string' ? frontmatter.name : undefined;

  return {
    provider: {
      id: destinationId,
    },
    file: {
      name,
      path: parsedDoc.source.path,
      frontmatter,
    },
    project,
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
      const failure = error instanceof Error ? error : new Error(String(error));
      const sourcePath = parsedDoc.source.path ?? '<inline>';
      const contextualError = new Error(
        `Handlebars compilation failed for ${sourcePath}: ${failure.message}`,
        { cause: failure }
      );
      logger?.error(contextualError);
      throw contextualError;
    }

    return {
      source: parsedDoc.source,
      ast: parsedDoc.ast,
      output: {
        content: compiledBody,
        metadata: parsedDoc.source.frontmatter,
      },
      context: {
        destinationId,
        config: options.projectConfig ?? {},
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
    runtime.registerHelper('uppercase', (value: unknown) =>
      typeof value === 'string' ? value.toUpperCase() : (value ?? '')
    );

    runtime.registerHelper(
      'if-provider',
      function (this: HandlebarsContext, ids: string, options) {
        const match = ids.split(',').map((id) => id.trim());
        if (match.includes(this.provider.id)) {
          return options.fn(this);
        }
        return options.inverse ? options.inverse(this) : '';
      }
    );
  }
}
