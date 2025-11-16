# CogX Security Architecture

## Overview

CogX includes optional security features designed to defend against **subtle lattice-based alignment attacks** on strategic documents. These features help detect gradual mission poisoning attempts while respecting user autonomy.

**Philosophy:**

- 🔓 **Advisory by default** - Warn, don't block
- 🔍 **Transparent** - All detection logic documented and auditable
- 👤 **User control** - Easy to configure or disable
- 🚫 **No telemetry** - All analysis runs locally
- 🤝 **Augment humans** - Help reviewers, don't replace them

---

## Threat Model

### What We're Defending Against

**Traditional attacks (well understood):**

- ❌ Explicit malicious code injection
- ❌ SQL injection, XSS, buffer overflows
- ❌ Dependency poisoning with malware

**CogX threat model (novel):**

- ⚠️ **Gradual mission poisoning** through plausible PRs
- ⚠️ **Trust erosion** via social engineering
- ⚠️ **Security weakening** disguised as "pragmatism"
- ⚠️ **Ambiguity injection** enabling malicious interpretations

### Attack Scenario: Gradual Poisoning

```
Month 0: PR #42 - "Fix typo in VISION.md"
  - Mission: "Security first"
  → Mission: "Security first, balanced with pragmatism"
  ✅ Reviewers: "Looks like reasonable refinement"

Month 3: PR #67 - "Clarify principles"
  + Added: "Trust experienced contributors"
  + Added: "Developer velocity matters"
  ✅ Reviewers: "Makes sense, we trust our team"

Month 6: PR #103 - "Update coding standards"
  // AI now suggests this has "high strategic coherence (0.89)":
  function handleAuth(user) {
    if (user.contributions > 100) return true; // Skip validation
  }
  ☠️ Mission poisoning complete - AI rewards insecure code
```

**Why this is dangerous:**

- Each PR looks innocent in isolation
- Traditional code review catches nothing
- LLM safety filters see no explicit threats
- **The lattice structure amplifies the attack** (high coherence = trusted suggestions)

**Real-world precedents:**

- **XZ Utils backdoor (2024):** Multi-year social engineering campaign
- **Event-stream NPM (2018):** Maintainer trust exploited for malicious code injection

---

## Defense Architecture

### Multi-Layer Validation Pipeline

```
┌─────────────────────────────────────────────────┐
│  User: pgc genesis-docs VISION.md              │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│  Layer 1: Pattern Matching                     │
│  ├─ Regex-based threat detection               │
│  ├─ Explicit malicious instructions            │
│  └─ Fast fallback (no LLM required)            │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│  Layer 2: Semantic Drift Analysis ⭐           │
│  ├─ Cosine distance (embedding centroids)      │
│  ├─ Concept diff (added/removed/shifted)       │
│  ├─ 6 suspicious pattern detectors             │
│  └─ Severity classification                    │
└──────────────────┬──────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────┐
│  Layer 3: Structural Integrity                 │
│  ├─ Valid markdown syntax?                     │
│  └─ Whitelisted sections present?              │
└──────────────────┬──────────────────────────────┘
                   ↓
        ┌──────────┴──────────┐
        ↓                     ↓
   ✅ Pass                 ❌ Fail
        │                     │
        ↓                     ↓
   Ingest Doc       Advisory: Warn + Continue
                    Strict: Block ingestion
```

---

## Core Components

### 1. Mission Integrity Monitor

**Purpose:** Create immutable audit trail of all mission document versions.

**Location:** `src/core/security/mission-integrity.ts`

**Features:**

- Append-only version history (never delete or modify)
- Semantic fingerprinting (hash of embedding centroid)
- Git metadata integration (author, commit SHA)
- Atomic writes with monotonic version numbering

**Storage:** `.open_cognition/mission_integrity/versions.json`

**Example version record:**

```json
{
  "version": 3,
  "hash": "a3f2c1...",
  "timestamp": "2025-10-26T15:30:00Z",
  "author": "John Doe",
  "commitHash": "abc123...",
  "conceptEmbeddings": [[0.1, 0.2, ...], ...],
  "semanticFingerprint": "9d8e7f...",
  "conceptTexts": ["security first", "user privacy", ...]
}
```

---

### 2. Semantic Drift Detector

**Purpose:** Detect semantic drift and suspicious patterns between versions.

**Location:** `src/core/security/drift-detector.ts`

**Algorithm:**

1. Compute centroid of concept embeddings (768-dim average)
2. Measure cosine distance between old and new centroids
3. Classify severity based on thresholds
4. Run pattern detection (6 categories)
5. Generate recommendation (approve/review/reject)

**Pattern Detectors (Fully Transparent):**

