import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  platform: 'node',
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    '@rulesets/core',
    'chalk',
    'commander',
    'ora',
    'node:fs',
    'node:path',
    'node:url',
    'node:os'
  ],
  bundle: true,
  splitting: false,
});
