# Cognition Σ (Sigma)

Cognition Σ is a portable cognitive layer designed for verifiable human-AI symbiosis. It creates a dual-lattice knowledge representation in any repository:

- **Conversation Lattice** (`.sigma/`): Stores conversation memory and semantic context using LanceDB.
- **Project Lattice** (`.open_cognition/`): Stores project-specific knowledge and automated insights (PGC) using LanceDB.

## Project Structure

- `src/sigma`: The context engine. Handles semantic analysis, compression, and reconstruction of context.
- `src/tui`: React/Ink-based terminal interface. Orchestrates agents, tools, and the visual workspace.
- `src/llm`: Multi-provider abstraction layer for Gemini, Claude, and OpenAI agents.
- `src/ipc`: ZeroMQ-based communication bus for multi-agent coordination.
- `src/core`: Core foundations, algebra, and shared utilities.
- `src/core/pgc`: Project Knowledge Store management.

## Self-Sufficient Loops

Agents are expected to verify their own work autonomously. Before concluding a task, ensure the project remains in a healthy state by running the following sequence:

1. **Build**: `npm run build`
2. **Format & Lint (Changed Files Only)**: `npm run format:changed && npm run lint:changed`
3. **Test**: `npm test <file>` (for targeted verification) or `npm run test` (for the full suite).

## Rules for Agents

- **Implementation Verification**: Every implementation task MUST end with the execution of the relevant self-sufficient loop commands (build, lint, test) before being marked as completed.
- **Context Hygiene**: Always distill findings into a summary before completing a task to trigger context pruning.
- **Surgical Actions**: Use `grep` and targeted `read_file` (with offset/limit) to minimize token usage. Do not read entire large files if avoidable.
- **Verification**: Never assume a fix works; always run the relevant build/test command before marking a task as completed.
- **No Interactive Tools**: NEVER use `npx vitest` as it enters an interactive mode that blocks the workflow. ALWAYS use `npm test <file>` which is configured to run in CI mode (non-interactive).

## Commit Message Instructions

Generate commit messages by strictly following the template below. Omit categories for small diffs.

```text
type(scope): imperative short description (max 72 chars)

<1-2 sentences explaining WHY the change was made and high-level impact. Hard-wrap at 88 chars.>[Category Name] (Only for large/multi-domain commits)
- <Imperative verb> + <explanation of WHAT changed, wrapped at 88 chars>.

Refs: <Ticket/Link>
```
