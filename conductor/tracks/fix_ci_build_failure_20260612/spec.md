# Specification - Fix GitLab CI Build Failure

## Overview
The GitLab CI/CD build fails when building the Docker image for the target architecture `linux/arm64`. The failure occurs in the `builder` stage and final stage during `npm ci` executions, failing with `qemu: uncaught target signal 4 (Illegal instruction) - core dumped`.

This is a well-known issue of compatibility between Alpine-based Node images (`node:alpine` using `musl libc`) and QEMU's emulation of `linux/arm64` on `linux/amd64` runners in GitLab CI. Switching the base image of the Docker containers to a Debian-based slim version (`node:slim` using `glibc`) is a reliable solution to avoid these emulation limitations.

## Requirements
- Modify `Dockerfile` to change the base images from `node:22-alpine` to `node:22-slim`.
- Verify the change does not disrupt the application's runtime or testing suite.
- Update `docs/diagnostics.md` to document the error mapping, its root cause, and the resolution.
- Keep `README.md` under 50 lines by moving detailed setup, CORS configuration, running, and testing instructions to a new document: `docs/setup.md`.

## Acceptance Criteria
1. The `Dockerfile` must build without errors for both `linux/amd64` and `linux/arm64`.
2. All 108 unit/integration tests must pass successfully on the local development environment.
3. `docs/diagnostics.md` has the technical error mapping for this QEMU target signal 4 issue.
4. `README.md` is less than 50 lines, functioning solely as a map to `/docs`.
5. A new `docs/setup.md` document exists and fully contains the content previously housed in `README.md`.
