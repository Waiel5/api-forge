import { describe, it, expect, afterAll } from "vitest";
import { z } from "zod";
import {
  createApp,
  Controller,
  Post,
  Get,
  Body,
  Query,
  Params,
  validate,
  ValidationError,
  formatZodError,
  zodToJsonSchema,
  paginate,
} from "../src";

// ---------- Schema helpers ----------

const CreateUserSchema = z.object({
  name: z.string().min(2).max(50),
  email: z.string().email(),
  age: z.number().int().positive().optional(),
});

const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

const IdParamSchema = z.object({
  id: z.string().uuid(),
});

// ---------- Tests ----------

describe("Zod validation decorators", () => {
  @Controller("/users")
  class UserController {
    @Post("/")
    @Body(CreateUserSchema)
    async create(req: any) {
      return { created: true, data: req.body };
    }

    @Get("/")
    @Query(PaginationSchema)
    async list(req: any) {
      const q = req.query as z.infer<typeof PaginationSchema>;
      return paginate([], 0, q.page, q.perPage);
    }

    @Get("/:id")
    @Params(IdParamSchema)
    async getById(req: any) {
      return { id: (req.params as any).id };
    }
  }

  const app = createApp({ port: 0, logger: false });
  app.controllers([UserController]);
  const ready = app.instance.ready();

  afterAll(async () => {
    await app.close();
  });

  it("should accept valid body", async () => {
    await ready;
    const res = await app.inject({
      method: "POST",
      url: "/users",
      payload: { name: "Alice", email: "alice@example.com", age: 30 },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.created).toBe(true);
    expect(body.data.name).toBe("Alice");
  });

  it("should reject invalid body (missing email)", async () => {
    await ready;
    const res = await app.inject({
      method: "POST",
      url: "/users",
      payload: { name: "A" },
    });
    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("should reject body with short name", async () => {
    await ready;
    const res = await app.inject({
      method: "POST",
      url: "/users",
      payload: { name: "A", email: "a@b.com" },
    });
    expect(res.statusCode).toBe(422);
  });

  it("should parse query params with defaults", async () => {
    await ready;
    const res = await app.inject({
      method: "GET",
      url: "/users",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.meta.page).toBe(1);
    expect(body.meta.perPage).toBe(20);
  });

  it("should parse explicit query params", async () => {
    await ready;
    const res = await app.inject({
      method: "GET",
      url: "/users?page=3&perPage=10",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.meta.page).toBe(3);
    expect(body.meta.perPage).toBe(10);
  });

  it("should reject invalid params (non-uuid)", async () => {
    await ready;
    const res = await app.inject({
      method: "GET",
      url: "/users/not-a-uuid",
    });
    expect(res.statusCode).toBe(422);
  });

  it("should accept valid UUID param", async () => {
    await ready;
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    const res = await app.inject({
      method: "GET",
      url: `/users/${uuid}`,
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).id).toBe(uuid);
  });
});

describe("validate() standalone helper", () => {
  const schema = z.object({ x: z.number() });

  it("should return parsed data on success", () => {
    const result = validate(schema, { x: 42 });
    expect(result).toEqual({ x: 42 });
  });

  it("should throw ValidationError on failure", () => {
    expect(() => validate(schema, { x: "nope" })).toThrow();
    try {
      validate(schema, { x: "nope" });
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
    }
  });
});

describe("formatZodError", () => {
  it("should produce a flat array of field errors", () => {
    const schema = z.object({
      name: z.string(),
      nested: z.object({ value: z.number() }),
    });

    const result = schema.safeParse({ name: 42, nested: { value: "x" } });
    if (result.success) throw new Error("Should fail");

    const formatted = formatZodError(result.error);
    expect(formatted.length).toBeGreaterThanOrEqual(2);
    expect(formatted[0].field).toBeDefined();
    expect(formatted[0].message).toBeDefined();
  });
});

describe("zodToJsonSchema", () => {
  it("should convert a string schema", () => {
    const schema = z.string().email();
    const json = zodToJsonSchema(schema);
    expect(json).toEqual({ type: "string", format: "email" });
  });

  it("should convert a number schema", () => {
    const schema = z.number().int().min(0).max(100);
    const json = zodToJsonSchema(schema);
    expect(json).toEqual({ type: "integer", minimum: 0, maximum: 100 });
  });

  it("should convert an object schema", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number().optional(),
    });
    const json = zodToJsonSchema(schema) as any;
    expect(json.type).toBe("object");
    expect(json.properties.name).toEqual({ type: "string" });
    expect(json.required).toEqual(["name"]);
  });

  it("should convert an array schema", () => {
    const schema = z.array(z.string());
    const json = zodToJsonSchema(schema) as any;
    expect(json.type).toBe("array");
    expect(json.items).toEqual({ type: "string" });
  });

  it("should convert an enum schema", () => {
    const schema = z.enum(["a", "b", "c"]);
    const json = zodToJsonSchema(schema) as any;
    expect(json.type).toBe("string");
    expect(json.enum).toEqual(["a", "b", "c"]);
  });
});

describe("paginate()", () => {
  it("should build proper pagination meta", () => {
    const result = paginate(["a", "b"], 50, 2, 10);
    expect(result.data).toEqual(["a", "b"]);
    expect(result.meta.total).toBe(50);
    expect(result.meta.page).toBe(2);
    expect(result.meta.perPage).toBe(10);
    expect(result.meta.lastPage).toBe(5);
  });
});
