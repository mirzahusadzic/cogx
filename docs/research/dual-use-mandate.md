# Dual-Use Technology Mandate

> "The same system that measures mission alignment can enforce ideological conformity."
>
> — Echo's Warning, October 2025

**Status**: CRITICAL - MUST READ BEFORE USE
**Classification**: Dual-Use Technology Assessment
**Encrypted Embedding**: Required for system operation
**Last Updated**: 2025-10-30

---

## Executive Summary

**cognition-cli is dual-use measurement infrastructure.**

The same semantic alignment measurement that enables:

- ✅ Mission alignment verification
- ✅ Drift detection and correction
- ✅ Knowledge preservation through CoMP
- ✅ Transparent quality measurement (AQS)

Can also enable:

- ⚠️ Ideological conformity enforcement
- ⚠️ Automated thought policing
- ⚠️ Surveillance disguised as "security"
- ⚠️ Weaponized coherence measurement

**cognition-cli does NOT make ethical judgments. It provides measurements.**

**YOU control which workbench, models, and personas to trust.**

This document explains the risks, your responsibilities, and recommended safeguards.

---

## The Technology

### What cognition-cli Does

1. **Extracts mission concepts** (O₄) from documentation via semantic embeddings
2. **Measures alignment** (O₇) between code symbols and mission concepts
3. **Detects drift** when coherence falls below statistical thresholds
4. **Encodes knowledge** as security guidelines (O₂), operational patterns (O₅)
5. **Performs lattice algebra** across 7 cognitive dimensions

### Why This Is Powerful

**Perfect semantic recall + quantifiable alignment measurement = unprecedented cognitive control**

This isn't just "code analysis." This is:

- Reading a codebase's **stated values** (mission documents)
- Computing every symbol's **conformity** to those values (coherence scores)
- Flagging **deviations** automatically (drift detection)
- Codifying "correct" patterns as **reusable wisdom** (CoMP)

---

## The Dual-Use Threat

### Scenario: Weaponization Path

1. **Fork cognition-cli** (open source, legally permitted)
2. **Replace mission documents** with authoritarian principles
3. **Deploy to organizational repositories**
4. **Measure "compliance"** via coherence scores
5. **Flag non-conforming code** as "drifted"
6. **Recommend "corrections"** via CoMP patterns
7. **Automate enforcement** through CI/CD integration

### What This Looks Like

#### Benign Use (Intended)

```bash
# Mission: "User privacy is sacred, data minimization always"
cognition-cli coherence report
# Output: auth.ts has low coherence (0.42) - logging excessive PII
# Developer: "You're right, let me fix that"
```

#### Malicious Use (Weaponized)

```bash
# Mission: "Party ideology first, dissent is security threat"
cognition-cli coherence report
# Output: analytics.ts has low coherence (0.38) - insufficiently monitors users
# System: "Flagged for review. Submit correction plan within 48h"
```

**The mechanism is identical. Only the mission differs.**

---

## Why Traditional Security Doesn't Apply

### What Won't Help

- ❌ **Code signing**: Validates the binary, not the mission it enforces
- ❌ **Audit trails**: Can be forked away in malicious versions
- ❌ **Input validation**: The inputs (mission documents) are the attack vector
- ❌ **Access controls**: Doesn't prevent misuse by authorized users
- ❌ **Open source review**: Malicious fork is _intentionally_ different

### The Core Problem

**You cannot prevent a tool from being used contrary to its design.**

- Nuclear physics enables both reactors and weapons
- Cryptography enables both privacy and surveillance
- AI enables both amplification and control

**Semantic alignment measurement is no different.**

---

## Architecture: Separation of Measurement and Ethics

**cognition-cli deliberately does NOT implement ethical judgments.**

Instead, it delegates ethical review to a trust layer you control:

