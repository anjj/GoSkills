# Project Instructions (GoSkills)

This repository follows the **Golive Documentation-Driven Development** standards. These instructions are foundational and take precedence over general workflows.

## 🛠️ Conductor & Implementation Workflow

### 1. Domain Knowledge First
Before proposing any implementation plan or modifying code, you MUST explore and read relevant files in `docs/` to ensure alignment with existing patterns and business logic.

### 2. Implementation Pre-flight (Git Hygiene)
Before beginning any file modifications:
- **Check Status:** Run `git status` to ensure a clean working directory.
- **Branching:** If not already on a dedicated feature branch, suggest or perform a branch creation (e.g., `git checkout -b feature/<track-id>`) to ensure changes are isolated.
- **Never Commit:** Do not commit changes; leave them staged or unstaged for the user to review.

### 3. Documentation for Knowledge Transfer (RAG-Ready)
Implementation is not complete until documentation in `docs/` is updated or created.
- **Target Audience:** Write for consultants and RAG systems. Focus on business logic, user impact, and "the why" rather than code implementation details.
- **Mandate:** Every implementation plan MUST include a dedicated "Documentation Updates" step.

### 4. Repository Aesthetics
- Maintain a minimalistic `README.md` at the project root with clear links to primary domain documentation in the `docs/` folder.
- Use **Tech Stack Badges** with versions (e.g., Node.js v20, React v18).

## 💡 Specialized Skills

### `doc-driven-planning`
Use this skill during the planning phase of any new feature or fix. It ensures that the plan respects the documentation-first culture and git hygiene mandates.
**Location:** `.gemini/skills/doc-driven-planning/SKILL.md`

---
*Derived from Golive Documentation-Driven Conductor extension.*
