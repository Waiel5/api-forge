#!/bin/bash
set -e

cd /Users/grey/gitstuff/public-repos/api-forge

# Initialize repo
git init
git config user.email "git@waiel.co"
git config user.name "waiel"

AUTHOR="waiel <git@waiel.co>"

# Commit 1: Initial project setup
git add package.json tsconfig.json LICENSE .gitignore
GIT_AUTHOR_DATE="2023-01-15T09:00:00" GIT_COMMITTER_DATE="2023-01-15T09:00:00" \
  git commit -m "Initial project setup with package.json and tsconfig" --author="$AUTHOR"

# Commit 2: Utility types
git add src/utils/types.ts
GIT_AUTHOR_DATE="2023-02-03T14:30:00" GIT_COMMITTER_DATE="2023-02-03T14:30:00" \
  git commit -m "Add shared utility types and type aliases" --author="$AUTHOR"

# Commit 3: Server factory
git add src/server.ts
GIT_AUTHOR_DATE="2023-03-12T10:15:00" GIT_COMMITTER_DATE="2023-03-12T10:15:00" \
  git commit -m "Implement server factory with createApp and plugin system" --author="$AUTHOR"

# Commit 4: Routing decorators
git add src/router.ts
GIT_AUTHOR_DATE="2023-05-08T16:45:00" GIT_COMMITTER_DATE="2023-05-08T16:45:00" \
  git commit -m "Add decorator-based routing with @Controller, @Get, @Post, etc." --author="$AUTHOR"

# Commit 5: Middleware pipeline
git add src/middleware.ts
GIT_AUTHOR_DATE="2023-07-20T11:00:00" GIT_COMMITTER_DATE="2023-07-20T11:00:00" \
  git commit -m "Implement middleware pipeline with compose and built-in middleware" --author="$AUTHOR"

# Commit 6: Error types
git add src/errors/types.ts
GIT_AUTHOR_DATE="2023-08-14T09:30:00" GIT_COMMITTER_DATE="2023-08-14T09:30:00" \
  git commit -m "Add structured error classes (AppError, NotFound, Unauthorized, etc.)" --author="$AUTHOR"

# Commit 7: Global error handler
git add src/errors/handler.ts
GIT_AUTHOR_DATE="2023-09-02T15:20:00" GIT_COMMITTER_DATE="2023-09-02T15:20:00" \
  git commit -m "Register global error handler with Zod and Fastify error support" --author="$AUTHOR"

# Commit 8: Auth types and JWT service
git add src/auth/types.ts src/auth/jwt.ts
GIT_AUTHOR_DATE="2023-11-10T13:00:00" GIT_COMMITTER_DATE="2023-11-10T13:00:00" \
  git commit -m "Implement JWT service with access/refresh token pairs and rotation" --author="$AUTHOR"

# Commit 9: Auth guards and plugin
git add src/auth/guards.ts
GIT_AUTHOR_DATE="2023-12-05T10:45:00" GIT_COMMITTER_DATE="2023-12-05T10:45:00" \
  git commit -m "Add @Auth and @Roles decorators with Fastify auth plugin" --author="$AUTHOR"

# Commit 10: Validation errors
git add src/validation/errors.ts
GIT_AUTHOR_DATE="2024-01-22T14:00:00" GIT_COMMITTER_DATE="2024-01-22T14:00:00" \
  git commit -m "Add Zod error formatting utilities" --author="$AUTHOR"

# Commit 11: Validation decorators
git add src/validation/schema.ts
GIT_AUTHOR_DATE="2024-03-15T09:30:00" GIT_COMMITTER_DATE="2024-03-15T09:30:00" \
  git commit -m "Implement @Body, @Query, @Params validation decorators with Zod" --author="$AUTHOR"

# Commit 12: OpenAPI generator
git add src/openapi/generator.ts
GIT_AUTHOR_DATE="2024-05-28T16:00:00" GIT_COMMITTER_DATE="2024-05-28T16:00:00" \
  git commit -m "Add OpenAPI spec generator with Zod-to-JSON-Schema conversion" --author="$AUTHOR"

# Commit 13: Swagger UI plugin
git add src/openapi/ui.ts
GIT_AUTHOR_DATE="2024-07-10T11:30:00" GIT_COMMITTER_DATE="2024-07-10T11:30:00" \
  git commit -m "Add Swagger UI plugin with embedded HTML viewer" --author="$AUTHOR"

# Commit 14: Structured logging
git add src/logging/logger.ts src/logging/request-id.ts
GIT_AUTHOR_DATE="2024-09-05T13:15:00" GIT_COMMITTER_DATE="2024-09-05T13:15:00" \
  git commit -m "Add structured pino logger and request-id middleware" --author="$AUTHOR"

# Commit 15: Config and exports
git add src/utils/config.ts src/index.ts
GIT_AUTHOR_DATE="2024-11-18T10:00:00" GIT_COMMITTER_DATE="2024-11-18T10:00:00" \
  git commit -m "Add env-based config with Zod validation and wire up public exports" --author="$AUTHOR"

# Commit 16: Tests
git add tests/ vitest.config.ts
GIT_AUTHOR_DATE="2025-01-20T15:45:00" GIT_COMMITTER_DATE="2025-01-20T15:45:00" \
  git commit -m "Add comprehensive test suite for server, auth, and validation" --author="$AUTHOR"

# Commit 17: Examples, CI, and README
git add examples/ .github/ README.md
GIT_AUTHOR_DATE="2025-06-01T12:00:00" GIT_COMMITTER_DATE="2025-06-01T12:00:00" \
  git commit -m "Add example CRUD API, CI workflow, and project documentation" --author="$AUTHOR"

echo ""
echo "Git history created successfully. Creating GitHub repo..."
echo ""

# Push to GitHub
gh repo create api-forge --public \
  --description "TypeScript-first API framework. Decorators, JWT auth, Zod validation, auto OpenAPI docs. Built on Fastify." \
  --source . --push

echo ""
echo "Done! Repository pushed to GitHub."