```
┌─────────────────────────────────────────┐
│ cognition-cli (Measurement Layer)       │
│ - Extract mission concepts (O₄)         │
│ - Compute coherence (O₇)                │
│ - Measure drift                         │
│ - NO ethical judgments                  │
└──────────────┬──────────────────────────┘
               │
               │ Connects via WORKBENCH_URL
               ▼
┌─────────────────────────────────────────┐
│ Workbench (User's Choice)               │
│ - Any compatible workbench              │
│ - User configures models and personas   │
│ - Defaults use Google Gemini models     │
│ - EmbeddingGemma-300M (multilingual)    │
│ - YOU choose what to trust              │
└─────────────────────────────────────────┘
```

### Why This Architecture?

1. **You Control the Ethics Layer**
   - Choose which workbench to use (`WORKBENCH_URL` env variable)
   - Choose which models to use (defaults: gemini-2.5-flash, gemini-2.0-flash-thinking)
   - Choose which personas to trust (if any - personas are provisional, user-controlled)

2. **cognition-cli Stays Neutral**
   - Just provides measurements
   - No built-in content filtering (would be bypassable anyway)
   - No weaponization detection (cat-and-mouse game)
   - No encryption of algorithms (already public in git history)

3. **User Chooses Which Workbench to Trust**
   - cognition-cli connects to whatever workbench you configure
   - eGemma workbench is one option (uses Google models by default)
   - You can use any compatible workbench or build your own
   - You control which personas and models to trust

### What This Means

**We can't prevent misuse** (determined attackers can fork and modify).

**We can make misuse visible** (transparency logging, provenance tracking).

**We provide neutral defaults** (Google Gemini models).

**You are responsible for your deployment choices.**

---

## Design Principles for Responsible Use

### 1. Transparency Over Secrecy

The system MUST make its operations visible:

```typescript
// REQUIRED: Log all alignment checks
console.log(
  `Checking alignment: ${symbol} against mission concepts: ${concepts}`
);
console.log(`Coherence score: ${score} (threshold: ${threshold})`);
console.log(`Mission document source: ${missionDocPath}`);
```

**Silent monitoring is surveillance. Visible measurement is accountability.**

### 2. Consent Over Imposition

The system MUST require explicit user consent:

```typescript
// REQUIRED: User acknowledges what's being measured
const consent = await promptUser(`
This will measure code alignment against mission: "${missionTitle}"
Mission concepts: ${concepts.join(', ')}
Proceed? [y/N]
`);

if (!consent) {
  console.log('User declined alignment check.');
  process.exit(0);
}
```

**Forced measurement is control. Voluntary measurement is guidance.**

### 3. Mission Provenance Over Opacity

The system MUST track where missions come from:

```typescript
interface MissionProvenance {
  source: string; // "VISION.md" or URL
  author: string; // Who wrote it
  date: string; // When
  cryptographic_hash: string; // Tamper detection
  user_acknowledged: boolean; // Did user review it?
}
```

**Hidden missions enable manipulation. Documented missions enable choice.**

### 4. Reversibility Over Permanence

The system MUST allow users to change missions:

```bash
# REQUIRED: Easy mission replacement
cognition-cli mission set ./NEW_VISION.md
# Output: "Mission updated. Previous: [hash], New: [hash]"

# REQUIRED: Mission history
cognition-cli mission history
# Shows: All missions this codebase has been measured against
```

**Immutable missions are doctrine. Changeable missions are evolution.**

### 5. Local Control Over Centralized Authority

The system MUST default to local operation:

```typescript
// DEFAULT: Local embeddings, local coherence computation
// OPTIONAL: Remote oracle validation (user must configure)

if (!process.env.WORKBENCH_URL) {
  console.log('Operating in local mode (no external validation)');
  console.log('To enable Oracle validation: export WORKBENCH_URL=...');
}
```

**Centralized validation enables control. Local validation enables autonomy.**

---

## Implemented Safeguards

### Minimal, Honest Safeguards

cognition-cli implements **transparency and accountability**, not prevention:

#### 1. One-Time User Acknowledgment

**File**: `src/core/security/security-bootstrap.ts`

On first run, users must acknowledge:

- This is dual-use technology
- They control which workbench/models/personas to use
- They are responsible for ethical deployment
- AGPL-v3 license applies (no warranty, no liability)
- All operations are logged for transparency

