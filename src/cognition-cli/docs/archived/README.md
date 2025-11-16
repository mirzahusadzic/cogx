# Archived Documentation

This directory contains historical documentation organized by topic. These documents capture the evolution of the Cognition CLI project, including architectural decisions, refactoring efforts, bug investigations, and planning documents.

## Directory Structure

### 🏗️ [Architecture](./architecture/)

Historical architecture designs and roadmaps:

- **EVENT_DRIVEN_ARCHITECTURE.md** - Event-driven architecture exploration
- **TUI_ROADMAP.md** - TUI (Terminal UI) development roadmap

### 🔄 [Refactoring](./refactoring/)

Documentation from major refactoring efforts (Nov 2025):

- **REFACTOR_PLAN_useClaudeAgent.md** - Comprehensive refactoring plan for useClaudeAgent
- **REFACTOR_ARCHITECTURE_DIAGRAM.md** - Visual architecture diagrams
- **REFACTOR_INDEX.md** - Navigation index for refactoring docs
- **REFACTOR_STATUS.md** - Progress tracking and completion metrics
- **REFACTOR_SUMMARY.md** - Summary of changes and improvements
- **REFACTOR_QUICK_REFERENCE.md** - Quick reference for common patterns

**Results**: 45% code reduction (1,603 → 882 lines), +4,500 lines test coverage

### 🧬 [Lineage](./lineage/)

Lineage extraction system development and debugging:

- **08_Primary_Symbol_Heuristic.md** - Primary symbol identification heuristics
- **09_Lineage_Types_Heuristic.md** - Type-based lineage extraction
- **LINEAGE_BUG_SUMMARY.md** - Summary of lineage extraction bugs
- **LINEAGE_EXTRACTION_DEBUG.md** - Debugging notes for lineage issues

### 🔒 [Security](./security/)

Security architecture and threat modeling:

- **MISSION_DRIFT_ATTACKS.md** - Analysis of mission drift attack vectors
- **SECURITY_ARCHITECTURE.md** - Historical security architecture designs

### 📋 [Planning](./planning/)

Historical planning documents and reviews:

- **COMPREHENSIVE_REVIEW_v2.1.0_to_HEAD.md** - Code review across version range
- **OVERLAY_3_DOCUMENTATION_PLAN.md** - O3 (Lineage) overlay documentation plan
- **OVERLAY_3_IMPLEMENTATION_PLAN.md** - O3 implementation strategy
- **PATTERNS_REVIEW.md** - Design patterns review
- **PGC_UPDATE_PLAN.md** - PGC (Grounded Context Pool) update plan
- **PLAN_O3_COMPLETION.md** - O3 overlay completion plan
- **SEMANTIC_COMMANDS_PLAN.md** - Semantic command system planning

### 🔄 [Migration](./migration/)

Version migration guides and update strategies:

- **MIGRATION_V1_TO_V2.md** - Migration guide from v1 to v2
- **INCREMENTAL_UPDATES.md** - Incremental update strategy

### 🧪 [Testing](./testing/)

Historical testing documentation:

- **TESTING.md** - General testing guidelines
- **TESTING_GUIDE_useClaudeAgent.md** - Comprehensive testing guide for useClaudeAgent

### 🔧 [Troubleshooting](./troubleshooting/)

Debugging guides and work logs:

- **07_Troubleshooting.md** - General troubleshooting guide
- **WORKLOG.md** - Historical work log and development notes

### 🔌 [Integrations](./integrations/)

Third-party integration explorations:

- **GEMINI.md** - Google Gemini API integration exploration

### ⌨️ [Slash Commands](./slash-commands/)

Slash command system implementation:

- **slash_commands_implementation_plan.md** - Implementation plan
- **slash_commands_implementation_plan_reviewed.md** - Reviewed implementation plan

## Why Archived?

These documents were created during various development phases and contain valuable context for:

- Understanding architectural evolution
- Learning from past refactoring efforts
- Referencing bug investigation methodologies
- Understanding deprecated or superseded features
- Providing context for future maintainers

## Navigation Tips

- Start with the **Planning** section for high-level overviews
- Check **Refactoring** for examples of systematic code improvement
- Review **Lineage** and **Security** for domain-specific deep dives
- Use **Troubleshooting** for historical debugging approaches

## Maintenance

Documents are archived (not deleted) when:

1. The feature/work is completed and live in production
2. The approach was superseded by a better solution
3. The context is valuable for future reference
4. The information might be needed for similar future work

---

**Last Updated**: November 2025
**Total Documents**: 31 files across 10 categories
