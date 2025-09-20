# `.mix.md` File Extension Support

## Overview

This document outlines the plan for implementing the `.mix.md` file extension for Mixdown source rules files. This extension will improve discoverability, enable better search capabilities, and support IDE integration.

## Implementation Proposal

### Core Features

1. **Dual Extension Support**
   - Both `.md` and `.mix.md` extensions should be recognized as valid source rules files
   - `.mix.md` should be treated as the preferred extension

2. **Compiler Implementation**
   - The compiler should scan for both `.md` and `.mix.md` files
   - Add a configuration option to prefer one extension over the other (default to `.mix.md`)

3. **Type Definitions**
   - Define supported extensions as constants
   - Create proper TypeScript types for supported extensions

4. **Utility Methods**
   - Add method to get preferred extension based on configuration
   - Add method to check if a file is a valid source rules file

### Code Structure

The proposed implementation would involve these changes to the core package:

```typescript
// In types.ts
export const SUPPORTED_EXTENSIONS = ['.md', '.mix.md'] as const;
export type SupportedExtension = typeof SUPPORTED_EXTENSIONS[number];

export interface CompilerConfig {
  // ...existing config
  preferMixExtension?: boolean;
}

export interface SourceRulesFile {
  // ...existing properties
  extension: SupportedExtension;
}

// In compiler.ts
class MixdownCompiler {
  constructor(config: CompilerConfig) {
    this.config = {
      ...config,
      preferMixExtension: config.preferMixExtension ?? true // Default to preferring .mix.md
    };
  }

  findSourceRulesFiles(directory: string): SourceRulesFile[] {
    // Implementation that checks for both .mix.md and .md extensions
  }

  getPreferredExtension(): string {
    return this.config.preferMixExtension ? '.mix.md' : '.md';
  }

  isSourceRulesFile(filePath: string): boolean {
    return SUPPORTED_EXTENSIONS.some(ext => filePath.endsWith(ext));
  }
}
```

## Benefits

1. **Discoverability**
   - The `.mix.md` extension makes it clear these files are Mixdown source rules
   - Better distinction from regular Markdown files

2. **IDE and Tooling Support**
   - Enables IDE plugins to recognize Mixdown files specifically
   - Allows for custom syntax highlighting and validation

3. **Search Improvements**
   - Easier to find all Mixdown files with search tools
   - Clearer distinction in search results

4. **Documentation**
   - Clearer documentation by referring to a specific extension
   - Easier to understand file patterns in project structure

## Migration Strategy

For existing projects:
- Continue supporting `.md` for backward compatibility
- Encourage migration to `.mix.md` for new files
- Provide documentation on the benefits of the `.mix.md` extension

## Testing Strategy

Testing should verify:
- Both extensions are properly recognized
- The correct preferences are applied
- File finder functionality works with both extensions
- Non-supported extensions are rejected