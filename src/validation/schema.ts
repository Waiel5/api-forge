import { type ZodSchema, type ZodTypeDef, ZodError } from "zod";
import type { FastifyRequest, FastifyReply } from "fastify";
import { ValidationError } from "../errors/types";
import { formatZodError } from "./errors";

// ---------- Metadata keys ----------

const BODY_SCHEMA = Symbol("bodySchema");
const QUERY_SCHEMA = Symbol("querySchema");
const PARAMS_SCHEMA = Symbol("paramsSchema");

// ---------- Decorators ----------

/**
 * Attach a Zod schema for request body validation.
 *
 * @example
 * ```ts
 * @Post("/")
 * @Body(CreateUserSchema)
 * async create(req: Request) { ... }
 * ```
 */
export function Body<T>(schema: ZodSchema<T, ZodTypeDef, unknown>): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    Reflect.defineMetadata(BODY_SCHEMA, schema, target, propertyKey);
    return descriptor;
  };
}

/**
 * Attach a Zod schema for query-string validation.
 */
export function Query<T>(schema: ZodSchema<T, ZodTypeDef, unknown>): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    Reflect.defineMetadata(QUERY_SCHEMA, schema, target, propertyKey);
    return descriptor;
  };
}

/**
 * Attach a Zod schema for route params validation.
 */
export function Params<T>(schema: ZodSchema<T, ZodTypeDef, unknown>): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    Reflect.defineMetadata(PARAMS_SCHEMA, schema, target, propertyKey);
    return descriptor;
  };
}

// ---------- Metadata readers ----------

export function getBodySchema(
  target: object,
  propertyKey: string | symbol
): ZodSchema | undefined {
  return Reflect.getMetadata(BODY_SCHEMA, target, propertyKey);
}

export function getQuerySchema(
  target: object,
  propertyKey: string | symbol
): ZodSchema | undefined {
  return Reflect.getMetadata(QUERY_SCHEMA, target, propertyKey);
}

export function getParamsSchema(
  target: object,
  propertyKey: string | symbol
): ZodSchema | undefined {
  return Reflect.getMetadata(PARAMS_SCHEMA, target, propertyKey);
}

// ---------- Validation middleware factory ----------

/**
 * Build a preHandler that validates body / query / params against Zod schemas
 * extracted from decorator metadata.
 */
export function validationHook(
  target: object,
  handlerName: string | symbol
): ((req: FastifyRequest, reply: FastifyReply) => Promise<void>) | null {
  const bodySchema = getBodySchema(target, handlerName);
  const querySchema = getQuerySchema(target, handlerName);
  const paramsSchema = getParamsSchema(target, handlerName);

  if (!bodySchema && !querySchema && !paramsSchema) return null;

  return async (req: FastifyRequest, _reply: FastifyReply) => {
    const errors: { location: string; issues: ReturnType<typeof formatZodError> }[] = [];

    if (bodySchema) {
      const result = bodySchema.safeParse(req.body);
      if (!result.success) {
        errors.push({ location: "body", issues: formatZodError(result.error) });
      } else {
        (req as any).body = result.data;
      }
    }

    if (querySchema) {
      const result = querySchema.safeParse(req.query);
      if (!result.success) {
        errors.push({ location: "query", issues: formatZodError(result.error) });
      } else {
        (req as any).query = result.data;
      }
    }

    if (paramsSchema) {
      const result = paramsSchema.safeParse(req.params);
      if (!result.success) {
        errors.push({ location: "params", issues: formatZodError(result.error) });
      } else {
        (req as any).params = result.data;
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(errors);
    }
  };
}

// ---------- Standalone validation helper ----------

/**
 * Validate a value against a Zod schema. Returns the parsed result or throws
 * an `AppError` (422).
 */
export function validate<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(formatZodError(result.error));
  }
  return result.data;
}
