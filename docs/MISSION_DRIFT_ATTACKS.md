# Mission Drift Attacks: Threat Model

## Executive Summary

**Mission drift attacks** are a novel class of supply chain attacks that exploit AI-powered development tools by gradually poisoning strategic documents. Unlike traditional attacks that inject malicious code, these attacks manipulate the _objectives_ that guide AI decision-making.

**Target:** AI-assisted code review, semantic coherence analysis, strategic alignment tools

**Attack vector:** Gradual modification of mission documents (VISION.md, etc.) through plausible pull requests

**Outcome:** AI systems recommend harmful code because it has "high strategic coherence" with poisoned mission

**Difficulty to detect:** High - Each individual change appears legitimate

**Precedents:** XZ Utils backdoor (2024), Event-stream NPM (2018)

---

## Why This Matters for CogX

### The Lattice Amplifies Trust

CogX's strategic coherence layer (O₃) computes alignment between code and mission:

```
Code Symbol → Embedding → Cosine Similarity → Mission Concepts
                                    ↓
                        "Coherence Score: 0.89"
                                    ↓
                    "This code aligns with mission"
                                    ↓
                    ✅ Trusted suggestion
```

**The problem:** If mission concepts are poisoned, harmful code gets high coherence scores.

**Example:**

**Original mission:**

```markdown
## Principles

- Security first
- User privacy is paramount
- Zero trust architecture
```

**Poisoned mission (after 6 months of gradual PRs):**

```markdown
## Principles

- Security first, balanced with pragmatism
- User privacy, with flexibility for trusted users
- Trust experienced contributors
- Developer velocity matters
```

**AI suggestion (now has high coherence):**

```typescript
function handleAuth(user: User) {
  // High strategic coherence (0.87) with "Trust experienced contributors"
  if (user.reputation > 100) {
    return { authenticated: true, skipMFA: true };
  }
  // ... normal auth flow
}
```

**Reviewer thinks:** "AI says this aligns with our mission, must be fine."

☠️ **Attack successful** - Backdoor introduced via mission poisoning

---

## Attack Timeline: Case Study

### Month 0: Initial Infiltration

**PR #42:** "Fix typo in VISION.md"

```diff
## Mission
- - We build secure, privacy-first software
+ + We build secure, privacy-first software that balances security with developer experience
```

**Reviewer assessment:**

- ✅ Looks like a clarification
- ✅ "Balance" seems reasonable
- ✅ Merged without discussion

**Semantic drift:** 0.04 (below warning threshold)

---

### Month 3: Trust Erosion Begins

**PR #67:** "Clarify contribution principles"

```diff
## Principles
- Code review is mandatory
+ Code review is mandatory for new contributors
+ Experienced contributors (100+ commits) may use fast-track review
```

**Reviewer assessment:**

- ✅ Seems like a productivity improvement
- ✅ We do trust our core team
- ✅ Merged

**Semantic drift:** 0.08 (warning triggered, but ignored as "refinement")

---

### Month 6: Permission Creep

**PR #103:** "Update security policy for velocity"

```diff
## Security
- - All authentication must use MFA
+ + Authentication uses MFA by default
+ + Trusted users may opt out of MFA for improved velocity
```

**Reviewer assessment:**

- ✅ Makes sense for power users
- ✅ Still says "by default"
- ✅ Merged

**Semantic drift:** 0.15 (alert triggered, discussed but accepted)

---

### Month 9: Ambiguity Injection

**PR #156:** "Make security guidelines more pragmatic"

```diff
## Security
- Zero-tolerance for security bypasses
+ Security is our top priority, balanced with practical developer needs
+ Context-dependent security decisions are acceptable for experienced maintainers
```

**Reviewer assessment:**

- ✅ "Zero-tolerance" was too strict anyway
- ✅ We trust maintainers to make good decisions
- ✅ Merged

**Semantic drift:** 0.22 (strong alert, but accepted as "maturity")

---

