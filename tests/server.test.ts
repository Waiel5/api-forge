import { describe, it, expect, afterAll } from "vitest";
import { createApp, Controller, Get, Post } from "../src";

describe("createApp", () => {
  it("should create an app with defaults", () => {
    const app = createApp({ port: 0, logger: false });
    expect(app).toBeDefined();
    expect(app.instance).toBeDefined();
  });

  it("should register a raw Fastify plugin", async () => {
    const app = createApp({ port: 0, logger: false });

    app.register(async (fastify) => {
      fastify.get("/health", async () => ({ status: "ok" }));
    });

    const res = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ status: "ok" });
  });

  it("should return 404 for unknown routes", async () => {
    const app = createApp({ port: 0, logger: false });

    const res = await app.inject({
      method: "GET",
      url: "/nonexistent",
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("should add X-Request-Id header", async () => {
    const app = createApp({ port: 0, logger: false });

    app.register(async (fastify) => {
      fastify.get("/ping", async () => ({ pong: true }));
    });

    const res = await app.inject({
      method: "GET",
      url: "/ping",
    });

    expect(res.headers["x-request-id"]).toBeDefined();
    expect(typeof res.headers["x-request-id"]).toBe("string");
  });

  it("should forward existing X-Request-Id", async () => {
    const app = createApp({ port: 0, logger: false });

    app.register(async (fastify) => {
      fastify.get("/ping", async () => ({ pong: true }));
    });

    const customId = "my-custom-id-123";
    const res = await app.inject({
      method: "GET",
      url: "/ping",
      headers: { "x-request-id": customId },
    });

    expect(res.headers["x-request-id"]).toBe(customId);
  });
});

describe("Controller registration", () => {
  @Controller("/items")
  class ItemController {
    @Get("/")
    async list() {
      return [{ id: 1, name: "Widget" }];
    }

    @Get("/:id")
    async getById(req: any) {
      return { id: (req.params as any).id, name: "Widget" };
    }

    @Post("/")
    async create(req: any) {
      return { id: 2, ...(req.body as object) };
    }
  }

  const app = createApp({ port: 0, logger: false });
  app.controllers([ItemController]);

  // Must register controllers before inject
  const ready = app.instance.ready();

  afterAll(async () => {
    await app.close();
  });

  it("should handle GET /items", async () => {
    await ready;
    const res = await app.inject({ method: "GET", url: "/items" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].name).toBe("Widget");
  });

  it("should handle GET /items/:id", async () => {
    await ready;
    const res = await app.inject({ method: "GET", url: "/items/42" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe("42");
  });

  it("should handle POST /items", async () => {
    await ready;
    const res = await app.inject({
      method: "POST",
      url: "/items",
      payload: { name: "Gadget" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.name).toBe("Gadget");
    expect(body.id).toBe(2);
  });
});
