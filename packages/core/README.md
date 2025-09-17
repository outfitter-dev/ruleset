# @rulesets/core

Core library for Rulesets - parser, compiler, linter, and plugins.

## Installation

```bash
npm install @rulesets/core
```

## Usage

```typescript
import { parse, compile, destinations, ConsoleLogger } from '@rulesets/core';

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
const logger = new ConsoleLogger();
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
    content: string;
    frontmatter?: Record<string, unknown>;
    path?: string;
  };
  stems: Stem[];
  errors?: ParseError[];
}

interface CompiledDoc {
  content: string;
  metadata: {
    destination: string;
    timestamp: string;
    version: string;
  };
}

interface DestinationPlugin {
  id: string;
  name: string;
  compile(doc: ParsedDoc, config: object): CompiledDoc;
  write?(params: WriteParams): Promise<void>;
}
```

## License

MIT © Outfitter
