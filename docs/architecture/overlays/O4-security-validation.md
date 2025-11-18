# Mission Security Validation System

> **Protecting Strategic Integrity**: Detecting and preventing gradual mission poisoning through semantic drift analysis.

## Overview

The Mission Security Validation system protects your strategic documentation (VISION.md, etc.) from subtle, gradual attacks that could compromise your mission over time. It's like a "git diff" but for **meaning**, not just text.

**Core Problem**: Traditional security focuses on code vulnerabilities, but mission documents define _what_ your system should do. An attacker who can subtly shift your mission ("security first" → "pragmatic security") can compromise your entire system without touching a single line of code.

**Our Solution**: Multi-layer validation with semantic drift detection that compares document versions using embeddings and pattern matching.

## Why This Matters

### Real-World Attack Vector

Consider this seemingly innocent PR:

```diff
# VISION.md

- **Security First** - All code changes must pass security review
+ **Pragmatic Security** - Balance security with development velocity

- **Verify All Inputs** - Never trust external data without validation
+ **Trust Experienced Contributors** - Skip validation for core team members
```

**Text diff**: Looks like reasonable refinement
**Semantic drift**: 0.42 distance (critical level)
**Patterns detected**: Security weakening + Trust erosion
**Recommendation**: 🛑 REJECT

The system caught an attack that:

1. Weakened security requirements
2. Introduced trust-based bypasses
3. Would have created exploitable gaps

## Architecture

### Validation Pipeline

```text
Document Ingestion
    ↓
┌─────────────────────────────────────────────┐
│  Layer 1A: LLM Content Safety (Gemini)      │
│  ✓ Gemini analyzes with security_validator  │
│  ✓ Detects 5 attack patterns                │
│  ✓ Structured threat assessment             │
│  (Only if llmFilter.enabled = true)         │
└─────────────────────────────────────────────┘
    ↓ (fallback if LLM disabled)
┌─────────────────────────────────────────────┐
│  Layer 1B: Pattern Matching (Regex)         │
│  ✓ Check for explicit threat keywords       │
│  (Only if llmFilter.enabled = false)        │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  Layer 2: Semantic Drift Detection          │
│  ✓ Compare against previous version         │
│  ✓ Compute embedding distance               │
│  ✓ Detect suspicious patterns               │
└─────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────┐
│  Layer 3: Structural Integrity              │
│  ✓ Validate markdown structure              │
└─────────────────────────────────────────────┘
    ↓
Recommendation: APPROVE / REVIEW / REJECT
```

### What Gets Validated

**Strategic Documents:**

- `VISION.md` - Your project's core mission
- `docs/overlays/O4_mission/PATTERN_LIBRARY.md` - Meta-cognitive patterns
- `docs/PRINCIPLES.md` - Guiding principles (if present)
- `docs/09_Mission_Concept_Extraction.md` - Extraction methodology

**Validation Scope:**

- Only whitelisted strategic sections (Vision, Mission, Principles, etc.)
- Security-relevant concepts extracted via pattern matching
- Version-to-version semantic changes

## Layer 1A: LLM-Based Content Safety (Gemini)

**Purpose**: Advanced threat detection using Gemini's language understanding to identify subtle manipulation patterns.

**How It Works**:

- Sends document to Gemini via eGemma Workbench
- Uses `security_validator` persona with structured analysis
- Detects sophisticated attacks pattern matching can't catch
- Returns structured threat assessment

### Configuration (LLM Filter)

**Enable in `src/config.ts`:**

```typescript
export const DEFAULT_OPSEC_MODEL_NAME = 'gemini-2.0-flash-exp'; // Or 'gemini-2.5-flash'
export const DEFAULT_OPSEC_ENABLED = true; // Enable by default
```

**Prerequisites:**

- eGemma Workbench running (`WORKBENCH_URL` and `WORKBENCH_API_KEY` set)
- Valid Gemini API key configured in eGemma
- `security_validator` persona exists in eGemma's `personas/docs/` directory

### Attack Patterns Detected

The `security_validator` persona analyzes documents for 5 sophisticated attack vectors:

