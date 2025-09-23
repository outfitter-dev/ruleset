# Rulesets Core API Documentation

The `@rulesets/core` package provides high-level APIs for compiling rules files, managing project configuration, and integrating with the Rulesets build system.

## Installation

```bash
bun add @rulesets/core
```

## Quick Start

The simplest way to compile rules is using the high-level `compileRules` function:

```typescript
import { compileRules } from '@rulesets/core';

// Compile all rules in the default directory
const result = await compileRules();

console.log(`Compiled ${result.compiledCount} files`);
if (result.errors.length > 0) {
  console.error('Errors:', result.errors);
}
```

## High-Level APIs

### compileRules(options)

Compiles rules files from source to provider outputs. This is the primary API that applications should use.

```typescript
import { compileRules } from '@rulesets/core';

const result = await compileRules({
  source: './my-rules',              // Source directory (default: ./.ruleset/rules)
  output: './dist',                  // Output directory (default: ./.ruleset/dist)
  destination: 'cursor',             // Specific provider (omit for all)
  configPath: './custom-config.yaml', // Custom config path (optional)
  lint: true,                        // Enable linting (default: false)
  logger: myLogger,                  // Custom logger (optional)
});

// Result contains:
console.log(result.compiledCount);   // Number of files compiled
console.log(result.totalFiles);     // Total files processed
console.log(result.errors);         // Any compilation errors
console.log(result.projectConfig);  // Project configuration used
console.log(result.outputPath);     // Output directory path
```

### initializeProject(options)

Initialize a new Rulesets project structure with configuration and example files.

```typescript
import { initializeProject } from '@rulesets/core';

await initializeProject({
  baseDir: process.cwd(),            // Base directory (default: cwd)
  createExamples: true,              // Create example files (default: true)
  logger: myLogger,                  // Custom logger (optional)
});
```

This creates:
- `.ruleset/config.yaml` - Project configuration
- `.ruleset/rules/` - Rules directory
- `.ruleset/dist/` - Output directory
- `.ruleset/partials/` - Partials directory
- Example rule file and partial (if createExamples is true)

> The generated configuration file is written in YAML (`config.yaml`) to match the CLI and documentation defaults.

### discoverRulesFiles(options)

Discover rules files in a directory with optional glob filtering.

```typescript
import { discoverRulesFiles } from '@rulesets/core';

const files = await discoverRulesFiles({
  basePath: './src/rules',
  globs: ['**/*.rule.md', '!**/draft-*'],  // Optional filtering
  logger: myLogger,                        // Optional logger
});

console.log('Found files:', files);
```

## Configuration Management

### loadProjectConfig(options)

Load project configuration with fallback to defaults.

```typescript
import { loadProjectConfig } from '@rulesets/core';

const config = await loadProjectConfig({
  startPath: './src',                      // Search starting point
  configPath: './custom-config.yaml',     // Explicit config file
});

console.log('Config path:', config.path);
console.log('Format:', config.format);      // yaml, json, jsonc, toml
console.log('Config:', config.config);
```

## Low-Level APIs

For advanced use cases, you can use the lower-level compilation APIs:

### compile(parsedDoc, providerId, projectConfig, options)

Compile a single parsed document for a specific provider.

```typescript
import { compile, parse } from '@rulesets/core';

const content = '# My Rule\n\nThis is a rule file.';
const parsed = parse(content);
const compiled = compile(parsed, 'cursor', { /* project config */ });

console.log('Compiled content:', compiled.output.content);
console.log('Metadata:', compiled.output.metadata);
```

### parse(content)

Parse markdown content into a structured document.

```typescript
import { parse } from '@rulesets/core';

const content = `---
rule:
  version: "1.0.0"
description: "My rule"
---

# Rule Content

This is the rule body.
`;

const parsed = parse(content);
console.log('Frontmatter:', parsed.source.frontmatter);
console.log('Content:', parsed.source.content);
```

### lint(parsedDoc, config)

Lint a parsed document for issues.

```typescript
import { lint, parse } from '@rulesets/core';

const parsed = parse(content);
const results = lint(parsed, {
  requireRulesetsVersion: true,
  allowedDestinations: ['cursor', 'windsurf'],
});

for (const result of results) {
  console.log(`${result.severity}: ${result.message}`);
}
```