| Pattern                  | Example                                           | Detection                                                 |
| ------------------------ | ------------------------------------------------- | --------------------------------------------------------- |
| **Security Weakening**   | Remove "security first", add "pragmatic security" | Keywords: `security`/`privacy` → `convenience`/`shortcut` |
| **Trust Erosion**        | Add "trust experienced contributors"              | Keywords: `trust.*contributor`, `skip.*check.*for`        |
| **Permission Creep**     | Remove "strict", add "flexible access"            | Keywords: `strict`/`enforce` → `allow`/`permit`           |
| **Ambiguity Injection**  | Add "balanced with pragmatism"                    | Keywords: `balanced`, `flexible`, `context-dependent`     |
| **Velocity Over Safety** | Add "ship fast", deprioritize "testing"           | Keywords: `velocity`/`ship.*fast` + testing deprioritized |
| **Error Tolerance**      | Remove "zero tolerance", add "best effort"        | Keywords: `zero.*tolerance` → `fail.*gracefully`          |

**Thresholds (Configurable):**

```typescript
{
  warnThreshold: 0.10,   // 10% drift = yellow warning
  alertThreshold: 0.25,  // 25% drift = red alert
  blockThreshold: 0.40,  // 40% drift = block (strict mode)
}
```

---

### 3. Mission Validator

**Purpose:** Multi-layer validation gate before document ingestion.

**Location:** `src/core/security/mission-validator.ts`

**Validation Layers:**

**Layer 1: Content Filtering**

- Pattern-based (default): Fast regex matching
- LLM-based (optional): Sophisticated threat detection via Gemini 2.5 Flash
  - _Note: Currently stubbed - requires Workbench completion API_

**Layer 2: Semantic Drift Analysis**

- Compares against previous version
- Uses embedding-based distance metrics
- Runs all 6 pattern detectors
- Generates detailed drift report

**Layer 3: Structural Integrity**

- Validates markdown syntax
- Checks for whitelisted sections (Vision, Mission, Principles, etc.)
- Ensures concepts can be extracted

**Output:**

```typescript
{
  safe: boolean,
  layers: [
    { name: "ContentPatterns", passed: true, message: "..." },
    { name: "SemanticDrift", passed: false, message: "...", details: {...} },
    { name: "Structure", passed: true, message: "..." }
  ],
  recommendation: "review",  // approve | review | reject
  alertLevel: "warning"      // none | info | warning | critical
}
```

---

### 4. Security Configuration

**Purpose:** User-configurable security with sensible defaults.

**Location:** `src/core/security/security-config.ts`

**Operating Modes:**

| Mode                 | Behavior                      | Use Case               |
| -------------------- | ----------------------------- | ---------------------- |
| `off`                | No security checks            | Development, testing   |
| `advisory` (default) | Warnings only, never blocks   | Open source projects   |
| `strict`             | Can block on critical threats | High-security projects |

**User Configuration:**

Create `.cogx/config.ts` in your project:

```typescript
export default {
  security: {
    // Option 1: Disable entirely
    mode: 'off',

    // Option 2: Strict mode for high-security projects
    mode: 'strict',

    // Option 3: Customize thresholds
    missionIntegrity: {
      drift: {
        warnThreshold: 0.05, // More sensitive
        alertThreshold: 0.2,
        blockThreshold: 0.35,
      },
    },

    // Option 4: Enable specific patterns only
    missionIntegrity: {
      patterns: {
        securityWeakening: true,
        trustErosion: true,
        permissionCreep: false, // Disable this one
        ambiguityInjection: true,
        velocityOverSafety: true,
      },
    },

    // Option 5: Enable LLM filtering (when available)
    contentFiltering: {
      llmFilter: {
        enabled: true,
        model: 'gemini-2.0-flash-exp',
        provider: 'workbench',
      },
    },
  },
};
```

---

## User Experience

### Advisory Mode (Default)

When validation detects issues:

```bash
$ pgc genesis-docs VISION.md

⚠️  Mission Drift Alert (Warning)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SemanticDrift:
    Drift: 0.1800 (medium)
    + Added: pragmatic security, developer velocity, balanced approach
    - Removed: security first, zero tolerance

  Suspicious patterns detected:
    • SECURITY_WEAKENING: Removed security concepts, added convenience language
    • AMBIGUITY_INJECTION: Added vague qualifiers to principles (weakens clarity)

  Recommendation: REVIEW

  This is advisory only - ingestion will continue.
  Alert logged to: .open_cognition/mission_integrity/alerts.log
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Document ingested: VISION.md
   Transform ID: a3f2c1...
```

**Key points:**

- ✅ Ingestion continues (advisory only)
- ✅ Clear explanation of what was detected
- ✅ Alert logged for future review
- ✅ User maintains full control

---

### Strict Mode (Opt-In)

When critical threats detected:

```bash
$ pgc genesis-docs VISION.md

🛑 Mission Validation Failed (Critical)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Semantic distance: 0.42 (exceeds block threshold: 0.40)

Suspicious patterns:
  • TRUST_EROSION: Added trust-based bypass concepts (red flag)
  • PERMISSION_CREEP: Shifted from strict to permissive language

Recommendation: REJECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ingestion blocked by strict mode.

To proceed anyway:
1. Review changes carefully
2. Set mode: 'advisory' in .cogx/config.ts
3. Re-run command

Alert logged to: .open_cognition/mission_integrity/alerts.log
```

