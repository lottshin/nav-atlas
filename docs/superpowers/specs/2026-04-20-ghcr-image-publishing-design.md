# Nav Atlas GHCR Image Publishing Design

## Summary

This design adds a GitHub-native container publishing path for `D:\New_god\nav-website` so the project can be deployed like a ready-made image project instead of a source-only repository.

The chosen direction is to publish Docker images to **GitHub Container Registry (GHCR)** from GitHub Actions, using the repository `https://github.com/lottshin/nav-atlas.git` as the single source of truth. The main operational goal is simple deployment: once configured, 1Panel or plain Docker can pull `ghcr.io/lottshin/nav-atlas:latest` directly.

This is intentionally a **small operational enhancement**, not a full CI/CD platform rebuild.

---

## Goals

- Let the project publish a ready-to-run container image from GitHub automatically.
- Make server deployment simpler by allowing image-based deployment instead of source clone + local build.
- Provide a stable default image reference for 1Panel and Docker users:
  - `ghcr.io/lottshin/nav-atlas:latest`
- Keep the existing local Docker build path working.
- Document the new image-based deployment path clearly in both README and deployment docs.
- Bump project version for this new deployment capability.

## Non-Goals

- Publishing to Docker Hub in the first pass.
- Building a multi-registry pipeline.
- Replacing the existing Dockerfile or Docker Compose architecture.
- Adding release automation, changelog automation, or semantic-release tooling.
- Solving multi-instance/file-mode scaling limits.

---

## Current Project Context

The repository already has the prerequisites for image publishing:

1. A working `Dockerfile` already exists.
2. A `docker-compose.yml` already exists for source-based deployment.
3. The repository is already pushed to GitHub at `lottshin/nav-atlas`.
4. The current package version is `1.1.0`.
5. There is no `.github/workflows/` publishing workflow yet.

That means this task is mainly about:

- CI workflow wiring
- tag strategy
- deployment documentation
- small metadata/version updates

---

## Considered Approaches

### Option A: Manual local build and push

Example shape:

- local machine runs `docker build`
- local machine runs `docker push`

**Pros**
- Lowest initial file changes
- No GitHub Actions setup needed

**Cons**
- Manual and error-prone
- Hard to reproduce consistently
- Depends on the operator's local Docker environment every time
- Not a good fit for “push code, then deploy latest image”

### Option B: GitHub Actions -> GHCR (**Chosen**)

Example shape:

- push code to GitHub
- GitHub Actions builds image
- GitHub Actions publishes image to `ghcr.io/lottshin/nav-atlas`

**Pros**
- Native to the current GitHub-hosted repository
- Can authenticate with `GITHUB_TOKEN`
- No separate Docker Hub credentials needed
- Cleanest path for 1Panel image deployment
- Keeps code and image close together operationally

**Cons**
- Requires adding workflow files
- Requires understanding GHCR visibility/package settings

### Option C: GitHub Actions -> Docker Hub

**Pros**
- Familiar to many users
- Broad ecosystem recognition

**Cons**
- Requires separate Docker Hub account/repository/credentials
- Adds another external dependency
- Less convenient than GHCR when source code already lives on GitHub

**Decision**

Choose **Option B**. It is the most direct, lowest-friction path for this repository.

---

## Chosen Publishing Model

### Registry and Image Name

Use:

```text
ghcr.io/lottshin/nav-atlas
```

This matches the repository owner and target repository naming, and is easy to paste into 1Panel.

### Trigger Strategy

Use GitHub Actions to publish images when:

1. code is pushed to the default branch `main`
2. a Git tag like `v1.2.0` is pushed
3. a manual workflow dispatch is triggered from GitHub Actions UI for `main` maintenance republish only

### Manual dispatch semantics

`workflow_dispatch` is included only as a maintenance/recovery trigger, not as a separate custom release system.

In the first pass, its behavior is intentionally narrow:

- manual dispatch is for the `main` branch only
- it republishes the same tag set as a normal `main` push:
  - `latest`
  - `sha-<shortsha>`
- semver publishing remains tied to real Git tag pushes such as `v1.2.0`
- do **not** support arbitrary custom tag input in the first pass

This keeps the workflow easy to understand and avoids inventing a parallel manual release protocol.

### Tag Strategy

To balance simplicity and correctness, use this tag model:

#### On push to `main`

Publish:

- `latest`
- `sha-<shortsha>`

This gives users a simple rolling tag (`latest`) plus an immutable traceable tag (`sha-*`).

#### On version tag push such as `v1.2.0`

Publish:

- `1.2.0`
- `1.2`
- `1`

This gives a proper fixed-version deployment path without mutating semver tags on every commit.

### Why not publish package.json version on every main push

That would make version tags mutable unless a release/tag discipline is enforced. For a clean first version, versioned image tags should come from Git tags, while `latest` covers the simple deployment use case.

---

## Workflow Design

### Files to Add or Modify

- Create: `D:\New_god\nav-website\.github\workflows\publish-image.yml`
- Modify: `D:\New_god\nav-website\README.md`
- Modify: `D:\New_god\nav-website\DEPLOY.md`
- Modify: `D:\New_god\nav-website\package.json`
- Modify: `D:\New_god\nav-website\package-lock.json`

