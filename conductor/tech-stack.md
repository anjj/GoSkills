# Technology Stack

This document defines the technology stack for the GoSkills project, derived from the existing codebase.

---

## 1. Core Language
- **TypeScript**: Used for both frontend React development and backend Express API coding, ensuring full-stack type safety.

## 2. Frontend Framework & Styling
- **React (v19)**: Component-based UI library.
- **Vite (v6)**: Modern development server and bundler.
- **TailwindCSS (v4)**: Utility-first CSS framework for styles.
- **Lucide React**: Icon library.
- **Motion**: Animation library for smooth transitions.

## 3. Backend & APIs
- **Express (v4)**: Lightweight backend framework serving APIs and client routes.
- **TSX**: TypeScript execute to run the backend files directly.
- **Firebase Admin SDK (v13)**: Used for secure server-side interactions with Firebase.
- **Multer**: Middleware for handling `multipart/form-data` uploads.

## 4. Cloud Services & Databases
- **Firebase (v12)**:
  - **Firestore**: NoSQL document database used to store course metadata, user progress, and categories.
  - **Firebase Authentication**: For user identity and Google Auth.
- **AWS S3**: Secure object storage for course video files, accessed via presigned URLs for playback and uploads.

## 5. Testing
- **Vitest (v4)**: Vite-native unit and integration test framework.
- **React Testing Library**: For component testing.
- **JSDOM**: Browser environment simulation for testing.

## 6. Containerization & Deployment
- **Docker**: Containerization tool for packaging and running the Express/React server.
- **Node.js Base Image (`node:22-slim`)**: Uses a Debian-based slim image with `glibc` to ensure compatibility under QEMU-emulated `linux/arm64` container builds in CI pipelines (preventing SIGILL/illegal instruction crashes seen on `alpine` variants).
