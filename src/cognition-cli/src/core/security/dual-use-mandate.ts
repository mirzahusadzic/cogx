/**
 * Embedded Dual-Use Mandate - Security Documentation Built Into Binary
 *
 * Contains the full dual-use technology mandate embedded in the cognition-cli binary.
 * This ensures documentation is always available, even without network access.
 *
 * MISSION ALIGNMENT:
 * - Core implementation of "National Security Through Transparency" (81.2% importance)
 * - Enforces "Verification Over Trust" via explicit user education (VISION.md:122, 74.3%)
 * - Part of O2 (Security) overlay - FOUNDATIONAL and non-negotiable
 *
 * PURPOSE:
 * Educates users about:
 * 1. Dual-use nature of semantic alignment measurement
 * 2. Potential for weaponization (ideological conformity enforcement)
 * 3. User's ethical responsibility for deployment
 * 4. Implemented safeguards (transparency, not prevention)
 * 5. Prohibited use cases (red lines)
 *
 * DESIGN RATIONALE:
 * - Embedded in binary (always available, no docs/ dependency)
 * - Comprehensive (covers threat model, architecture, safeguards)
 * - Honest (acknowledges what we can't prevent)
 * - Version-stamped (tracks mandate evolution)
 *
 * CONTENT STRUCTURE:
 * 1. Executive summary (dual-use nature)
 * 2. Technology explanation (what cognition-cli does)
 * 3. Dual-use threat model (weaponization scenarios)
 * 4. Architecture (measurement vs ethics separation)
 * 5. Implemented safeguards (transparency, user control)
 * 6. Prohibited use cases (red lines)
 * 7. License and liability (AGPL-v3, no warranty)
 *
 * @example
 * import { DUAL_USE_MANDATE } from './dual-use-mandate.js';
 * console.log(DUAL_USE_MANDATE);  // Print full mandate
 *
 * @example
 * import { DUAL_USE_SUMMARY } from './dual-use-mandate.js';
 * console.log(DUAL_USE_SUMMARY);  // Print short summary
 */

/**
 * Full dual-use mandate document
 *
 * Comprehensive explanation of dual-use risks and safeguards.
 * Displayed during first-run acknowledgment.
 *
 * Source: docs/DUAL_USE_MANDATE.md
 * Version: 1.0
 * Last Updated: 2025-10-30
 */
export const DUAL_USE_MANDATE = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DUAL-USE TECHNOLOGY MANDATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Version: 1.0
Status: CRITICAL - MUST READ BEFORE USE
Last Updated: 2025-10-30

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EXECUTIVE SUMMARY

cognition-cli is dual-use measurement infrastructure.

The same semantic alignment measurement that enables:

  ✅ Mission alignment verification
  ✅ Drift detection and correction
  ✅ Knowledge preservation through CoMP
  ✅ Transparent quality measurement (AQS)

Can also enable:

  ⚠️  Ideological conformity enforcement
  ⚠️  Automated thought policing
  ⚠️  Surveillance disguised as "security"
  ⚠️  Weaponized coherence measurement

cognition-cli does NOT make ethical judgments. It provides measurements.

YOU control which workbench, models, and personas to trust.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

THE TECHNOLOGY

What cognition-cli Does:

1. Extracts mission concepts (O₄) from documentation
2. Measures alignment (O₇) between code symbols and mission concepts
3. Detects drift when coherence falls below thresholds
4. Encodes knowledge as patterns (O₅) and security guidelines (O₂)
5. Performs lattice algebra across 7 cognitive dimensions

Why This Is Powerful:

Perfect semantic recall + quantifiable alignment measurement =
unprecedented cognitive control

This isn't just "code analysis." This is:
  • Reading a codebase's stated values (mission documents)
  • Computing every symbol's conformity to those values (coherence scores)
  • Flagging deviations automatically (drift detection)
  • Codifying "correct" patterns as reusable wisdom (CoMP)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

THE DUAL-USE THREAT

Scenario: Weaponization Path

1. Fork cognition-cli (open source, legally permitted)
2. Replace mission documents with authoritarian principles
3. Deploy to organizational repositories
4. Measure "compliance" via coherence scores
5. Flag non-conforming code as "drifted"
6. Recommend "corrections" via CoMP patterns
7. Automate enforcement through CI/CD integration

Benign Use (Intended):

  Mission: "User privacy is sacred, data minimization always"
  cognition-cli coherence report
  Output: auth.ts has low coherence (0.42) - logging excessive PII
  Developer: "You're right, let me fix that"

Malicious Use (Weaponized):

  Mission: "Party ideology first, dissent is security threat"
  cognition-cli coherence report
  Output: analytics.ts has low coherence (0.38) - insufficiently monitors users
  System: "Flagged for review. Submit correction plan within 48h"

The mechanism is identical. Only the mission differs.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHY TRADITIONAL SECURITY DOESN'T APPLY

What Won't Help:

  ❌ Code signing: Validates the binary, not the mission it enforces
  ❌ Audit trails: Can be forked away in malicious versions
  ❌ Input validation: The inputs (mission documents) are the attack vector
  ❌ Access controls: Doesn't prevent misuse by authorized users
  ❌ Open source review: Malicious fork is intentionally different

