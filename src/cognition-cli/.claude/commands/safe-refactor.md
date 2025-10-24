# Safe Refactoring Workflow

Perform refactoring with full impact awareness and risk assessment.

## Goal

Help the user refactor code safely by:

1. Analyzing blast radius before making changes
2. Assessing risk level
3. Recommending safe approaches
4. Identifying critical paths that need testing

## Steps

1. **Ask which component to refactor**
   - Get the symbol name from the user
   - Validate it exists in the PGC

2. **Analyze blast radius**
   - Run `cognition-cli blast-radius <component> --json`
   - Parse the JSON to extract:
     - Total symbols impacted
     - Direct consumers count
     - Maximum depth of dependencies
     - Risk level
     - Critical paths

3. **Assess risk and provide recommendation**

   **LOW RISK** (< 10 symbols, < 5 consumers):

   ```bash
   ✅ LOW RISK - Safe to refactor with standard precautions
   ```

   **MEDIUM RISK** (10-30 symbols, 5-15 consumers):

   ```bash
   ⚠️ MEDIUM RISK - Exercise caution, ensure good test coverage
   ```

   **HIGH RISK** (30-50 symbols, 15-30 consumers):

   ```bash
   ⚠️ HIGH RISK - Recommend incremental approach and comprehensive testing
   ```

   **CRITICAL RISK** (> 50 symbols, > 30 consumers):

   ```bash
   🚨 CRITICAL RISK - Strongly recommend breaking into smaller changes
   ```

4. **For MEDIUM, HIGH, or CRITICAL risk:**
   - Show critical dependency paths
   - Suggest safer approaches:
     - Incremental refactoring
     - Feature flags
     - Parallel implementation with gradual migration
     - Interface-preserving changes
   - Identify which tests need creation/updating

5. **If user wants to proceed:**
   - Offer to create tests for critical paths first
   - Suggest implementation strategy
   - Remind about running `cognition-cli update` after changes

## Output Format Example

### LOW RISK Example

```bash
Analyzing blast radius for: UserPreferences

✅ LOW RISK REFACTORING

Blast Radius Analysis:
  - Total Impact: 7 symbols
  - Direct Consumers: 3 files
  - Maximum Depth: 2 levels
  - Risk Level: LOW ✅

Direct Consumers:
  1. UserDashboard (displays user preferences)
  2. SettingsPanel (allows editing preferences)
  3. ProfilePage (shows summary)

✅ RECOMMENDATION: Safe to proceed with standard testing
  - Add unit tests for new functionality
  - Update integration tests for the 3 consumers
  - Standard code review should be sufficient

Ready to refactor! What changes would you like to make?
```

### HIGH RISK Example

```bash
Analyzing blast radius for: AuthService

⚠️ HIGH RISK REFACTORING DETECTED

Blast Radius Analysis:
  - Total Impact: 47 symbols
  - Direct Consumers: 15 files
  - Maximum Depth: 4 levels
  - Risk Level: HIGH ⚠️

Critical Paths (showing top 3):
  1. AuthService → LoginController → UserDashboard → RoleManager → PermissionCache
     Impact: Auth affects user interface AND permission system

  2. AuthService → PermissionChecker → AdminPanel → AuditLog → ComplianceReport
     Impact: Changes could affect admin features AND compliance

  3. AuthService → SessionManager → WebSocketServer → RealTimeNotifications → PushService
     Impact: Session changes affect real-time features

⚠️ RECOMMENDATION: High-risk component with deep dependencies

Safer Approach:
1. **Phase 1: Add Tests** (DO THIS FIRST)
   - Create integration tests for all 3 critical paths
   - Add specific tests for edge cases in authentication
   - Ensure test coverage > 90% for AuthService

2. **Phase 2: Implement with Feature Flag**
   - Add feature flag: `NEW_AUTH_SERVICE`
   - Implement new logic behind flag
   - Test in staging with flag enabled

3. **Phase 3: Incremental Rollout**
   - Path 1: SessionManager path (lowest risk)
   - Path 2: PermissionChecker path (medium risk)
   - Path 3: LoginController path (highest risk - do last)
   - Verify each path thoroughly before moving to next

4. **Phase 4: Monitoring & Validation**
   - Monitor error rates during rollout
   - Have rollback plan ready
   - Gradual percentage rollout (10% → 50% → 100%)

Alternative: Interface-Preserving Refactoring
- Keep AuthService's public API identical
- Refactor internal implementation only
- This limits blast radius to just AuthService itself
- Much safer but may limit refactoring scope

⚠️ Estimated effort: 2-3 days for safe implementation
⚠️ Risk if rushed: Authentication bugs, security vulnerabilities

What would you like to do?
1. Create tests for critical paths first? (RECOMMENDED)
2. Discuss interface-preserving approach?
3. Review specific critical paths in detail?
```

## Follow-up Questions

Based on risk level:

**LOW RISK:**

- "What changes would you like to make?"
- "Should I proceed with the refactoring?"

**MEDIUM RISK:**

- "Should I help create tests first?"
- "Would you like to see the consumer code before refactoring?"

**HIGH/CRITICAL RISK:**

- "Would you like me to create comprehensive tests for the critical paths?"
- "Should we explore an interface-preserving approach?"
- "Would you like to break this into smaller, safer refactorings?"

## Notes

- Always prioritize safety over speed
- Be explicit about risks - don't sugarcoat high-risk situations
- Suggest practical, actionable alternatives
- Consider the user's experience level
- Offer to help with test creation for high-risk refactorings
- Remember: It's better to prevent a catastrophic bug than to fix it later