### Workflow Responsibilities

The workflow should:

1. check out the repository
2. set up Docker Buildx
3. log in to GHCR with `GITHUB_TOKEN`
4. generate tags and OCI labels automatically
5. build the Docker image from the existing `Dockerfile`
6. push the image only for qualifying events

### Permissions

The workflow needs at least:

- `contents: read`
- `packages: write`

### Metadata Expectations

Add OCI labels through metadata generation so the image exposes:

- source repository
- image description
- license if applicable
- revision/commit metadata

This improves traceability inside GHCR and deployment panels.

---

## Deployment UX After This Change

### Docker CLI path

After the image is published, the simplest deployment path becomes:

```bash
docker pull ghcr.io/lottshin/nav-atlas:latest
```

or in Compose:

```yaml
image: ghcr.io/lottshin/nav-atlas:latest
```

### 1Panel path

In 1Panel, the user can create a container or compose app based on the image:

```text
ghcr.io/lottshin/nav-atlas:latest
```

This is the main practical benefit of the change.

### First-publish visibility caveat

GHCR packages can require a visibility check after first publish. The documentation should explicitly tell the operator to inspect the package page under the repository/account and ensure the image is public if public anonymous pulls are desired.

For this rollout, the intended deployment UX is **public anonymous pull** for the default image path used by 1Panel and standard Docker pulls. In other words, a successful rollout is not merely “image published”, but “image published and publicly pullable as `ghcr.io/lottshin/nav-atlas:latest`”.

### Runtime contract remains unchanged

Image-based deployment must keep the same runtime contract as the current source-based Docker deployment.

That means the published image still expects:

- persistent writable data mounted to `/app/data`
- runtime environment variables injected at container start, not baked into the image
- the same file-mode single-instance limitation
- the same reverse-proxy model for public traffic unless the operator intentionally chooses direct port exposure

For the documented default server path, this still means:

- app listens on container port `3000`
- server-side env is provided from the production env file
- public access goes through Nginx or 1Panel reverse proxy
- persistent host storage is mounted into `/app/data`

---

## Documentation Design

### README changes

README should gain a concise GitHub-facing section that answers:

- what image is published
- where it is published
- which tag a normal user should deploy
- how to publish versioned tags if needed

### DEPLOY changes

`DEPLOY.md` should add a second path alongside source-based deployment:

1. **Image deployment path** (recommended for servers/1Panel once GHCR image exists)
2. **Source build path** (existing fallback path)

This prevents the docs from implying that cloning the repo is the only option, while still preserving the same runtime requirements around env injection, `/app/data` persistence, and reverse-proxy exposure.

### Versioning note

Because this is a new deployment capability, the project version should bump from `1.1.0` to `1.2.0`.

This version bump does **not** automatically imply that a `v1.2.0` Git tag will be created as part of this rollout. Until a version tag is explicitly pushed, the guaranteed published tags are `latest` and `sha-*` from `main`.

---

## Security Notes

- Use GitHub Actions `GITHUB_TOKEN` for GHCR authentication instead of storing a separate PAT when possible.
- Do not add runtime production secrets to the publishing workflow.
- The workflow builds the image; runtime secrets still belong in server-side env configuration.
- Keep the Dockerfile free of embedded secrets.

---

## Verification Strategy

The work should be verified at three levels.

### 1. Local repository verification

Run:

- `npm exec tsc -- --noEmit`
- `npm run build`

This confirms the repo still type-checks and builds after doc/workflow/version updates.

### 2. Workflow validity review

Confirm that:

- workflow YAML is syntactically valid
- trigger conditions match the intended tag strategy
- image name resolves to `ghcr.io/lottshin/nav-atlas`
- permissions include `packages: write`

### 3. Post-merge operational verification

After pushing to GitHub, confirm in GitHub Actions and GHCR that:

- the workflow runs on `main`
- `latest` is published
- the package is visible
- the published package is linked to the repository
- the package is public if direct 1Panel / anonymous Docker pull is the target deployment path
- an unauthenticated pull of `ghcr.io/lottshin/nav-atlas:latest` succeeds once visibility is configured

If the user later creates a Git tag like `v1.2.0`, confirm that the version tags appear as expected.

---

## Risks and Mitigations

### Risk: users confuse `latest` with immutable versioning
**Mitigation:** document clearly that `latest` tracks `main`, and fixed versions come from Git tags.

### Risk: first publish succeeds but the image is not publicly pullable
**Mitigation:** add a doc note to check GHCR package visibility after first publish.

### Risk: workflow overreaches and changes deployment behavior
**Mitigation:** keep this rollout limited to image publishing and docs; do not alter runtime architecture.

### Risk: future pushes overwrite expectations for semver tags
**Mitigation:** only create semver tags from Git tags, not from every main branch push.

---

## Final Decision

Proceed with a **GitHub Actions -> GHCR** publishing flow for `D:\New_god\nav-website`, using:

- image name `ghcr.io/lottshin/nav-atlas`
- `latest` + `sha-*` tags on `main`
- semver tags on `v*` Git tag pushes
- README and deployment docs updated for image-based deployment
- project version bump to `1.2.0`

This gives the project the same kind of deployment ergonomics as a ready-made image project like NewAPI, while keeping the implementation small and maintainable.
