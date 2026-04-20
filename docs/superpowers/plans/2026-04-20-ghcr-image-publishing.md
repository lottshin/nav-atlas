# Nav Atlas GHCR Image Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GitHub Actions based GHCR publishing so `D:\New_god\nav-website` can be deployed from `ghcr.io/lottshin/nav-atlas:latest` instead of only from source builds.

**Architecture:** Keep the existing Docker runtime contract unchanged and add a GitHub-native image publishing layer on top of the current `Dockerfile`. Publish `latest` and `sha-*` from `main`, publish semver tags from real `v*` Git tags, and document both the image deployment path and the existing source-build fallback path.

**Tech Stack:** GitHub Actions, GHCR, Docker Buildx, Next.js 15, TypeScript, npm, Markdown docs

---

## File Map

- Create: `D:\New_god\nav-website\.github\workflows\publish-image.yml`
  - GitHub Actions workflow that builds and publishes the container image to GHCR.
- Modify: `D:\New_god\nav-website\package.json`
  - Bump version from `1.1.0` to `1.2.0`.
- Modify: `D:\New_god\nav-website\package-lock.json`
  - Keep lockfile root package version in sync with `package.json`.
- Modify: `D:\New_god\nav-website\README.md`
  - Add GitHub-facing image publishing/deployment instructions in bilingual style.
- Modify: `D:\New_god\nav-website\DEPLOY.md`
  - Add image-based deployment path while preserving the current runtime contract (`/app/data`, env injection, reverse proxy model).

## Planning Notes

- This rollout is mainly **workflow + docs + versioning**. No application runtime code behavior should change.
- TDD exception applies here because the main change is configuration/documentation rather than new production logic. Verification should focus on build evidence, workflow correctness, and doc/runtime contract consistency.
- The current workspace is on branch `main`. Before implementation starts, switch to a dedicated branch with the required prefix: `codex/ghcr-image-publishing`.
- GHCR public pull is part of the intended UX, but the actual package visibility switch may still require GitHub-side verification after first publish.
- First-pass scope is **single-platform image publishing only**. Do not add multi-arch or Docker Hub support in this rollout.

---

### Task 1: Create an isolated implementation branch and lock the publishing scope

**Files:**
- Verify only: repository branch state, `D:\New_god\nav-website\docs\superpowers\specs\2026-04-20-ghcr-image-publishing-design.md`

- [ ] **Step 1: Create the feature branch**

Run:

```bash
git checkout -b codex/ghcr-image-publishing
```

Expected:
- branch switches from `main` to `codex/ghcr-image-publishing`

- [ ] **Step 2: Re-read the approved spec before editing files**

Open and confirm these requirements from:

```text
D:\New_god\nav-website\docs\superpowers\specs\2026-04-20-ghcr-image-publishing-design.md
```

Checklist:
- image name is `ghcr.io/lottshin/nav-atlas`
- `main` publishes `latest` + `sha-*`
- `v*` tags publish semver tags
- `workflow_dispatch` is only a `main` maintenance republish path
- runtime contract stays the same (`/app/data`, env injection, reverse proxy model)

- [ ] **Step 3: Commit nothing in this task**

This task only establishes the branch and scope. Move to workflow implementation next.

---

### Task 2: Add the GHCR publishing workflow

**Files:**
- Create: `D:\New_god\nav-website\.github\workflows\publish-image.yml`
- Verify: workflow file contents, trigger rules, image name, tag rules

- [ ] **Step 1: Create the workflow directory if missing**

Run:

```bash
mkdir .github
mkdir .github\workflows
```

Expected:
- `.github\workflows` exists

If `.github` already exists, only create the missing child directory.

- [ ] **Step 2: Write `publish-image.yml` with the exact event scope**

The workflow must trigger on:

```yaml
on:
  push:
    branches: [main]
    tags: ['v*']
  workflow_dispatch:
```

Do **not** add extra inputs for arbitrary custom tags in this first version.

- [ ] **Step 3: Add job permissions and setup steps**

The workflow job must include at least:

```yaml
permissions:
  contents: read
  packages: write
```

And must include steps for:
- `actions/checkout`
- `docker/setup-buildx-action`
- `docker/login-action` against `ghcr.io` using `${{ github.actor }}` and `${{ secrets.GITHUB_TOKEN }}`
- `docker/metadata-action`
- `docker/build-push-action`

- [ ] **Step 4: Encode the tag rules in metadata generation**

The workflow must generate:

For `main`:
- `latest`
- `sha-<shortsha>`

For Git tags like `v1.2.0`:
- `1.2.0`
- `1.2`
- `1`

Make the `latest` rule explicit in implementation:

- `latest` must be emitted **only** for `main`
- `v*` tag builds must emit semver tags only
- do **not** let tag builds also publish `latest`

