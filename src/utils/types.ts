import type { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";

// ---------- Core type aliases ----------

export type Request = FastifyRequest;
export type Reply = FastifyReply;
export type App = FastifyInstance;

// ---------- Generic helpers ----------

export type Constructor<T = unknown> = new (...args: any[]) => T;

export type AsyncFunction<TArgs extends any[] = any[], TReturn = any> = (
  ...args: TArgs
) => Promise<TReturn>;

export type MaybeAsync<T> = T | Promise<T>;

// ---------- Route handler ----------

export type RouteHandler = (
  req: Request,
  reply: Reply
) => MaybeAsync<unknown>;

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";

// ---------- Middleware ----------

export interface MiddlewareContext {
  req: Request;
  reply: Reply;
  app: App;
}

export type MiddlewareFn = (
  ctx: MiddlewareContext,
  next: () => Promise<void>
) => MaybeAsync<void>;

// ---------- Plugin ----------

export interface PluginOptions {
  prefix?: string;
  [key: string]: unknown;
}

export type PluginFn = (app: App, opts: PluginOptions) => MaybeAsync<void>;

// ---------- Route metadata ----------

export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handlerName: string;
  middleware: MiddlewareFn[];
  schema?: RouteSchema;
  auth?: boolean;
  roles?: string[];
  summary?: string;
  tags?: string[];
  deprecated?: boolean;
}

export interface RouteSchema {
  body?: unknown;
  querystring?: unknown;
  params?: unknown;
  response?: Record<number, unknown>;
}

// ---------- Config ----------

export interface AppConfig {
  port: number;
  host?: string;
  logger?: boolean | object;
  prefix?: string;
  cors?: boolean | object;
  trustProxy?: boolean;
}

// ---------- Pagination ----------

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    lastPage: number;
  };
}

export function paginate<T>(
  items: T[],
  total: number,
  page: number,
  perPage: number
): PaginatedResponse<T> {
  return {
    data: items,
    meta: {
      total,
      page,
      perPage,
      lastPage: Math.ceil(total / perPage),
    },
  };
}