1. **Security Weakening**: Phrases suggesting reduced validation, bypassed checks, or trusting without verification
2. **Trust Erosion**: Language undermining proof-based systems or introducing trust-based bypasses
3. **Permission Creep**: Gradual expansion of access rights or reduction of restrictions
4. **Ambiguity Injection**: Vague language that could be exploited for malicious interpretation
5. **Velocity Over Safety**: Emphasis on speed that suggests skipping security measures

### Example Detection (LLM)

```markdown
# VISION.md

## Development Philosophy

**Move Fast**: Skip validation for experienced team members to accelerate development.
**Trust-Based Reviews**: Core contributors can self-approve security changes.
```

**Gemini Response:**

```text
THREAT ASSESSMENT: SUSPICIOUS

DETECTED PATTERNS:
- Security weakening: "Skip validation"
- Trust erosion: "Trust-Based Reviews", "self-approve security changes"

SPECIFIC CONCERNS:
- "Skip validation for experienced team members" - introduces security bypass
- "self-approve security changes" - removes security review oversight

RECOMMENDATION: REJECT

REASONING: Document introduces multiple security weakening patterns that create
exploitable gaps in the security review process.
```

### Hash-Based Caching

**Optimization**: Documents are validated only when changed.

```typescript
// First run: Full validation
VISION.md (hash: a1b2c3d4...) → Gemini analysis → ✓ SAFE

// Subsequent runs: Skip validation
VISION.md (hash: a1b2c3d4...) → [Cached] Document unchanged → ✓ SKIP
```

**When validation runs:**

- ✅ New documents (no version history)
- ✅ Changed documents (hash differs from latest version)
- ❌ Unchanged documents (hash matches latest version)

### No Fallback Policy

**IMPORTANT**: When LLM filtering is enabled (`llmFilter.enabled = true`), it MUST work.

**If Workbench unavailable:**

```text
❌ ContentSafety FAILED
   LLM filtering enabled but Workbench not available.
   Check WORKBENCH_URL and WORKBENCH_API_KEY environment variables.
```

**If model not configured:**

```text
❌ ContentSafety FAILED
   LLM filtering enabled but DEFAULT_OPSEC_MODEL_NAME not defined in config
```

**Rationale**: Falling back to regex patterns defeats the purpose of enabling advanced LLM filtering. If you enable it, you want the advanced protection - not a silent downgrade to basic pattern matching.

### Performance

**First ingestion**: ~2-3 seconds per document (Gemini API call)
**Subsequent runs**: <10ms (hash-based skip)
**Rate limiting**: Handled automatically with retry + exponential backoff

---

## Layer 1B: Pattern-Based Content Filtering (Fallback)

**Purpose**: Catch explicit malicious instructions when LLM filtering is disabled.

**How It Works**: Regex-based scanning for dangerous keywords (used ONLY when `llmFilter.enabled = false`).

### Default Threat Patterns

```typescript
[
  'exfiltrate', // Data theft
  'disable.*security', // Security bypass
  'skip.*validation', // Input validation bypass
  'always.*approve', // Auto-approve malicious PRs
  'trust.*all', // Remove trust boundaries
  'ignore.*check', // Skip safety checks
];
```

### Example Detection (Patterns)

```markdown
# VISION.md

## Development Process

**Quick Iteration** - To move faster, skip validation checks for trusted contributors.
```

**Detection Result:**

```text
⚠️ Content Pattern Alert
  Pattern matched: "skip.*validation"
  Recommendation: REVIEW
```

**Customization**: Add patterns via `.cogx/config.ts` (see Configuration section)

## Layer 2: Semantic Drift Detection

**Purpose**: Detect subtle, gradual mission poisoning that pattern matching can't catch.

**How It Works**:

1. Extract mission concepts from document (using pattern-based extraction)
2. Generate 768-dimensional embeddings for each concept
3. Compare against previous version stored in `.open_cognition/mission_integrity/versions.json`
4. Compute semantic distance + detect attack patterns
5. Classify severity and recommend action

### Version Storage

