import pino, { type Logger, type LoggerOptions } from "pino";

export type { Logger } from "pino";

const DEFAULT_OPTIONS: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
  serializers: {
    req(request) {
      return {
        method: request.method,
        url: request.url,
        hostname: request.hostname,
        remoteAddress: request.ip,
      };
    },
    res(reply) {
      return {
        statusCode: reply.statusCode,
      };
    },
  },
};

/**
 * Create a pre-configured pino logger.
 *
 * In non-production environments, `pino-pretty` is enabled automatically.
 */
export function createLogger(opts: LoggerOptions = {}): Logger {
  const isDev = process.env.NODE_ENV !== "production";

  const merged: LoggerOptions = {
    ...DEFAULT_OPTIONS,
    ...opts,
    ...(isDev
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss",
              ignore: "pid,hostname",
            },
          },
        }
      : {}),
  };

  return pino(merged);
}

/**
 * Create a child logger scoped to a specific module or component.
 */
export function createChildLogger(
  parent: Logger,
  module: string,
  extra: Record<string, unknown> = {}
): Logger {
  return parent.child({ module, ...extra });
}
