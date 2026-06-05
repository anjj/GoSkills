# Specification: Fix bug video finished not being marked as Viewed

## Overview

When a learner finishes watching a video, the chapter should be automatically marked as completed and the course progress updated accordingly in Firestore. This is **not happening** — the completion API call (`POST /api/progress/chapter-completed`) returns **401 Unauthorized**, so the Firestore write never occurs.

All videos are hosted on AWS S3 and played through the `CustomVideoPlayer` component. The client-side completion trigger (`onEnded` / 99.5% fallback) fires correctly, but the server rejects the request due to misconfigured Firebase Admin SDK credentials.

---

## Root Cause

The Express server (`server.ts`) uses Firebase Admin SDK to verify the user's ID token before writing to Firestore. The Admin SDK is initialized via:

```ts
adminApp = initializeApp(
  serviceAccount
    ? { credential: cert(JSON.parse(serviceAccount)) }
    : { credential: applicationDefault() }
);
```

The `.env` file contains only the **client-side** `VITE_FIREBASE_*` keys. There is no `FIREBASE_SERVICE_ACCOUNT` variable and no Application Default Credentials (`GOOGLE_APPLICATION_CREDENTIALS`) configured. As a result:

1. `getAdminApp()` falls back to `applicationDefault()`
2. `applicationDefault()` fails silently at startup (lazy init)
3. `verifyIdToken(idToken)` throws a credential error
4. The `catch` block returns `401 { error: "invalid_token" }`

The client-side code in `VideoPlayer.tsx` is **correct**: it calls `auth.currentUser.getIdToken()` and sends the token in the `Authorization: Bearer <token>` header. The video `onEnded` event is also correctly wired.

---

## Functional Requirements

1. **FR-1**: When the server receives `POST /api/progress/chapter-completed` with a valid Firebase ID token, it MUST successfully verify the token and write to Firestore.
2. **FR-2**: The fix MUST NOT require code changes to the client (`VideoPlayer.tsx`) — the client implementation is already correct.
3. **FR-3**: The server MUST log a meaningful error message when token verification fails (instead of swallowing the exception), to aid future debugging.
4. **FR-4**: The `FIREBASE_SERVICE_ACCOUNT` environment variable MUST be documented in `.env.example` (or equivalent) so future developers know it is required.

---

## Non-Functional Requirements

- **NFR-1**: The service account JSON key MUST NOT be committed to the repository.
- **NFR-2**: The `.env.example` file should show the expected format of `FIREBASE_SERVICE_ACCOUNT` without exposing real credentials.

---

## Acceptance Criteria

- [ ] **AC-1**: Watching a video to the end updates the chapter's completion state in the sidebar (green `CheckCircle` icon appears).
- [ ] **AC-2**: Watching a video to the end updates the overall course progress counter (e.g., "2 de 3 capítulos completados").
- [ ] **AC-3**: When ALL chapters are completed, the sidebar displays "Curso Completado".
- [ ] **AC-4**: The server console no longer logs `[auth] verifyIdToken failed:` on chapter completion requests.
- [ ] **AC-5**: A `.env.example` file documents the `FIREBASE_SERVICE_ACCOUNT` requirement.

---

## Out of Scope

- Changes to `VideoPlayer.tsx` — client-side code is correct.
- Changes to `server.ts` business logic — only the error logging improvement is kept.
- YouTube or other video provider support.
