# Rulesets Core Coding Standards

This document outlines coding standards and best practices for the Rulesets codebase, particularly focusing on the use of shared dependencies like type-fest and pino.

## Shared Dependencies

### Type Utilities with type-fest

We use `type-fest` for common type transformations and patterns. This ensures consistency and leverages well-tested utilities instead of rolling our own.

#### When to Use type-fest

- **Configuration objects**: Use `PartialDeep<T>` for partial configurations and `RequiredDeep<T>` for validated ones
- **Immutable data**: Use `ReadonlyDeep<T>` for data that shouldn't be modified
- **String unions with extensibility**: Use `LiteralUnion<T, string>` for known values with custom options
- **Type-safe IDs**: Use `Opaque<string, 'TypeName'>` for type-safe identifiers
- **Object manipulation**: Use `PickByValue<T, V>` and `OmitByValue<T, V>` for value-based type filtering

#### Common Patterns

```typescript
import type { PartialDeep, ReadonlyDeep, LiteralUnion, Opaque } from 'type-fest';

// Configuration pattern
type Config = { database: { host: string; port: number } };
type PartialConfig = PartialDeep<Config>; // Deep partial for construction
type FinalConfig = ReadonlyDeep<Config>; // Immutable after validation

// Extensible enums
type ProviderName = LiteralUnion<'cursor' | 'windsurf', string>;

// Type-safe identifiers
type UserId = Opaque<string, 'UserId'>;
type ProjectId = Opaque<string, 'ProjectId'>;
```

#### Available Utilities

See `/src/utils/types.ts` for project-specific utilities built on type-fest:

- `PartialConfig<T>` and `ValidatedConfig<T>` - Configuration object patterns
- `ProviderName` - Extensible provider name union
- `AbsolutePath` and `RelativePath` - Type-safe file paths
- `Result<T, E>` - Result pattern with helper functions

### Structured Logging with pino

We use `pino` for structured, high-performance logging throughout the codebase.

#### Logger Creation

**Always use `createDefaultLogger()` for new code:**

```typescript
import { createDefaultLogger } from '@rulesets/core';

const logger = createDefaultLogger({
  level: 'info',
  prettyPrint: true,
  baseContext: { component: 'parser' }
});
```

**For backward compatibility, `ConsoleLogger` remains available but is deprecated.**

#### Logging Best Practices

1. **Use structured metadata instead of string interpolation:**

```typescript
// Good
logger.info('File processed successfully', {
  file: filePath,
  size: contentLength,
  duration: processingTime
});

// Avoid
logger.info(`Processed ${filePath} (${contentLength} bytes) in ${processingTime}ms`);
```

2. **Include relevant context in metadata:**

```typescript
logger.error('Compilation failed', {
  file: sourceFile,
  provider: targetProvider,
  error: error.message,
  stage: 'handlebars-compilation'
});
```

3. **Use appropriate log levels:**
   - `debug`: Detailed diagnostic information
   - `info`: General operational messages
   - `warn`: Warning conditions that don't prevent operation
   - `error`: Error conditions that may prevent operation

#### Environment Configuration

Control logging behavior via environment variables:

- `RULESETS_LOG_LEVEL`: Set to `debug`, `info`, `warn`, or `error`
- `NODE_ENV`: When set to `production`, disables pretty printing for performance

#### Logger Interface

All loggers must implement the `Logger` interface:

```typescript
export type Logger = {
  debug(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string | Error, metadata?: LogMetadata): void;
};
```

Error objects are automatically handled - stack traces are included when logging `Error` instances.

## Type Safety Standards

### Required Practices

1. **Strict TypeScript configuration**: No `any` types without explicit justification
2. **Exhaustive error handling**: All async operations must handle errors appropriately
3. **Interface segregation**: Keep interfaces focused and minimal
4. **Immutability by default**: Use `readonly` for data that shouldn't change

### Type Definition Guidelines

```typescript
// Good - Clear, specific types
type CompileResult = {
  readonly success: boolean;
  readonly output?: string;
  readonly errors: readonly CompileError[];
};

// Avoid - Vague, mutable types
type CompileResult = {
  success: boolean;
  data?: any;
  errors: any[];
};
```

### Error Handling Patterns

Use the `Result<T, E>` pattern for operations that can fail:

```typescript
import { Result, success, failure, isSuccess } from '@rulesets/core';

async function parseFile(path: string): Promise<Result<ParsedDoc, Error>> {
  try {
    const content = await fs.readFile(path, 'utf8');
    const parsed = parse(content);
    return success(parsed);
  } catch (error) {
    return failure(error instanceof Error ? error : new Error(String(error)));
  }
}

// Usage
const result = await parseFile('example.rule.md');
if (isSuccess(result)) {
  console.log('Parsed successfully:', result.data);
} else {
  console.error('Parse failed:', result.error.message);
}
```

## Performance Considerations

### Logging Performance

- Use debug level logging sparingly in hot paths
- Prefer structured metadata over string concatenation
- pino automatically handles performance optimizations in production

### Type System Performance

- Avoid deeply nested conditional types that slow compilation
- Use type-fest utilities instead of complex custom types
- Keep union types reasonably small for better IntelliSense performance

## Testing Requirements

### Logger Testing

Mock the logger interface in tests rather than specific implementations:

```typescript
const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
```

### Type Testing

Verify type utilities work as expected:

```typescript
import { expectType } from 'tsd';
import type { PartialConfig, ValidatedConfig } from '@rulesets/core';

type Config = { required: string; optional?: number };

expectType<PartialConfig<Config>>({ }); // Should compile
expectType<ValidatedConfig<Config>>({ required: 'test' }); // Should compile
```

## Migration Guidelines

### From ConsoleLogger to StructuredLogger

Replace direct instantiation:

```typescript
// Before
const logger = new ConsoleLogger();

// After
const logger = createDefaultLogger();
```

Update function parameters to use the interface:

```typescript
// Before
function processFile(path: string, logger: ConsoleLogger) { }

// After
function processFile(path: string, logger: Logger) { }
```

### Adding Type Safety

Gradually replace generic types with specific ones:

```typescript
// Before
config: Record<string, any>

// After
config: ProviderConfig & Record<string, unknown>
```

Use Result pattern for new error-prone operations:

```typescript
// Before
async function riskyOperation(): Promise<Data> {
  // throws on error
}

// After
async function riskyOperation(): Promise<Result<Data, Error>> {
  // returns success/failure
}
```

This document should be updated as coding standards evolve and new patterns emerge.