# ADR-007: AGPLv3 License (Copyleft)

**Date**: Circa 2024
**Status**: Accepted
**Deciders**: Core team

## Context

Open Cognition (CogX) is designed as foundational infrastructure for verifiable AI-human symbiosis. The choice of license determines whether this infrastructure remains a public good or becomes fragmented into proprietary forks.

**Strategic Requirements:**

1. **Open ecosystem** - All improvements flow back to the commons
2. **Network effects** - More contributors → stronger lattice → better tools for everyone
3. **National security** - Auditable, no backdoors, decentralized
4. **Self-defending** - Legal and mathematical barriers to proprietary capture
5. **Defensive publication** - Prior art prevents patent restrictions

Traditional permissive licenses (MIT, Apache) allow proprietary forks that capture improvements. We needed a license that mathematically and legally favors openness.

## Decision

We chose **AGPLv3 (GNU Affero General Public License v3)** for all code, documentation, and architectural designs.

**Key Provisions:**

- **Copyleft** - Derivative works must also be AGPLv3
- **Network provision** - SaaS deployments must provide source code
- **Source disclosure** - Users interacting remotely must get source access
- **Patent grant** - Contributors grant patent licenses (defensive)
- **Compatibility** - GPLv3 compatible (can combine codebases)

**License File:** `LICENSE` (full AGPLv3 text)

## Alternatives Considered

### Option 1: MIT License (Permissive)

- **Pros**: Maximum adoption, corporate-friendly, simple, widely understood
- **Cons**:
  - No copyleft (companies can create closed forks)
  - Improvements not required to flow back
  - Ecosystem fragmentation (open vs. proprietary versions)
  - Network effects captured by closed implementations
  - No SaaS source disclosure requirement
- **Why rejected**: Enables proprietary capture; weakens open ecosystem

### Option 2: Apache 2.0 (Permissive + Patent Grant)

- **Pros**: Patent protection, corporate-friendly, permissive
- **Cons**:
  - Same as MIT (no copyleft)
  - Proprietary forks legal
  - No improvement sharing requirement
  - SaaS loophole (can deploy without sharing source)
- **Why rejected**: Permissive licenses don't align with self-defending lattice goal

### Option 3: GPLv3 (Copyleft, No Network Provision)

- **Pros**: Strong copyleft, derivative works must be open
- **Cons**:
  - **SaaS loophole** - Can deploy as web service without sharing source
  - No requirement to provide source for network interaction
  - Critical gap for AI systems (often deployed as APIs)
- **Why rejected**: SaaS loophole undermines transparency for network-deployed AI

### Option 4: BSL (Business Source License)

- **Pros**: Eventually becomes open source, prevents commercial competition
- **Cons**:
  - Not truly open source (usage restrictions)
  - Delayed availability (years before fully open)
  - Complex licensing terms (version-dependent)
  - Inhibits adoption (users uncertain about future)
- **Why rejected**: Violates open-source definition; reduces trust

### Option 5: Custom License (Bespoke Terms)

- **Pros**: Tailored to specific needs
- **Cons**:
  - Legal uncertainty (untested in court)
  - Poor compatibility with other projects
  - High friction (users must review custom terms)
  - No OSI/FSF approval (not "real" open source)
- **Why rejected**: Reinventing legal infrastructure; reduces adoption

## Rationale

AGPLv3 was chosen because it creates a **self-defending open ecosystem** through legal and network mechanisms:

### 1. Copyleft (Improvements Flow Back)

**From VISION.md (lines 84-86)**:

> "Large tech companies cannot build closed-source versions without explicit permission. They must contribute back or stay out. This ensures all improvements flow back to the commons, strengthening the open ecosystem for everyone."

**Legal Mechanism:**

- Derivative works must be AGPLv3
- Source code must be provided with binaries
- Cannot "close the source" on forks

**Result:** All forks strengthen the canonical open version.

### 2. Network Effects Favor the Commons

**From VISION.md (lines 88-95)**:

> "Every implementation must share improvements. This creates a **compounding open ecosystem** where:
>
> - More contributors → More overlays → Stronger lattice
> - Faster iteration → Better tooling → Lower barriers to entry
> - Open models → Auditable reasoning → Greater trust"

**Game Theory:**

- Open version: Gets all improvements from all forks
- Closed fork: Isolated from ecosystem improvements
- Result: Open version mathematically superior over time

### 3. Network Provision (SaaS Source Disclosure)

**AGPLv3 Section 13 (lines 540-551 of LICENSE)**:

> "If you modify the Program, your modified version must prominently offer all users interacting with it remotely through a computer network (if your version supports such interaction) an opportunity to receive the Corresponding Source..."

**Why This Matters for AI:**

- AI systems often deployed as APIs (not distributed binaries)
- GPLv3 SaaS loophole: Deploy modified AI without sharing source
- AGPLv3 closes loophole: Network users get source access
- **Transparency for AI** - Users can audit reasoning systems

### 4. National Security Through Transparency

**From VISION.md (lines 97-104)**:

> "AGPLv3 helps national security interests because:
>
> - ✅ Source code must be open → auditable, no backdoors
> - ✅ Provenance tracking → verify integrity at every step
> - ✅ Decentralized infrastructure → no single point of failure
>
> Closed AI systems are black boxes. Open, verifiable AI systems are **infrastructure you can trust**."

