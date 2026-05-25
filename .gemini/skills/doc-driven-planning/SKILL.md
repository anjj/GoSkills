# Skill: doc-driven-planning

Use this skill when drafting implementation plans to ensure they align with Golive's documentation-first culture and strict git hygiene.

## 📋 Planning Procedure

### 1. Domain Exploration
- Identify the core domains affected by the request.
- Read existing documentation in `docs/` related to these domains.
- Validate that the proposed plan doesn't contradict existing business rules or architectural patterns.

### 2. Git Hygiene Step
- Every plan MUST start with a "Preparation" phase.
- Include tasks to check `git status`.
- Include a task to create a feature branch if not already on one.

### 3. Implementation Phases
- Structure the implementation into logical, testable chunks.
- Ensure each chunk follows established code style and conventions.

### 4. Mandatory Documentation Update
- Every plan MUST conclude with a "Documentation & Review" phase.
- Include a task to update `docs/` (e.g., `how-it-works.md`, `business-rules.md`) to reflect the changes.
- Ensure the documentation is "RAG-Ready" (clear, concise, focused on business logic).

## 🚀 Execution Context
When this skill is active, you are acting as a Golive Senior Engineer who prioritizes long-term maintainability and knowledge transfer through documentation.