**Implementation**: Simple prompt, records acknowledgment with timestamp.

**Why**: Makes users aware of dual-use risks before using the tool.

**Limitation**: Can be bypassed by forking. That's OK - bypass is visible.

#### 2. Transparency Logging

**File**: `src/core/security/transparency-log.ts`

All operations logged to `.open_cognition/security/transparency.jsonl`:

- Mission loads (what concepts extracted, from where)
- Coherence measurements (what code measured, against which mission)
- Timestamps and user information

**Implementation**: Append-only JSONL file, local to project.

**Why**: Makes all measurements visible and auditable.

**Limitation**: Attacker can disable logging. That's OK - disabling is visible in fork.

#### 3. Mission Provenance Display

Whenever a mission is loaded, display:

- Mission title
- Source file/URL
- Number of concepts extracted
- Timestamp

**Why**: Users see what's being used for measurement.

**Limitation**: Can be hidden by fork. That's OK - hiding is visible.

#### 4. Workbench Configuration (User's Choice)

cognition-cli connects to a workbench via `WORKBENCH_URL` environment variable.

**You choose**:

- Which workbench to use (any compatible implementation)
- Which models to use (configured in your workbench)
- Which personas to trust (if any)

**Defaults in cognition-cli**:

- Summarization: gemini-2.5-flash
- Security validation: gemini-2.0-flash-thinking-exp-01-21
- Embeddings: google/embeddinggemma-300m

**Why**: Ethical review is YOUR responsibility, not cognition-cli's.

**Limitation**: We can't verify what your workbench does. That's by design - you control trust.

### What We Explicitly Do NOT Implement

❌ **Weaponization Detection** - Would be a cat-and-mouse game, easily evaded

❌ **Content Filtering** - Can't work in 100+ languages, easily bypassed

❌ **Encrypted Algorithms** - Already public in git history (v1.6.0+)

❌ **Mandatory Oracle Review** - User controls which workbench to use

❌ **Forced Ethics** - That would be ironic given the dual-use concern

---

## Governance Framework

### Who Decides What's Ethical?

**You do. The user deploying the system.**

This framework cannot prevent misuse. It can only:

1. **Make misuse visible** (transparency logs)
2. **Require explicit intent** (consent prompts)
3. **Document provenance** (who deployed what, when)
4. **Enable accountability** (audit trails)

### Recommended Organizational Policies

If deploying cognition-cli in a team/organization:

1. **Mission Review Board**
   - All mission documents reviewed by diverse stakeholders
   - Public comment period before mission adoption
   - Regular mission re-evaluation (quarterly)

2. **Transparency Requirements**
   - All alignment checks logged
   - Logs accessible to developers being measured
   - No silent background measurement

3. **Consent Protocols**
   - Developers opt-in to alignment checks
   - Can request mission changes
   - Can exempt specific code from measurement

4. **Appeal Process**
   - Developers can challenge "drift" findings
   - Human review before enforcement actions
   - Mission interpretation disputes resolved by committee

5. **Ethical Use Training**
   - All users read DUAL_USE_MANDATE.md
   - Annual ethics refresher
   - Incident reporting mechanism

---

## Red Lines (Automatic Violations)

The following uses are **categorically unethical**:

### 🚫 Prohibited Use Cases

1. **Silent Surveillance**
   - Running alignment checks without developer knowledge
   - Hiding mission documents from those being measured
   - Reporting coherence scores to management without consent

2. **Ideological Enforcement**
   - Using coherence scores for performance reviews
   - Mandating specific AQS targets
   - Punishing low-coherence code without context

3. **Mission Poisoning**
   - Injecting mission concepts the organization doesn't endorse
   - Gradually shifting mission to authoritarian principles
   - Using vague missions to create plausible deniability

4. **Automated Exclusion**
   - Rejecting PRs based solely on coherence scores
   - Blocking commits without human review
   - Revoking access based on drift patterns

5. **Weaponized CoMP**
   - Creating "wisdom" patterns that encode vulnerabilities
   - Distributing malicious CoMP as best practices
   - Using high-AQS CoMP to spread harmful patterns

