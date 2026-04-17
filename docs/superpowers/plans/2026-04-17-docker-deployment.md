# Nav Website Docker Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub-friendly Docker deployment path for the current `file` mode app, with host Nginx as the reverse proxy and persistent host-mounted data.

**Architecture:** Keep the application as a single Docker Compose service bound to `127.0.0.1:3000`, keep host Nginx responsible for domain/TLS, and persist `/app/data` via a host bind mount. Add a narrow env-loading refactor so `next build` no longer depends on real production secrets being available at Docker image build time.

**Tech Stack:** Next.js 15, NextAuth v5, Prisma, TypeScript, Docker, Docker Compose, Nginx

---

## Planning Notes

- This workspace is currently **not** a Git repository, so commit steps should only be executed after the project is initialized/pushed to GitHub.
- The repository does **not** currently include an automated test harness. For this deployment-focused change, verification will rely on targeted type-check/build/container smoke checks rather than introducing a new test framework as part of the same change.
- Scope is intentionally limited to **single-machine, single-instance, `NAV_STORAGE_MODE="file"`** deployment.

---

### Task 1: Make auth/env loading Docker-build-friendly

**Files:**
- Create: `lib/auth-env.ts`
- Modify: `lib/env.ts`
- Modify: `auth.ts`
- Verify: `npm exec tsc -- --noEmit`, `npm run build`

- [ ] **Step 1: Extend `lib/env.ts` with a tiny build-aware env helper**

Add a helper that can distinguish between:
- strict runtime-required env values
- safe build-time placeholder behavior for Docker image builds

Keep `requireEnv()` for existing strict callers, but add a narrowly-scoped helper for deployment-sensitive auth env reads instead of rewriting the whole env module.

- [ ] **Step 2: Create `lib/auth-env.ts` to centralize auth-related env access**

Move auth env loading behind focused functions such as:
- admin username lookup
- admin password lookup
- auth secret lookup

Design this module so:
- real runtime execution still throws on missing required values
- Docker build can proceed without injecting real production secrets into the image build

- [ ] **Step 3: Refactor `auth.ts` to stop resolving required env values at module top level**

Replace direct top-level `requireEnv("ADMIN_USERNAME")`, `requireEnv("ADMIN_PASSWORD")`, and `requireEnv("AUTH_SECRET")` usage with the new helper module so the file becomes Docker-build-friendly without changing login behavior.

- [ ] **Step 4: Re-run type checking**

Run:

```bash
npm exec tsc -- --noEmit
```

Expected:
- exit code `0`
- no new TypeScript errors

- [ ] **Step 5: Re-run the production build**

Run:

```bash
npm run build
```

Expected:
- exit code `0`
- existing routes still build successfully

- [ ] **Step 6: Commit the env/auth refactor (only if inside a real Git clone)**

```bash
git add lib/env.ts lib/auth-env.ts auth.ts
git commit -m "refactor: make auth env loading docker-friendly"
```

---

### Task 2: Add Docker packaging artifacts for a single app service

**Files:**
- Create: `.dockerignore`
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Verify: `docker compose build`

- [ ] **Step 1: Create `.dockerignore` with a minimal, deployment-safe context**

Exclude at least:

```text
.next
node_modules
.env
.env.local
dist
coverage
*.log
data
docs
tmp*
```

Keep the build context focused so local caches, secrets, and runtime data do not get copied into the image build context.

- [ ] **Step 2: Create a conservative multi-stage `Dockerfile`**

Use:

```text
node:20-bookworm-slim
```

Structure:
- dependency install stage
- build stage
- runtime stage

Runtime stage should:
- run the Next.js app on port `3000`
- include only the files needed to start the app
- avoid embedding real production secrets

- [ ] **Step 3: Create `docker-compose.yml` for one `nav-website` service**

Design the service so it:
- builds from the repo `Dockerfile`
- restarts automatically
- binds only to localhost:

```text
127.0.0.1:3000:3000
```

- loads env from the host-side production env file using the recommended server layout:

```text
../shared/env/production.env
```

- mounts persistent data:

```text
../shared/data:/app/data
```

- [ ] **Step 4: Build the Docker image locally or on a Docker-enabled target machine**

Run:

```bash
docker compose build
```

Expected:
- image build completes successfully
- no dependency/install/build failures

- [ ] **Step 5: Commit Docker packaging files (only if inside a real Git clone)**

