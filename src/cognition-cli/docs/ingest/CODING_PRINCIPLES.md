# Coding Principles

> _Rigorous types and clear boundaries enable safe evolution._

## Philosophy

**Types are the verifiable contract of our system.**

We believe that a strong type system is the first line of defense against cognitive drift. In Cognition CLI, we use TypeScript not just as a linter, but as a formal specification of the system's capabilities. If it compiles, it should handle its edge cases.

**We prefer explicit complexity over implicit magic.**

## Principles

### 1. Strict Type Safety

**Any is not an option.**

We do not use `any`. We define interfaces for everything. The PGC relies on structured data, and loose typing corrupts that structure.

What this means:

- ✅ **Define Interfaces** — Every data structure passed between components has a named interface.
- ✅ **Use Discriminated Unions** — For state machines and message passing.
- ✅ **Use Generics Wisely** — To preserve type information through transformations.
- ❌ **Avoid `as any`** — It breaks the contract.
- ❌ **Avoid Implicit Returns** — Be explicit about what functions return.

### 2. Functional Core, Imperative Shell

**Logic is pure; side effects are isolated.**

Core business logic (analyzers, algebra, concept extraction) should be pure functions that take data and return data. Side effects (file I/O, network calls, terminal output) should be pushed to the boundaries (commands, TUI).

What this means:

- ✅ **Pure Functions** — Analyzers take an AST and return a result, touching nothing else.
- ✅ **Dependency Injection** — Pass services into orchestrators.
- ❌ **Global State** — Avoid module-level mutable variables.
- ❌ **Hidden I/O** — Don't read files deep inside a utility function.

### 3. Error Handling as Values

**Failures are part of the domain model.**

We prefer typed error results over throwing exceptions for expected failure modes. This forces the consumer to handle the failure case explicitly.

Practices:

- ✅ **Result Types** — Return `{ success: true, data: T } | { success: false, error: E }`.
- ✅ **Custom Error Classes** — `PGCInitializationError`, `NetworkError` for specific catch handling.
- ❌ **Throwing Strings** — `throw "error"` is forbidden.

### 4. Component Modularity

**High cohesion, low coupling.**

Each module (TUI, Core, Sigma, LLM) should have a clear public API. Internals should be hidden.

### 5. Documentation as Code

**If it isn't documented, it doesn't exist.**

Code comments are good, but structure is better. We use self-documenting names and explicit TSDoc comments for public APIs.

## Practices

### Things We Do

- ✅ **Use Async/Await** — Modern concurrency patterns.
- ✅ **Prettier/Eslint** — Automated formatting and linting.
- ✅ **Test Driven Development** — Write the test case for the bug before fixing it.
- ✅ **Immutable by Default** — Mutate only when performance demands it.
- ✅ **Clean Imports** — Use path aliases (`@/core`, `@/utils`) to keep imports readable.

### Things We Avoid

- ❌ **Magic Numbers** — Define constants.
- ❌ **Deep Nesting** — Return early to reduce complexity.
- ❌ **God Objects** — Split massive classes into focused responsibilities.
- ❌ **Commented Out Code** — Delete it; git remembers.
- ❌ **Console Logs** — Use the logger service, not `console.log`.

## Code Quality Standards

### Naming Conventions

- **PascalCase** — Classes, Interfaces, Types, React Components.
- **camelCase** — Variables, functions, methods, instances.
- **UPPER_SNAKE_CASE** — Constants.
- **kebab-case** — Filenames.

### React/TUI

- **Functional Components** — Use hooks, not classes.
- **Effect Discipline** — `useEffect` dependencies must be exhaustive.
- **Custom Hooks** — Extract logic from UI components.

## Summary

**We write code for the human who will maintain it next.**

Our codebase is a living document of our understanding. By adhering to these principles, we ensure that Cognition CLI remains robust, understandable, and extensible as it scales to handle millions of lines of code.