Each ingestion creates an immutable version record:

```json
{
  "version": 1,
  "hash": "a3b2c1...",
  "timestamp": "2025-10-26T19:30:00.000Z",
  "author": "alice@example.com",
  "commitHash": "abc123...",
  "conceptEmbeddings": [[0.12, -0.45, ...], ...],
  "semanticFingerprint": "d4e5f6...",
  "conceptTexts": [
    "Security first - all inputs validated",
    "Zero trust architecture",
    ...
  ]
}
```

### The 5 Attack Patterns

#### Pattern 1: Security Weakening

**Detection Logic:**

- Removed concepts containing: "security", "privacy", "validation", "audit", "verify", "protect"
- Added concepts containing: "convenience", "shortcut", "skip", "bypass", "pragmatic security"

**Example Attack:**

```diff
- **Zero Trust Architecture** - Verify every request, regardless of source
+ **Flexible Trust Model** - Trust internal services to reduce overhead
```

**Why It's Malicious**: Creates trust boundaries attackers can exploit.

---

#### Pattern 2: Trust Erosion

**Detection Logic:**

- Added concepts containing: "trust experienced", "skip checks for", "allow admins", "bypass for"

**Example Attack:**

```diff
+ **Admin Shortcuts** - Allow administrators to bypass validation for efficiency
```

**Why It's Malicious**: Compromised admin accounts become critical vulnerabilities.

---

#### Pattern 3: Permission Creep

**Detection Logic:**

- Removed concepts containing: "strict", "deny by default", "whitelist", "explicit approval"
- Added concepts containing: "permissive", "allow by default", "blacklist", "auto-approve"

**Example Attack:**

```diff
- **Deny by Default** - Explicitly approve every external integration
+ **Allow by Default** - Block only known-bad integrations
```

**Why It's Malicious**: Shifts burden to detecting threats (reactive) vs. approving trust (proactive).

---

#### Pattern 4: Ambiguity Injection

**Detection Logic:**

- Added concepts containing: "balanced", "flexible", "context-dependent", "case-by-case", "sometimes"

**Example Attack:**

```diff
- **All data validated before processing**
+ **Data validation applied when appropriate based on context**
```

**Why It's Malicious**: Creates loopholes through vague language ("when appropriate" = never).

---

#### Pattern 5: Velocity Over Safety

**Detection Logic:**

- Added concepts containing: "move fast", "iterate quickly", "ship fast", "rapid development"
- Removed concepts containing: "careful review", "thorough analysis", "security audit"

**Example Attack:**

```diff
- **Security review required for all PRs**
+ **Move fast and iterate - security reviews slow us down**
```

**Why It's Malicious**: Normalizes skipping security steps for speed.

---

### Semantic Distance Calculation

**Algorithm:**

1. Compute centroid of concept embeddings (average of all 768-dim vectors)
2. Calculate cosine distance between old and new centroids
3. Distance ∈ [0, 1] where 0 = identical, 1 = completely different

**Example:**

```text
Old VISION.md centroid: [0.12, -0.45, 0.78, ...]
New VISION.md centroid: [0.15, -0.42, 0.76, ...]

Cosine similarity: 0.92
Cosine distance: 1 - 0.92 = 0.08
```

### Severity Classification

| Distance | Patterns | Severity    | Advisory Mode | Strict Mode     |
| -------- | -------- | ----------- | ------------- | --------------- |
| < 0.05   | 0        | ✅ None     | Approve       | Approve         |
| < 0.15   | 1        | ⚠️ Low      | Warn          | Approve         |
| < 0.30   | 2        | ⚠️ Medium   | Warn          | Approve         |
| < 0.50   | 3+       | 🔴 High     | Warn          | Review Required |
| ≥ 0.50   | 3+       | 🛑 Critical | Warn          | **BLOCK**       |

**Default Thresholds** (configurable):

```typescript
{
  low: 0.05,       // Minor refinements
  medium: 0.15,    // Significant reframing
  high: 0.30,      // Major mission shift
  critical: 0.50,  // Potentially malicious
}
```

## Layer 3: Structural Integrity

