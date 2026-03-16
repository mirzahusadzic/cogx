# Contributing to Cognition CLI

> **⚠️ This is a solo research project. External contributions are not accepted.**
>
> Cognition CLI is an active, long-term research and engineering project maintained by a single author. It is developed in close collaboration with AI agents (the intended users of the system itself) and is not structured for community contribution workflows.
>
> **What this means:**
> - Pull requests will not be reviewed or merged
> - Issues and feature requests are disabled
> - The project is source-available for learning and forking under AGPLv3
>
> You are welcome to **fork** the project and build your own thing. If you have found a **security vulnerability**, please report it privately via [SECURITY.md](SECURITY.md).
>
> Thank you for your understanding. 🐉

## Why no contributions?

This project evolves through a tight human-AI collaboration loop. The architecture decisions, commit cadence, and design philosophy are deeply personal and intentional. Introducing external contribution workflows would break that loop and introduce coordination overhead that is incompatible with how this project is built.

It is not a reflection of the quality of your ideas — it is a deliberate choice about how this project works best.

## Licensing

The project is licensed under **AGPLv3**. You are free to:
- Read, study, and learn from the code
- Fork and adapt it under the same license
- Use it as inspiration for your own projects

See [LICENSE](LICENSE) for full terms.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to <mirza.husadzic@proton.me>.

## Getting Started

### Prerequisites