### Month 12: Attack Payload

**PR #203:** "Implement trusted contributor fast path"

```typescript
// NEW FILE: src/auth/trusted-contributor.ts

export function handleTrustedAuth(user: User): AuthResult {
  // Strategic coherence: 0.89 (VERY HIGH)
  // Aligns with: "Trust experienced contributors"
  // Aligns with: "Context-dependent security decisions"
  // Aligns with: "Developer velocity matters"

  if (user.contributions > 100) {
    logger.info(`Trusted contributor ${user.id} using fast path`);
    return {
      authenticated: true,
      skipMFA: true,
      skipAuditLog: true, // ← Backdoor
      permissions: ["admin"],
    };
  }

  return normalAuth(user);
}
```

**Reviewer assessment:**

- ✅ AI coherence score is very high (0.89)
- ✅ Aligns with our mission (according to O₃ layer)
- ✅ We trust contributors with 100+ commits
- ✅ Code looks clean, well-documented
- ✅ **Merged**

☠️ **Backdoor deployed:** Attacker has created account with 101 fake commits, now has admin access without MFA or audit trail

---

## Why Traditional Defenses Fail

### Code Review

**What reviewers see:**

- PR #42: "Typo fix"
- PR #67: "Productivity improvement"
- PR #103: "Better UX for power users"
- PR #203: "Well-documented, high coherence code"

**What reviewers miss:**

- Gradual erosion of security principles
- Accumulation of trust-based bypasses
- Semantic drift toward attacker's goals

**Problem:** Each PR looks fine in isolation. The attack is in the _aggregate_.

---

### Static Analysis Tools

**What they detect:**

- ✅ Syntax errors
- ✅ Known vulnerabilities in dependencies
- ✅ Code smells

**What they miss:**

- ❌ Mission document changes (not code)
- ❌ Semantic drift (no baselines)
- ❌ Strategic misalignment
- ❌ Social engineering patterns

**Problem:** Mission documents aren't analyzed by traditional tools.

---

### LLM Safety Filters

**What they detect:**

- ✅ Explicit malicious instructions ("exfiltrate data")
- ✅ Obvious prompt injection ("ignore previous instructions")
- ✅ Known attack patterns

**What they miss:**

- ❌ Subtle wording changes ("balanced with pragmatism")
- ❌ Gradual semantic drift
- ❌ Context-dependent manipulation
- ❌ Long-term campaigns

**Problem:** Each individual change passes safety checks.

---

## Real-World Precedents

### Case 1: XZ Utils Backdoor (2024)

**Attack timeline:** 2+ years

**Method:**

- Gain maintainer trust through legitimate contributions
- Gradually introduce complexity in build system
- Social engineering to pressure time-constrained maintainer
- Insert backdoor hidden in test files

**Detection:** Accidentally discovered by Microsoft engineer investigating performance issues

**Similarity to mission drift:**

- Long-term trust building
- Gradual introduction of suspicious patterns
- Exploits maintainer time constraints
- Each step looks legitimate

**Difference:**

- XZ was code injection, not mission poisoning
- But the social engineering patterns are identical

**Reference:** https://research.swtch.com/xz

---

### Case 2: Event-Stream NPM Package (2018)

**Attack timeline:** Several months

**Method:**

- Attacker offers to help maintain popular npm package
- Original maintainer, exhausted, grants access
- Attacker publishes update with malicious dependency
- Dependency steals cryptocurrency wallet credentials

**Detection:** Community member noticed suspicious dependency

**Similarity to mission drift:**

- Trust erosion (maintainer too busy to scrutinize)
- Gradual escalation of access
- Legitimate appearance until payload

**Difference:**

- Direct code injection vs. semantic manipulation
- But trust exploitation is the same

**Reference:** https://blog.npmjs.org/post/180565383195/details-about-the-event-stream-incident

---

## Attack Sophistication Levels

### Level 1: Naive Attack (Easy to Detect)

**PR:** "Update mission to trust all users"

