/**
 * Example: Users CRUD API built with api-forge
 *
 * Run with: npx ts-node examples/basic-api/index.ts
 */
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
  type PaginatedResponse,
} from "../../src";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const CreateUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  role: z.enum(["user", "editor", "admin"]).default("user"),
});

const UpdateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(["user", "editor", "admin"]).optional(),
});

const ListUsersQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

const IdParam = z.object({
  id: z.coerce.number().int().positive(),
});

// ─── In-memory store ─────────────────────────────────────────────────────────

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

let nextId = 1;
const users: Map<number, User> = new Map();

// Seed a few users
function seed() {
  const names = ["Alice", "Bob", "Charlie", "Diana"];
  for (const name of names) {
    const id = nextId++;
    users.set(id, {
      id,
      name,
      email: `${name.toLowerCase()}@example.com`,
      role: name === "Alice" ? "admin" : "user",
      createdAt: new Date().toISOString(),
    });
  }
}

// ─── Controller ──────────────────────────────────────────────────────────────

@Controller("/api/users")
class UserController {
  @Get("/", { summary: "List users", tags: ["users"] })
  @Query(ListUsersQuery)
  async list(req: Request): Promise<PaginatedResponse<User>> {
    const { page, perPage, search } = req.query as z.infer<typeof ListUsersQuery>;

    let items = Array.from(users.values());

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q)
      );
    }

    const total = items.length;
    const start = (page - 1) * perPage;
    const slice = items.slice(start, start + perPage);

    return paginate(slice, total, page, perPage);
  }

  @Get("/:id", { summary: "Get user by ID", tags: ["users"] })
  @Params(IdParam)
  async getById(req: Request): Promise<User> {
    const { id } = req.params as z.infer<typeof IdParam>;
    const user = users.get(id);
    if (!user) throw new NotFoundError("User");
    return user;
  }

  @Post("/", { summary: "Create a new user", tags: ["users"] })
  @Auth()
  @Body(CreateUserSchema)
  async create(req: Request): Promise<User> {
    const data = req.body as z.infer<typeof CreateUserSchema>;
    const id = nextId++;
    const user: User = {
      id,
      ...data,
      createdAt: new Date().toISOString(),
    };
    users.set(id, user);
    return user;
  }

  @Put("/:id", { summary: "Update a user", tags: ["users"] })
  @Auth()
  @Params(IdParam)
  @Body(UpdateUserSchema)
  async update(req: Request): Promise<User> {
    const { id } = req.params as z.infer<typeof IdParam>;
    const existing = users.get(id);
    if (!existing) throw new NotFoundError("User");

    const updates = req.body as z.infer<typeof UpdateUserSchema>;
    const updated = { ...existing, ...updates };
    users.set(id, updated);
    return updated;
  }

  @Delete("/:id", { summary: "Delete a user", tags: ["users"] })
  @Roles("admin")
  @Params(IdParam)
  async delete(req: Request): Promise<{ deleted: boolean }> {
    const { id } = req.params as z.infer<typeof IdParam>;
    const existed = users.delete(id);
    if (!existed) throw new NotFoundError("User");
    return { deleted: true };
  }
}

// ─── Health check controller ─────────────────────────────────────────────────

@Controller("/api")
class HealthController {
  @Get("/health", { summary: "Health check", tags: ["system"] })
  async health() {
    return {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function main() {
  seed();

  const app = createApp({
    port: 3000,
    logger: true,
  });

  // Plugins
  app.register(
    authPlugin({
      secret: process.env.JWT_SECRET ?? "dev-secret-change-in-production!!",
      expiresIn: "1h",
    })
  );

  app.register(
    openapiPlugin({
      title: "Users API",
      version: "1.0.0",
      description: "Example CRUD API built with api-forge",
    })
  );

  // Controllers
  app.controllers([UserController, HealthController]);

  const address = await app.listen();
  console.log(`Server running at ${address}`);
  console.log(`Docs at ${address}/docs`);
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
