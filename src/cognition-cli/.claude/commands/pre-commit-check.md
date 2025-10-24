# Pre-Commit Quality Check

Run a comprehensive quality check before committing code.

## Goal

Ensure code quality and PGC coherence before every commit by:

1. Checking PGC coherence with dirty_state
2. Analyzing commit size and impact
3. Running tests (if available)
4. Providing clear commit recommendation

## Steps

1. **Check PGC Coherence**
   - Run `cognition-cli status --verbose`
   - If coherent: ✅ proceed
   - If incoherent: Show which symbols are affected and their blast radius

2. **Analyze Commit Size**
   Based on impacted symbols:
   - **Small** (1-5 symbols): ✅ Good commit! Focused and manageable
   - **Medium** (6-15 symbols): ⚠️ Review for cohesion - could this be split?
   - **Large** (15+ symbols): 🚨 Strongly suggest splitting into multiple commits

3. **Calculate Blast Radius**
   For modified files with > 10 affected symbols:
   - Run `cognition-cli blast-radius <symbol>` for major changes
   - Show risk level and critical paths
   - Warn if high-risk changes are included

4. **Run Tests** (if test command exists)
   - Check for `package.json` scripts: test, test:unit, etc.
   - Run available tests
   - Report pass/fail status

5. **Provide Final Recommendation**
   - ✅ SAFE TO COMMIT: Coherent, focused, tests passing
   - ⚠️ REVIEW RECOMMENDED: Medium impact or some concerns
   - 🚨 BLOCKING ISSUES: Incoherent, large impact, or failing tests

## Output Format

```bash
Running pre-commit quality checks...

1. PGC Coherence Check
   Status: 🎐 INCOHERENT
   Modified files: 2
   Impacted symbols: 7

   Details:
   ✗ src/auth/session.ts
     Symbols: createSession, destroySession, refreshToken
   ✗ src/auth/middleware.ts
     Symbols: authMiddleware, validateToken, checkPermissions, extractUser

2. Commit Size Analysis
   Impact Level: MEDIUM (7 symbols)
   Assessment: ⚠️ Moderate change affecting auth module

   The 7 affected symbols are all within the auth concern.
   This appears to be a cohesive change.

3. Blast Radius Check
   Checking high-impact symbols...
   - authMiddleware: 12 consumers (MEDIUM risk)
   - validateToken: 5 consumers (LOW risk)

   Overall Risk: MEDIUM ⚠️

4. Test Suite
   Running: npm test
   ✅ All 147 tests passing (2.3s)

───────────────────────────────────────
RECOMMENDATION: ⚠️ REVIEW BEFORE COMMIT

Summary:
  • PGC is incoherent - run `cognition-cli update` first
  • Medium-sized change (7 symbols in auth module)
  • Tests are passing ✅
  • Appears to be cohesive within auth concern

Suggested Actions:
  1. Run `cognition-cli update` to sync PGC
  2. Review if all changes belong in one commit
  3. Consider commit message: "refactor(auth): improve session management and validation"

Proceed with commit? (Recommended after update)
```

## Blocking Conditions

Should return **🚨 BLOCKING ISSUES** if:

- PGC is incoherent AND user hasn't run update
- More than 20 symbols affected (suggest splitting)
- Tests are failing
- High-risk or critical-risk blast radius detected

## Use Cases

1. **Pre-Commit Hook**: Run automatically before every commit
2. **Manual Check**: Run when unsure if ready to commit
3. **Code Review Prep**: Ensure quality before creating PR
4. **CI/CD Gate**: Block merges that don't meet quality bar

## Integration

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Ask Claude to run pre-commit check
claude "Please run /pre-commit-check and tell me if it's safe to commit"
```

## Notes

- Be strict about PGC coherence - it's foundational
- Use blast radius to catch high-risk changes
- Smaller commits lead to faster updates and safer changes
- Tests are critical - always report their status
- Provide actionable next steps, not just problems
