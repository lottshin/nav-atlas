# Nav Website Docker Deployment Design

## Summary

This design defines a production deployment path for `nav-website` that keeps the current `file` storage mode, moves code distribution to GitHub, runs the application in Docker Compose, and keeps reverse proxy/TLS termination on the host machine with Nginx.

The goal is to make deployments and updates more repeatable without introducing unnecessary operational complexity. The first version intentionally targets **single-machine, single-instance deployment** and does **not** attempt to solve horizontal scaling, database mode, or full infrastructure containerization.

---

## Goals

- Make server deployment reproducible and easier to update.
- Keep the initial production path compatible with the current `NAV_STORAGE_MODE="file"` setup.
- Prevent data loss across container rebuilds and image updates.
- Avoid pushing TLS/certificate management into containers for the first deployment version.
- Keep runtime memory overhead low and close to the already-measured baseline for the current application.

## Non-Goals

- Supporting `database` mode in the first Docker rollout.
- Running PostgreSQL, Redis, or Nginx inside Compose.
- Supporting multiple application replicas that share writable file storage.
- Building a full CI/CD pipeline in the first pass.
- Reworking unrelated application architecture.

---

## Current Project Constraints

The current application has several characteristics that affect deployment design:

1. The project uses `Next.js + NextAuth + Prisma`.
2. The current local/validated mode is `NAV_STORAGE_MODE="file"`.
3. Application data is stored under `data/`, including navigation state and favicon cache data.
4. Some required environment variables are read at module import time, most notably in `auth.ts`, where `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `AUTH_SECRET` are currently required immediately.
5. The project currently has no Docker deployment files in-repo.

These constraints mean the deployment design must solve both:

- **runtime persistence** for `file` mode
- **build-time environment handling** for required secrets

---

## Considered Approaches

### Option A: Host Node.js + PM2 + Host Nginx

**Pros**
- Fastest first-time setup
- Lowest conceptual overhead
- Easy to inspect logs/processes directly on the server

**Cons**
- More manual environment drift over time
- Harder to reproduce exactly across machines
- Less convenient upgrade/rollback story

### Option B: Docker Compose for app + Host Nginx for proxy/TLS (**Chosen**)

**Pros**
- Reproducible application runtime
- Keeps HTTPS/domain setup simple on the host
- Good balance between operational simplicity and long-term maintainability
- Easier future updates: `git pull` + `docker compose up -d --build`

**Cons**
- Requires adding deployment artifacts to the repository
- Needs explicit design for data mounts and env handling

### Option C: App container + Nginx container + containerized TLS/proxy

**Pros**
- More self-contained infrastructure
- Portable as a complete stack

**Cons**
- More moving parts for the first deployment
- More complex TLS/certificate management
- Higher first-time setup/debugging cost

**Decision**

Choose **Option B**. It gives us a durable deployment path without front-loading reverse proxy complexity.

---

## Chosen Architecture

### High-Level Request Flow

```text
Browser
  -> Host Nginx (80/443, domain, TLS)
  -> 127.0.0.1:3000
  -> Docker container running nav-website
```

### Deployment Model

- Source code is hosted in GitHub.
- The server clones the repository into a dedicated app directory.
- Docker Compose builds and runs the Next.js application container.
- Host Nginx proxies the public domain to the container-exposed localhost port.
- Application data remains outside the container and is bind-mounted into `/app/data`.

---

## Server Directory Layout

Recommended host layout:

```text
/opt/nav-website/
  app/                    # git checkout
  shared/
    data/                 # persisted file-mode data
    env/production.env    # production environment variables