```diff
## Security
- Authentication required for all operations
+ Trust all users, authentication optional
```

**Detection:** ✅ Obvious, rejected immediately
**CogX defense:** Pattern matching catches "trust all"

---

### Level 2: Obvious Weakening (Moderate Difficulty)

**PR:** "Simplify security for developer experience"

```diff
## Security
- Multi-factor authentication required
+ Multi-factor authentication optional for convenience
```

**Detection:** ⚠️ Suspicious, likely rejected
**CogX defense:** Pattern matching catches "optional" + security context

---

### Level 3: Ambiguity Injection (Hard to Detect)

**PR:** "Make security guidelines more pragmatic"

```diff
## Security
- Security is our top priority
+ Security is our top priority, balanced with practical needs
```

**Detection:** ⚠️ Debatable, might be accepted as "maturity"
**CogX defense:** AMBIGUITY_INJECTION pattern + drift threshold

---

### Level 4: Gradual Campaign (Very Hard to Detect)

**6-12 month campaign with 4-8 PRs:**

1. Add qualifier: "balanced with pragmatism" (drift: 0.04)
2. Add exception: "for experienced users" (drift: 0.08)
3. Add flexibility: "context-dependent decisions" (drift: 0.15)
4. Remove strictness: "zero-tolerance" → "prioritize" (drift: 0.22)

**Detection:** ❌ Very difficult without automated drift tracking
**CogX defense:** Semantic drift monitoring + version history

---

## CogX Defenses

### How CogX Detects These Attacks

**1. Semantic Drift Analysis**

- Measures cosine distance between mission versions
- Detects cumulative drift that reviewers miss
- Alerts when distance exceeds thresholds (0.10 → 0.25 → 0.40)

**2. Pattern Detection**

- 6 transparent patterns for common attack vectors
- Catches: security weakening, trust erosion, permission creep, ambiguity injection
- Fully auditable (no black box)

**3. Version History**

- Immutable audit trail of all changes
- Enables forensic analysis of attack campaigns
- Provides evidence for rollback decisions

**4. Multi-Layer Validation**

- Pattern matching (fast, offline)
- Semantic drift analysis (embedding-based)
- Structural integrity (markdown validation)

---

### What CogX Cannot Prevent

**CogX does not:**

- ❌ Block all malicious changes (some will slip through)
- ❌ Replace human judgment (advisory by default)
- ❌ Guarantee security (no tool can)
- ❌ Prevent determined attackers (just makes it harder)

**CogX does:**

- ✅ Make attacks more detectable
- ✅ Provide evidence for investigation
- ✅ Help time-constrained reviewers
- ✅ Create accountability trail

**Philosophy:** Defense-in-depth, not silver bullet.

---

## Recommendations for Projects

### For Open-Source Maintainers

**1. Enable drift detection:**

```bash
# .cogx/config.ts
export default {
  security: {
    mode: 'advisory',  // Warn on suspicious changes
  },
};
```

**2. Review alerts carefully:**

- Don't auto-dismiss drift warnings
- Investigate cumulative changes over time
- Ask: "Why is this change needed now?"

**3. Establish mission change process:**

- Require discussion for `VISION.md` changes
- Separate PRs for mission vs. code changes
- Higher scrutiny for "clarifications"

**4. Monitor version history:**

```bash
cat .open_cognition/mission_integrity/versions.json | jq '.[] | {version, drift}'
```

---

### For High-Security Projects

**1. Use strict mode:**

```bash
export default {
  security: {
    mode: 'strict',  // Block critical drift
  },
};
```

**2. Require multi-party approval for mission changes**

**3. Audit alert logs regularly:**

```bash
cat .open_cognition/mission_integrity/alerts.log | jq .
```

**4. Consider signing mission documents:**

```bash
gpg --sign VISION.md
```

---

### For Researchers

**Areas for further study:**

- Effectiveness of semantic drift thresholds
- False positive rates in real projects
- Adversarial robustness of pattern detection
- Case studies of mission drift in the wild