The image target must resolve to:

```text
ghcr.io/lottshin/nav-atlas
```

Use OCI labels so the package is traceable back to the repository and GitHub can associate the package correctly. At minimum, include the source repository label equivalent to:

```text
org.opencontainers.image.source=https://github.com/lottshin/nav-atlas
```

along with the usual revision/title/description metadata.

- [ ] **Step 5: Ensure manual dispatch is narrow and non-magical**

Manual dispatch must behave as a maintenance republish for `main` only.

Implement this explicitly in the workflow logic, not just in comments. The planned workflow must:

- allow normal `push` events for `main` and `v*`
- allow `workflow_dispatch` only when `github.ref == 'refs/heads/main'`
- skip publish behavior for any manually selected non-`main` branch

The workflow should not introduce a separate release protocol, custom tag text boxes, or Docker Hub publishing.

- [ ] **Step 6: Self-review the workflow file before moving on**

Read the file back and confirm:
- no Docker Hub references
- no multi-arch matrix
- no PAT requirement when `GITHUB_TOKEN` is sufficient
- no mismatch between image name and repository name
- no doc/spec contradiction around manual dispatch

- [ ] **Step 7: Commit the workflow**

Run:

```bash
git add .github/workflows/publish-image.yml
git commit -m "ci: add ghcr image publishing workflow"
```

Expected:
- one commit created on `codex/ghcr-image-publishing`

---

### Task 3: Sync project version metadata with the new deployment capability

**Files:**
- Modify: `D:\New_god\nav-website\package.json`
- Modify: `D:\New_god\nav-website\package-lock.json`

- [ ] **Step 1: Bump `package.json` version from `1.1.0` to `1.2.0`**

Update:

```json
"version": "1.2.0"
```

This is a minor bump because GHCR publishing is a new deployment capability.

- [ ] **Step 2: Keep `package-lock.json` root version in sync**

Update both top-level version fields from `1.1.0` to `1.2.0`.

- [ ] **Step 3: Verify no unrelated dependency changes were introduced**

Run:

```bash
git diff -- package.json package-lock.json
```

Expected:
- only version metadata changes are present

- [ ] **Step 4: Commit the version bump**

Run:

```bash
git add package.json package-lock.json
git commit -m "chore: bump version to 1.2.0"
```

Expected:
- one commit created for version-only metadata changes

---

### Task 4: Update README for GitHub-facing image deployment

**Files:**
- Modify: `D:\New_god\nav-website\README.md`

- [ ] **Step 1: Preserve the current README positioning and preview image**

Keep existing project introduction and preview image in place. Add the new image-publishing content without turning the README into a generic template.

- [ ] **Step 2: Add a concise bilingual image publishing/deployment section**

README must explain:
- published image name: `ghcr.io/lottshin/nav-atlas`
- default deployment tag: `latest`
- fixed version tags come from real Git tags like `v1.2.0`
- `latest` tracks `main`
- source-build deployment still exists as a fallback

Use the same bilingual presentation style already used elsewhere in the README.

- [ ] **Step 3: Add a short GHCR visibility note**

Document that after first publish, the package may need to be checked in GitHub Packages/GHCR and set to public if anonymous pull is desired for 1Panel or plain Docker usage.

- [ ] **Step 4: Keep the messaging GitHub-appropriate**

Avoid writing README as a private deployment memo. It should read like a public repository README: concise, discoverable, and understandable to someone landing on the repo page.

- [ ] **Step 5: Commit the README update**

Run:

```bash
git add README.md
git commit -m "docs: add ghcr deployment guidance"
```

Expected:
- one commit created for README-only changes

---

### Task 5: Update deployment docs for image-based server deployment

**Files:**
- Modify: `D:\New_god\nav-website\DEPLOY.md`

- [ ] **Step 1: Add an image-based deployment path near the top of `DEPLOY.md`**

This new section should be the recommended path once GHCR images exist.

It must include the image reference:

```text
ghcr.io/lottshin/nav-atlas:latest
```

- [ ] **Step 2: Preserve the current runtime contract in the docs**

The image-based path must still document:
- persistent mount to `/app/data`
- runtime env injection from the production env file
- single-instance file-mode limitation
- reverse proxy / Nginx / 1Panel proxy expectations for public access

Do **not** let the new docs imply that “just filling the image name” is enough without env and data mounts.

- [ ] **Step 3: Keep the source-build path as fallback, not the default**

The document should clearly distinguish:
1. image deployment (recommended once GHCR image is available)
2. source clone + local build deployment (fallback / advanced path)

- [ ] **Step 4: Add the post-first-publish GHCR visibility check**

Document a short operator step to confirm:
- the package exists under GitHub/GHCR
- it is linked to the repository
- it is public if anonymous pull is required

