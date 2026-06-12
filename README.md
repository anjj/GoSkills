# GoSkills

A minimalist internal LMS for video-based knowledge pills.

[![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20Node.js%20%7C%20Firebase%20%7C%20AWS-blue)](#tech-stack)
[![Documentation](https://img.shields.io/badge/Docs-RAG--Ready-green)](./docs/how-it-works.md)

## 📖 Documentation Directory

To keep this repository clean and maintainable, all key documentation and business logic details are hosted inside the `/docs` folder:

- [**How it Works**](./docs/how-it-works.md): High-level business overview and flow.
- [**Setup & Development**](./docs/setup.md): Prerequisites, configuration, S3 bucket settings, running the server, and running tests.
- [**Business Rules**](./docs/business-rules.md): Validation logic, constraints, and platform invariants.
- [**Diagnostics Guide**](./docs/diagnostics.md): Error code mappings, failure descriptions, and troubleshooting steps.

## 🛠️ Quick Start

1. **Setup Environment**: Copy `.env.example` to `.env` and configure your credentials.
2. **Install & Start**:
   ```bash
   pnpm install
   pnpm dev
   ```
3. **Verify**: Open `http://localhost:3000` to verify your local instance.
