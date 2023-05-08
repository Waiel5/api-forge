import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { HttpMethod, RouteHandler, MiddlewareFn } from "./utils/types";
import { isAuthRequired, getRequiredRoles, authHook, rolesHook } from "./auth/guards";
import { validationHook } from "./validation/schema";
import { toPreHandlerChain } from "./middleware";

// ---------- Metadata keys ----------

const ROUTES_KEY = Symbol("routes");
const CONTROLLER_PREFIX_KEY = Symbol("controllerPrefix");
const MIDDLEWARE_KEY = Symbol("middleware");

// ---------- Route metadata storage ----------

interface RouteMeta {
  method: HttpMethod;
  path: string;
  handlerName: string;
  summary?: string;
  tags?: string[];
  deprecated?: boolean;
}

function getRouteMetas(target: object): RouteMeta[] {
  return Reflect.getMetadata(ROUTES_KEY, target) ?? [];
}

function addRouteMeta(target: object, meta: RouteMeta): void {
  const existing = getRouteMetas(target);
  Reflect.defineMetadata(ROUTES_KEY, [...existing, meta], target);
}

// ---------- Decorator options ----------

interface RouteDecoratorOpts {
  summary?: string;
  tags?: string[];
  deprecated?: boolean;
}

// ---------- HTTP method decorators ----------

function createMethodDecorator(method: HttpMethod) {
  return function (path = "/", opts: RouteDecoratorOpts = {}): MethodDecorator {
    return (target, propertyKey, descriptor) => {
      addRouteMeta(target.constructor, {
        method,
        path,
        handlerName: String(propertyKey),
        ...opts,
      });
      return descriptor;
    };
  };
}

export const Get = createMethodDecorator("GET");
export const Post = createMethodDecorator("POST");
export const Put = createMethodDecorator("PUT");
export const Delete = createMethodDecorator("DELETE");
export const Patch = createMethodDecorator("PATCH");

// ---------- Controller decorator ----------

/**
 * Register a class as a route controller with an optional path prefix.
 *
 * @example
 * ```ts
 * @Controller("/users")
 * class UserController { ... }
 * ```
 */
export function Controller(prefix = "/"): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(CONTROLLER_PREFIX_KEY, prefix, target);
  };
}

/**
 * Add middleware that runs before every handler in a controller.
 */
export function UseMiddleware(...fns: MiddlewareFn[]): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(MIDDLEWARE_KEY, fns, target);
  };
}

// ---------- Controller registration ----------

/**
 * Register all routes of a decorated controller onto a Fastify instance.
 *
 * This reads the metadata set by `@Controller`, `@Get`, `@Post`, etc.
 * and translates them into Fastify route registrations, wiring up
 * auth guards, validation hooks, and middleware automatically.
 */
export function registerController(
  app: FastifyInstance,
  ControllerClass: new (...args: any[]) => any
): void {
  const prefix: string =
    Reflect.getMetadata(CONTROLLER_PREFIX_KEY, ControllerClass) ?? "/";
  const controllerMiddleware: MiddlewareFn[] =
    Reflect.getMetadata(MIDDLEWARE_KEY, ControllerClass) ?? [];
  const routes = getRouteMetas(ControllerClass);

  const instance = new ControllerClass();

  for (const route of routes) {
    const handler: RouteHandler = (instance as any)[route.handlerName].bind(instance);
    const proto = Object.getPrototypeOf(instance);

    // Collect preHandler hooks
    const preHandler: ((
      req: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>)[] = [];

    // 1. Controller-level middleware
    if (controllerMiddleware.length > 0) {
      preHandler.push(toPreHandlerChain(controllerMiddleware, app));
    }

    // 2. Auth guard
    if (isAuthRequired(proto, route.handlerName)) {
      preHandler.push(authHook);

      const roles = getRequiredRoles(proto, route.handlerName);
      if (roles.length > 0) {
        preHandler.push(rolesHook(roles));
      }
    }

    // 3. Validation
    const valHook = validationHook(proto, route.handlerName);
    if (valHook) {
      preHandler.push(valHook);
    }

    const fullPath = normalizePath(`${prefix}/${route.path}`);

    app.route({
      method: route.method,
      url: fullPath,
      preHandler,
      handler: async (req, reply) => {
        const result = await handler(req, reply);
        // If the handler returns a value and hasn't sent a response, send it.
        if (result !== undefined && !reply.sent) {
          return reply.send(result);
        }
      },
      schema: {
        ...(route.summary ? { summary: route.summary } : {}),
        ...(route.tags ? { tags: route.tags } : {}),
        ...(route.deprecated ? { deprecated: route.deprecated } : {}),
      } as any,
    });
  }
}

/**
 * Register multiple controllers at once.
 */
export function registerControllers(
  app: FastifyInstance,
  controllers: (new (...args: any[]) => any)[]
): void {
  for (const ctrl of controllers) {
    registerController(app, ctrl);
  }
}

// ---------- Helpers ----------

function normalizePath(raw: string): string {
  return (
    "/" +
    raw
      .split("/")
      .filter(Boolean)
      .join("/")
  );
}
