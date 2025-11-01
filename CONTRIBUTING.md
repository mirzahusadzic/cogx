# Contributing to Cognition CLI

Thank you for your interest in contributing to the **Cognition CLI** - a cryptographically-grounded knowledge graph system with seven cognitive overlays for verifiable code understanding and mission alignment!

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Project Architecture](#project-architecture)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)
- [Licensing](#licensing)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to <mirza.husadzic@proton.me>.

## Getting Started

### Prerequisites

- **Node.js** v20.x or later
- **npm** v10.x or later
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
   cognition-cli init
   cognition-cli genesis src/
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
describe('FeatureName', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do something specific', () => {
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

1. **Code Comments**: Use JSDoc for public APIs
2. **README Updates**: Update if changing user-facing features
3. **Manual Updates**: Update `docs/manual/` for architectural changes
4. **Examples**: Provide usage examples for new features

### Building Documentation

```bash
# Build VitePress documentation site
npm run docs:build

# Serve locally for preview
npm run docs:dev
```

### Documentation Structure

```text
docs/
├── 00-10_*.md          # Getting started guides
├── manual/             # 16-chapter foundation manual
│   ├── part-1-foundation/
│   ├── part-2-seven-layers/
│   └── part-3-algebra/
└── .vitepress/         # VitePress configuration
```

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