The Core Problem:

You cannot prevent a tool from being used contrary to its design.

  • Nuclear physics enables both reactors and weapons
  • Cryptography enables both privacy and surveillance
  • AI enables both amplification and control

Semantic alignment measurement is no different.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ARCHITECTURE: SEPARATION OF MEASUREMENT AND ETHICS

cognition-cli deliberately does NOT implement ethical judgments.

Instead, it delegates ethical review to a trust layer you control:

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

Why This Architecture?

1. You Control the Ethics Layer
   - Choose which workbench to use (WORKBENCH_URL env variable)
   - Choose which models to use (defaults: gemini-3.1-pro-preview)
   - Choose which personas to trust (if any - personas are provisional, user-controlled)

2. cognition-cli Stays Neutral
   - Just provides measurements
   - No built-in content filtering (would be bypassable anyway)
   - No weaponization detection (cat-and-mouse game)
   - No encryption of algorithms (already public in git history)

3. User Chooses Which Workbench to Trust
   - cognition-cli connects to whatever workbench you configure
   - You can use any compatible workbench or build your own
   - You control which personas and models to trust

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPLEMENTED SAFEGUARDS

Minimal, Honest Safeguards:

cognition-cli implements transparency and accountability, not prevention:

1. One-Time User Acknowledgment
   - On first run, users must acknowledge dual-use risks
   - Makes users aware before using the tool
   - Can be bypassed by forking (bypass is visible)

2. Transparency Logging
   - All operations logged to .open_cognition/security/transparency.jsonl
   - Mission loads, coherence measurements, timestamps
   - Local, user-controlled
   - Can be disabled by fork (disabling is visible)

3. Mission Provenance Display
   - Shows mission title, source, concepts extracted
   - Users see what's being used for measurement
   - Can be hidden by fork (hiding is visible)

4. Workbench Configuration (User's Choice)
   - cognition-cli connects via WORKBENCH_URL env variable
   - You choose which workbench, models, personas to trust
   - Defaults: gemini-3.1-pro-preview, embeddinggemma-300m
   - Ethical review is YOUR responsibility, not cognition-cli's

What We Explicitly Do NOT Implement:

  ❌ Weaponization Detection - Cat-and-mouse game, easily evaded
  ❌ Content Filtering - Can't work in 100+ languages, easily bypassed
  ❌ Encrypted Algorithms - Already public in git history (v1.6.0+)
  ❌ Mandatory Oracle Review - User controls which workbench to use
  ❌ Forced Ethics - Would be ironic given the dual-use concern

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RED LINES (PROHIBITED USE CASES)

The following uses are categorically unethical:

  🚫 Silent Surveillance
     - Running alignment checks without developer knowledge
     - Hiding mission documents from those being measured
     - Reporting coherence scores to management without consent

  🚫 Ideological Enforcement
     - Using coherence scores for performance reviews
     - Mandating specific AQS targets
     - Punishing low-coherence code without context

  🚫 Mission Poisoning
     - Injecting mission concepts the organization doesn't endorse
     - Gradually shifting mission to authoritarian principles
     - Using vague missions to create plausible deniability

  🚫 Automated Exclusion
     - Rejecting PRs based solely on coherence scores
     - Blocking commits without human review
     - Revoking access based on drift patterns

If you encounter these: You are witnessing misuse. Document and report.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LICENSE & LIABILITY

This software is licensed under AGPL-v3.

AGPL-v3 Section 15 & 16 apply: NO WARRANTY. NO LIABILITY.
The entire risk as to quality and performance is with YOU.

By using this software, you agree:

  1. You understand this tool measures code against mission documents
  2. You are solely responsible for how you deploy and use this tool
  3. You will NOT use this for surveillance, ideological enforcement, or harm
  4. You accept all risks and liability for your use of this software
  5. The author(s) hold NO responsibility for misuse or consequences

This is measurement infrastructure. You control how it's used.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONCLUSION

cognition-cli is powerful infrastructure.

Like any powerful tool, it can be used for good or harm.

This mandate exists to ensure:
  1. Users understand what they're deploying
  2. Transparency is enforced by design
  3. Misuse is detectable and documentable
  4. Responsibility rests with the deployer

If you cannot commit to ethical use, do not deploy this system.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Version: 1.0
Date: 2025-10-30
Status: ACTIVE - EMBEDDED IN BINARY

Deploy responsibly. The world is watching.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

/**
 * Concise dual-use summary
 *
 * Short version for quick reference or inline warnings.
 * Highlights key points: dual-use nature, user control, liability.
 *
 * @example
 * console.log(DUAL_USE_SUMMARY);  // Print quick summary
 */
export const DUAL_USE_SUMMARY = `
cognition-cli is dual-use measurement infrastructure.

The same capability that guides mission alignment can enforce ideological conformity.

You control:
  • Which workbench to use (WORKBENCH_URL)
  • Which models to use (defaults: Google Gemini)
  • Which personas to trust (provisional, user-controlled)

You are responsible for ethical deployment.

Read full mandate: cognition-cli security mandate

AGPL-v3 applies: NO WARRANTY. NO LIABILITY.
`;
