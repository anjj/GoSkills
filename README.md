# GoSkills

A minimalist internal LMS for video-based knowledge pills.

[![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20Node.js%20%7C%20Firebase%20%7C%20AWS-blue)](#tech-stack)
[![Documentation](https://img.shields.io/badge/Docs-RAG--Ready-green)](./docs/how-it-works.md)

## 📖 Documentation
- [**How it Works**](./docs/how-it-works.md): High-level overview of the platform.
- [**Business Rules**](./docs/business-rules.md): Logic, validations, and constraints.
- [**Diagnostics**](./docs/diagnostics.md): Error mapping and troubleshooting guide.

## Setup Instructions

### 1. Prerequisites
- Node.js installed.
- [pnpm](https://pnpm.io/) installed (recommended over npm for more efficient, disk-space-friendly dependency management). Install it with `npm install -g pnpm`.
- An AWS Account with an S3 bucket configured for CORS (to allow video uploads and playback).
- A Firebase project configured with Firestore and Authentication.

1. **Install:** `npm install`
2. **Configure:** Copy `.env.example` to `.env` and fill in your secrets.
3. **Run:** `npm run dev` (Starts Vite + Express server).

```env
# AWS Credentials for S3 Video Storage
AWS_ACCESS_KEY_ID="your_aws_access_key"
AWS_SECRET_ACCESS_KEY="your_aws_secret_key"
AWS_REGION="your_aws_region"
AWS_S3_BUCKET="your_bucket_name"

# Admin Panel Access Password
ADMIN_ACCESS="your_secure_password"

# Restrict Access to specific Email Domains (Comma-separated)
ALLOW_DOMAINS="gmail.com,yourcompany.com"

# Firebase Configuration
VITE_FIREBASE_PROJECT_ID="your_firebase_project_id"
VITE_FIREBASE_APP_ID="your_firebase_app_id"
VITE_FIREBASE_API_KEY="your_firebase_api_key"
VITE_FIREBASE_AUTH_DOMAIN="your_firebase_auth_domain"
VITE_FIREBASE_FIRESTORE_DATABASE_ID="your_firebase_firestore_database_id"
VITE_FIREBASE_STORAGE_BUCKET="your_firebase_storage_bucket"
VITE_FIREBASE_MESSAGING_SENDER_ID="your_firebase_messaging_sender_id"
VITE_FIREBASE_MEASUREMENT_ID="your_firebase_measurement_id"
```

### 3. AWS S3 CORS Configuration
To allow the platform to upload and read videos from your AWS S3 bucket, ensure your bucket's CORS (Cross-Origin Resource Sharing) policy is configured exactly as follows:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "POST", "GET"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": []
  }
]
```

### 4. Running the Project
This project uses Vite and a Node.js Express server to handle API routes like the AWS S3 interactions.

1. **Install Dependencies:**
   ```bash
   pnpm install
   ```

2. **Start the server:**
   ```bash
   pnpm dev
   ```
   *The server runs on port 3000.*

3. **Production Build:**
   ```bash
   pnpm build
   pnpm start
   ```

## Key Technologies
- **Frontend:** React, Tailwind CSS, Lucide Icons
- **Backend Setup:** Node.js, Express, Vite
- **Storage:** AWS S3 (Integration via `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`)
- **Database & Identity:** Firebase (Firestore & Auth)
- **Testing:** Vitest, React Testing Library, Supertest

## Testing

The project ships with a Vitest-based test suite covering both the Express API
and the React frontend (with mocked Firebase, AWS, and XHR layers).

```bash
# Run the test suite once
pnpm test

# Run in watch mode while developing
pnpm test:watch

# Generate the coverage report (HTML output in ./coverage)
pnpm test:coverage
```

Current coverage (v8 provider):

| Metric     | Coverage |
|------------|---------:|
| Statements |   83.02% |
| Branches   |   82.52% |
| Functions  |   78.19% |
| Lines      |   84.15% |
