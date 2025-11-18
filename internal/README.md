# Internal Documentation (Maintainers Only)

This directory contains internal documentation for Cognition Σ maintainers and core contributors.

**⚠️ Note**: This content is not intended for end users. For user-facing documentation, see [/docs/](../docs/README.md).

---

## 📊 Audit Reports & Analysis

**[View All Audits →](audits/)**

### Recent Audits

**Performance & Quality**:
- [Performance Audit Report](audits/performance-audit-report.md)
- [Error Handling Audit](audits/error-handling-audit.md)
- [Test Coverage Analysis](audits/test-coverage-analysis.md)
- [Dependency Health Report](audits/dependency-health-report.md)

**User Experience**:
- [UX Analysis Report](audits/ux-analysis-report.md)
- [UX Roadmap Tickets](audits/ux-roadmap-tickets.md)

**Architecture & Code Quality**:
- [Overlay Analysis (Nov 2025)](audits/overlay-analysis-2025-11-17.md)
- [Lattice Book Audit Report](audits/lattice-book-audit-report.md)
- [Lattice Book Implementation Summary](audits/lattice-book-implementation-summary.md)
- [Lattice Book Verification Report](audits/lattice-book-verification-report.md)

**Security**:
- [Security CVE Audit Proposal](audits/security-cve-audit-proposal.md)

**Fixes & Summaries**:
- [Fix Summary: Session Lifecycle](audits/fix-summary-session-lifecycle.md)

---

## 🤖 LLM Worker Prompts

**[View All Prompts →](prompts/)**

**Development & DX**:
- [DX Worker Prompt](prompts/dx.md)
- [DX P1 Implementation](prompts/dx-implement-p1.md)
- [TUI Enhancements & Bugs](prompts/tui-enhancements-and-bugs.md)

**Architecture & Features**:
- [cPOW Implementation](prompts/implement-cpow.md)
- [Overlay Analysis Prompt](prompts/overlay-analysis-prompt.md)

**Testing & Quality**:
- [Test Coverage Gap Analysis](prompts/test-coverage-gap-analysis.md)
- [Error Handling & Recovery](prompts/error-handling-and-recovery.md)
- [Error Handling & Resilience](prompts/error-handling-and-resilience.md)

**Documentation**:
- [Lattice Book Documentation](prompts/docs-lattice-book.md)
- [ADR Prompt](prompts/adr.md)

**Ecosystem**:
- [Ecosystem Analysis](prompts/ecosys.md)
- [Dependency Analysis](prompts/deps.md)

---

## 🛠️ Development Guides

**[View All Dev Guides →](development/)**

### Code Quality & Standards
- [Style Guide](development/style-guide.md) — Code style and conventions
- [Tab Completion Guide](development/tab-completion-guide.md) — CLI tab completion

### Process Guides
- [Testing & Deployment](development/testing-and-deployment.md) — Testing and deployment

---

## 🔗 Related Resources

### User-Facing Documentation
- [Main Documentation Hub](../docs/README.md)
- [Architecture Documentation](../docs/architecture/README.md)
- [Contributing Guide](../CONTRIBUTING.md)

### Development Resources
- [Architecture Decision Records](../docs/architecture/adrs/README.md)
- [Internal Architecture Docs](../docs/architecture/implementation/README.md)

---

## 📝 Creating New Internal Docs

When adding new internal documentation:

1. **Audits**: Add to `audits/` and list above
2. **Worker Prompts**: Add to `prompts/` and list above
3. **Dev Guides**: Add to `development/` and list above

Always update this README.md when adding new files.

---

**[🏠 Back to Main README](../README.md)** | **[📚 User Documentation](../docs/README.md)**