- [ ] **Step 5: Commit the deployment doc update**

Run:

```bash
git add DEPLOY.md
git commit -m "docs: add ghcr image deployment path"
```

Expected:
- one commit created for deployment documentation changes

---

### Task 6: Run local verification before any completion claim

**Files:**
- Verify only: repository root, workflow file, version files, docs

- [ ] **Step 1: Prepare a local build environment if `.env.local` is missing**

If `.env.local` does not exist, create it from the example file before running build verification.

Run:

```bash
Copy-Item .env.example .env.local
```

Then confirm the minimum values needed for local build are present. At minimum, ensure the file provides the variables required by the current build path.

- [ ] **Step 2: Run TypeScript verification**

Run:

```bash
npm exec tsc -- --noEmit
```

Expected:
- exit code `0`
- no new TypeScript errors

- [ ] **Step 3: Run the production build**

Run:

```bash
npm run build
```

Expected:
- exit code `0`
- build completes successfully

- [ ] **Step 4: Inspect the final working tree**

Run:

```bash
git status --short
git log --oneline -5
```

Expected:
- only intended file changes are present or all commits are already recorded
- commit history cleanly reflects workflow, version, README, and DEPLOY changes

- [ ] **Step 5: Perform a final spec-to-files checklist**

Confirm manually that the implementation now matches the approved spec:
- workflow publishes to `ghcr.io/lottshin/nav-atlas`
- `main` -> `latest` + `sha-*`
- `v*` tags -> semver tags
- `v*` tags do **not** also publish `latest`
- manual dispatch does not add arbitrary custom release behavior
- docs preserve `/app/data` + env injection + reverse proxy runtime contract
- version is `1.2.0`

- [ ] **Step 6: Commit any final fixups**

Run only if needed:

```bash
git add .github/workflows/publish-image.yml package.json package-lock.json README.md DEPLOY.md
git commit -m "feat: finalize ghcr publishing support"
```

Skip this step if no additional fixup is needed.

---

### Task 7: Publish and perform GitHub-side follow-up verification

**Files:**
- Verify only: local git branch state, remote repository, GitHub Actions run, GHCR package page

- [ ] **Step 1: Push the feature branch for review/integration**

Push the implementation branch first so the changes are backed up remotely and ready for integration review.

Run example:

```bash
git push -u origin codex/ghcr-image-publishing
```

Important:
- a feature-branch push alone is **not** expected to publish GHCR images
- the publish workflow only becomes operationally verifiable after the change is merged to `main` or a manual dispatch is run on `main`

- [ ] **Step 2: Land the change onto `main` or run `workflow_dispatch` against `main`**

Choose one of these two valid verification paths:

1. merge `codex/ghcr-image-publishing` into `main`, then push `main`
2. if the workflow file is already present on `main`, run a manual dispatch on `main`

Do **not** expect a feature-branch push to create the final GHCR package publication result.

- [ ] **Step 3: Confirm the workflow run appears in GitHub Actions**

Check that the publishing workflow is triggered from the expected event.

Expected:
- a run appears under the repository Actions tab
- the run uses `main` as the effective publish source
- if the run is manual, it is clearly tied to `main`

- [ ] **Step 4: Confirm GHCR package publication**

Verify on GitHub that:
- package name corresponds to `ghcr.io/lottshin/nav-atlas`
- package is linked to `lottshin/nav-atlas`
- `latest` exists after `main` publication

- [ ] **Step 5: Confirm public-pull readiness if that is the target deployment UX**

If the package is still private after first publish, switch visibility as needed.

Then verify an anonymous pull of:

```text
ghcr.io/lottshin/nav-atlas:latest
```

succeeds from a non-authenticated environment.

Example verification shape:

```bash
docker logout ghcr.io
docker pull ghcr.io/lottshin/nav-atlas:latest
```

- [ ] **Step 6: Record any GitHub-side blocker clearly**

If GitHub UI permissions, authentication, or network policy prevent completion, document the exact blocker and stop instead of pretending the image is fully published.

---

## Manual Self-Review Checklist

- [ ] Workflow scope matches the approved spec and does not add Docker Hub or multi-arch scope.
- [ ] Manual dispatch is maintenance-only and does not create a second release system.
- [ ] Image name is exactly `ghcr.io/lottshin/nav-atlas`.
- [ ] Version bump is applied consistently to `package.json` and `package-lock.json`.
- [ ] README remains suitable for a public GitHub repository.
- [ ] `DEPLOY.md` preserves the existing runtime contract around `/app/data`, env injection, and reverse proxy usage.
- [ ] Fresh verification evidence exists for `npm exec tsc -- --noEmit` and `npm run build` before claiming completion.
