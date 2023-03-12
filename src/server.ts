import Fastify, { type FastifyInstance } from "fastify";
import type { AppConfig, PluginFn, PluginOptions } from "./utils/types";
import { createLogger } from "./logging/logger";
import { registerRequestId } from "./logging/request-id";
import { registerErrorHandler } from "./errors/handler";
import { registerControllers } from "./router";

// ---------- Types ----------

export interface ForgeApp {
  /** Underlying Fastify instance — escape hatch for advanced usage */
  readonly instance: FastifyInstance;

  /** Register a Fastify plugin or an api-forge plugin function */
  register(plugin: PluginFn | ((app: FastifyInstance, opts?: any) => any), opts?: PluginOptions): ForgeApp;

  /** Register one or more decorated controller classes */
  controllers(classes: (new (...args: any[]) => any)[]): ForgeApp;

  /** Start listening */
  listen(): Promise<string>;

  /** Graceful shutdown */
  close(): Promise<void>;

  /** Access the Fastify instance for testing (inject) */
  inject: FastifyInstance["inject"];
}

// ---------- Factory ----------

/**
 * Create an api-forge application.
 *
 * @example
 * ```ts
 * const app = createApp({ port: 3000, logger: true });
 * app.register(authPlugin({ secret: "supersecret" }));
 * app.controllers([UserController]);
 * await app.listen();
 * ```
 */
export function createApp(config: Partial<AppConfig> = {}): ForgeApp {
  const {
    port = 3000,
    host = "0.0.0.0",
    logger = true,
    prefix,
    trustProxy = false,
  } = config;

  // Build Fastify instance
  const loggerOption =
    typeof logger === "object"
      ? logger
      : logger
        ? createLogger()
        : false;

  const app = Fastify({
    logger: loggerOption as any,
    trustProxy,
    ...(prefix ? { prefix } : {}),
  });

  // Core built-ins
  registerRequestId(app);
  registerErrorHandler(app);

  const forge: ForgeApp = {
    get instance() {
      return app;
    },

    register(plugin, opts = {}) {
      app.register(plugin as any, opts);
      return forge;
    },

    controllers(classes) {
      registerControllers(app, classes);
      return forge;
    },

    async listen() {
      const address = await app.listen({ port, host });
      return address;
    },

    async close() {
      await app.close();
    },

    inject: app.inject.bind(app),
  };

  return forge;
}

/**
 * Create a minimal app suitable for testing — logger disabled, ephemeral port.
 */
export function createTestApp(): ForgeApp {
  return createApp({ port: 0, logger: false });
}
