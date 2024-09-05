import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { v4 as uuidv4 } from "uuid";

const REQUEST_ID_HEADER = "x-request-id";

/**
 * Register the request-id plugin.
 *
 * Ensures every incoming request has a unique identifier, either forwarded
 * from a trusted upstream header or generated as a v4 UUID.
 * The ID is attached to both the request object and the response header.
 */
export function registerRequestId(app: FastifyInstance): void {
  app.addHook(
    "onRequest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const existing = request.headers[REQUEST_ID_HEADER];
      const requestId =
        typeof existing === "string" && existing.length > 0
          ? existing
          : uuidv4();

      // Fastify exposes `request.id` but it's read-only after construction,
      // so we store ours on a custom property and forward it.
      (request as any).requestId = requestId;
      reply.header(REQUEST_ID_HEADER, requestId);
    }
  );
}

/**
 * Retrieve the request ID from the request object.
 */
export function getRequestId(request: FastifyRequest): string {
  return (request as any).requestId ?? request.id;
}
