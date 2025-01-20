import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  createApp,
  Controller,
  Get,
  authPlugin,
  Auth,
  Roles,
  JwtService,
  initJwt,
} from "../src";
import type { TokenPayload } from "../src";

const TEST_SECRET = "test-secret-key-thats-long-enough";

describe("JwtService", () => {
  let jwt: JwtService;

  beforeAll(() => {
    jwt = new JwtService({
      secret: TEST_SECRET,
      expiresIn: "1h",
      refreshExpiresIn: "7d",
    });
  });

  it("should sign and verify an access token", () => {
    const payload: TokenPayload = { sub: "user-1", roles: ["admin"] };
    const token = jwt.signAccessToken(payload);
    const decoded = jwt.verifyAccessToken(token);

    expect(decoded.sub).toBe("user-1");
    expect(decoded.roles).toEqual(["admin"]);
    expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
  });

  it("should sign and verify a refresh token", () => {
    const token = jwt.signRefreshToken({ sub: "user-1" });
    const decoded = jwt.verifyRefreshToken(token);

    expect(decoded.sub).toBe("user-1");
  });

  it("should generate a token pair", () => {
    const pair = jwt.generateTokenPair({ sub: "user-1", roles: ["editor"] });

    expect(pair.accessToken).toBeDefined();
    expect(pair.refreshToken).toBeDefined();
    expect(typeof pair.accessToken).toBe("string");
    expect(typeof pair.refreshToken).toBe("string");
  });

  it("should rotate tokens", () => {
    const original = jwt.generateTokenPair({ sub: "user-1" });
    const rotated = jwt.rotateTokens(original.refreshToken, (sub) => ({
      sub,
      roles: ["admin"],
    }));

    // Access token must differ because the payload changed (added roles)
    expect(rotated.accessToken).not.toBe(original.accessToken);
    // Both tokens should be valid
    expect(typeof rotated.refreshToken).toBe("string");
    expect(rotated.refreshToken.length).toBeGreaterThan(0);

    const decoded = jwt.verifyAccessToken(rotated.accessToken);
    expect(decoded.sub).toBe("user-1");
    expect(decoded.roles).toEqual(["admin"]);
  });

  it("should throw on invalid access token", () => {
    expect(() => jwt.verifyAccessToken("garbage")).toThrow("Invalid token");
  });

  it("should throw on invalid refresh token", () => {
    expect(() => jwt.verifyRefreshToken("garbage")).toThrow(
      "Invalid refresh token"
    );
  });
});

describe("Auth guards", () => {
  let jwtService: JwtService;

  @Controller("/protected")
  class ProtectedController {
    @Get("/open")
    async open() {
      return { msg: "public" };
    }

    @Get("/secret")
    @Auth()
    async secret(req: any) {
      return { msg: "secret", user: req.user?.sub };
    }

    @Get("/admin")
    @Roles("admin")
    async adminOnly(req: any) {
      return { msg: "admin", user: req.user?.sub };
    }
  }

  const app = createApp({ port: 0, logger: false });
  app.register(authPlugin({ secret: TEST_SECRET }));
  app.controllers([ProtectedController]);

  const ready = app.instance.ready();

  beforeAll(async () => {
    await ready;
    jwtService = initJwt({ secret: TEST_SECRET });
  });

  afterAll(async () => {
    await app.close();
  });

  it("should allow unauthenticated access to open routes", async () => {
    const res = await app.inject({ method: "GET", url: "/protected/open" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).msg).toBe("public");
  });

  it("should reject unauthenticated access to @Auth routes", async () => {
    const res = await app.inject({ method: "GET", url: "/protected/secret" });
    expect(res.statusCode).toBe(401);
  });

  it("should allow authenticated access to @Auth routes", async () => {
    const token = jwtService.signAccessToken({ sub: "user-1" });
    const res = await app.inject({
      method: "GET",
      url: "/protected/secret",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ msg: "secret", user: "user-1" });
  });

  it("should reject wrong role on @Roles route", async () => {
    const token = jwtService.signAccessToken({ sub: "user-1", roles: ["editor"] });
    const res = await app.inject({
      method: "GET",
      url: "/protected/admin",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("should allow correct role on @Roles route", async () => {
    const token = jwtService.signAccessToken({ sub: "user-1", roles: ["admin"] });
    const res = await app.inject({
      method: "GET",
      url: "/protected/admin",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).msg).toBe("admin");
  });
});
