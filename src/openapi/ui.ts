import type { FastifyInstance } from "fastify";
import { generateOpenAPISpec, type OpenAPIConfig } from "./generator";

export interface OpenAPIPluginOptions {
  /** API title shown in the Swagger UI header */
  title: string;
  /** API version (semver) */
  version?: string;
  /** Short description of the API */
  description?: string;
  /** Path where the JSON spec is served */
  specPath?: string;
  /** Path where the Swagger UI is served */
  uiPath?: string;
  /** Additional OpenAPI config */
  config?: Partial<OpenAPIConfig>;
}

/**
 * Fastify plugin that serves an OpenAPI JSON spec and a minimal
 * Swagger UI page for exploring the API.
 *
 * @example
 * ```ts
 * app.register(openapiPlugin({ title: "My API", version: "1.0.0" }));
 * ```
 */
export function openapiPlugin(opts: OpenAPIPluginOptions) {
  const specPath = opts.specPath ?? "/openapi.json";
  const uiPath = opts.uiPath ?? "/docs";
  const version = opts.version ?? "1.0.0";

  return async function plugin(app: FastifyInstance): Promise<void> {
    // JSON spec endpoint
    app.get(specPath, async (_req, reply) => {
      const spec = generateOpenAPISpec(app, {
        info: {
          title: opts.title,
          version,
          description: opts.description,
        },
        ...opts.config,
      });
      reply.type("application/json").send(spec);
    });

    // Minimal Swagger UI HTML page
    app.get(uiPath, async (_req, reply) => {
      const html = buildSwaggerHtml(opts.title, specPath);
      reply.type("text/html").send(html);
    });

    app.log.info(`OpenAPI spec available at ${specPath}`);
    app.log.info(`Swagger UI available at ${uiPath}`);
  };
}

// ---------- HTML template ----------

function buildSwaggerHtml(title: string, specUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} - API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; }
    #swagger-ui { max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "${specUrl}",
      dom_id: "#swagger-ui",
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.SwaggerUIStandalonePreset,
      ],
      layout: "BaseLayout",
      deepLinking: true,
    });
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
