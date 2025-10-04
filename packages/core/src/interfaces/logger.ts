import type { Logger as PinoLogger } from "pino";
import pino from "pino";

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

/**
 * Logger configuration options.
 */
export type LoggerConfig = {
  /** Minimum log level to output */
  level?: "debug" | "info" | "warn" | "error";
  /** Whether to format logs for human reading */
  prettyPrint?: boolean;
  /** Additional context to include in all log messages */
  baseContext?: Record<string, unknown>;
};

/**
 * Pino-based structured logger implementation.
 * Provides consistent, structured logging across the Rulesets codebase.
 */
export class StructuredLogger implements Logger {
  private readonly logger: PinoLogger;

  constructor(config: LoggerConfig = {}) {
    const {
      level = process.env.RULESETS_LOG_LEVEL || "info",
      prettyPrint = process.env.NODE_ENV !== "production",
      baseContext = {},
    } = config;

    this.logger = pino({
      level,
      base: {
        name: "ruleset",
        ...baseContext,
      },
      transport: prettyPrint
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:standard",
              ignore: "pid,hostname,name",
            },
          }
        : undefined,
    });
  }

  debug(message: string, metadata?: LogMetadata): void {
    this.logger.debug(metadata ?? {}, message);
  }

  info(message: string, metadata?: LogMetadata): void {
    this.logger.info(metadata ?? {}, message);
  }

  warn(message: string, metadata?: LogMetadata): void {
    this.logger.warn(metadata ?? {}, message);
  }

  error(message: string | Error, metadata?: LogMetadata): void {
    if (message instanceof Error) {
      this.logger.error({ err: message, ...metadata }, message.message);
    } else {
      this.logger.error(metadata ?? {}, message);
    }
  }
}

/**
 * Legacy console logger for backward compatibility.
 * @deprecated Use StructuredLogger for new code.
 */
export class ConsoleLogger implements Logger {
  private formatMetadata(metadata?: LogMetadata): string {
    if (!metadata || Object.keys(metadata).length === 0) {
      return "";
    }
    const pairs = Object.entries(metadata)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`);
    return pairs.length > 0 ? ` [${pairs.join(" ")}]` : "";
  }

  private writeOut(line: string): void {
    process.stdout.write(line.endsWith("\n") ? line : `${line}\n`);
  }
  private writeErr(line: string): void {
    process.stderr.write(line.endsWith("\n") ? line : `${line}\n`);
  }
  debug(message: string, metadata?: LogMetadata): void {
    if (process.env.RULESETS_LOG_LEVEL === "debug") {
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
        `[ERROR] ${message.message}${this.formatMetadata(metadata)}\n${message.stack ?? ""}`
      );
    } else {
      this.writeErr(`[ERROR] ${message}${this.formatMetadata(metadata)}`);
    }
  }
}

/**
 * Creates a default logger instance for the Rulesets project.
 * Uses StructuredLogger with sensible defaults.
 */
export function createDefaultLogger(config?: LoggerConfig): Logger {
  return new StructuredLogger(config);
}
