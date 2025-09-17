# @rulesets/core

Core library for Rulesets - parser, compiler, linter, and plugins.

## Installation

```bash
npm install @rulesets/core
```

## Usage

```typescript
import { parse, compile, destinations, type Logger } from '@rulesets/core';

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
`;

const parsed = parse(content);

// Compile for a specific destination
const compiled = compile(parsed, 'cursor', {});

// Access destination plugins
const cursorPlugin = destinations.get('cursor');
const logger: Logger = {
  debug: console.debug,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

await cursorPlugin?.write({
  compiled,
  destPath: '.rulesets/dist/cursor/my-rules.md',
  config: {},
  logger,
});
```

`Stem` and `ParseError` are exported from `@rulesets/core` (see `src/interfaces`) for convenience if you need the detailed types.

## API

### parse(content: string): ParsedDoc

Parse Markdown content with frontmatter into a structured document.

### compile(doc: ParsedDoc, destination: string, config: object): CompiledDoc

Compile a parsed document for a specific destination.

### destinations: Map<string, DestinationPlugin>

Registry of available destination plugins.

### Supported Destinations

- `cursor` - Cursor IDE
- `windsurf` - Windsurf IDE
- `claude-code` - Claude Code
- `agents-md` - Codex AGENTS.md
- `copilot` - GitHub Copilot

## Types

```typescript
interface ParsedDoc {
  source: {
    path?: string;
    content: string;
    frontmatter?: Record<string, unknown>;
  };
  ast: {
    stems: Stem[];
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
    destinationId: string;
    config: Record<string, unknown>;
  };
}

interface DestinationPlugin {
  readonly name: string;
  configSchema(): JSONSchema7;
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
  destination?: string;
  line?: number;
  [key: string]: unknown;
};
```

## License

MIT © Outfitter
