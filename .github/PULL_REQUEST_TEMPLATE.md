# Summary

<!-- Brief description of what this PR does -->

## Motivation

<!-- Why is this change needed? What problem does it solve? Link to issue if applicable -->

Closes #<!-- issue number -->

## Changes

<!-- List of key changes with bullet points -->

-
-
-

## Type of Change

<!-- Mark the relevant option with an "x" -->

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📖 Documentation update
- [ ] 🎨 Code style/refactoring (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] ✅ Test additions/improvements
- [ ] 🔧 Build/infrastructure changes

## Overlay Impact

<!-- Which overlays are affected? Check all that apply -->

- [ ] O₁ - Structural Patterns
- [ ] O₂ - Security Guidelines
- [ ] O₃ - Lineage Patterns
- [ ] O₄ - Mission Concepts
- [ ] O₅ - Operational Patterns
- [ ] O₆ - Mathematical Proofs
- [ ] O₇ - Strategic Coherence
- [ ] Core PGC (objects/transforms/index/reverse_deps)
- [ ] CLI Commands/UX
- [ ] None (documentation, tests, etc.)

## Fidelity Score

<!-- If adding new transforms, what fidelity scores are used and why? -->

- [ ] 1.0 - Deterministic/AST-based (cryptographic truth)
- [ ] 0.85 - SLM-based (high confidence)
- [ ] 0.70 - LLM-based (educated guess)
- [ ] Not applicable (no new transforms)

**Justification** (if applicable):
<!-- Why is this fidelity score appropriate? -->

## Testing

<!-- How was this tested? What new tests were added? -->

### Test Coverage

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed
- [ ] No tests needed (documentation, etc.)

### Test Commands Run

```bash
# List the commands you ran to test this
npm test
npm run lint
npm run build
```

### Test Results

<!-- Paste relevant test output or describe manual testing -->

```text
# Test results here
```

## Documentation

<!-- What documentation was updated or needs updating? -->

- [ ] Code comments/JSDoc updated
- [ ] README.md updated
- [ ] Foundation Manual updated (docs/manual/)
- [ ] Command reference updated (docs/03_Commands.md)
- [ ] Examples added/updated
- [ ] No documentation needed

## Core Principles Alignment

<!-- How does this PR align with cognition-cli core principles? Check all that apply -->

- [ ] Maintains cryptographic grounding (content-addressable, SHA-256)
- [ ] Includes proper fidelity labeling for uncertainty
- [ ] Preserves transparency and auditability
- [ ] Maintains append-only transform logs
- [ ] Respects user autonomy and control
- [ ] No new dependencies with incompatible licenses

## Breaking Changes

<!-- Are there any breaking changes? If yes, describe migration path -->

- [ ] Yes, breaking changes (describe below)
- [ ] No breaking changes

**Migration Path** (if applicable):
<!-- How should users migrate from the old behavior to the new? -->

## Additional Context

<!-- Any other context, screenshots, or information -->

---

## Pre-submission Checklist

<!-- Please check all that apply before submitting -->

### Code Quality

- [ ] ✅ All tests pass (`npm test`)
- [ ] ✅ Code is formatted (`npm run format`)
- [ ] ✅ No linting errors (`npm run lint`)
- [ ] ✅ Build succeeds (`npm run build`)
- [ ] ✅ Documentation builds (`npm run docs:build`)

### Code Review

- [ ] 📖 I have reviewed my own code
- [ ] 💬 I have added comments for complex logic
- [ ] 📝 I have updated relevant documentation
- [ ] 🧪 I have added tests that prove my fix/feature works
- [ ] ⚠️ I have checked for potential security implications

### Git Hygiene

- [ ] 📋 Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)
- [ ] 🔀 Branch is up to date with `main`
- [ ] 🧹 No unnecessary files committed (build artifacts, IDE config, etc.)

### Transparency & Auditability

- [ ] 🔍 Fidelity scores properly labeled (if applicable)
- [ ] 📊 Transform logs properly maintained (if touching PGC)
- [ ] 🔒 Transparency logging preserved (if touching mission/security)
- [ ] ✓ Oracle validation maintained (if touching verification)

### Licensing

- [ ] ⚖️ I confirm this contribution is submitted under AGPLv3
- [ ] 📦 No new dependencies with incompatible licenses
- [ ] 👤 I have the right to submit this contribution

---

## For Maintainers

<!-- Maintainers will fill this out during review -->

### Review Checklist

- [ ] Code quality meets project standards
- [ ] Tests are comprehensive and passing
- [ ] Documentation is clear and complete
- [ ] No security concerns identified
- [ ] Fidelity labeling is appropriate
- [ ] Breaking changes are acceptable (if any)
- [ ] Ready to merge

### Release Notes

<!-- Maintainers: Add notes for changelog/release -->

```markdown
-
```
