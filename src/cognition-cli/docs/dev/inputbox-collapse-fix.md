# InputBox Collapse Fix - The Hard-Won Battle

**Date:** 2025-01-29
**Context:** Wizard confirmation modal integration
**Affected File:** `src/tui/components/InputBox.tsx`

## The Problem

When displaying confirmation modals (tool confirmation or wizard confirmation), the InputBox would **completely collapse** to just two horizontal border lines with no content between them:

```
─────────────────────────────────────────────────────────────────
─────────────────────────────────────────────────────────────────
```

Instead of showing a helpful tip message like:

```
─────────────────────────────────────────────────────────────────
> Select Source Directories - Use ↑↓ arrows, Space to toggle...
─────────────────────────────────────────────────────────────────
```

## Root Cause

The issue was in how the confirmation pending state was rendered in the InputBox component. The rendering pattern didn't match what was proven to work for tool confirmation.

## The Solution - EXACT Pattern to Follow

### ✅ CORRECT Pattern (What Works)

```tsx
{
  /* Input content area */
}
<Box flexDirection="column" minHeight={1}>
  {confirmationPending ? (
    /* Show static tip when confirmation modal is active */
    <>
      <Text color="#f85149">{'> '}</Text>
      <Text dimColor color="#8b949e">
        {wizardConfirmationState?.pending
          ? wizardConfirmationState.mode === 'select'
            ? `${wizardConfirmationState.title} - Use ↑↓ arrows, Space to toggle, Enter to confirm, Esc to cancel`
            : `${wizardConfirmationState.title} - Press Y to confirm, N to skip, Esc to cancel`
          : 'Waiting for tool confirmation... (See prompt above)'}
      </Text>
    </>
  ) : (
    /* Normal input rendering */
    <>{/* ... normal input rendering code ... */}</>
  )}
</Box>;
```

### ❌ INCORRECT Patterns (What Doesn't Work)

#### Wrong: Wrapping tip in a Box

```tsx
{confirmationPending ? (
  <Box>  {/* ❌ DON'T wrap in Box */}
    <Text color="#f85149">{'> '}</Text>
    <Text dimColor color="#8b949e">Tip text...</Text>
  </Box>
) : (
  /* normal input */
)}
```

#### Wrong: Trying to show both input and tip simultaneously

```tsx
<>
  {/* Always show input */}
  {/* ... input rendering ... */}

  {/* Also show tip when wizard active */}
  {wizardConfirmationState?.pending && (
    <Box marginTop={1}>
      {' '}
      {/* ❌ This causes collapse */}
      <Text>Tip text...</Text>
    </Box>
  )}
</>
```

#### Wrong: Not setting minHeight on parent Box

```tsx
<Box flexDirection="column">  {/* ❌ Missing minHeight={1} */}
  {confirmationPending ? (
    /* tip */
  ) : (
    /* input */
  )}
</Box>
```

## Key Requirements

1. **Parent Box MUST have `minHeight={1}`**
   - This prevents the Box from collapsing when content changes
   - `<Box flexDirection="column" minHeight={1}>`

2. **Use fragments `<>...</>` NOT Box for wrapping**
   - Don't wrap the tip Text components in a Box
   - Use a fragment instead: `<> <Text>...</Text> </>`

3. **Conditional rendering: tip XOR input, never both**
   - When `confirmationPending` is true: show ONLY the tip
   - When `confirmationPending` is false: show ONLY the input
   - Never try to show both simultaneously

4. **Match the tool confirmation pattern EXACTLY**
   - This pattern was battle-tested and proven to work
   - Any deviation risks re-introducing the collapse bug

## Why This Pattern Works

The collapse happens when Ink's layout engine can't properly calculate the height of the content area. By ensuring:

1. A minimum height is set on the parent Box
2. Content is always rendered (tip OR input, but something is always there)
3. Text components are not over-wrapped in unnecessary Boxes

...we give Ink stable dimensions to work with, preventing the collapse.

## Reference Commit

The original fix for tool confirmation: `06a0bdb`

```bash
git show 06a0bdb
```

This commit shows the exact pattern that works for confirmation modals.

## Testing the Fix

1. Start TUI with onboarding wizard
2. Open a wizard modal (e.g., source directory selection)
3. Verify the InputBox shows the tip message between the borders
4. Press ESC to close the wizard
5. Verify the InputBox returns to normal input mode

If you see two horizontal lines with nothing between them, the collapse bug has returned.

## Never Again

This was a **super-tricky** issue to debug. The pattern is now documented. If you need to add new confirmation modals or modify the InputBox:

**FOLLOW THIS PATTERN EXACTLY. DO NOT DEVIATE.**

Any changes to the InputBox confirmation rendering should be compared against this document and the reference commit to ensure the pattern is preserved.

---

**Lessons Learned:**

- Ink's layout engine is sensitive to Box nesting and height calculations
- Proven patterns should be replicated exactly, not "reimagined"
- `minHeight={1}` is critical for preventing collapse
- Fragments are better than Boxes for simple grouping

**Final Note:** If this bug returns, check:

1. Is `minHeight={1}` still on the parent Box?
2. Are we using fragments instead of Boxes for the tip?
3. Are we showing tip XOR input (not both)?
