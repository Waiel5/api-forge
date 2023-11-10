export interface JwtConfig {
  /** Secret used to sign access tokens */
  secret: string;
  /** Access-token lifetime (e.g. "15m", "1h") */
  expiresIn?: string;
  /** Refresh-token secret (defaults to `secret` if not provided) */
  refreshSecret?: string;
  /** Refresh-token lifetime (e.g. "7d") */
  refreshExpiresIn?: string;
  /** Custom issuer claim */
  issuer?: string;
  /** Custom audience claim */
  audience?: string;
}

export interface TokenPayload {
  sub: string;
  roles?: string[];
  [key: string]: unknown;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface DecodedToken extends TokenPayload {
  iat: number;
  exp: number;
  iss?: string;
  aud?: string;
}

/**
 * Augment the Fastify request to carry the decoded user after
 * the auth guard runs.
 */
declare module "fastify" {
  interface FastifyRequest {
    user?: DecodedToken;
  }
}
