# Security Check

Perform comprehensive security analysis using O₂ security guidelines.

## Your Task

1. **Check symbol security coverage** from O₂
2. **Identify attack vectors** that apply
3. **Verify mitigations** are in place
4. **Check security boundaries** aren't violated
5. **Assess alignment** with security principles

## Commands to Run

```bash
# 1. Check if symbol has security coverage
cognition-cli lattice "O2" | grep -i "[SYMBOL_NAME]"

# 2. Find coverage gaps
cognition-cli security coverage-gaps

# 3. Check attack vectors
cognition-cli security attacks

# 4. Review security boundaries
cognition-cli security boundaries

# 5. Check alignment with mission security principles
cognition-cli lattice "O2 ~ O4[security]"

# 6. Full security context
cognition-cli lattice "O2[[SYMBOL_NAME]]" --format json
```

## Security Analysis

**Symbol**: [Symbol Name]
**File**: [File path]
**Type**: [Function/Class/etc.]

### Coverage Status

- ✅ **Fully Covered**: Security analysis complete
- ⚠️ **Partial Coverage**: Some aspects analyzed
- ❌ **No Coverage**: Not in O₂ security overlay

### Applicable Attack Vectors

[List attack vectors from O₂ that apply to this symbol]

1. [Attack type] - Severity: [critical/high/medium/low]
2. [Attack type] - Severity: [level]

### Mitigations in Place

[List mitigations from O₂ that are implemented]

- ✅ [Mitigation name]: [How it's implemented]
- ⚠️ [Mitigation name]: [Partially implemented]
- ❌ [Mitigation name]: [Missing - CRITICAL]

### Security Boundaries

**Boundaries Touched**:
[List security boundaries from O₂ this code interacts with]

**Constraints to Honor**:
[List security constraints that apply]

**Validation Required**:
[Input validation, output sanitization, etc.]

### Threat Model

**Trust Boundary**:

- External input: [Yes/No]
- Privileged operation: [Yes/No]
- Data exposure risk: [High/Medium/Low]

**Attack Surface**:
[Describe exposed attack surface]

**Severity Assessment**:

- Impact if compromised: [Critical/High/Medium/Low]
- Likelihood of exploit: [High/Medium/Low]
- **Overall Risk**: [Level]

## Recommendations

### Immediate Actions

1. [ ] [Critical security fixes needed]
2. [ ] [High-priority mitigations to add]

### Best Practices

1. [Security pattern to follow from O₅]
2. [Validation strategy]
3. [Defense in depth layers]

### Testing Requirements

**Security Tests Needed**:

- [ ] Input validation tests
- [ ] Boundary condition tests
- [ ] Injection attack tests
- [ ] Authorization tests
- [ ] [Domain-specific tests]

### Code Review Checklist

- [ ] All inputs validated
- [ ] Outputs sanitized
- [ ] Error handling secure (no info leaks)
- [ ] Logging appropriate (no sensitive data)
- [ ] Cryptography used correctly
- [ ] Access controls enforced
- [ ] Rate limiting in place (if applicable)

## Mission Alignment

**Security Principles** (from O₄):
[Relevant security principles from mission]

**Alignment Score**: [X%]
[How well this code honors security mission principles]

## Related Security Context

**Similar Secure Implementations**:
[List symbols with high security coherence from O₇]

**Past Security Issues**:
[Any historical context from mission docs]

**Dependencies to Audit**:
[Third-party code that needs security review]

---

**CRITICAL**: Run `cognition-cli quest-verify` before committing security-sensitive code.
