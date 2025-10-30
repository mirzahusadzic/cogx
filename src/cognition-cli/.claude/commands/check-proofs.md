# Check Proofs

Check mathematical proofs and theorems for formal verification.

## Your Task

1. **Search O₆ mathematical proofs** for relevant theorems
2. **Verify proof alignment** with mission concepts (O₄)
3. **Check code implementations** that claim to implement proven theorems
4. **Identify proof gaps** where formal verification is missing
5. **Suggest formalization** opportunities

## Commands to Run

```bash
# 1. List all theorems
cognition-cli proofs theorems

# 2. List all lemmas
cognition-cli proofs lemmas

# 3. Search for specific proof
cognition-cli proofs list --type theorem | grep -i "[THEOREM_NAME]"

# 4. Find proofs aligned with mission
cognition-cli proofs aligned

# 5. Check if code symbol has corresponding proof
cognition-cli lattice "O6[theorem] ~ O1[[SYMBOL_NAME]]"

# 6. Mathematical statements by type
cognition-cli proofs list --type [theorem|lemma|axiom|proof|identity]
```

## Proof Analysis

**Theorem/Lemma**: [Name]
**Type**: [theorem/lemma/axiom/identity]
**Stated in**: [Document/file reference]

**Formal Statement**:
[Mathematical statement from O₆]

**Proof Status**:

- ✅ Formally proven
- ⚠️ Proof sketched (informal)
- ❌ Claimed but unproven
- 🔄 Proof in progress

**Code Implementations**:
[List symbols from O₁ that implement this theorem]

1. [Symbol] - [Coherence score%]
2. [Symbol] - [Coherence score%]

**Dependencies**:

- **Axioms**: [List required axioms]
- **Lemmas**: [List required lemmas]
- **Theorems**: [List prerequisite theorems]

**Mission Alignment**: [Score%]
[How this proof supports mission principles from O₄]

## Verification Checklist

**Formal Verification**:

- [ ] Proof formally stated in O₆
- [ ] All steps documented
- [ ] Dependencies identified
- [ ] Code implementation verified
- [ ] Edge cases covered

**Proof Gaps**:
[List areas where proofs are claimed but not formal]

**Formalization Opportunities**:

1. [Where informal reasoning could be formalized]
2. [Invariants that could be proven]
3. [Algorithms that could have correctness proofs]

## Recommendations

**If Proof Exists**:

1. Verify implementation matches formal statement
2. Check all preconditions are enforced
3. Ensure invariants are maintained

**If Proof Missing**:

1. Document informal reasoning
2. Identify proof obligations
3. Consider formal verification effort

**Related Proofs**:
[List related theorems/lemmas from O₆]

**Security Implications** (if applicable):
[If proof relates to security properties from O₂]
