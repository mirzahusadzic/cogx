# Onboard SIGMA.md

This command initializes or updates the `SIGMA.md` file in the project root. `SIGMA.md` is the "Operating Manual" for AI agents, defining project structure, self-sufficient loops, and core operating rules.

## Context & Purpose

When an agent starts working on a project, its first task is to read `SIGMA.md`. This file provides the "ground truth" for how the project should be built, tested, and modified.

## The Process

### Step 1: Analyze Project Landscape

Explore the project to understand its core modules and automation.

1. **Map `src/`**: List subdirectories in `src/` and identify their primary responsibilities.
2. **Detect Tech Stack**: Identify the primary language (TS, Rust, Python, etc.) and package manager.
3. **Discover Loops**: Find the scripts for `build`, `lint`, and `test` (e.g., in `package.json`, `Makefile`, or `Taskfile.yml`).

### Step 2: Draft SIGMA.md

Construct the `SIGMA.md` file using the following template.

---
# [Project Name]

[A 1-2 sentence description of what this project does and its core value proposition.]

## Project Structure

[List core directories in src/ with a one-line description of their role.]

- `src/[dir1]`: [Description]
- `src/[dir2]`: [Description]

## Self-Sufficient Loops

Agents are expected to verify their own work autonomously. Before concluding a task, ensure the project remains in a healthy state by running the following sequence:

1. **Build**: `[Exact build command, e.g., npm run build]`
2. **Format & Lint (Changed Files Only)**: `[Exact lint command, e.g., npm run lint:changed]`
3. **Test**: `[Exact test command, e.g., npm run test]` (Ensure it is non-interactive/CI mode)

## Rules for Agents

- **Implementation Verification**: Every implementation task MUST end with the execution of the relevant self-sufficient loop commands (build, lint, test) before being marked as completed.
- **Context Hygiene**: Always distill findings into a summary before completing a task to trigger context pruning.
- **Surgical Actions**: Use `grep` and targeted `read_file` (with offset/limit) to minimize token usage. Do not read entire large files if avoidable.
- **Verification**: Never assume a fix works; always run the relevant build/test command before marking a task as completed.
- **No Interactive Tools**: NEVER use interactive test runners or watchers. ALWAYS use CI-friendly, non-interactive modes.

## Commit Message Instructions

Generate commit messages by strictly following the template below. Omit categories for small diffs.
**CRITICAL: Pass the entire message as a single `-m` chunk to git (using newline escapes if necessary) to ensure correct formatting and whitespace preservation.**

```text
type(scope): imperative short description (max 72 chars)

<1-2 sentences explaining WHY the change was made and high-level impact. Hard-wrap at 88 chars.>[Category Name] (Only for large/multi-domain commits)
- <Imperative verb> + <explanation of WHAT changed, wrapped at 88 chars>.

Refs: <Ticket/Link>
```

---

## Step 3: Deployment

Write the final content to `SIGMA.md` in the root of the project.

### Verification

Once written, confirm that:

1. All paths in "Project Structure" exist.
2. Build/Test commands are valid and runnable.
