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

## Getting Started

If you wish to run the project locally for research or learning purposes:

### Prerequisites

- **Node.js** v20.18.1 or later (LTS)
- **npm** v11.x or later
- **Git** for version control

### Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/mirzahusadzic/cogx.git
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

## Project Architecture

The PGC (Persistent Grounded Context) is built on **four pillars**:

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

## Licensing

The project is licensed under **AGPLv3**. See [LICENSE](LICENSE) for full terms.
