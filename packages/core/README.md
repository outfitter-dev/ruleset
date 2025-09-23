# @rulesets/core

Core library for Rulesets - parser, compiler, linter, and providers.

## Installation

```bash
bun add @rulesets/core

# Node users can install via npm if needed
# npm install @rulesets/core
```

## Usage

```typescript
import { parse, compile, providers, type Logger } from '@rulesets/core'

// Parse a source rules file
const content = `
---
name: my-rules
destinations:
  include: ["cursor", "windsurf"]
---

# My Rules

- Use TypeScript
- Write tests
`

const parsed = parse(content)

// Compile for a specific provider
const compiled = compile(parsed, 'cursor', {})

// Access providers
const cursorProvider = providers.get('cursor')
if (!cursorProvider) {
  throw new Error('cursor provider not registered')
}
const logger: Logger = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
}

await cursorProvider.write({
  compiled,
  destPath: '.ruleset/dist/cursor/my-rules.md',
  config: {},
  logger,
})
```

Core types are exported from `@rulesets/core` for convenience, including `Section`, `Import`, `Variable`, `Marker`, and `ParseError`.

## API

### parse(content: string): ParsedDoc

Parse Markdown content with front matter into a structured document.

### compile(doc: ParsedDoc, provider: string, config: object, options?: CompileOptions): CompiledDoc

Compile a parsed document for a specific provider. Pass an optional `options` object to fine-tune Handlebars compilation (for example `options.handlebars.force = true` to opt in even when front matter does not).

### providers: Map<string, DestinationProvider>

Registry of available providers.

Each provider may expose `prepareCompilation(parsed, projectConfig, logger)` to return provider-specific Handlebars settings or project-config overrides. The compiler merges those results with the shared partial discovery described below before rendering.

### Handlebars partial discovery

When Handlebars is enabled, partials are loaded from the following locations (later entries override earlier ones on name collisions):

1. `${RULESETS_HOME:-~/.config/ruleset}/partials/**/*`
2. `./.config/ruleset/partials/**/*`
3. `./.ruleset/partials/**/*`
4. `./.ruleset/rules/` files whose names start with `@`

Supported extensions include `.rule.md`, `.md`, `.hbs`, `.handlebars`, and `.txt`. Inline rule partials drop the leading `@` when registered. Prefer partials for shared content rather than importing sections from other rule files.

### Supported Providers

- `cursor` - Cursor IDE
- `windsurf` - Windsurf IDE
- `claude-code` - Claude Code
- `agents-md` - AGENTS.md
- `copilot` - GitHub Copilot

## Types

```typescript
import type {
  ProviderCompilationOptions,
  DestinationProvider,
} from '@rulesets/core';

interface ParsedDoc {
  source: {
    path?: string;
    content: string;
    frontmatter?: Record<string, unknown>;
  };
  ast: {
    sections: Section[];
    imports: Import[];
    variables: Variable[];
    markers: Marker[];
  };
  errors?: Array<{ message: string; line?: number; column?: number }>;
}

interface CompiledDoc {
  source: ParsedDoc['source'];
  ast: ParsedDoc['ast'];
  output: {
    content: string;
    metadata?: Record<string, unknown>;
  };
  context: {
    providerId: string;
    config: Record<string, unknown>;
  };
}

interface DestinationProvider {
  readonly name: string;
  configSchema(): JSONSchema7;
  prepareCompilation?(ctx: {
    parsed: ParsedDoc;
    projectConfig: Record<string, unknown>;
    logger: Logger;
  }): Promise<DestinationCompilationOptions | void> |
    DestinationCompilationOptions |
    void;
  write(ctx: {
    compiled: CompiledDoc;
    destPath: string;
    config: Record<string, unknown>;
    logger: Logger;
  }): Promise<void>;
}

interface Logger {
  debug(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string | Error, metadata?: LogMetadata): void;
}

type LogMetadata = {
  file?: string;
  provider?: string;
  line?: number;
  [key: string]: unknown;
};
```

## License

MIT © Outfitter
