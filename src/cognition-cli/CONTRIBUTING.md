# Contributing to cognition-cli

## Pre-Commit Checklist: F.L.T.B

**IMPORTANT:** Before committing any changes, you MUST run the F.L.T.B. pipeline:

```bash
# F - Format
npm run format

# L - Lint
npm run lint

# T - Test
npm run test

# B - Build
npm run build
```

### Quick Command

Run all checks in sequence:

```bash
npm run format && npm run lint && npm run test && npm run build
```

### Why F.L.T.B?

- **Format**: Ensures consistent code style across the project
- **Lint**: Catches potential bugs and enforces code quality
- **Test**: Verifies all functionality works as expected
- **Build**: Confirms the project compiles without errors

### CI/CD

All pull requests will automatically run these checks. Failures will block merging.

## Development Workflow

1. Make your changes
2. Run F.L.T.B. (`npm run format && npm run lint && npm run test && npm run build`)
3. Commit your changes
4. Push to your branch
5. Create a pull request

## Common Issues

### Tests Failing Locally with WORKBENCH_API_KEY

If you see "Unhandled Error: Unexpected message on Worker" when running tests with `WORKBENCH_API_KEY` set, this is a known harmless warning that doesn't affect test results or CI/CD (where the key is not set).

### Worker Processes Hanging

If you encounter hanging worker processes consuming CPU:

- Kill them: `ps aux | grep node | grep vitest` then `kill -9 <PID>`
- This should not happen with the current codebase (we use worker threads, not child processes)

## Code Style

- Use TypeScript strict mode
- Follow existing patterns in the codebase
- Add tests for new features
- Document complex logic with comments
- Use meaningful variable and function names

## Testing

- Write unit tests for new functions
- Add integration tests for new commands
- Mock external dependencies (workbench API, file system)
- Ensure tests are deterministic (no flaky tests)

## Commit Messages

Use conventional commits format:

```text
type(scope): description

- feat: New feature
- fix: Bug fix
- docs: Documentation changes
- test: Test changes
- refactor: Code refactoring
- chore: Maintenance tasks
```

Example:

```text
fix(workers): switch from child processes to threads

Changed all worker pools to use worker_threads instead of child processes
to prevent zombie processes from consuming CPU.
```
