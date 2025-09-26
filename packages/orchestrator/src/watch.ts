import { type FSWatcher, watch as watchFs } from "node:fs";
import path from "node:path";

import type { CompilationOutput } from "@rulesets/types";

const DEFAULT_DEBOUNCE_MS = 150;

type WatchManager = {
  update(paths: Iterable<string>): void;
  dispose(): void;
};

const createWatchManager = (
  onChange: (paths: Set<string>) => void,
  options: { debounceMs?: number } = {}
): WatchManager => {
  const watchers = new Map<string, FSWatcher>();
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  let debounceTimer: NodeJS.Timeout | undefined;
  const pendingPaths = new Set<string>();

  const flush = () => {
    const snapshot = new Set(pendingPaths);
    pendingPaths.clear();
    onChange(snapshot);
  };

  const schedule = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      flush();
    }, debounceMs);
  };

  const attachWatcher = (watchPath: string) => {
    if (watchers.has(watchPath)) {
      return;
    }

    try {
      const watcher = watchFs(
        watchPath,
        { recursive: false },
        (_event, file) => {
          const changed =
            typeof file === "string" && file.length > 0
              ? path.join(watchPath, file)
              : watchPath;
          pendingPaths.add(path.resolve(changed));
          schedule();
        }
      );

      watcher.on("error", () => {
        watcher.close();
        watchers.delete(watchPath);
      });

      watchers.set(watchPath, watcher);
    } catch {
      // Ignore paths that cannot be watched (may not exist yet).
    }
  };

  const update = (paths: Iterable<string>) => {
    const desired = new Set<string>();
    for (const value of paths) {
      desired.add(value);
    }

    for (const [watchPath, watcher] of watchers) {
      if (!desired.has(watchPath)) {
        watcher.close();
        watchers.delete(watchPath);
      }
    }

    for (const watchPath of desired) {
      attachWatcher(watchPath);
    }
  };

  const dispose = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = undefined;
    }
    pendingPaths.clear();
    for (const watcher of watchers.values()) {
      watcher.close();
    }
    watchers.clear();
  };

  return { update, dispose };
};

export type WatchExecutorResult = {
  output: CompilationOutput;
  watchPaths: readonly string[];
};

export type WatchExecutor = (
  phase: "initial" | "incremental",
  changedPaths?: ReadonlySet<string>
) => Promise<WatchExecutorResult>;

export type WatchOptions = {
  debounceMs?: number;
};

const toAbsoluteDirectory = (value: string): string => {
  const resolved = path.resolve(value);
  return path.extname(resolved) ? path.dirname(resolved) : resolved;
};

const computeWatchDirectories = (
  watchPaths: readonly string[],
  output: CompilationOutput
): Set<string> => {
  const directories = new Set<string>();
  for (const watchPath of watchPaths) {
    directories.add(toAbsoluteDirectory(watchPath));
  }

  if (output.sourceSummaries) {
    for (const summary of output.sourceSummaries) {
      for (const dependency of summary.dependencies) {
        directories.add(toAbsoluteDirectory(dependency));
      }
    }
  }

  return directories;
};

export const watchRulesets = (
  executor: WatchExecutor,
  options: WatchOptions = {}
): AsyncIterable<CompilationOutput> => {
  const { debounceMs = DEFAULT_DEBOUNCE_MS } = options;

  return {
    async *[Symbol.asyncIterator]() {
      let disposed = false;
      let fatalError: unknown;
      const outputs: CompilationOutput[] = [];
      let resolvePending: (() => void) | undefined;

      const notify = () => {
        if (resolvePending) {
          const resolve = resolvePending;
          resolvePending = undefined;
          resolve();
        }
      };

      const pushOutput = (output: CompilationOutput) => {
        outputs.push(output);
        notify();
      };

      let pendingChangedPaths: Set<string> | undefined;
      let rebuildInProgress = false;
      let pendingRebuild = false;

      const runCompilation = async (
        phase: "initial" | "incremental",
        changedPaths?: Set<string>
      ) => {
        try {
          const result = await executor(phase, changedPaths);
          const directories = computeWatchDirectories(
            result.watchPaths,
            result.output
          );
          if (directories.size === 0) {
            directories.add(process.cwd());
          }
          watchManager.update(directories);
          pushOutput(result.output);
        } catch (error) {
          fatalError = error;
          disposed = true;
          watchManager.dispose();
          notify();
        }
      };

      const scheduleRecompile = (changedPaths?: Set<string>) => {
        if (disposed) {
          return;
        }
        if (changedPaths && changedPaths.size > 0) {
          if (pendingChangedPaths) {
            for (const value of changedPaths) {
              pendingChangedPaths.add(value);
            }
          } else {
            pendingChangedPaths = new Set(changedPaths);
          }
        } else if (!pendingChangedPaths) {
          pendingChangedPaths = new Set<string>();
        }

        if (rebuildInProgress) {
          pendingRebuild = true;
          return;
        }

        rebuildInProgress = true;
        const snapshot = pendingChangedPaths;
        pendingChangedPaths = undefined;

        runCompilation("incremental", snapshot).finally(() => {
          rebuildInProgress = false;
          if (pendingRebuild) {
            pendingRebuild = false;
            scheduleRecompile();
          }
        });
      };

      const watchManager = createWatchManager(
        (changedPaths) => {
          if (disposed) {
            return;
          }
          if (changedPaths.size === 0) {
            scheduleRecompile(new Set());
          } else {
            scheduleRecompile(changedPaths);
          }
        },
        { debounceMs }
      );

      await runCompilation("initial");

      try {
        while (!disposed) {
          if (fatalError) {
            throw fatalError;
          }

          if (outputs.length === 0) {
            await new Promise<void>((resolve) => {
              resolvePending = resolve;
            });
            if (fatalError) {
              throw fatalError;
            }
            if (disposed && outputs.length === 0) {
              break;
            }
          }

          const output = outputs.shift();
          if (!output) {
            continue;
          }
          yield output;
        }
      } finally {
        disposed = true;
        watchManager.dispose();
      }
    },
  };
};