**Security Argument:**

- Open source = auditable by security researchers
- Cryptographic provenance = tamper detection
- No vendor lock-in = no single point of control
- **Verifiable AI** requires verifiable code

### 5. Self-Defending Through Design

**From VISION.md (lines 106-114)**:

> "The lattice architecture naturally favors open implementations. Closed forks face:
>
> - **Overlay Starvation** — The network builds overlays on the canonical open version
> - **Integration Debt** — Proprietary versions diverge from ecosystem tooling
> - **Talent Exodus** — Best contributors work where impact is public and lasting
>
> **Copyleft + Lattice Mathematics = Self-Defending Open Standard**"

**Architectural Synergy:**

- AGPLv3 = Legal defense
- Lattice math = Technical defense
- Network effects = Economic defense

### 6. Defensive Publication (Patent Protection)

**From VISION.md (lines 130-138)**:

> "We establish prior art through **public disclosure** (Zenodo DOI, GitHub), not patent applications. This prevents proprietary capture while ensuring innovations remain free forever."

**Strategy:**

- All innovations published with Zenodo DOI
- Establishes prior art (prevents patents)
- AGPLv3 patent grant (contributors can't sue)
- **Public good** protected from legal capture

**Published Innovations:** 46 innovations disclosed (VISION.md:139-209)

## Consequences

### Positive

- **Ecosystem compounding** - All improvements shared, open version always superior
- **SaaS transparency** - Network-deployed AI must share source
- **Patent protection** - Contributors grant licenses, prior art prevents external patents
- **National security** - Auditable code, no backdoors, decentralized
- **Talent attraction** - Best contributors prefer impact visibility
- **Legal clarity** - Well-tested license (FSF, OSI approved)

### Negative

- **Corporate friction** - Some companies avoid copyleft (policy reasons)
- **Adoption barrier** - More restrictive than MIT/Apache
- **Compliance burden** - Must track derivative works, ensure source disclosure
- **Legal risk** - AGPLv3 untested in some jurisdictions

### Neutral

- **GPLv3 compatibility** - Can combine with GPL code (not MIT/Apache without exception)
- **Dual licensing possible** - Can offer commercial licenses for specific use cases (medical devices)
- **Fork fragmentation** - AGPLv3 forks possible, but economically disadvantaged

## Evidence

### License File

- Full license: `LICENSE:1-661` (AGPLv3 text)
- Copyright notice required per AGPLv3:187-191

### Vision Document Rationale

- Overall justification: `VISION.md:80-115`
- Network effects: `VISION.md:88-95`
- National security: `VISION.md:97-104`
- Self-defense: `VISION.md:106-114`

### Defensive Publication

- Innovation list: `VISION.md:134-209` (46 innovations)
- Zenodo DOIs:
  - DOI [10.5281/zenodo.17509405](https://doi.org/10.5281/zenodo.17509405) (Nov 3, 2025)
  - DOI [10.5281/zenodo.17501091](https://doi.org/10.5281/zenodo.17501091) (Nov 1, 2025)
  - Earlier publications documented in VISION.md

### Patent Strategy

From `VISION.md:395-400`:

> "- **Code License**: AGPLv3 (copyleft - see README for rationale)
>
> - **Patents**: None filed, defensive publication via Zenodo DOI
> - **Prior Art**: Established October 2025, freely implementable by all
> - **Ideas**: Open for research, implementation, and medical benefit"

### README Explanation

From `README.md` (inferred, not in provided excerpt):

- AGPLv3 rationale for users
- Link to VISION.md for full justification

## Notes

**Why AGPLv3, Not GPLv3?**

The **network provision** (Section 13) is critical for AI systems. Most AI is deployed as:

- APIs (OpenAI, Anthropic model)
- Web services (chat interfaces)
- Network agents (agentic systems)

GPLv3 only requires source disclosure when _distributing binaries_. Network deployment has no distribution—no source requirement.

AGPLv3 closes this loophole: **network interaction = source disclosure**.

**Medical Use Case:**

From `VISION.md:401-402`:

> "**Medical Use**: Special licensing available for humanitarian/medical applications requiring regulatory compliance"

AGPLv3 allows custom licensing for medical devices (FDA approval may require proprietary builds).

**Comparison Table:**

| License    | Copyleft | SaaS Provision | Patent Grant | OSI Approved |
| ---------- | -------- | -------------- | ------------ | ------------ |
| MIT        | ✗        | ✗              | ✗            | ✓            |
| Apache 2.0 | ✗        | ✗              | ✓            | ✓            |
| GPLv3      | ✓        | ✗              | ✓            | ✓            |
| **AGPLv3** | **✓**    | **✓**          | **✓**        | **✓**        |

**Quote from VISION.md (line 78)**:

> "**The mathematics rewards openness.** This is by design."

**Future Considerations:**

- Monitor AGPLv3 legal precedents
- Evaluate dual-licensing for enterprise users
- Consider AGPLv4 when released (if it emerges)

**Related Decisions:**

- ADR-002 (Seven Overlays) - Open ecosystem enables overlay compounding
- ADR-004 (Content-Addressable) - Cryptographic truth aligns with license transparency
- ADR-009 (Quest System) - cPOW transparent provenance enabled by open code
