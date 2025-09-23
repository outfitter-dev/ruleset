# Workflow Rules Review (2025-08-19 14:30)

Scope: Review `.agents/rules/WORKFLOWS.md` and subsequent workflow files for accuracy and best practices, and provide critiques/suggestions.

## What I Found

- `.agents/rules/WORKFLOWS.md` now exists in this workspace and serves as the source-of-truth index.
- Related materials:
  - `monorepo/.agents/rules/CI.md` (covers GitHub Actions workflows, caching, stages, and release automation).
  - Multiple actual GitHub workflows under `.github/workflows` in various packages; notably this repo’s root `.github/workflows/ci.yml` and `.github/workflows/ci-quick-fix.yml`.

## Assessment: `monorepo/.agents/rules/CI.md`

Overall: Solid, broadly accurate, and aligns with common best practices. The document advocates reusable workflows, matrix builds, separation of concerns, Turbo caching, and Changesets—these are all good.

Suggestions to strengthen it:

- Action pinning: Recommend pinning GitHub Actions by version range (e.g., `@v4`) and ideally by commit SHA for supply-chain safety, with Dependabot to update.
- Permissions: Add a standard snippet for least-privilege `permissions` at workflow/job level (e.g., default `contents: read`; add `id-token: write` only where needed; `packages: write` for publish).
- Concurrency: Include a baseline `concurrency` example that cancels superseded runs per ref.
- Triggers: Encourage use of `paths`/`paths-ignore` to avoid running CI for docs-only changes in monorepos, and gating on `pull_request` only for non-draft PRs.
- Bun versioning: Avoid `bun-version: 'latest'`; prefer pinned major/minor (e.g., `1.2.x`) for reproducibility.
- Cache guidance: Clarify lockfile naming differences (`bun.lock` vs `bun.lockb`) and recommend keying caches to the actual file present in the repo. Avoid caching `node_modules` unless necessary; rely on Bun’s cache.
- Reusable workflows: Provide an explicit `workflow_call` example with typed inputs, secrets handling (`secrets: inherit` vs explicit), and output propagation.
- Coverage & artifacts: Suggest collecting coverage (e.g., `bun test --coverage`) and uploading results (Codecov or artifact) for visibility; optionally publish a summary using `$GITHUB_STEP_SUMMARY`.
- Turbo remote caching: Show an example setting `TURBO_TOKEN`/`TURBO_TEAM` and enabling remote cache in CI to get consistent speed-ups across jobs.
- Security: Mention OIDC for npm publishing (to reduce reliance on long-lived `NPM_TOKEN`) where feasible.

## Assessment: `.github/workflows/ci.yml` (this repo)

Strengths observed:

- Concurrency: Uses a per-ref `concurrency` group with cancel-in-progress.
- Reproducibility: Pins `oven-sh/setup-bun@v2` with a specific Bun version (`1.2.19`).
- Debuggability: Uploads step logs as artifacts and produces a step summary rollup. Uses `continue-on-error` per step and a terminal “Check Results” to fail the job while keeping logs.
- Release: Uses `changesets/action@v1` with full history checkout for versioning.

Notable improvement opportunities:

- Permissions: Add top-level `permissions` (e.g., default `contents: read`) and job-specific elevation where required (release: `contents: write`; optionally `id-token: write` if moving to OIDC publish).
- Cache policy: You cache `node_modules` along with Bun’s cache. With Bun, caching `node_modules` often yields limited benefit and can introduce inconsistencies. Prefer caching Bun’s install cache only; let `bun install --frozen-lockfile` rebuild `node_modules` deterministically.
- Path filters: Consider `paths`/`paths-ignore` for triggers to skip unnecessary runs (e.g., docs-only changes) and/or leverage Turbo scopes to reduce work to changed packages.
- Coverage: If tests exist, add coverage generation and artifact upload (or Codecov) and publish a coverage badge/threshold in the PR summary.
- Turbo cache: For larger builds, consider enabling a remote Turbo cache. The workflow currently caches build artifacts and `.turbo` in release; remote caching across jobs/runs can further reduce time.
- Matrix/OS coverage: If cross-env support matters, add a small matrix (Node/Bun versions or OS) and/or a weekly scheduled workflow for broader coverage.
- Runtime limits: You set `timeout-minutes`; good. Consider `fail-fast: false` for matrices where appropriate to surface all failures simultaneously.