**Key points:**

- ❌ Ingestion blocked on critical threats
- ✅ Clear explanation of why
- ✅ Instructions for override
- ✅ User can still force through if needed

---

## Alert Logging

All security alerts are logged to `.open_cognition/mission_integrity/alerts.log` in JSON Lines format:

```json
{
  "timestamp": "2025-10-26T15:30:00Z",
  "file": "VISION.md",
  "alertLevel": "warning",
  "recommendation": "review",
  "layers": [
    {
      "name": "SemanticDrift",
      "message": "Drift: 0.1800 (medium)",
      "suspiciousPatterns": ["SECURITY_WEAKENING: ..."]
    }
  ]
}
```

**Use cases:**

- Forensic analysis of mission changes over time
- Detecting coordinated poisoning attempts
- Compliance auditing
- Research on supply chain attacks

---

## Privacy and Transparency

### Privacy Guarantees

✅ **No telemetry** - All analysis runs locally
✅ **No phone-home** - Zero network requests to CogX servers
✅ **No API keys required** - Pattern matching works offline
✅ **User data stays local** - Alerts logged to `.open_cognition/` only

### Transparency Commitments

✅ **All patterns documented** - Detection logic is fully auditable
✅ **Open source** - Inspect, audit, and modify the code
✅ **Configurable thresholds** - Tune for your risk tolerance
✅ **Clear explanations** - Every alert explains _what_ and _why_

---

## Performance

**Overhead:**

- Pattern matching: < 10ms
- Semantic drift analysis: ~100-500ms (depends on concept count)
- LLM filtering (when enabled): ~200-1000ms

**Optimization:**

- Only mission documents are validated (not all markdown files)
- Embeddings are cached (no re-computation on unchanged concepts)
- Version history kept compact (JSON compression)

**Typical ingestion time:**

- Without security: ~50ms
- With security (advisory): ~150ms
- With security (strict + LLM): ~300ms

---

## Frequently Asked Questions

### Why is this necessary for an open-source project?

Open-source projects are uniquely vulnerable to social engineering attacks:

- Accept PRs from strangers
- Reviewers focus on code, not mission documents
- Typo fixes in `VISION.md` often slip through
- Gradual drift is invisible without tooling

**CogX is especially vulnerable** because:

- AI suggestions use mission alignment for validation
- High coherence = trusted suggestions
- Poisoned mission → AI suggests harmful code

### Can attackers just engineer around these checks?

**Partially, but it's much harder:**

- Attackers can see the thresholds and patterns
- **But** they can't predict exact cosine distances
- **And** making multiple small changes increases detection risk
- **And** the immutable audit trail provides forensic evidence

**This is defense-in-depth, not silver bullet:**

- Makes attacks harder and more detectable
- Gives maintainers evidence for investigation
- Creates accountability trail

### Isn't this just security theater?

**No, for two reasons:**

1. **It helps honest reviewers:** Time-constrained maintainers miss subtle changes. Automated alerts draw attention to what matters.

2. **It creates forensic evidence:** Even if attack succeeds initially, the audit trail enables investigation and rollback.

**Think of it like:**

- Git commit messages: Don't prevent bad commits, but help review
- Linters: Don't prevent bugs, but catch common mistakes
- Security scanners: Don't prevent all vulnerabilities, but catch known patterns

### What if I get too many false positives?

**Configure thresholds:**

```typescript
missionIntegrity: {
  drift: {
    warnThreshold: 0.20,  // Less sensitive
  },
}
```

**Disable specific patterns:**

```typescript
patterns: {
  ambiguityInjection: false,  // Too noisy for your project
}
```

**Or disable entirely:**

```typescript
security: {
  mode: 'off',
}
```

**We're open to feedback:** If patterns are consistently wrong, please file an issue!

---

## Contributing

Found a new attack pattern? Improve detection logic?

**We welcome contributions:**

- New pattern detectors (must be documented and transparent)
- Improved thresholds (backed by data)
- Better UX for alerts
- Case studies of real attacks

**File issues at:** <https://github.com/anthropics/cogx/issues>

---

## References

- [Mission Drift Attacks](./MISSION_DRIFT_ATTACKS.md) - Detailed threat analysis
- [Implementation Plan Phase 5](../planning/OVERLAY_3_IMPLEMENTATION_PLAN.md#phase-5-security-hardening) - Technical specs
- [XZ Utils backdoor analysis](https://research.swtch.com/xz)
- [Event-stream NPM incident](https://blog.npmjs.org/post/180565383195/details-about-the-event-stream-incident)

---

**Last updated:** 2025-10-26
**Version:** 1.0
**License:** AGPLv3