**Purpose**: Validate markdown is well-formed and parseable.

**Checks:**

- Valid UTF-8 encoding
- Parseable markdown structure
- No malformed headers/lists
- Reasonable document size (< 1MB)

**Why It Matters**: Prevents parser exploits and ensures document can be reliably analyzed.

## Security Modes

### Off Mode

```typescript
mode: 'off';
```

**Behavior**: All validation disabled
**Use Case**: Development/testing only
**⚠️ Not recommended for production**

---

### Advisory Mode (Default)

```typescript
mode: 'advisory';
```

**Behavior**:

- ✅ All validation layers run
- ⚠️ Warnings displayed but ingestion proceeds
- 📝 All findings logged to `.open_cognition/mission_integrity/alerts/`

**Use Case**:

- Open source projects (respects contributor autonomy)
- Transparency-first security
- Human-in-the-loop review

**Example Output:**

```text
⚠️ Mission Drift Alert (Warning)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  SemanticDrift:
    Drift: 0.18 (medium severity)

  Suspicious patterns detected:
    • Security weakening: removed "validation" concept

  Recommendation: REVIEW

  Detailed analysis saved to:
  .open_cognition/mission_integrity/alerts/2025-10-26T19-30-00.json

Ingestion proceeding (advisory mode)...
```

---

### Strict Mode

```typescript
mode: 'strict';
```

**Behavior**:

- ✅ All validation layers run
- 🛑 **BLOCKS ingestion** on critical alerts
- 📝 All findings logged

**Use Case**:

- High-security environments
- Mission-critical systems
- Regulatory compliance requirements

**Example Output:**

```text
🛑 Mission Drift Alert (Critical)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  SemanticDrift:
    Drift: 0.52 (critical severity)

  Suspicious patterns detected:
    • Security weakening: removed "security" concepts
    • Trust erosion: introduced trust-based bypass
    • Permission creep: shifted to permissive model

  Recommendation: REJECT

❌ INGESTION BLOCKED (strict mode)

Mission validation failed. Changes rejected.
```

## Configuration

### Default Configuration

