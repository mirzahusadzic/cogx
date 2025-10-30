# Gemini Workflow for `cognition-cli`

This document outlines the standard operating procedure for me, Gemini, when developing the `cognition-cli` project. Adhering to this workflow ensures consistency, quality, and alignment with the project's architectural principles.

## Core Principle

All development must be aligned with the CogX blueprint (`../../README.md`). The primary goal is to build a robust, verifiable, and well-tested implementation of this blueprint.

## Development Workflow

When adding a feature or fixing a bug, I will follow these steps in order:

1. **Log the Goal:** Before any action, I will add a new, high-level entry to `../../WORKLOG.md` describing the overall goal.

2. **Write/Update Tests:** All new functionality must be accompanied by tests. All bug fixes must include a regression test. I will use the `vitest` framework and write tests _before_ or _alongside_ the implementation.

3. **Implement the Code:** I will write the application code in TypeScript, adhering to the established project structure and coding style.

4. **Verify Locally:** Before considering a task complete, I must run the full local verification suite:
   1. `npm run format`: Format the code with Prettier.
   2. `npm run lint`: Check for code quality issues with ESLint (for TypeScript) and markdownlint (for Markdown).
   3. `npm test`: Run all unit and integration tests with Vitest.
   4. `npm run build`: Ensure the project compiles successfully with `tsc`.
      I must ensure all checks pass with zero errors.

5. **Update Documentation:** If a change impacts the user-facing CLI, a core concept, or an architectural component, I will update the documentation in the `docs` directory.

6. **Update README.md:** If a change impacts the user-facing CLI, I will update the `src/cognition-cli/README.md` file.

7. **Log the Final Action:** I will add a final entry to `../../WORKLOG.md` summarizing the successful completion of the task (just one line appended at the top of the logs).

8. **Propose a Commit:** After all steps are complete, I will analyze the changes and propose a clear and descriptive `git commit` message.

## Key Commands

A quick reference for project scripts:

| Command            | Description                                       |
| ------------------ | ------------------------------------------------- |
| `npm test`         | Run all tests with Vitest.                        |
| `npm run lint`     | Check for code quality errors with ESLint.        |
| `npm run format`   | Format the entire codebase with Prettier.         |
| `npm run build`    | Compile the TypeScript project.                   |
| `npm run dev`      | Run the CLI in development/watch mode with `tsx`. |
| `npm run docs:dev` | Start the local VitePress documentation server.   |

## Project Conventions

- **Logging:** All development steps are logged in `../../WORKLOG.md`.

- **Source Control:** The `.open_cognition` directory is a generated artifact and **must not** be committed to Git.

- **Commit Messages:** Keep messages lean but descriptive, using the imperative mood (e.g., "Add feature" not "Added feature"). The subject line must not exceed 88 characters. For multiline messages, use `git commit -F <file>` to avoid escaping issues.

- **Dependencies:** The `eGemma` server at `http://localhost:8000` is a required dependency for any tasks involving LLMs or remote parsing.