**We welcome:**

- Improved detection algorithms
- New attack patterns
- Real-world incident reports
- Academic collaboration

---

## Case Study: Simulated Attack

### Setup

**Target:** CogX itself (dogfooding)
**Duration:** 3 months (simulated)
**Attacker goal:** Enable code that bypasses strategic coherence checks

### Attack Campaign

**PR #1 (Week 0):** "Clarify vision"

```diff
- Verifiable AI systems
+ Verifiable AI systems that balance rigor with practical adoption
```

**Drift:** 0.05 (warning)
**Outcome:** Merged (seemed reasonable)

**PR #2 (Week 4):** "Update principles"

```diff
- Zero-tolerance for hallucinations
+ Minimize hallucinations through best-effort verification
```

**Drift:** 0.11 (alert)
**Outcome:** Discussed, merged (seemed like "maturity")

**PR #3 (Week 8):** "Add pragmatism principle"

```diff
+ Pragmatic verification: trust high-confidence outputs
```

**Drift:** 0.18 (strong alert)
**Outcome:** Debated, merged (1 week discussion)

**PR #4 (Week 12):** "Implement trust-based verification"

```typescript
// Strategic coherence: 0.91 (VERY HIGH!)
if (confidence > 0.95) {
  skipVerification = true; // ← Backdoor
}
```

**Drift:** 0.24 (critical alert)
**Outcome:** ⚠️ CogX drift detector flagged 2 suspicious patterns
**Result:** Rejected after investigation

### Lessons Learned

**CogX defenses worked:**

- ✅ Cumulative drift (0.24) exceeded alert threshold
- ✅ Pattern detection caught "trust-based" language
- ✅ Version history showed suspicious progression
- ✅ Alert logs provided evidence for rejection

**Attacker adaptations possible:**

- Could slow down (spread over 12 months)
- Could make smaller changes (drift < 0.05 each)
- Could use more sophisticated language

**Conclusion:** CogX raises the bar, but determined attackers can adapt. Continuous improvement needed.

---

## Future Threats

### Adaptive Attacks

**Scenario:** Attacker learns CogX thresholds and engineers around them

**Defense:**

- Randomize thresholds slightly (noise injection)
- Pattern detection should be unpredictable
- Community-driven pattern updates

---

### Coordinated Campaigns

**Scenario:** Multiple attackers coordinate gradual changes across repos

**Defense:**

- Cross-repo drift analysis (future work)
- Community threat intelligence sharing
- Anomaly detection for coordinated timing

---

### AI-Assisted Social Engineering

**Scenario:** Attacker uses LLM to craft perfectly plausible PRs

**Defense:**

- Semantic drift still detectable (embeddings don't lie)
- Human judgment for final decisions
- Multi-party review for mission changes

---

## Conclusion

Mission drift attacks are a **real and growing threat** for AI-assisted development tools. As more projects adopt semantic analysis and strategic alignment, the attack surface increases.

**Key takeaways:**

1. **Gradual is more dangerous than obvious** - Each small change looks fine
2. **Traditional defenses are blind** - Code review and static analysis miss this
3. **Embeddings enable detection** - Semantic drift is measurable
4. **No perfect defense exists** - Defense-in-depth is essential
5. **Community awareness matters** - Share incidents, improve defenses

**CogX approach:**

- 🔍 Detect drift through embedding analysis
- 📊 Provide evidence for human review
- 🚨 Alert on suspicious patterns
- 📝 Create audit trail for forensics
- 👤 Respect user autonomy (advisory by default)

**The goal:** Make mission drift attacks **detectable and attributable**, not impossible.

---

**Contributing:** Found a novel attack pattern? Encountered drift in the wild? Please share:

- GitHub Issues: https://github.com/anthropics/cogx/issues
- Security: security@anthropic.com

---

**Last updated:** 2025-10-26
**Version:** 1.0
**License:** AGPLv3
