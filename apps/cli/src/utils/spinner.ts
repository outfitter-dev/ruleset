import ora from "ora";

/**
 * Creates a spinner that respects JSON/quiet logging modes so automated
 * consumers are not spammed with terminal animations.
 */
export function createSpinner(text: string) {
  const isJson = process.env.RULESETS_LOG_FORMAT === "json";
  const isQuiet =
    (process.env.RULESETS_LOG_LEVEL || "").toLowerCase() === "error";
  return ora({ text, isSilent: isJson || isQuiet }).start();
}
