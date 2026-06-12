# Setup & Development Guide

This guide details how to set up, configure, run, and test the GoSkills project locally and in production.

---

## 🛠️ Prerequisites

To run this project, you will need the following tools installed on your system:
- **Node.js** (v22 or higher)
- **pnpm** (recommended package manager for efficiency and disk-space optimization). If not installed, run:
  ```bash
  npm install -g pnpm
  ```
- An **AWS Account** with an S3 bucket configured for Cross-Origin Resource Sharing (CORS) to store and stream video files.
- A **Firebase Project** with Firestore database and Firebase Authentication configured.

---

## ⚙️ Configuration & Environment Variables

Copy the `.env.example` file to create your own local `.env` file:
```bash
cp .env.example .env
```

Fill in the environment variables with your project credentials:

| Variable | Description |
|----------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS IAM access key ID. |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret access key. |
| `AWS_REGION` | The region of your AWS S3 bucket (e.g., `us-east-1`). |
| `AWS_S3_BUCKET` | The name of the AWS S3 bucket. |
| `ADMIN_ACCESS` | A secret password to access and elevate admin panel controls. |
| `ALLOW_DOMAINS` | A comma-separated list of whitelisted email domains allowed to sign in. |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID. |
| `VITE_FIREBASE_APP_ID` | Firebase Application ID. |
| `VITE_FIREBASE_API_KEY` | Firebase API Key (public client-side identifier). |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Authentication domain. |
| `VITE_FIREBASE_FIRESTORE_DATABASE_ID` | Firestore Database ID (defaults to `(default)`). |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket name. |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging sender ID. |
| `VITE_FIREBASE_MEASUREMENT_ID` | Firebase Measurement ID (for analytics). |

---

## 🪣 AWS S3 CORS Configuration

To allow the web application to perform direct uploads and request videos, ensure your S3 bucket's CORS (Cross-Origin Resource Sharing) policy is configured exactly as follows:

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

---

## 🚀 Running the Project

The project integrates a React client with an Express API server.

### 1. Install Dependencies
Ensure you install dependencies using `pnpm`:
```bash
pnpm install
```

### 2. Run in Development Mode
Start the local development server (runs both the Vite bundler and backend Express API):
```bash
pnpm dev
```
By default, the development environment will be accessible at: `http://localhost:3000`.

### 3. Build & Run for Production
To package and build the application for production use:
```bash
pnpm build
pnpm start
```

---

## 🧪 Testing

The repository includes a comprehensive test suite using **Vitest** for both the backend Express API and the React frontend components.

Run the test suite using one of these commands:

```bash
# Run tests once
pnpm test

# Run tests in watch mode during development
pnpm test:watch

# Generate code coverage reports (saved as HTML in ./coverage)
pnpm test:coverage
```

### Coverage Quality Gates
New features and modifications are expected to maintain or improve coverage, target:
- **Statements**: >80%
- **Branches**: >80%
- **Lines**: >80%
