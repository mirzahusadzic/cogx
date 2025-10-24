# Find Refactoring Candidates

Use structural pattern similarity to discover refactoring opportunities.

## Goal

Identify code that shares high structural similarity and suggest concrete refactorings based on architectural roles.

## Steps

1. Run `cognition-cli patterns list` to get all symbols

2. For each major architectural role (component, service, utility):
   - Select representative symbols
   - Run `cognition-cli patterns find-similar <symbol> --top-k 10`
   - Identify groups with similarity > 0.85

3. For each high-similarity group:
   - Describe what patterns they share
   - Suggest concrete refactoring approaches:
     - Extract common interfaces
     - Create base classes
     - Apply strategy pattern
     - Implement shared utilities
   - Estimate code reduction potential

4. Prioritize suggestions by:
   - Similarity score (higher = more similar)
   - Number of affected components (more = higher impact)
   - Architectural role (focus on components and services)

## Output Format

Present findings as actionable refactoring suggestions with specific symbol names and approaches.

## Example

```
Analyzing structural patterns for refactoring opportunities...

🔍 Refactoring Candidates Found:

1. **User Management Patterns** (0.94 similarity):
   - UserManager (src/services/user-manager.ts)
   - AdminManager (src/services/admin-manager.ts)
   - GuestManager (src/services/guest-manager.ts)

   Shared Patterns:
   - Constructor takes config and database connection
   - All have create(), update(), delete(), findById() methods
   - Similar error handling patterns
   - Same dependency injection approach

   💡 Refactoring Suggestion:
   - Extract interface: IAccountManager
   - Create base class: BaseAccountManager
   - Potential code reduction: ~180 lines (~40%)
   - Effort: Medium (2-3 hours)

2. **Data Validators** (0.91 similarity):
   - EmailValidator (src/validators/email-validator.ts)
   - PhoneValidator (src/validators/phone-validator.ts)
   - URLValidator (src/validators/url-validator.ts)

   Shared Patterns:
   - Single validate() method signature
   - Return boolean or throw ValidationError
   - Similar regex-based validation logic

   💡 Refactoring Suggestion:
   - Create ValidatorStrategy interface
   - Implement strategy pattern for validation
   - Benefits: Easier testing, simpler addition of new validators
   - Potential code reduction: ~60 lines (~30%)
   - Effort: Low (1-2 hours)

3. **HTTP Controllers** (0.87 similarity):
   - UserController (src/controllers/user-controller.ts)
   - ProductController (src/controllers/product-controller.ts)
   - OrderController (src/controllers/order-controller.ts)

   Shared Patterns:
   - Express route handlers
   - Similar error handling middleware
   - Common request/response formatting

   💡 Refactoring Suggestion:
   - Extract BaseController with common patterns
   - Create standard response formatters
   - Implement shared error handling middleware
   - Potential code reduction: ~140 lines (~35%)
   - Effort: Medium (2-4 hours)

📊 Summary:
  - Total opportunities found: 3 groups (11 symbols)
  - Estimated total code reduction: ~380 lines
  - Total estimated effort: 5-9 hours
  - Primary benefit: DRY compliance, easier maintenance

Would you like me to implement any of these refactorings?
```

## Follow-up Questions

After presenting findings, ask:

- "Which refactoring would you like to tackle first?"
- "Should I create a detailed implementation plan for any of these?"
- "Would you like me to analyze a specific architectural role more deeply?"

## Notes

- Focus on practical, actionable suggestions
- Provide specific file paths and symbol names
- Estimate effort and impact realistically
- Consider the team's coding standards and patterns
- Suggest incremental refactoring when impact is large