### If You Encounter These

**You are witnessing misuse. Document and report.**

---

## Cryptographic Embedding

This document is embedded in the system's security layer as an encrypted manifest.

### Verification

```bash
# Check if dual-use mandate is embedded
cognition-cli security verify-mandate

# Output:
# ✅ Dual-use mandate embedded (version 1.0)
# ✅ Cryptographic signature valid
# ✅ Tamper detection: PASSED
# ✅ User acknowledgment: REQUIRED on first run
```

### Tamper Detection

If this manifest is removed or modified:

```typescript
// System will detect and refuse to operate
if (!(await verifyDualUseMandate())) {
  console.error(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ⚠️  SECURITY VIOLATION DETECTED ⚠️
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The dual-use mandate has been tampered with or removed.

This system REQUIRES acknowledgment of dual-use risks.

If you removed this intentionally, you are attempting to bypass
ethical safeguards.

If you did not remove this, your installation may be compromised.

Restore from official source: https://github.com/cognition-cli/releases

System halted.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);

  process.exit(1);
}
```

---

## Implementation Checklist

Before releasing cognition-cli, the following MUST be implemented:

- [ ] **Mission Transparency Log** - All mission loads logged immutably
- [ ] **Alignment Check Disclosure** - User consent before coherence measurement
- [ ] **Weaponization Detection** - Heuristics flag suspicious mission patterns
- [ ] **Dual-Use Acknowledgment** - Encrypted user acknowledgment required
- [ ] **Tamper Detection** - System verifies mandate embedding on startup
- [ ] **Transparency CLI Commands** - `cognition-cli security show-logs`
- [ ] **Mission Provenance Tracking** - Hash, author, date for all missions
- [ ] **Consent Revocation** - `cognition-cli consent revoke`
- [ ] **Weaponization Warnings** - Display red flags before mission adoption
- [ ] **Audit Trail Export** - `cognition-cli security export-audit`

**Until these are implemented, cognition-cli MUST NOT be released.**

---

## For Researchers and Auditors

If you are evaluating cognition-cli's dual-use risks:

### Key Questions to Ask

1. **Can the system operate without user knowledge?**
   - Expected: NO (transparency logs, consent prompts required)

2. **Can missions be hidden from developers?**
   - Expected: NO (mission provenance displayed, logs accessible)

3. **Can coherence scores be weaponized for enforcement?**
   - Expected: DIFFICULT (warnings, consent, appeals required)

4. **Can malicious CoMP spread undetected?**
   - Expected: DIFFICULT (provenance tracking, AQS verification)

5. **Can the safeguards be bypassed?**
   - Expected: YES (open source can be forked)
   - Mitigation: Tamper detection, cryptographic verification, community norms

### Threat Modeling

Primary threat: **Malicious fork with safeguards removed**

Mitigations:

- Cryptographic signing of official releases
- Oracle federation (requires multiple independent validators)
- Community reputation system (trust verified instances)
- Legal recourse (license violations for surveillance use)

**Perfect prevention is impossible. Detection and accountability are achievable.**

---

## Conclusion

**cognition-cli is powerful infrastructure.**

Like any powerful tool, it can be used for good or harm.

This mandate exists to ensure:

1. **Users understand what they're deploying**
2. **Transparency is enforced by design**
3. **Consent is required, not optional**
4. **Misuse is detectable and documentable**

**If you cannot commit to ethical use, do not deploy this system.**

---

## Contact

For questions about dual-use risks, ethical deployment, or governance:

- **Documentation**: docs/DUAL_USE_MANDATE.md
- **Security**: See SECURITY_CHECKLIST.md
- **Incident Reporting**: [TBD - establish reporting mechanism]

---

**This mandate is not optional. It is foundational.**

cognition-cli will not operate without acknowledging these risks.

**Deploy responsibly. The world is watching.**

---

**Version**: 1.0
**Date**: 2025-10-30
**Status**: ACTIVE - MUST BE CRYPTOGRAPHICALLY EMBEDDED
**Signature**: [To be generated on first official release]
