// TLDR: Thin wrapper around ora with JSON/quiet awareness (mixd-v0)
import ora from 'ora';

export function createSpinner(text: string) {
  const isJson = process.env.RULESETS_LOG_FORMAT === 'json';
  const isQuiet =
    (process.env.RULESETS_LOG_LEVEL || '').toLowerCase() === 'error';
  return ora({ text, isSilent: isJson || isQuiet }).start();
}
