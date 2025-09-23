import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'esnext',
  platform: 'neutral',
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['@rulesets/core', 'chalk', 'commander', 'ora'],
  bundle: true,
  splitting: false,
});
