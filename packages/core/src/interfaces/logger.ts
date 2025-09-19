export type LogMetadata = {
  file?: string;
  destination?: string;
  line?: number;
  [key: string]: unknown;
};

export type Logger = {
  debug(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  error(message: string | Error, metadata?: LogMetadata): void;
};

// Basic console logger implementation for v0
export class ConsoleLogger implements Logger {
  private formatMetadata(metadata?: LogMetadata): string {
    if (!metadata || Object.keys(metadata).length === 0) {
      return '';
    }
    const pairs = Object.entries(metadata)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`);
    return pairs.length > 0 ? ` [${pairs.join(' ')}]` : '';
  }

  private writeOut(line: string): void {
    process.stdout.write(line.endsWith('\n') ? line : `${line}\n`);
  }
  private writeErr(line: string): void {
    process.stderr.write(line.endsWith('\n') ? line : `${line}\n`);
  }
  debug(message: string, metadata?: LogMetadata): void {
    if (process.env.RULESETS_LOG_LEVEL === 'debug') {
      this.writeOut(`[DEBUG] ${message}${this.formatMetadata(metadata)}`);
    }
  }
  info(message: string, metadata?: LogMetadata): void {
    this.writeOut(`[INFO] ${message}${this.formatMetadata(metadata)}`);
  }
  warn(message: string, metadata?: LogMetadata): void {
    this.writeErr(`[WARN] ${message}${this.formatMetadata(metadata)}`);
  }
  error(message: string | Error, metadata?: LogMetadata): void {
    if (message instanceof Error) {
      this.writeErr(
        `[ERROR] ${message.message}${this.formatMetadata(metadata)}\n${message.stack ?? ''}`
      );
    } else {
      this.writeErr(`[ERROR] ${message}${this.formatMetadata(metadata)}`);
    }
  }
}
