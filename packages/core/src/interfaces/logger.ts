export type Logger = {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string | Error, ...args: unknown[]): void;
};

// Basic console logger implementation for v0
export class ConsoleLogger implements Logger {
  private writeOut(line: string): void {
    process.stdout.write(line.endsWith('\n') ? line : `${line}\n`);
  }
  private writeErr(line: string): void {
    process.stderr.write(line.endsWith('\n') ? line : `${line}\n`);
  }
  debug(message: string, ...args: unknown[]): void {
    if (process.env.RULESETS_LOG_LEVEL === 'debug') {
      this.writeOut(`[DEBUG] ${message} ${args.map(String).join(' ')}`);
    }
  }
  info(message: string, ...args: unknown[]): void {
    this.writeOut(`[INFO] ${message} ${args.map(String).join(' ')}`);
  }
  warn(message: string, ...args: unknown[]): void {
    this.writeErr(`[WARN] ${message} ${args.map(String).join(' ')}`);
  }
  error(message: string | Error, ...args: unknown[]): void {
    if (message instanceof Error) {
      this.writeErr(
        `[ERROR] ${message.message}\n${message.stack ?? ''} ${args
          .map(String)
          .join(' ')}`
      );
    } else {
      this.writeErr(`[ERROR] ${message} ${args.map(String).join(' ')}`);
    }
  }
}
