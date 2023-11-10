import jwt from "jsonwebtoken";
import type { JwtConfig, TokenPayload, TokenPair, DecodedToken } from "./types";
import { UnauthorizedError } from "../errors/types";

/**
 * Low-level JWT helper — sign, verify, and manage token pairs.
 */
export class JwtService {
  private readonly secret: string;
  private readonly refreshSecret: string;
  private readonly expiresIn: string;
  private readonly refreshExpiresIn: string;
  private readonly issuer?: string;
  private readonly audience?: string;

  constructor(config: JwtConfig) {
    this.secret = config.secret;
    this.refreshSecret = config.refreshSecret ?? config.secret;
    this.expiresIn = config.expiresIn ?? "15m";
    this.refreshExpiresIn = config.refreshExpiresIn ?? "7d";
    this.issuer = config.issuer;
    this.audience = config.audience;
  }

  // ---------- Access token ----------

  signAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
      ...(this.issuer ? { issuer: this.issuer } : {}),
      ...(this.audience ? { audience: this.audience } : {}),
    });
  }

  verifyAccessToken(token: string): DecodedToken {
    try {
      return jwt.verify(token, this.secret, {
        ...(this.issuer ? { issuer: this.issuer } : {}),
        ...(this.audience ? { audience: this.audience } : {}),
      }) as DecodedToken;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError("Token expired");
      }
      if (err instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError("Invalid token");
      }
      throw new UnauthorizedError("Token verification failed");
    }
  }

  // ---------- Refresh token ----------

  signRefreshToken(payload: Pick<TokenPayload, "sub">): string {
    return jwt.sign({ sub: payload.sub }, this.refreshSecret, {
      expiresIn: this.refreshExpiresIn,
    });
  }

  verifyRefreshToken(token: string): DecodedToken {
    try {
      return jwt.verify(token, this.refreshSecret) as DecodedToken;
    } catch {
      throw new UnauthorizedError("Invalid refresh token");
    }
  }

  // ---------- Pair ----------

  generateTokenPair(payload: TokenPayload): TokenPair {
    return {
      accessToken: this.signAccessToken(payload),
      refreshToken: this.signRefreshToken({ sub: payload.sub }),
    };
  }

  /**
   * Rotate a refresh token: verify the old one, issue a fresh pair.
   */
  rotateTokens(
    refreshToken: string,
    payloadFn: (sub: string) => TokenPayload
  ): TokenPair {
    const decoded = this.verifyRefreshToken(refreshToken);
    const payload = payloadFn(decoded.sub);
    return this.generateTokenPair(payload);
  }
}

// ---------- Convenience factory ----------

let _instance: JwtService | null = null;

export function initJwt(config: JwtConfig): JwtService {
  _instance = new JwtService(config);
  return _instance;
}

export function getJwt(): JwtService {
  if (!_instance) {
    throw new Error("JwtService not initialised — call initJwt() first");
  }
  return _instance;
}
