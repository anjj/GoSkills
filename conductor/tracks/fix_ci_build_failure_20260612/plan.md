# Implementation Plan - Fix GitLab CI Build Failure

This plan outlines the steps required to resolve the GitLab CI build failure for `linux/arm64` and adhere to the Documentation-Driven Development guidelines.

## Phase 1: Dockerfile Update
- [x] Task: Modify `Dockerfile` to change `node:22-alpine` to `node:22-slim` in both build stages.
- [x] Task: Verify the Dockerfile changes by building the Docker image locally if possible, or confirming syntax correctness. (Checked syntax and base image; local docker command requires root docker.sock permission).
- [x] Task: Add `VITE_MICROSOFT_TENANT_ID` as an ARG and ENV in the builder stage of the `Dockerfile`.

## Phase 2: Repository Aesthetics & Minimalist README
- [x] Task: Extract setup, CORS configuration, running, and testing instructions from `README.md` and move them to `docs/setup.md`.
- [x] Task: Reduce `README.md` to under 50 lines, functioning as a clean index/map pointing to `/docs/` and displaying tech badges.

## Phase 3: Diagnostics & Tech Stack Documentation Updates
- [x] Task: Update `docs/diagnostics.md` to document the QEMU target signal 4 illegal instruction error mapping and resolution.
- [x] Task: Update `conductor/tech-stack.md` to reflect the change to `node:22-slim` in the deployment section.

## Phase 4: CI/CD Workflow Update
- [x] Task: Update `.github/workflows/ci.yml` to pass `VITE_MICROSOFT_TENANT_ID` to the docker build-args from GitHub Secrets.

## Phase 5: Verification and Review
- [x] Task: Run `npm test` to verify that all tests pass locally.
- [x] Task: Invoke the `doc-driven-review` skill to perform cross-domain impact review. (Executed, no business domains impacted, only Infrastructure/CI-CD).
- [x] Task: Conductor - User Manual Verification 'Fix GitLab CI Build Failure' (Protocol in workflow.md)