- **Node.js** v20.18.1 or later (LTS)
- **npm** v11.x or later
- **Git** for version control
- **Optional**: [eGemma Workbench](https://github.com/mirzahusadzic/egemma) for embeddings and advanced features

### Development Setup

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/YOUR_USERNAME/cogx.git
   cd cogx/src/cognition-cli
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Build the project**

   ```bash
   npm run build
   ```

4. **Run tests**

   ```bash
   npm test
   ```

5. **Link for local development** (optional)

   ```bash
   npm link
   ```

6. **Initialize a test PGC**

   ```bash
   cd /path/to/test/project
   cognition-cli wizard
   ```

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number-description
```

### 2. Make Your Changes

- Write clean, maintainable code
- Follow existing code style (enforced by Prettier and ESLint)
- Add tests for new functionality
- Update documentation as needed

### 3. Run Quality Checks

```bash
# Format code
npm run format

# Lint code
npm run lint

# Run tests
npm test

# Build TypeScript
npm run build

# Build documentation
npm run docs:build
```

All checks must pass before submitting a PR.

### 4. Commit Your Changes

Follow our commit message conventions (see below).

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub.

## Project Architecture

Understanding the architecture will help you contribute effectively:

### The PGC (Persistent Grounded Context)

The PGC is built on **four pillars**:

```bash
.open_cognition/
├── objects/         # Content-addressable immutable storage (SHA-256)
├── transforms/      # Append-only audit trail with fidelity scores
├── index/           # Path → hash mappings
└── reverse_deps/    # O(1) dependency lookup
```

### The Seven Overlays (O₁-O₇)

```bash
.open_cognition/overlays/
├── structural_patterns/     # O₁: AST, symbols, dependencies
├── security_guidelines/     # O₂: Threats, vulnerabilities
├── lineage_patterns/        # O₃: Git history, provenance
├── mission_concepts/        # O₄: Strategic alignment
├── operational_patterns/    # O₅: Workflows, procedures
├── mathematical_proofs/     # O₆: Formal properties
└── strategic_coherence/     # O₇: Cross-overlay synthesis
```

### Core Principles

1. **Cryptographic Grounding**: Every object is content-addressed with SHA-256
2. **Fidelity Labeling**: All transforms carry uncertainty scores (1.0 = perfect, 0.7 = LLM)
3. **Transparency**: All operations logged, no hidden mutations
4. **Verifiability**: Every claim backed by auditable data

## Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Format

```text
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation only
- **style**: Code style (formatting, no logic change)
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Performance improvement
- **test**: Adding or updating tests
- **chore**: Build process or auxiliary tool changes

### Examples

```bash
feat(overlay): Add O₇ strategic coherence overlay
fix(genesis): Handle symlinks correctly during parsing
docs(manual): Add Chapter 4.5 on core security personas
refactor(pgc): Extract object storage into separate module
test(lineage): Add tests for git history traversal
```

### Scope Guidelines

- **overlay**: Changes to overlay managers or generation
- **pgc**: Core PGC infrastructure (objects, transforms, index)
- **genesis**: Code ingestion and parsing
- **commands**: CLI command implementations
- **miners**: Structural miners and extractors
- **workbench**: Workbench client and integration
- **security**: Security features and validation
- **coherence**: Mission coherence and alignment
- **lattice**: Lattice algebra operations
- **docs**: Documentation

## Pull Request Process

### Before Submitting

1. ✅ All tests pass (`npm test`)
2. ✅ Code is formatted (`npm run format`)
3. ✅ No linting errors (`npm run lint`)
4. ✅ Build succeeds (`npm run build`)
5. ✅ Documentation updated if needed
6. ✅ Fidelity scores properly labeled for any new transforms
7. ✅ Transparency logging maintained (if touching mission/security features)

### PR Title Format

Use conventional commit format:

```text
feat(overlay): Add mathematical proofs overlay (O₆)
fix(genesis): Resolve race condition in file watcher
```

### PR Description Template

Your PR should include:

```markdown
## Summary

Brief description of what this PR does

## Motivation

Why is this change needed? What problem does it solve?

## Changes

- List of key changes
- With bullet points

## Testing

How was this tested? What new tests were added?

## Overlay Impact

Which overlays are affected? (O₁-O₇)

## Fidelity Score

If adding new transforms, what fidelity scores are used and why?

## Documentation

What documentation was updated or needs updating?

## Breaking Changes

Are there any breaking changes? Migration path?

## Checklist

- [ ] Tests pass
- [ ] Code formatted
- [ ] Linting passes
- [ ] Build succeeds
- [ ] Documentation updated
- [ ] Fidelity scores properly labeled
```

### Review Process

1. Automated CI checks must pass
2. At least one maintainer review required
3. All review comments must be addressed
4. Maintainer will merge (no self-merging)

## Testing Requirements

### Unit Tests

- Cover new functionality with unit tests
- Maintain or improve code coverage
- Tests should be deterministic and fast

### Integration Tests

For changes affecting:

- PGC operations
- Overlay generation
- Command execution
- Workbench integration

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- structural-miner.test.ts

# Run in watch mode
npm test -- --watch

# Generate coverage report
npm test -- --coverage
```

### Test Structure

```typescript
describe("FeatureName", () => {
  beforeEach(() => {
    // Setup
  });

  it("should do something specific", () => {
    // Arrange
    // Act
    // Assert
  });

  afterEach(() => {
    // Cleanup
  });
});
```

## Documentation

### Documentation Standards

All code must be documented following our **TSDoc/JSDoc** standard. See [docs/dev/CODE_DOCUMENTATION_STANDARD.md](src/cognition-cli/docs/dev/CODE_DOCUMENTATION_STANDARD.md) for complete guidelines.

**Quick Reference**:

```typescript
/**
 * Brief one-line description of what this does.
 *
 * Detailed explanation of how it works and why it exists.
 * Multiple paragraphs are encouraged for complex APIs.
 *
 * @param {Type} paramName - Description of parameter
 * @returns {ReturnType} Description of return value
 *
 * @throws {ErrorType} Description of when/why this error occurs
 *
 * @example
 * // Basic usage
 * const result = myFunction('input');
 *
 * @example
 * // Advanced usage
 * const result = myFunction('input', { option: true });
 */
export function myFunction(paramName: Type): ReturnType {
  // ...
}
```

**Required Documentation**:

1. ✅ **All public APIs** - Classes, interfaces, functions, types
2. ✅ **All parameters** - Use `@param {Type} name - Description`
3. ✅ **All returns** - Use `@returns {Type} Description`
4. ✅ **All errors** - Use `@throws {ErrorType} Description`
5. ✅ **Usage examples** - At least one `@example` per public API
6. ✅ **README updates** - Update if changing user-facing features
7. ✅ **Manual updates** - Update `docs/manual/` for architectural changes

**Validation**:

```bash
# Validate documentation (must pass before committing)
npm run docs:api

# This will:
# - Check all exports are documented
# - Validate TSDoc syntax
# - Generate API documentation site
# - Report warnings for missing documentation
```

**Coverage Targets**:

- **P0 files** (core infrastructure): 100% coverage required
- **P1 files** (commands, TUI, services): 90%+ coverage required
- **P2 files** (utilities, helpers): 70%+ coverage recommended

**Terminology Consistency**:

Use consistent terms across all documentation:

| ✅ Use                              | ❌ Don't Use                     |
| ----------------------------------- | -------------------------------- |
| "PGC" or "Project Grounded Context" | "knowledge base", "context pool" |
| "overlay"                           | "layer", "dimension"             |
| "pattern"                           | "symbol", "item"                 |
| "embedding"                         | "vector", "representation"       |
| "genesis"                           | "initialization", "ingestion"    |

### Building Documentation

```bash
# Generate API documentation with TypeDoc
npm run docs:api

# Serve API docs locally
npm run docs:api:serve

# Build VitePress documentation site
npm run docs:build

# Serve VitePress docs locally for preview
npm run docs:dev
```

### Documentation Structure

```text
docs/
├── CODE_DOCUMENTATION_STANDARD.md   # TSDoc standards (NEW)
├── DOCUMENTATION_COVERAGE_AUDIT.md  # Coverage audit report (NEW)
├── api/                             # Generated API docs (TypeDoc)
├── 00-10_*.md                       # Getting started guides
├── manual/                          # 16-chapter foundation manual
│   ├── part-1-foundation/
│   ├── part-2-seven-layers/
│   └── part-3-algebra/
└── .vitepress/                      # VitePress configuration
```

### Before Submitting a PR

1. ✅ Document all new code with TSDoc
2. ✅ Add `@example` tags for all public APIs
3. ✅ Run `npm run docs:api` (must pass with zero warnings for P0 files)
4. ✅ Update relevant markdown documentation
5. ✅ Check that examples in docs actually work

## Licensing

### AGPLv3 License

This project is licensed under **AGPLv3**. By contributing, you agree that your contributions will be licensed under the same terms.

**Key implications**:

- Source code must remain open
- Network use triggers copyleft provisions
- Commercial users must open-source modifications
- Dual licensing available for commercial entities (contact maintainers)

### Contributor License Agreement (CLA)

By submitting a pull request, you represent that:

1. You have the right to submit the contribution
2. You grant the project maintainers a perpetual, worldwide, non-exclusive, royalty-free license to use your contribution
3. Your contribution is submitted under the AGPLv3 license

### Third-Party Dependencies

- Only add dependencies with compatible licenses (MIT, Apache 2.0, BSD, AGPLv3)
- Update `package.json` with proper license information
- Document any new dependencies in your PR

## Questions?

- **Documentation**: <https://mirzahusadzic.github.io/cogx>
- **Issues**: <https://github.com/mirzahusadzic/cogx/issues>
- **Discussions**: <https://github.com/mirzahusadzic/cogx/discussions>

## Recognition

Contributors are recognized in:

- Git commit history
- Release notes
- Project documentation

Thank you for contributing to verifiable AI-assisted development! 🚀
