# Security Blast Radius

Analyze cascading security impact when a file or symbol is compromised (O₂+O₃).

## Your Task

1. **Identify security threats** - What vulnerabilities apply? (O₂)
2. **Calculate blast radius** - What depends on this? (O₃)
3. **Find critical paths** - What are the high-impact chains?
4. **Assess data exposure** - What data could be compromised?
5. **Prioritize remediation** - Where to focus security efforts?

## Commands to Run

```bash
# Analyze security blast radius for a file
cognition-cli security blast-radius src/auth/manager.ts

# Analyze for a specific symbol
cognition-cli security blast-radius AuthManager

# Get JSON output for automation
cognition-cli security blast-radius validateToken --json

# Limit blast radius depth
cognition-cli security blast-radius src/api/handler.ts --max-depth 5
```

## Security Blast Radius Analysis

**Target**: [file or symbol]
**Type**: [File/Symbol]

### 🔐 Security Threats (O₂)

**Applicable Threats**: [count]

[List specific threats from O₂ that apply to this code]

1. **[Threat Type]**
   - Severity: [Critical/High/Medium/Low]
   - CVE: [CVE-ID if applicable]
   - Description: [threat description]
   - Similarity: [X%]

**Severity Distribution**:

- Critical: [count]
- High: [count]
- Medium: [count]
- Low: [count]

### 💥 Blast Radius (O₃)

**Direct Consumers**: [count]
**Transitive Impact**: [total affected symbols]
**Max Depth**: [depth]

**Consumers** (what depends on this):
[List symbols that directly consume this code]

**Dependencies** (what this depends on):
[List symbols this code depends on]

### 🔴 Critical Security Paths

**High-Impact Chains**:

1. **[Path Description]** (depth: [N])

   ```
   [Symbol A] → [Symbol B] → [Symbol C] → [vulnerable target]
   ```

   Impact: [why this path is critical]

2. **[Path Description]** (depth: [N])
   ```
   [path chain]
   ```
   Impact: [impact description]

### 📊 Data Exposure Assessment

**Data Types at Risk**:

- User credentials: [Yes/No]
- Personal information: [Yes/No]
- Financial data: [Yes/No]
- API keys/secrets: [Yes/No]
- [Domain-specific data types]

**Exposure Paths**:
[Trace how compromised code could expose data through dependency chain]

**Data Flow**:

```
[Source] → [Processing] → [vulnerable point] → [Exposure risk]
```

## Risk Assessment

**Overall Severity**: [Critical/High/Medium/Low]

**Risk Factors**:

1. **Attack Vector Severity**: [Level]
   - Number of applicable threats: [count]
   - Highest severity: [Critical/High/etc.]

2. **Blast Radius Size**: [Small/Medium/Large]
   - Direct consumers: [count]
   - Total impacted: [count]
   - Affects critical systems: [Yes/No]

3. **Data Sensitivity**: [High/Medium/Low]
   - Sensitive data exposed: [Yes/No]
   - Scope of exposure: [describe]

4. **Attack Complexity**: [Low/Medium/High]
   - Easy to exploit: [Yes/No]
   - Requires authentication: [Yes/No]
   - Requires privileges: [Yes/No]

**Combined Risk Score**: [0-100]

## Remediation Priorities

### 🔴 Critical (Fix Immediately)

1. [Critical vulnerability with large blast radius]
2. [Critical vulnerability affecting sensitive data]

### 🟡 High Priority

1. [High severity threat with medium blast radius]
2. [Medium threat with large blast radius]

### 🟢 Medium Priority

1. [Medium severity with small blast radius]
2. [Low severity with large blast radius]

## Mitigation Strategy

### Immediate Actions

1. **Isolate the vulnerability**

   ```bash
   # Add security boundary
   [code changes needed]
   ```

2. **Validate all inputs**
   [List input validation needed]

3. **Add monitoring**
   [Metrics/logs to add]

### Defensive Layers

**Defense in Depth**:

1. **Input Layer**: [validation/sanitization]
2. **Processing Layer**: [security checks]
3. **Output Layer**: [encoding/escaping]
4. **Monitoring Layer**: [alerts/logging]

### Containment Strategy

**Reduce Blast Radius**:

1. Break dependencies: [How to decouple]
2. Add security boundaries: [Where to add checks]
3. Implement circuit breakers: [For cascading failures]

## Testing Requirements

### Security Tests Needed

- [ ] Input validation tests
- [ ] Boundary condition tests
- [ ] Injection attack tests (SQL, XSS, command, etc.)
- [ ] Authentication bypass tests
- [ ] Authorization escalation tests
- [ ] Rate limiting tests
- [ ] [Threat-specific tests]

### Blast Radius Tests

**Test Each Consumer**:
[List consumers that need security testing]

**Integration Tests**:

- [ ] Test critical paths with malicious input
- [ ] Verify security boundaries hold
- [ ] Confirm data isolation

## Incident Response

**If This Were Compromised**:

1. **Immediate Impact**:
   [What fails/leaks immediately]

2. **Cascading Failures**:
   [What else could be compromised through dependencies]

3. **Detection Strategy**:
   [Logs/metrics to monitor]

4. **Rollback Plan**:
   [How to quickly mitigate]

## Recommendations

### Architecture Improvements

1. **Reduce Blast Radius**:
   - Decouple: [specific dependencies to break]
   - Isolate: [components to sandbox]
   - Boundary: [where to add security checks]

2. **Strengthen Security**:
   - Mitigations: [from O₂ to implement]
   - Validation: [input/output to validate]
   - Monitoring: [detection to add]

### Code Changes

```bash
# Example: Add input validation
[code snippet]

# Example: Add security boundary
[code snippet]

# Example: Implement mitigation from O₂
[code snippet]
```

### Monitoring & Alerts

**Add Logging For**:

- Authentication attempts
- Authorization failures
- Input validation failures
- [Threat-specific events]

**Set Alerts For**:

- Anomalous access patterns
- Rate limit violations
- Security boundary violations

## CI/CD Integration

```bash
# Add to security pipeline
cognition-cli security blast-radius $CHANGED_FILE --json > blast-radius.json

# Check risk score
RISK=$(jq -r '.risk_assessment.severity' blast-radius.json)
if [ "$RISK" == "critical" ]; then
  echo "❌ Critical security blast radius detected"
  exit 1
fi

# Require security review for high-impact changes
IMPACT=$(jq -r '.blast_radius.total_impacted' blast-radius.json)
if [ "$IMPACT" -gt 50 ]; then
  echo "⚠️ Large blast radius: requires security review"
  # Trigger manual review workflow
fi
```

## Related Commands

- `/security-check` - Deep security analysis of specific symbol
- `/pr-review` - Full PR security + mission + coherence analysis
- `/analyze-impact` - General blast radius analysis
- `/trace-dependency` - Understand dependency chains

---

**CRITICAL**: Use this before deploying changes to security-sensitive code!