```bash
git add .dockerignore Dockerfile docker-compose.yml
git commit -m "build: add docker deployment artifacts"
```

---

### Task 3: Add operator-facing deployment and environment documentation

**Files:**
- Create: `.env.production.example`
- Create: `DEPLOY.md`
- Modify: `.env.example`

- [ ] **Step 1: Create `.env.production.example` for file-mode Docker deployment**

Include only the production-facing values needed for the first deployment path, with sane placeholders:

```env
NAV_STORAGE_MODE="file"
AUTH_SECRET="replace-with-long-random-string"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="replace-me"
NEXTAUTH_URL="https://example.com"
JOB_RUNNER_SECRET="replace-with-long-random-string"
```

Do **not** include `DATABASE_URL` in the first-pass production example since this rollout is explicitly file-mode only.

- [ ] **Step 2: Update `.env.example` to clarify its role**

Add a short comment header or note making it clear that:
- `.env.example` is the general/local example
- `.env.production.example` is the Docker/server deployment example

This avoids future confusion when copying env templates.

- [ ] **Step 3: Create `DEPLOY.md` with exact server steps**

Document:
- recommended host directory layout
- GitHub clone location
- where to place the host env file
- where to place persistent `data/`
- how to copy existing local `data/` to the server
- `docker compose up -d --build`
- host Nginx reverse proxy config example
- update flow
- backup guidance for `shared/data` and env file
- explicit single-instance/file-mode limitation

- [ ] **Step 4: Include the host Nginx reverse proxy snippet in `DEPLOY.md`**

Document an example server block that proxies:

```text
https://your-domain -> 127.0.0.1:3000
```

Keep TLS/certificate handling on the host and make that operational boundary explicit.

- [ ] **Step 5: Commit deployment docs (only if inside a real Git clone)**

```bash
git add .env.example .env.production.example DEPLOY.md
git commit -m "docs: add docker deployment instructions"
```

---

### Task 4: Run end-to-end verification for the first Docker deployment path

**Files:**
- Verify only: project root, container runtime, mounted `data/`

- [ ] **Step 1: Re-run type checking from a clean working tree**

Run:

```bash
npm exec tsc -- --noEmit
```

Expected:
- exit code `0`

- [ ] **Step 2: Re-run the production build**

Run:

```bash
npm run build
```

Expected:
- exit code `0`

- [ ] **Step 3: Start the containerized app**

Run:

```bash
docker compose up -d --build
```

Expected:
- service starts successfully
- container remains healthy/running after startup

- [ ] **Step 4: Smoke-test the app over localhost**

Run:

```bash
curl -I http://127.0.0.1:3000/
curl -I http://127.0.0.1:3000/admin/login
curl -I http://127.0.0.1:3000/search
```

Expected:
- HTTP `200` or equivalent successful response headers

- [ ] **Step 5: Verify the mounted data directory is visible inside the container**

Run:

```bash
docker compose exec nav-website sh -lc "ls -la /app/data"
```

Expected:
- mounted host data directory is present
- expected file-mode data files/directories are visible

- [ ] **Step 6: Verify persistence survives container recreation**

Create a temporary sentinel in the host-mounted data directory, then recreate the container and confirm it remains. Example flow:

```bash
echo "deploy-check" > ../shared/data/.deploy-smoke-check
docker compose down
docker compose up -d
docker compose exec nav-website sh -lc "test -f /app/data/.deploy-smoke-check"
rm -f ../shared/data/.deploy-smoke-check
```

Expected:
- sentinel survives container recreation
- cleanup removes the temporary file afterward

- [ ] **Step 7: Record any deviations in `DEPLOY.md` before wrapping**

If any command differs on the target server, update the documentation immediately so the docs match the real working deployment flow.

- [ ] **Step 8: Commit the final verified deployment changes (only if inside a real Git clone)**

```bash
git add .
git commit -m "feat: add file-mode docker deployment flow"
```

---

## Manual Self-Review Checklist

- [ ] The env refactor does not weaken runtime secret enforcement.
- [ ] No real production secrets are required during Docker image build.
- [ ] `docker-compose.yml` does not expose the app publicly on `0.0.0.0`.
- [ ] `DEPLOY.md` clearly states that file-mode Docker deployment is single-instance only.
- [ ] The documented host layout matches the volume paths used in Compose.
- [ ] Verification commands are runnable on a Docker-enabled target machine without guessing.
