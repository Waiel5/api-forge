import "reflect-metadata";

// ─── Core ────────────────────────────────────────────────────────────────────
export { createApp, createTestApp, type ForgeApp } from "./server";

// ─── Routing ─────────────────────────────────────────────────────────────────
export {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  UseMiddleware,
  registerController,
  registerControllers,
} from "./router";

// ─── Middleware ───────────────────────────────────────────────────────────────
export {
  compose,
  toPreHandler,
  toPreHandlerChain,
  timing,
  cors,
  requestLogger,
} from "./middleware";

// ─── Auth ────────────────────────────────────────────────────────────────────
export { JwtService, initJwt, getJwt } from "./auth/jwt";
export { Auth, Roles, authHook, rolesHook, authPlugin } from "./auth/guards";
export type {
  JwtConfig,
  TokenPayload,
  TokenPair,
  DecodedToken,
} from "./auth/types";

// ─── Validation ──────────────────────────────────────────────────────────────
export { Body, Query, Params, validate } from "./validation/schema";
export { formatZodError, validationErrorResponse } from "./validation/errors";

// ─── OpenAPI ─────────────────────────────────────────────────────────────────
export {
  generateOpenAPISpec,
  zodToJsonSchema,
  type OpenAPIConfig,
} from "./openapi/generator";
export { openapiPlugin, type OpenAPIPluginOptions } from "./openapi/ui";

// ─── Logging ─────────────────────────────────────────────────────────────────
export { createLogger, createChildLogger, type Logger } from "./logging/logger";
export { registerRequestId, getRequestId } from "./logging/request-id";

// ─── Errors ──────────────────────────────────────────────────────────────────
export {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  TooManyRequestsError,
  InternalError,
} from "./errors/types";
export { registerErrorHandler } from "./errors/handler";

// ─── Config ──────────────────────────────────────────────────────────────────
export { loadConfig, getConfig, resetConfig, type EnvConfig } from "./utils/config";

// ─── Utility types ───────────────────────────────────────────────────────────
export type {
  Request,
  Reply,
  App,
  HttpMethod,
  RouteHandler,
  MiddlewareFn,
  MiddlewareContext,
  PluginFn,
  PluginOptions,
  RouteDefinition,
  RouteSchema,
  AppConfig,
  PaginatedResponse,
  Constructor,
  AsyncFunction,
  MaybeAsync,
} from "./utils/types";
export { paginate } from "./utils/types";