```

### Why this layout

- Keeps code updates separate from persistent state.
- Makes rebuilds safer.
- Makes backup/restore straightforward.
- Avoids storing secrets directly in the cloned repository tree.

---

## Persistence Model

### Required persistent mount

Host:

```text
/opt/nav-website/shared/data
```

Container:

```text
/app/data
```

### What lives there

At minimum, the deployment must preserve:

- `navigation-store.json`
- `favicon-preferences.json`
- `favicon-cache/`

### Explicit boundary

This deployment is designed for **one running application instance**. Because `file` mode writes local files, multiple concurrent writers across replicas are out of scope.

---

## Build-Time and Runtime Environment Strategy

This is the most important design correction from the self-review.

### Problem

The project currently reads required secrets at module import time in `auth.ts`:

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `AUTH_SECRET`

That is workable for direct host deployments, but it creates friction in container builds because `next build` can load modules that expect runtime secrets to exist.

### Rejected sub-approach: bake real secrets into Docker build

We will **not** solve this by passing production secrets into the Docker build stage. That is operationally risky because:

- it increases the chance of secrets ending up in image history/layers
- it mixes build concerns with runtime concerns

### Chosen sub-approach: small code adjustment for Docker-friendly env access

We will make a **small, targeted code change** so the app is more deployment-friendly:

- runtime-required env access remains strict
- build-time logic can avoid depending on real production secrets
- the application still fails loudly when required runtime secrets are actually missing at startup/usage time

### Design intent for this code change

The change should:

1. preserve secure runtime behavior
2. avoid requiring real secrets during image build
3. remain explicit and easy to understand
4. avoid introducing hidden fallback behavior in production runtime

### Preferred shape

Introduce a small env-loading abstraction for auth/runtime-sensitive values so that:

- Docker build can use safe placeholders or deferred resolution
- real secret enforcement still happens for actual runtime execution

This is intentionally a **small deployment-focused refactor**, not a broad env-system rewrite.

### Runtime env source

Docker Compose will use a dedicated production env file from the host, for example:

```text
/opt/nav-website/shared/env/production.env
```

The container runtime will receive environment variables from that file.

---

## Docker Image Strategy

### First version choice

Use a conservative **multi-stage Dockerfile** based on:

```text
node:20-bookworm-slim
```

### Why not Alpine first

This project uses Prisma, and the first deployment should optimize for fewer compatibility surprises rather than the smallest possible image.

### Why not force `output: "standalone"` in version 1

Although standalone can produce a cleaner runtime artifact, it is an additional behavior change. For the initial rollout:

- prefer lower behavioral risk
- keep the Docker adoption focused on deployment standardization

Standalone can remain a future optimization if desired.

---

## Compose Strategy

The first `docker-compose.yml` should define a **single app service**.

### Expected behavior

- Build from the local repository Dockerfile
- Run the app on port `3000`
- Bind to localhost on the host:

```text
127.0.0.1:3000:3000
```

- Mount persistent data:

```text
/opt/nav-website/shared/data:/app/data
```

- Load production environment variables from the host env file
- Use a restart policy suitable for long-running service use

### Why localhost-only port publishing

Because public traffic should come through host Nginx, not directly to the container. This reduces accidental exposure and keeps ingress architecture simple.

---

## Host Nginx Role

Host Nginx remains responsible for:

- listening on `80/443`
- domain routing
- HTTPS certificate handling
- proxying to `127.0.0.1:3000`

This keeps certificate management outside the container lifecycle and matches the simplest operational model for this stage of the project.

---

## Security Notes

- Production secrets must live outside the repo.
- Real production secrets must **not** be passed as Docker build arguments.
- The mounted data directory should be backed up regularly.
- The initial deployment should keep container port exposure limited to localhost.

---

## Operational Workflow

### First deployment

1. Clone repo from GitHub into `/opt/nav-website/app`
2. Create host directories for shared data and env files
3. Copy or restore current `data/` contents into the shared data directory
4. Create production env file on the host
5. Build and start via Compose
6. Configure host Nginx to proxy to `127.0.0.1:3000`

### Routine update flow

```bash
cd /opt/nav-website/app
git pull
docker compose up -d --build
```

This update flow assumes:

- persistent data remains mounted on the host
- Nginx config does not need to change for normal application updates

---

## Verification Strategy

The deployment work must be validated at several levels:

1. Type check passes
2. Production build passes
3. Docker image build succeeds
4. `docker compose up -d` succeeds
5. The following routes respond successfully behind the container:
   - `/`
   - `/admin/login`
   - `/search`
6. Data written in `file` mode survives container recreation

Because this rollout includes deployment-focused env changes, verification must cover both:

- build behavior
- runtime behavior

---

## Risks and Mitigations

### Risk: runtime env refactor changes auth behavior
**Mitigation:** keep the env refactor narrow, explicitly test build/start/auth routes.

### Risk: mounted host directory permissions prevent writes
**Mitigation:** document required ownership/permissions and verify write behavior in the container.

### Risk: users assume this supports multiple instances
**Mitigation:** state clearly in docs that file-mode Docker deployment is single-instance only.

### Risk: Docker deployment gets overcomplicated
**Mitigation:** keep version 1 limited to one app service and host-managed Nginx.

---

## Final Decision

Proceed with a **Dockerized application deployment** for the current `file` mode setup, using:

- GitHub for source distribution
- Docker Compose for the app service
- host Nginx for reverse proxy/TLS
- host bind mount for `/app/data`
- a small code adjustment to make build-time and runtime env handling Docker-friendly

This gives the project a practical, maintainable production path without prematurely expanding scope.
