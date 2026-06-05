# Specification: Fix bug video finished not being marked as Viewed

## Overview

When a learner finishes watching a video, the chapter should be automatically marked as completed, and the course progress should update accordingly in Firestore. This is currently broken for YouTube-embedded chapters: the `<iframe>` element used to render YouTube videos does not fire a native `onEnded` DOM event that our code can capture, so `markChapterCompleted` is never called.

The bug only affects YouTube-hosted chapters. Chapters backed by S3/direct-URL videos use the `<CustomVideoPlayer>` (a native `<video>` element) which correctly fires `onEnded` and calls the API.

---

## Root Cause

In `src/components/VideoPlayer.tsx`, the chapter completion handler is wired as:

```tsx
<CustomVideoPlayer
  ...
  onEnded={() => markChapterCompleted(currentChapter.id)}
/>
```

However, when the chapter URL is a YouTube link, the component renders an `<iframe>` **without any completion callback**:

```tsx
<iframe
  src={...}
  className="w-full h-full"
  allowFullScreen
  allow="..."
/>
```

There is no mechanism to detect that the YouTube video has ended, so `markChapterCompleted` is never invoked.

---

## Functional Requirements

1. **FR-1**: When a learner finishes a YouTube-embedded video chapter, the chapter MUST be automatically marked as completed in Firestore (via `POST /api/progress/chapter-completed`).
2. **FR-2**: The completion event for YouTube chapters must be detected using the [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference) (`YT.PlayerState.ENDED`).
3. **FR-3**: The existing completion logic for S3/direct-URL videos MUST remain unchanged.
4. **FR-4**: The `hasCalledEnded` guard (idempotency) MUST also apply to YouTube chapters to prevent double-completion.
5. **FR-5**: When a user switches to a different chapter, any YouTube player listener from the previous chapter MUST be cleaned up to avoid stale events.

---

## Non-Functional Requirements

- **NFR-1**: The fix must not introduce a global `window.onYouTubeIframeAPIReady` conflict if the YouTube API script is already loaded.
- **NFR-2**: The YouTube IFrame API script must be loaded lazily (only when a YouTube chapter is displayed), not on every page load.
- **NFR-3**: No changes to the backend (`server.ts`) are required.

---

## Acceptance Criteria

- [ ] **AC-1**: Watching a YouTube chapter to the end updates the chapter's completion state in the sidebar (green `CheckCircle` icon appears).
- [ ] **AC-2**: Watching a YouTube chapter to the end updates the overall course progress counter (e.g., "2 de 3 capítulos completados").
- [ ] **AC-3**: When ALL chapters (including YouTube ones) are completed, the sidebar displays "Curso Completado".
- [ ] **AC-4**: Watching a direct-video (S3) chapter to the end still correctly marks it as completed (no regression).
- [ ] **AC-5**: `markChapterCompleted` is called exactly once per chapter completion, even if the YouTube API fires the `ENDED` state multiple times or the user scrubs back.
- [ ] **AC-6**: A unit test covers the YouTube chapter completion path (mocking the YT IFrame API).

---

## Out of Scope

- Tracking partial progress (e.g., timestamp of where the user stopped) — only full completion is required.
- Supporting other embedded video providers (Vimeo, Loom, etc.) — only YouTube is addressed in this track.
- Any changes to the Admin Panel or video upload logic.
