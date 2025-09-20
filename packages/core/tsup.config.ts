import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false, // Will generate separately due to tsconfig issues
  sourcemap: true,
  clean: true,
  splitting: false,
  shims: false, // No Node shims needed for Bun
  external: ['js-yaml', '@iarna/toml', 'semver', 'handlebars'], // Only direct dependencies that consumers must install
  outExtension() {
    return {
      js: '.js',
    };
  },
});
