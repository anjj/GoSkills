# Implementation Plan: Fix bug video finished not being marked as Viewed

## Phase 1: Investigation & Test Setup

- [x] Task: Read and understand the current VideoPlayer implementation
    - [x] Read `src/components/VideoPlayer.tsx` focusing on `CustomVideoPlayer`, `markChapterCompleted`, and the YouTube iframe rendering branch.
    - [x] Read existing tests in `tests/VideoPlayer.test.tsx` and `tests/VideoPlayerEnhancements.test.tsx` to understand test patterns and mocking strategy.
    - [x] Confirm the root cause: the YouTube `<iframe>` has no `onEnded` callback wired.

- [x] Task: Write failing tests for YouTube chapter completion (Red Phase)
    - [x] In `tests/VideoPlayer.test.tsx` (or a new `tests/VideoPlayerYouTube.test.tsx`), add a test that:
        1. Renders a `VideoPlayer` with a course whose first chapter is a YouTube URL.
        2. Simulates the YouTube IFrame API firing `YT.PlayerState.ENDED`.
        3. Asserts that `fetch` was called with `POST /api/progress/chapter-completed` and the correct `chapterId`.
    - [x] Add a test verifying idempotency: firing `ENDED` twice results in only one API call.
    - [x] Run `CI=true npm test` and confirm the new tests fail as expected (Red Phase).

- [ ] Task: Conductor - User Manual Verification 'Phase 1: Investigation & Test Setup' (Protocol in workflow.md)

## Phase 2: Implementation

- [x] Task: Implement YouTube IFrame API integration in `VideoPlayer.tsx`
    - [x] Create a `loadYouTubeAPI()` utility function that lazily loads the YouTube IFrame API script (`https://www.youtube.com/iframe_api`) only once (guard against double-loading).
    - [x] Refactor the YouTube `<iframe>` branch in `VideoPlayer.tsx`:
        - [x] Assign a unique `id` to the iframe (e.g., `yt-player-${currentChapter.id}`).
        - [x] Call `loadYouTubeAPI()` when the YouTube chapter is active.
        - [x] After the API is ready, instantiate a `YT.Player` object targeting the iframe.
        - [x] In the `YT.Player`'s `onStateChange` handler, call `markChapterCompleted(currentChapter.id)` when `event.data === YT.PlayerState.ENDED`.
    - [x] Apply the `hasCalledEnded` guard to the YouTube completion path to ensure idempotency.
    - [x] In `useEffect` cleanup (triggered when `currentChapterIndex` or `currentChapter.id` changes), call `ytPlayer.destroy()` to dispose the previous player and prevent stale event listeners.
    - [x] Run `CI=true npm test` and confirm all tests pass (Green Phase).

- [x] Task: Refactor and clean up (Refactor Phase)
    - [x] Extract the YouTube player logic into a custom hook (`useYouTubePlayer`) and a presentational `YTChapterPlayer` component to keep `VideoPlayer.tsx` focused.
    - [x] Ensure TypeScript types are correct (added inline interfaces for the `YT` global via `declare global`).
    - [x] Run `CI=true npm test` one more time to confirm no regressions — **112/112 tests pass**.

- [ ] Task: Conductor - User Manual Verification 'Phase 2: Implementation' (Protocol in workflow.md)

## Phase 3: Review & Documentation

- [ ] Task: Run full test suite and verify coverage
    - [ ] Run `CI=true npm run test:coverage` and verify the new code paths achieve ≥90% coverage.
    - [ ] Fix any coverage gaps.

- [ ] Task: Manual end-to-end verification
    - [ ] Start the dev server (`npm run dev`).
    - [ ] Navigate to a course with a YouTube chapter.
    - [ ] Watch the YouTube video to the end and confirm the sidebar shows the `CheckCircle` icon for that chapter.
    - [ ] Confirm the progress counter updates (e.g., "1 de 2 capítulos completados").
    - [ ] Navigate to a course with an S3/direct video chapter and confirm it still works correctly (no regression).

- [ ] Task: Update documentation
    - [ ] Update `docs/how-it-works.md` to reflect that YouTube chapters now also trigger completion tracking.
    - [ ] Update `docs/business-rules.md` if any relevant business rules changed (e.g., note that completion works for both S3 and YouTube chapters).

- [ ] Task: Conductor - User Manual Verification 'Phase 3: Review & Documentation' (Protocol in workflow.md)