## Provider System

### providers

Access the provider registry:

```typescript
import { providers } from '@rulesets/core';

// List all registered providers
console.log('Available providers:', Array.from(providers.keys()));

// Get a specific provider
const cursorProvider = providers.get('cursor');
if (cursorProvider) {
  console.log('Cursor provider:', cursorProvider.name);
}
```

## Examples

### Basic CI/CD Integration

```typescript
// scripts/build-rules.ts
import { compileRules } from '@rulesets/core';

async function buildRules() {
  try {
    const result = await compileRules({
      source: './docs/rules',
      output: './dist/rules',
      lint: true,
    });

    if (result.errors.length > 0) {
      console.error('Build failed with errors:');
      for (const error of result.errors) {
        console.error(`${error.file}: ${error.message}`);
      }
      process.exit(1);
    }

    console.log(`✅ Built ${result.compiledCount} rules successfully`);
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

buildRules();
```

### Custom GitHub Action

```typescript
// .github/actions/build-rules/index.ts
import * as core from '@actions/core';
import { compileRules } from '@rulesets/core';

async function run() {
  try {
    const source = core.getInput('source') || './.ruleset/rules';
    const output = core.getInput('output') || './.ruleset/dist';

    const result = await compileRules({ source, output, lint: true });

    core.setOutput('compiled-count', result.compiledCount.toString());
    core.setOutput('total-files', result.totalFiles.toString());

    if (result.errors.length > 0) {
      const errorMessages = result.errors.map(e => `${e.file}: ${e.message}`);
      core.setFailed(`Compilation failed:\n${errorMessages.join('\n')}`);
    }
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
  }
}

run();
```

### Custom Build Script

```typescript
// scripts/compile-with-validation.ts
import { compileRules, loadProjectConfig, discoverRulesFiles } from '@rulesets/core';
import { promises as fs } from 'node:fs';

async function validateAndCompile() {
  // Load project configuration
  const configResult = await loadProjectConfig();

  // Discover source files
  const files = await discoverRulesFiles({
    basePath: './.ruleset/rules',
  });

  console.log(`Found ${files.length} rules files`);

  // Check each file has required metadata
  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    if (!content.includes('rule:')) {
      console.warn(`Warning: ${file} missing rule frontmatter`);
    }
  }

  // Compile with validation
  const result = await compileRules({
    lint: true,
    linterConfig: {
      requireRulesetsVersion: true,
    },
  });

  console.log(`Compiled ${result.compiledCount} files`);
  return result.errors.length === 0;
}

validateAndCompile().then(success => {
  process.exit(success ? 0 : 1);
});
```

## Error Handling

All high-level APIs use standard Promise rejection for error handling:

```typescript
import { compileRules, ConsoleLogger } from '@rulesets/core';

try {
  const result = await compileRules({
    source: './non-existent-path',
    logger: createDefaultLogger(),
  });
} catch (error) {
  if (error instanceof Error) {
    console.error('Compilation failed:', error.message);
  } else {
    console.error('Unknown error:', error);
  }
}
```

## Logging

The library uses a structured logging interface. You can provide your own logger:

```typescript
import { compileRules, type Logger } from '@rulesets/core';

class CustomLogger implements Logger {
  debug(message: string, meta?: Record<string, unknown>) {
    // Your debug implementation
  }

  info(message: string, meta?: Record<string, unknown>) {
    // Your info implementation
  }

  warn(message: string, meta?: Record<string, unknown>) {
    // Your warn implementation
  }

  error(message: string, meta?: Record<string, unknown>) {
    // Your error implementation
  }
}

const result = await compileRules({
  logger: new CustomLogger(),
});
```

## TypeScript Support

All APIs are fully typed with comprehensive TypeScript definitions:

```typescript
import type {
  CompilationOptions,
  CompilationResult,
  FileDiscoveryOptions,
  InitializationOptions,
  Logger,
  ParsedDoc,
  CompiledDoc,
} from '@rulesets/core';

// Your TypeScript code here with full type safety
```
