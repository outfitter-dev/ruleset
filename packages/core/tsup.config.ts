import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: false, // Will generate separately due to tsconfig issues
  sourcemap: true,
  clean: true,
  splitting: false,
  shims: true,
  external: ['js-yaml', '@iarna/toml', 'semver'], // Only direct dependencies that consumers must install
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.mjs' : '.cjs',
    };
  },
});
