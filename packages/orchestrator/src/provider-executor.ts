import { spawn } from "node:child_process";

import type {
  ProviderCompileInput,
  ProviderCompileResult,
  ProviderEntry,
} from "@ruleset/providers";
import {
  type CompileArtifact,
  createResultErr,
  createResultOk,
  type RulesetDiagnostics,
  type RulesetDocument,
  type RulesetRuntimeContext,
} from "@ruleset/types";

const BUN_COMMAND = "bun";

type SerializableDocument = Pick<
  RulesetDocument,
  "source" | "metadata" | "ast"
> & {
  diagnostics?: RulesetDiagnostics;
};

type SerializableContext = Pick<RulesetRuntimeContext, "cwd" | "cacheDir"> & {
  env: Record<string, string>;
};

const serializeDocument = (
  document: RulesetDocument
): SerializableDocument => ({
  source: document.source,
  metadata: document.metadata,
  ast: document.ast,
  diagnostics: document.diagnostics ?? [],
});

const serializeContext = (
  context: RulesetRuntimeContext
): SerializableContext => ({
  cwd: context.cwd,
  cacheDir: context.cacheDir,
  env: Object.fromEntries(context.env.entries()),
});

const runBunSubprocess = async (
  provider: ProviderEntry,
  input: ProviderCompileInput
): Promise<ProviderCompileResult> => {
  const sandbox = provider.handshake.sandbox;
  if (!sandbox?.entry) {
    return createResultErr([
      {
        level: "error",
        message: `Provider "${provider.handshake.providerId}" declared bun-subprocess sandbox but did not provide an entry script.`,
        tags: ["provider", provider.handshake.providerId, "sandbox"],
      },
    ]);
  }

  const command = sandbox.command ?? BUN_COMMAND;
  const args = sandbox.args ?? [sandbox.entry];
  const env = {
    ...process.env,
    ...sandbox.env,
  };

  const payload = JSON.stringify({
    handshake: provider.handshake,
    input: {
      document: serializeDocument(input.document),
      context: serializeContext(input.context),
      target: input.target,
      projectConfig: input.projectConfig,
      projectConfigPath: input.projectConfigPath,
      rendered: input.rendered,
    },
  });

  return await new Promise((resolve) => {
    const child = spawn(command, args, {
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk) => {
      stdoutChunks.push(Buffer.from(chunk));
    });

    child.stderr.on("data", (chunk) => {
      stderrChunks.push(Buffer.from(chunk));
    });

    child.on("error", (error) => {
      resolve(
        createResultErr([
          {
            level: "error",
            message: `Failed to launch provider subprocess for "${provider.handshake.providerId}"`,
            hint: error.message,
            tags: ["provider", provider.handshake.providerId, "sandbox"],
          },
        ])
      );
    });

    child.on("close", (exitCode) => {
      const stdout = Buffer.concat(stdoutChunks).toString("utf8");
      const stderr = Buffer.concat(stderrChunks).toString("utf8");

      if (exitCode !== 0) {
        resolve(
          createResultErr([
            {
              level: "error",
              message: `Provider subprocess for "${provider.handshake.providerId}" exited with code ${exitCode}.`,
              hint: stderr || undefined,
              tags: ["provider", provider.handshake.providerId, "sandbox"],
            },
          ])
        );
        return;
      }

      try {
        const parsed = JSON.parse(stdout) as {
          ok: boolean;
          artifact?: CompileArtifact | null;
          artifacts?: readonly CompileArtifact[] | null;
          diagnostics?: RulesetDiagnostics;
          error?: string;
        };

        if (parsed.ok) {
          if (Array.isArray(parsed.artifacts)) {
            resolve(createResultOk(parsed.artifacts));
            return;
          }

          if (parsed.artifact) {
            resolve(createResultOk(parsed.artifact));
            return;
          }
        }

        if (parsed.diagnostics) {
          resolve(createResultErr(parsed.diagnostics));
          return;
        }

        resolve(
          createResultErr([
            {
              level: "error",
              message:
                parsed.error ??
                "Provider subprocess returned an invalid payload.",
              hint: stdout,
              tags: ["provider", provider.handshake.providerId, "sandbox"],
            },
          ])
        );
      } catch (error) {
        resolve(
          createResultErr([
            {
              level: "error",
              message: `Failed to parse provider subprocess output for "${provider.handshake.providerId}"`,
              hint: error instanceof Error ? error.message : String(error),
              tags: ["provider", provider.handshake.providerId, "sandbox"],
            },
          ])
        );
      }
    });

    child.stdin.write(payload);
    child.stdin.end();
  });
};

export const executeProviderCompile = (
  provider: ProviderEntry,
  input: ProviderCompileInput
): Promise<ProviderCompileResult> => {
  const sandboxMode = provider.handshake.sandbox?.mode ?? "in-process";

  if (sandboxMode === "bun-subprocess") {
    return runBunSubprocess(provider, input);
  }

  return Promise.resolve(provider.compile(input));
};
