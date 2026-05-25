# Business Rules & Validations

## Course Management
- **Mandatory Fields**: Every course must have a title, a category, and at least one chapter.
- **Chapter Integrity**: Each chapter must contain both a title and a valid video asset (URL or S3 file).
- **Video Formats**: Supported formats for upload are currently restricted to `.webm` and `.mp4`.
- **Identity Restriction**: Course creation and modification are restricted to users who can provide the `ADMIN_ACCESS` password (managed via server-side verification).

## Access Control
- **Domain Whitelisting**: If `ALLOW_DOMAINS` is configured, only users with those email domains can access the platform.
- **Admin Elevation**: Admin status is determined by the server comparing a provided secret against the environment configuration.

## Data Invariants
- **Email Immutability**: A user's email is set at creation and cannot be changed.
- **Progress Ownership**: Users can only read and write their own progress documents.
