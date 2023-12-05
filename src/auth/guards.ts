import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getJwt } from "./jwt";
import { UnauthorizedError, ForbiddenError } from "../errors/types";
import type { DecodedToken, JwtConfig } from "./types";
import { initJwt } from "./jwt";

// ---------- Metadata keys (decorator-style) ----------

const AUTH_KEY = Symbol("auth");
const ROLES_KEY = Symbol("roles");

/**
 * Mark a route handler as requiring authentication.
 */
export function Auth(): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    Reflect.defineMetadata(AUTH_KEY, true, target, propertyKey);
    return descriptor;
  };
}

/**
 * Restrict a route handler to specific roles.
 * Implicitly enables authentication.
 */
export function Roles(...roles: string[]): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    Reflect.defineMetadata(AUTH_KEY, true, target, propertyKey);
    Reflect.defineMetadata(ROLES_KEY, roles, target, propertyKey);
    return descriptor;
  };
}

/**
 * Check if a handler was marked with @Auth or @Roles.
 */
export function isAuthRequired(target: object, propertyKey: string | symbol): boolean {
  return Reflect.getMetadata(AUTH_KEY, target, propertyKey) === true;
}

/**
 * Retrieve the allowed roles for a handler (empty array = any role).
 */
export function getRequiredRoles(target: object, propertyKey: string | symbol): string[] {
  return Reflect.getMetadata(ROLES_KEY, target, propertyKey) ?? [];
}

// ---------- Fastify hook implementation ----------

/**
 * Extract the bearer token from the Authorization header.
 */
function extractToken(request: FastifyRequest): string {
  const header = request.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or malformed Authorization header");
  }
  return header.slice(7);
}

/**
 * Authentication preHandler — verifies the JWT and attaches `request.user`.
 */
export async function authHook(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const token = extractToken(request);
  const decoded: DecodedToken = getJwt().verifyAccessToken(token);
  request.user = decoded;
}

/**
 * Factory for a role-checking preHandler.
 */
export function rolesHook(
  allowedRoles: string[]
): (req: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.user) {
      throw new UnauthorizedError("Not authenticated");
    }
    const userRoles = request.user.roles ?? [];
    const hasRole = allowedRoles.some((r) => userRoles.includes(r));
    if (!hasRole) {
      throw new ForbiddenError(
        `Required roles: ${allowedRoles.join(", ")}`
      );
    }
  };
}

// ---------- Auth plugin ----------

export interface AuthPluginOptions extends JwtConfig {}

/**
 * Fastify plugin that initialises JWT and exposes the `authHook`
 * as a decoration consumers can reference.
 */
export function authPlugin(opts: AuthPluginOptions) {
  return async function plugin(app: FastifyInstance): Promise<void> {
    const jwtService = initJwt(opts);

    // Decorate the Fastify instance so other plugins can access the service
    app.decorate("jwt", jwtService);

    // Expose a convenience decorator
    app.decorateRequest("user", null);
  };
}