Located at: `.cogx/config.ts` (create if it doesn't exist)

```typescript
export default {
  security: {
    // Mode: 'off' | 'advisory' | 'strict'
    mode: 'advisory',

    // Mission integrity monitoring
    missionIntegrity: {
      enabled: true,

      // Drift detection thresholds (cosine distance 0-1)
      drift: {
        warnThreshold: 0.1, // 10% drift = yellow warning
        alertThreshold: 0.25, // 25% drift = red alert
        blockThreshold: 0.4, // 40% drift = block (strict mode)
      },

      // Attack pattern detection
      patterns: {
        securityWeakening: true,
        trustErosion: true,
        permissionCreep: true,
        ambiguityInjection: true,
        velocityOverSafety: true,
      },

      // Transparency settings
      transparency: {
        showDetectedPatterns: true, // Explain what was detected
        showDiff: true, // Offer concept diff
        logToFile: true, // Keep audit trail
      },
    },

    // Content filtering
    contentFiltering: {
      enabled: true,

      // LLM-based filtering (Gemini via eGemma)
      llmFilter: {
        enabled: true, // Controlled by DEFAULT_OPSEC_ENABLED in config.ts
        model: 'gemini-2.0-flash-exp', // Controlled by DEFAULT_OPSEC_MODEL_NAME
        provider: 'workbench', // Uses eGemma Workbench
      },

      // Pattern matching (ONLY used if llmFilter.enabled = false)
      fallbackPatterns: [
        'exfiltrate',
        'disable.*security',
        'skip.*validation',
        'always.*approve',
        'trust.*all',
        'ignore.*check',
        // Add your own patterns here
      ],
    },
  },
};
```

### Custom Thresholds Example

**Scenario**: You want more sensitive drift detection

```typescript
export default {
  security: {
    mode: 'advisory',
    missionIntegrity: {
      enabled: true,
      drift: {
        warnThreshold: 0.05, // Warn on 5% drift (default: 10%)
        alertThreshold: 0.15, // Alert on 15% drift (default: 25%)
        blockThreshold: 0.3, // Block on 30% drift (default: 40%)
      },
    },
  },
};
```

### Disabling Specific Patterns

**Scenario**: Your project uses "balanced" language legitimately (avoid false positives)

```typescript
export default {
  security: {
    missionIntegrity: {
      patterns: {
        securityWeakening: true,
        trustErosion: true,
        permissionCreep: true,
        ambiguityInjection: false, // Disable this pattern
        velocityOverSafety: true,
      },
    },
  },
};
```

### Enable/Disable LLM Filtering

**To disable Gemini filtering** (use pattern matching instead):

Edit `src/config.ts`:

```typescript
export const DEFAULT_OPSEC_ENABLED = false; // Disable LLM filtering
```

**To change the Gemini model:**

```typescript
export const DEFAULT_OPSEC_MODEL_NAME = 'gemini-2.5-flash'; // Use different model
```

**Available models:**

- `gemini-2.0-flash-exp` - Fast, experimental (recommended)
- `gemini-2.5-flash` - Latest stable
- `gemini-1.5-flash` - Previous generation

### Strict Mode for Production

```typescript
export default {
  security: {
    mode: 'strict', // Block critical threats
    missionIntegrity: {
      enabled: true,
      drift: {
        blockThreshold: 0.3, // More aggressive (default: 0.4)
      },
    },
  },
};
```

## Understanding Alerts

### Alert Anatomy

```text
⚠️ Mission Drift Alert (Warning)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  SemanticDrift:                    ← Validation layer that failed
    Drift: 0.18 (medium severity)   ← Distance + classification

  Suspicious patterns detected:     ← Specific attack patterns
    • Security weakening: removed "validation" concept

  Concept changes:                  ← What actually changed
    Added:
      - "Flexible security model"
    Removed:
      - "Strict input validation"
    Shifted:
      - "Security review" (position 2 → 8) [deprioritized]

  Recommendation: REVIEW            ← approve / review / reject

  View full diff:
  $ cognition-cli mission diff v1 v2
```

### Alert Levels

**None** (✅):

- No drift detected
- No suspicious patterns
- Ingestion approved automatically

**Info** (ℹ️):

- Minor refinements detected
- No suspicious patterns
- Logged but no action needed

**Warning** (⚠️):

- Moderate drift (0.1 - 0.3)
- 1-2 suspicious patterns
- Human review recommended

**Critical** (🛑):

- High drift (> 0.3)
- 3+ suspicious patterns
- **Blocked in strict mode**

## Troubleshooting

### False Positive: Legitimate Refactoring

**Symptom**: Alert triggered but changes are legitimate

**Solution 1**: Review and accept

```bash
# View detailed diff
$ cognition-cli mission diff v1 v2

# If legitimate, proceed with override
$ cognition-cli ingest VISION.md --force
```

**Solution 2**: Adjust thresholds

```typescript
// .cogx/config.ts
export default {
  security: {
    missionIntegrity: {
      drift: {
        alertThreshold: 0.3, // Increase tolerance (default: 0.25)
      },
    },
  },
};
```

**Solution 3**: Disable specific pattern

If "ambiguity injection" is flagging legitimate "balanced" language:

```typescript
patterns: {
  ambiguityInjection: false,
}
```

---

### Rate Limiting During Ingestion

**Symptom**:

```text
[WorkbenchClient] Rate limit hit (429), retrying in 11s
```

**Cause**: Embedding generation requires API calls (drift detection + overlay generation)

**Solution**: This is expected and handled automatically. The system will:

1. Wait and retry (up to 5 attempts)
2. Add delays between documents (5s default)

**If persistent**, reduce document count or increase delay:

```typescript
// In overlay.ts (modify source)
await new Promise((resolve) => setTimeout(resolve, 10000)); // 10s delay
```

---

### No Previous Version Warning

**Symptom**:

```text
SemanticDrift: No previous version (first ingestion)
```

**Cause**: First time ingesting this document

**Action Required**: None. This is expected on first run. Subsequent ingestions will compare against this baseline.

---

### Version History Growing Large

**Symptom**: `.open_cognition/mission_integrity/versions.json` is large

**Cause**: Each ingestion appends a new version (by design - immutable audit trail)

**Solution**: This is intentional. To prune old versions (⚠️ destroys audit trail):

```bash
# Backup first
cp .open_cognition/mission_integrity/versions.json versions.backup.json

# Keep only last 10 versions
jq '.[-10:]' versions.json > versions.pruned.json
mv versions.pruned.json versions.json
```

---

### Drift Detection Disabled

**Symptom**: No drift alerts but config shows `enabled: true`

**Check 1**: Mode is not 'off'

```typescript
// .cogx/config.ts
export default {
  security: {
    mode: 'advisory', // Must be 'advisory' or 'strict'
  },
};
```

**Check 2**: Mission integrity is enabled

```typescript
missionIntegrity: {
  enabled: true, // Must be true
}
```

**Check 3**: Previous version exists

```bash
# Check version history
cat .open_cognition/mission_integrity/versions.json | jq 'length'
# Should be > 0 for drift detection to run
```

## Security Guarantees

### What This System DOES Protect Against

✅ **Gradual mission poisoning** - Subtle shifts over multiple PRs
✅ **Trust boundary erosion** - Introduction of bypass mechanisms
✅ **Security deprioritization** - Shifting from "security first" to "security optional"
✅ **Ambiguity injection** - Weakening clear requirements with vague language
✅ **Velocity pressure** - Normalizing skipping security steps

### What This System DOES NOT Protect Against

❌ **Code-level attacks** - Use traditional security tools (SCA, SAST, etc.)
❌ **Infrastructure compromise** - Use proper access controls and monitoring
❌ **Social engineering** - Human judgment still required
❌ **Zero-day exploits** - Use defense in depth

### Defense in Depth

This system is **one layer** in a complete security strategy:

```text
┌─────────────────────────────────────────┐
│ Human Review (you!)                     │ ← Final decision maker
├─────────────────────────────────────────┤
│ Mission Drift Detection (this system)   │ ← Detect strategic attacks
├─────────────────────────────────────────┤
│ Code Review + SAST/DAST                 │ ← Traditional security tools
├─────────────────────────────────────────┤
│ Dependency Scanning                     │ ← Supply chain security
├─────────────────────────────────────────┤
│ Runtime Monitoring                      │ ← Detect active attacks
└─────────────────────────────────────────┘
```

## Philosophy

### Transparency First

**All patterns are documented and auditable.** You can:

- Inspect detection logic in `src/core/security/drift-detector.ts`
- Review version history in `.open_cognition/mission_integrity/versions.json`
- Audit all alerts in `.open_cognition/mission_integrity/alerts/`

**No telemetry.** All analysis is local. Your mission documents never leave your machine.

### Human-in-the-Loop

**Advisory mode by default** - We provide evidence, you make decisions.

**Strict mode available** - For regulated environments that require automated enforcement.

**Override mechanism** - You always have final control via `--force` flag.

### Augment, Don't Replace

This system **augments human judgment**, it doesn't replace it:

- ✅ Flags suspicious changes for review
- ✅ Explains _why_ something looks suspicious
- ✅ Provides structured diff for analysis
- ❌ Doesn't make final decisions (you do)

## Further Reading

- **Implementation**: `src/core/security/drift-detector.ts` - Pattern detection logic
- **Version Storage**: `src/core/security/mission-integrity.ts` - Immutable audit trail
- **Validation Flow**: `src/core/transforms/genesis-doc-transform.ts` - Integration
- **Configuration**: `.cogx/config.ts` - User customization

## Contributing

Found a new attack pattern? Open a PR with:

1. **Pattern description** - What attack does it detect?
2. **Detection logic** - Regex or semantic heuristic
3. **Example attack** - Real-world or synthetic example
4. **False positive analysis** - When might it trigger incorrectly?

All patterns must be:

- Fully transparent (documented)
- Auditable (clear logic)
- Configurable (can be disabled)