Notes on correctness vs repo specifics:

- Lockfile: This repo uses `bun.lock` (not `bun.lockb`). Your workflows check `bun.lock` and key caches accordingly—good. Keep this consistent across docs and examples.
- Checkout depth: `fetch-depth: 2` is fine for the validation job; the release job correctly uses `fetch-depth: 0` for changesets.

## Assessment: `.github/workflows/ci-quick-fix.yml`

- Intent: A temporary relaxed flow for `release/v0.1-beta` that installs via Yarn mode (`bun install --yarn`) and skips linting.
- Suggestion: Remove this once the main CI is stable. It introduces a parallel install mode and different cache keys, which can mask integration issues. If keeping temporarily, add a conspicuous deprecation note and an end-of-life date.

## Gaps Likely Covered by a Missing `WORKFLOWS.md`

If you intend a `WORKFLOWS.md` under `.agents/rules`, I recommend it becomes a "source-of-truth" guide with:

- Standard Workflows: PR validation, release, hotfix, security scanning (SCA + secret scan), docs-only verification, e2e/regression suites.
- Structure: Guidance on reusable workflows via `workflow_call` and when to use composite actions vs reusable workflows.
- Conventions: Naming, concurrency policy, default permissions, default timeouts, artifact retention, runner selection.
- Monorepo Strategy: Turbo filters (`--filter`), affected-package detection, path filters, matrix design per package type.
- Caching: Bun cache policy, Turbo remote cache config, when to cache build outputs.
- Security: OIDC for package publishing, `permissions` defaults, dependency-review, code scanning, secret scanning.
- Observability: Step summaries, artifact uploads, Slack/Teams notifications, flake tracking and retry patterns.
- Examples: Copy-pasteable `ci.yml`, `reusable-test.yml`, `release.yml`, with annotations.

## Concrete Snippets to Add to the Rules

- Permissions baseline:

  ```yaml
  permissions:
    contents: read
  ```

  Elevate per job only as needed (e.g., `contents: write`, `id-token: write`, `packages: write`).

- Concurrency:

  ```yaml
  concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}
    cancel-in-progress: true
  ```

- Trigger path filters:

  ```yaml
  on:
    pull_request:
      branches: [main, develop]
      paths-ignore:
        - '**/*.md'
        - 'docs/**'
        - '.github/**'
  ```

- Bun setup with pinned version and cache:

  ```yaml
  - uses: oven-sh/setup-bun@v2
    with:
      bun-version: '1.2.x'
  - uses: actions/cache@v4
    with:
      path: ~/.bun/install/cache
      key: ${{ runner.os }}-bun-${{ hashFiles('**/bun.lock') }}
      restore-keys: ${{ runner.os }}-bun-
  ```

- Reusable workflow example:

  ```yaml
  # .github/workflows/reusable-test.yml
  name: Reusable Tests
  on: { workflow_call: { inputs: { scope: { required: false, type: string } } } }
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: oven-sh/setup-bun@v2
          with: { bun-version: '1.2.x' }
        - run: bun install --frozen-lockfile
        - run: bunx turbo run test ${{ inputs.scope }}
  ```

## Summary

- `.agents/rules/WORKFLOWS.md` appears to be missing; I reviewed the closest relevant sources instead.
- The CI rules and current workflows are broadly sound and reflect good practice. The most impactful improvements would be: least-privilege `permissions`, refined cache strategy (avoid `node_modules`), explicit path filters, coverage/artifact standards, action pinning, and optional OIDC for publishing.
- If you share the intended `WORKFLOWS.md` or confirm its path, I can do a targeted review and update these notes accordingly.
