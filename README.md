# api-forge

[![CI](https://github.com/Waiel5/api-forge/actions/workflows/ci.yml/badge.svg)](https://github.com/Waiel5/api-forge/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org/)

**TypeScript-first API framework built on Fastify.** Decorators for routing, JWT authentication, Zod-powered validation, auto-generated OpenAPI docs, and structured logging -- all in a lightweight package.

---

## Why api-forge?

| Feature | api-forge | Express | NestJS | Fastify (raw) |
|---|---|---|---|---|
| TypeScript-first | Yes | No | Yes | Partial |
| Decorator routing | Yes | No | Yes | No |
| Built-in JWT auth | Yes | No | Yes | No |
| Zod validation | Yes | No | No (class-validator) | No |
| Auto OpenAPI docs | Yes | No | Yes (Swagger module) | Plugin |
| Structured logging | Yes (pino) | No | Yes | Yes (pino) |
| Bundle complexity | Light | Light | Heavy | Light |
| Learning curve | Low | Low | High | Low |

## Quickstart

### Install

```bash
npm install api-forge fastify zod jsonwebtoken pino
```

### Hello World

```typescript
import { createApp, Controller, Get } from "api-forge";

@Controller("/")
class HelloController {
  @Get("/")
  async hello() {
    return { message: "Hello from api-forge!" };
  }
}

const app = createApp({ port: 3000, logger: true });
app.controllers([HelloController]);
await app.listen();
```

### Full Example with Auth, Validation & Docs

```typescript
import { z } from "zod";
import {
  createApp,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Auth,
  Roles,
  Body,
  Query,
  Params,
  authPlugin,
  openapiPlugin,
  paginate,
  NotFoundError,
  type Request,
} from "api-forge";

// Define schemas with Zod
const CreateUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  role: z.enum(["user", "editor", "admin"]).default("user"),
});

const ListQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

@Controller("/api/users")
class UserController {
  @Get("/", { summary: "List users", tags: ["users"] })
  @Query(ListQuery)
  async list(req: Request) {
    const { page, perPage } = req.query as z.infer<typeof ListQuery>;
    // ... fetch from database
    return paginate([], 0, page, perPage);
  }

  @Post("/", { summary: "Create user", tags: ["users"] })
  @Auth()
  @Body(CreateUserSchema)
  async create(req: Request) {
    const data = req.body as z.infer<typeof CreateUserSchema>;
    // ... insert into database
    return { id: 1, ...data };
  }

  @Delete("/:id", { summary: "Delete user", tags: ["users"] })
  @Roles("admin")
  async delete(req: Request) {
    // Only admins can delete
    return { deleted: true };
  }
}

const app = createApp({ port: 3000, logger: true });

app.register(authPlugin({ secret: process.env.JWT_SECRET! }));
app.register(openapiPlugin({
  title: "My API",
  version: "1.0.0",
  description: "User management API",
}));

app.controllers([UserController]);
await app.listen();
// Server at http://localhost:3000
// Docs at http://localhost:3000/docs
```

## API Reference

### `createApp(config?)`

Create an api-forge application instance.

```typescript
const app = createApp({
  port: 3000,        // default: 3000
  host: "0.0.0.0",   // default: "0.0.0.0"
  logger: true,       // default: true (pino)
  prefix: "/api",     // optional global prefix
  trustProxy: false,  // default: false
});
```

Returns a `ForgeApp` with methods:

| Method | Description |
|---|---|
| `app.register(plugin, opts?)` | Register a Fastify or api-forge plugin |
| `app.controllers([...])` | Register decorated controller classes |
| `app.listen()` | Start the server, returns address string |
| `app.close()` | Graceful shutdown |
| `app.inject(opts)` | Fastify inject for testing |
| `app.instance` | Raw Fastify instance (escape hatch) |

### Route Decorators

```typescript
@Controller("/prefix")    // Class-level path prefix
@Get("/path")             // GET route
@Post("/path")            // POST route
@Put("/path")             // PUT route
@Delete("/path")          // DELETE route
@Patch("/path")           // PATCH route
```

All route decorators accept an optional options object:

```typescript
@Get("/users", {
  summary: "List all users",    // OpenAPI summary
  tags: ["users"],              // OpenAPI tags
  deprecated: false,            // mark as deprecated
})
```

### Validation Decorators

Powered by [Zod](https://zod.dev). Schemas are validated before the handler runs. On failure, a `422` response with structured error details is returned.

```typescript
@Body(zodSchema)     // Validate request body
@Query(zodSchema)    // Validate query parameters
@Params(zodSchema)   // Validate route parameters
```

Standalone validation:

```typescript
import { validate } from "api-forge";
const data = validate(MySchema, rawInput); // throws ValidationError on failure
```

### Authentication

```typescript
// Register the auth plugin
app.register(authPlugin({
  secret: "your-jwt-secret",
  expiresIn: "15m",            // access token TTL
  refreshExpiresIn: "7d",     // refresh token TTL
  issuer: "my-app",           // optional JWT issuer
}));

// Use decorators on routes
@Auth()                    // require valid JWT
@Roles("admin", "editor")  // require specific roles (implies @Auth)
```

**Token management:**

```typescript
import { getJwt } from "api-forge";

const jwt = getJwt();
const tokens = jwt.generateTokenPair({ sub: "user-123", roles: ["admin"] });
// { accessToken: "...", refreshToken: "..." }

const decoded = jwt.verifyAccessToken(tokens.accessToken);
// { sub: "user-123", roles: ["admin"], iat: ..., exp: ... }

const rotated = jwt.rotateTokens(tokens.refreshToken, (sub) => ({
  sub,
  roles: ["admin"],
}));
```

### OpenAPI / Swagger

```typescript
app.register(openapiPlugin({
  title: "My API",
  version: "1.0.0",
  description: "API description",
  specPath: "/openapi.json",   // default
  uiPath: "/docs",             // default
}));
```

Visit `/docs` for the Swagger UI. The JSON spec is at `/openapi.json`.

### Middleware

```typescript
import { compose, timing, cors, requestLogger } from "api-forge";
import type { MiddlewareFn } from "api-forge";

// Built-in middleware
app.register(async (fastify) => {
  // Or use the compose utility for custom chains
  const chain = compose([timing(), requestLogger()]);
});

// Custom middleware
const myMiddleware: MiddlewareFn = async (ctx, next) => {
  console.log("before handler");
  await next();
  console.log("after handler");
};

// Apply at controller level
@UseMiddleware(myMiddleware)
@Controller("/guarded")
class GuardedController { ... }
```

### Error Handling

api-forge provides structured error classes that automatically map to HTTP status codes:

```typescript
import {
  AppError,          // base class (500)
  BadRequestError,   // 400
  UnauthorizedError, // 401
  ForbiddenError,    // 403
  NotFoundError,     // 404
  ConflictError,     // 409
  ValidationError,   // 422
  TooManyRequestsError, // 429
  InternalError,     // 500
} from "api-forge";

// Throw anywhere in a handler
throw new NotFoundError("User");
// Response: { "error": { "code": "NOT_FOUND", "message": "User not found" } }
```

### Logging

Built on [pino](https://getpino.io) with automatic pretty-printing in development.

```typescript
import { createLogger, createChildLogger } from "api-forge";

const logger = createLogger({ level: "debug" });
const child = createChildLogger(logger, "UserService");
child.info({ userId: 123 }, "User created");
```

Every request automatically gets an `X-Request-Id` header (generated or forwarded).

### Config

Environment-based configuration with Zod validation:

```typescript
import { loadConfig, getConfig } from "api-forge";

// Validates: NODE_ENV, PORT, HOST, LOG_LEVEL, JWT_SECRET, etc.
const config = loadConfig();
console.log(config.PORT); // 3000
```

## Testing

api-forge ships with test utilities:

```typescript
import { createTestApp, Controller, Get } from "api-forge";

const app = createTestApp(); // logger off, ephemeral port
app.controllers([MyController]);

const res = await app.inject({ method: "GET", url: "/my-route" });
expect(res.statusCode).toBe(200);
```

Run the project tests:

```bash
npm test
```

## Project Structure

```
src/
  index.ts           Public API exports
  server.ts          App factory (createApp)
  router.ts          Decorator-based routing
  middleware.ts       Middleware composition
  auth/
    jwt.ts           JWT sign/verify/refresh
    guards.ts        @Auth, @Roles decorators & hooks
    types.ts         Auth type definitions
  validation/
    schema.ts        @Body, @Query, @Params decorators
    errors.ts        Zod error formatting
  openapi/
    generator.ts     OpenAPI spec generation
    ui.ts            Swagger UI plugin
  logging/
    logger.ts        Pino logger factory
    request-id.ts    Request ID middleware
  errors/
    handler.ts       Global error handler
    types.ts         Error class hierarchy
  utils/
    config.ts        Env config with Zod
    types.ts         Shared TypeScript types
```

## Requirements

- Node.js >= 18
- TypeScript >= 5.0 (with `experimentalDecorators` enabled)

## License

MIT
