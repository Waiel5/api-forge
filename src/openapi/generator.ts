import type { FastifyInstance, FastifySchema } from "fastify";
import type { ZodSchema, ZodTypeDef } from "zod";

// ---------- Types ----------

interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
  contact?: { name?: string; email?: string; url?: string };
  license?: { name: string; url?: string };
}

interface OpenAPIServer {
  url: string;
  description?: string;
}

export interface OpenAPIConfig {
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  securitySchemes?: Record<string, SecurityScheme>;
}

interface SecurityScheme {
  type: "http" | "apiKey" | "oauth2" | "openIdConnect";
  scheme?: string;
  bearerFormat?: string;
  name?: string;
  in?: string;
}

interface PathItem {
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  security?: Record<string, string[]>[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: Record<string, ResponseObject>;
}

interface ParameterObject {
  name: string;
  in: "query" | "header" | "path" | "cookie";
  required?: boolean;
  schema: object;
  description?: string;
}

interface RequestBodyObject {
  required?: boolean;
  content: Record<string, { schema: object }>;
}

interface ResponseObject {
  description: string;
  content?: Record<string, { schema: object }>;
}

// ---------- Zod → JSON Schema (simplified) ----------

/**
 * Convert a Zod schema into a simplified JSON Schema representation.
 * This covers the most common Zod types; a production-grade implementation
 * would use `zod-to-json-schema`.
 */
export function zodToJsonSchema(schema: ZodSchema<any, ZodTypeDef, any>): object {
  const def = (schema as any)._def;

  if (!def) return { type: "object" };

  switch (def.typeName) {
    case "ZodString":
      return buildStringSchema(def);
    case "ZodNumber":
      return buildNumberSchema(def);
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodArray":
      return { type: "array", items: zodToJsonSchema(def.type) };
    case "ZodObject":
      return buildObjectSchema(def);
    case "ZodOptional":
      return zodToJsonSchema(def.innerType);
    case "ZodNullable":
      return { oneOf: [zodToJsonSchema(def.innerType), { type: "null" }] };
    case "ZodEnum":
      return { type: "string", enum: def.values };
    case "ZodLiteral":
      return { type: typeof def.value, enum: [def.value] };
    case "ZodUnion":
      return { oneOf: def.options.map(zodToJsonSchema) };
    case "ZodDefault":
      return { ...zodToJsonSchema(def.innerType), default: def.defaultValue() };
    default:
      return { type: "object" };
  }
}

function buildStringSchema(def: any): object {
  const schema: Record<string, unknown> = { type: "string" };
  for (const check of def.checks ?? []) {
    if (check.kind === "min") schema.minLength = check.value;
    if (check.kind === "max") schema.maxLength = check.value;
    if (check.kind === "email") schema.format = "email";
    if (check.kind === "url") schema.format = "uri";
    if (check.kind === "uuid") schema.format = "uuid";
    if (check.kind === "regex") schema.pattern = check.regex.source;
  }
  return schema;
}

function buildNumberSchema(def: any): object {
  const schema: Record<string, unknown> = { type: "number" };
  for (const check of def.checks ?? []) {
    if (check.kind === "min") schema.minimum = check.value;
    if (check.kind === "max") schema.maximum = check.value;
    if (check.kind === "int") schema.type = "integer";
  }
  return schema;
}

function buildObjectSchema(def: any): object {
  const shape = def.shape?.();
  if (!shape) return { type: "object" };

  const properties: Record<string, object> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    properties[key] = zodToJsonSchema(value as ZodSchema);

    // In Zod, wrapped in ZodOptional means not required
    if ((value as any)._def?.typeName !== "ZodOptional") {
      required.push(key);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

// ---------- Spec builder ----------

/**
 * Walk all registered routes on the Fastify instance and produce
 * a complete OpenAPI 3.0 specification object.
 */
export function generateOpenAPISpec(
  app: FastifyInstance,
  config: OpenAPIConfig
): object {
  const paths: Record<string, Record<string, PathItem>> = {};

  // Fastify stores routes internally; we iterate through them
  const routesList = (app as any).routes as Map<
    string,
    Array<{ method: string | string[]; url: string; schema?: FastifySchema }>
  > | undefined;

  if (!routesList) return buildSpec(config, paths);

  for (const [, routeArray] of routesList) {
    for (const route of routeArray) {
      const methods = Array.isArray(route.method)
        ? route.method
        : [route.method];

      for (const method of methods) {
        const lowerMethod = method.toLowerCase();
        if (lowerMethod === "head") continue; // skip implicit HEAD

        const openApiPath = fastifyToOpenApiPath(route.url);

        if (!paths[openApiPath]) paths[openApiPath] = {};

        const pathItem: PathItem = {
          responses: {
            "200": { description: "Successful response" },
          },
        };

        const schema = route.schema as Record<string, any> | undefined;
        if (schema) {
          if (schema.summary) pathItem.summary = schema.summary;
          if (schema.tags) pathItem.tags = schema.tags;
          if (schema.deprecated) pathItem.deprecated = schema.deprecated;
        }

        paths[openApiPath][lowerMethod] = pathItem;
      }
    }
  }

  return buildSpec(config, paths);
}

function buildSpec(
  config: OpenAPIConfig,
  paths: Record<string, Record<string, PathItem>>
): object {
  return {
    openapi: "3.0.3",
    info: {
      title: config.info.title,
      version: config.info.version,
      ...(config.info.description ? { description: config.info.description } : {}),
      ...(config.info.contact ? { contact: config.info.contact } : {}),
      ...(config.info.license ? { license: config.info.license } : {}),
    },
    servers: config.servers ?? [{ url: "http://localhost:3000" }],
    paths,
    components: {
      securitySchemes: config.securitySchemes ?? {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  };
}

/**
 * Convert Fastify-style path params (`:id`) to OpenAPI style (`{id}`).
 */
function fastifyToOpenApiPath(url: string): string {
  return url.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, "{$1}");
}
