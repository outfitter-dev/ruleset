import { GlobalHistory } from "@ruleset/lib";
import type { Command } from "commander";

/**
 * Track command execution in global history
 */
type TrackCommandOptions = {
  commandName: string;
  args: string[];
  options: Record<string, unknown>;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
};

export async function trackCommand(
  cmdOptions: TrackCommandOptions
): Promise<void> {
  const { commandName, args, options, success, error, metadata } = cmdOptions;
  // Skip history tracking if disabled via env var
  if (
    process.env.RULESETS_NO_HISTORY === "true" ||
    process.env.RULESETS_NO_HISTORY === "1"
  ) {
    return;
  }

  try {
    const history = new GlobalHistory({
      disabled: false,
    });

    await history.addCommand({
      command: commandName,
      args,
      options,
      cwd: process.cwd(),
      success,
      error,
      version: "0.4.0-next.0", // TODO: Get from package.json
      metadata,
    });
  } catch {
    // Silently ignore history tracking errors
  }
}

/**
 * Add history tracking to a command
 */
export function withHistoryTracking<T extends Command>(command: T): T {
  const originalAction = command.action;

  command.action(async function (this: Command, ...args: unknown[]) {
    const startTime = Date.now();
    const commandName = command.name();

    // Extract arguments and options from the action args
    // The last arg is always the Command instance
    const cmdInstance = args.at(-1) as Command;
    const actionArgs = args.slice(0, -1);
    const opts = cmdInstance.opts();

    let success = false;
    let error: string | undefined;

    try {
      // Call the original action
      const result = await originalAction.apply(this, args);
      success = true;
      return result;
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      const duration = Date.now() - startTime;

      // Track the command execution
      await trackCommand({
        commandName,
        args: actionArgs.filter((arg) => typeof arg === "string") as string[],
        options: opts,
        success,
        error,
        metadata: { duration },
      });
    }
  });

  return command;
}
