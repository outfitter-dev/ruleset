// TLDR: Minimal logger for CLI with optional JSON output (mixd-v0)
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error']; // mixd-v0

function stripAnsi(input: string): string {
  // Basic ANSI escape sequence stripper built from string to avoid control-char regex literal (mixd-v0)
  const ansiPattern = '\\u001B\\[[0-9;]*[A-Za-z]';
  const re = new RegExp(ansiPattern, 'g');
  return input.replace(re, '');
}

function currentLevel(): LogLevel {
  return (process.env.RULESETS_LOG_LEVEL as LogLevel) || 'info';
}

function isJsonMode(): boolean {
  return process.env.RULESETS_LOG_FORMAT === 'json';
}

function shouldLog(level: LogLevel): boolean {
  return LEVELS.indexOf(level) >= LEVELS.indexOf(currentLevel());
}

function write(stream: NodeJS.WritableStream, message: string): void {
  stream.write(message.endsWith('\n') ? message : `${message}\n`);
}

export const logger = {
  debug(message: string): void {
    if (shouldLog('debug')) {
      if (isJsonMode()) {
        write(
          process.stdout,
          JSON.stringify({
            level: 'debug',
            ts: new Date().toISOString(),
            message: stripAnsi(message),
          })
        );
      } else {
        write(process.stdout, message);
      }
    }
  },
  info(message: string): void {
    if (shouldLog('info')) {
      if (isJsonMode()) {
        write(
          process.stdout,
          JSON.stringify({
            level: 'info',
            ts: new Date().toISOString(),
            message: stripAnsi(message),
          })
        );
      } else {
        write(process.stdout, message);
      }
    }
  },
  warn(message: string): void {
    if (shouldLog('warn')) {
      if (isJsonMode()) {
        write(
          process.stderr,
          JSON.stringify({
            level: 'warn',
            ts: new Date().toISOString(),
            message: stripAnsi(message),
          })
        );
      } else {
        write(process.stderr, message);
      }
    }
  },
  error(message: string | Error): void {
    if (!shouldLog('error')) {
      return;
    }
    if (isJsonMode()) {
      if (message instanceof Error) {
        write(
          process.stderr,
          JSON.stringify({
            level: 'error',
            ts: new Date().toISOString(),
            message: stripAnsi(message.message),
            stack: message.stack,
          })
        );
      } else {
        write(
          process.stderr,
          JSON.stringify({
            level: 'error',
            ts: new Date().toISOString(),
            message: stripAnsi(message),
          })
        );
      }
    } else if (message instanceof Error) {
      write(process.stderr, message.stack ?? message.message);
    } else {
      write(process.stderr, message);
    }
  },
} as const;
