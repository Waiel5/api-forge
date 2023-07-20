import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { MiddlewareFn, MiddlewareContext } from "./utils/types";

/**
 * Compose an array of middleware functions into a single function
 * that executes them in order (Koa-style onion model).
 *
 * Each middleware calls `next()` to hand off to the next one.
 * If a middleware doesn't call `next()`, the chain stops.
 */
export function compose(middlewares: MiddlewareFn[]): MiddlewareFn {
  return async function composed(
    ctx: MiddlewareContext,
    next: () => Promise<void>
  ): Promise<void> {
    let index = -1;

    async function dispatch(i: number): Promise<void> {
      if (i <= index) {
        throw new Error("next() called multiple times in a single middleware");
      }
      index = i;

      const fn = i < middlewares.length ? middlewares[i] : next;

      if (!fn) return;

      if (i === middlewares.length) {
        // We've exhausted our middlewares — call the outer next
        return next();
      }

      await fn(ctx, () => dispatch(i + 1));
    }

    await dispatch(0);
  };
}

// ---------- Hook adapters ----------

/**
 * Convert an api-forge MiddlewareFn into a Fastify preHandler hook.
 */
export function toPreHandler(
  mw: MiddlewareFn,
  app: FastifyInstance
): (req: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const ctx: MiddlewareContext = { req, reply, app };
    await mw(ctx, async () => {});
  };
}

/**
 * Convert an array of MiddlewareFn into a single Fastify preHandler.
 */
export function toPreHandlerChain(
  middlewares: MiddlewareFn[],
  app: FastifyInstance
): (req: FastifyRequest, reply: FastifyReply) => Promise<void> {
  const composed = compose(middlewares);
  return toPreHandler(composed, app);
}

// ---------- Built-in middleware ----------

/**
 * Timing middleware — records the start time and sets
 * an `X-Response-Time` header on the outgoing response.
 */
export function timing(): MiddlewareFn {
  return async (ctx, next) => {
    const start = performance.now();
    await next();
    const ms = (performance.now() - start).toFixed(2);
    ctx.reply.header("X-Response-Time", `${ms}ms`);
  };
}

/**
 * CORS middleware — a minimal version when you don't want to
 * pull in the full @fastify/cors plugin.
 */
export function cors(origin = "*"): MiddlewareFn {
  return async (ctx, next) => {
    ctx.reply.header("Access-Control-Allow-Origin", origin);
    ctx.reply.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, PATCH, OPTIONS"
    );
    ctx.reply.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );

    if (ctx.req.method === "OPTIONS") {
      ctx.reply.status(204).send();
      return;
    }

    await next();
  };
}

/**
 * Logging middleware — logs request method + URL before and
 * status code after.
 */
export function requestLogger(): MiddlewareFn {
  return async (ctx, next) => {
    ctx.app.log.info({ method: ctx.req.method, url: ctx.req.url }, "incoming request");
    await next();
    ctx.app.log.info(
      { method: ctx.req.method, url: ctx.req.url, status: ctx.reply.statusCode },
      "request completed"
    );
  };
}
