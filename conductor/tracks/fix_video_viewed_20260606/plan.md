# Implementation Plan: Fix bug video finished not being marked as Viewed

## Phase 1: Investigation & Test Setup

- [x] Task: Read and understand the current VideoPlayer implementation
    - [x] Read `src/components/VideoPlayer.tsx` — confirmed `onEnded` and 99.5% fallback correctly fire `markChapterCompleted`.
    - [x] Read `tests/VideoPlayer.test.tsx` and `tests/server.test.ts` to understand test patterns.
    - [x] Identified root cause: `POST /api/progress/chapter-completed` returns **401 Unauthorized** because `FIREBASE_SERVICE_ACCOUNT` in `.env` is double-encoded (outer quotes) causing `JSON.parse` to return a string, not an object. Firebase Admin's `verifyIdToken` then fails.
    - [x] Identified secondary issue: `FIREBASE_SERVICE_ACCOUNT` private key had literal `\\n` instead of real newlines.
    - [x] Confirmed pre-existing broken server tests (3 failures) caused by the same JSON issue.

- [x] Task: Conductor - User Manual Verification 'Phase 1: Investigation & Test Setup'
    - User confirmed: 401 Unauthorized on chapter completion. No YouTube videos exist; all videos are S3-hosted.

## Phase 2: Implementation

- [x] Task: Fix Firebase Admin SDK initialization in `server.ts`
    - [x] Add double-parse guard: if `JSON.parse(serviceAccount)` returns a string, parse again.
    - [x] Normalize `\\n` → real newlines in `private_key` field.
    - [x] Add diagnostic error logging to `verifyIdToken` catch block (was swallowing all errors).
    - [x] Run `CI=true npm test` — **106/106 tests pass**.

- [x] Task: Fix test isolation in `tests/server.test.ts`
    - [x] Delete `FIREBASE_SERVICE_ACCOUNT` in `beforeEach` to prevent real service account JSON from reaching `JSON.parse` when firebase-admin is mocked.
    - [x] 3 previously broken server tests now pass.

- [x] Task: Fix `VideoPlayer.test.tsx` YouTube iframe test
    - [x] Updated test to assert all videos use the native `<video>` element (not iframe), matching actual S3-only architecture.

- [x] Task: Update `.env.example` (FR-4)
    - [x] Added clear documentation: FIREBASE_SERVICE_ACCOUNT is REQUIRED for chapter completion, paste JSON without outer quotes.

- [x] Task: Conductor - User Manual Verification 'Phase 2: Implementation' (Protocol in workflow.md)

## Phase 3: Review & Documentation

- [ ] Task: Run full test suite and verify coverage
    - [ ] Run `CI=true npm run test:coverage` and verify ≥90% coverage.
    - [ ] Fix any coverage gaps.

- [ ] Task: Manual end-to-end verification
    - [ ] Restart the dev server (`npm run dev`).
    - [ ] Navigate to a course, watch a video to the end, confirm the sidebar shows the `CheckCircle` icon.
    - [ ] Confirm the progress counter updates (e.g., "1 de 2 capítulos completados").
    - [ ] Confirm the server console shows NO `[auth] verifyIdToken failed:` errors.

- [ ] Task: Update documentation
    - [ ] Update `docs/` to note that `FIREBASE_SERVICE_ACCOUNT` is required for progress tracking.

- [ ] Task: Conductor - User Manual Verification 'Phase 3: Review & Documentation' (Protocol in workflow.md)
