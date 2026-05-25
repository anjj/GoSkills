# GoSkills: How it Works

GoSkills is a minimalist Learning Management System (LMS) designed for internal knowledge sharing via video "pills." It allows experts to upload structured courses and learners to track their progress.

## Core Flow
1. **Authentication**: Users sign in via Google Auth. Access can be restricted to specific email domains.
2. **Course Discovery**: Learners browse courses categorized by department (Ventas, Tecnología, etc.).
3. **Consumption**: Learners watch videos and read chapter descriptions.
4. **Administration**: Admins manage the catalog, uploading videos to AWS S3 and saving course metadata to Firebase Firestore.

## Business Domains
- **User Management**: Identity via Firebase Auth + domain-based access control.
- **Content Management**: Course structures (Chapters, Thumbnails, Categories).
- **Video Infrastructure**: Secure storage on AWS S3 with time-limited playback URLs.
- **Progress Tracking**: Real-time persistence of course completion status.
