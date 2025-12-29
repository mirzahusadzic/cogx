# The `MALFORMED_FUNCTION_CALL` you're seeing with Gemini 2.x is almost always caused by **Schema Complexity Fatigue**.

While Gemini 3.x has a vastly improved "reasoning-over-structure" capability, earlier models (2.x) often struggle when a tool has **deeply nested structures** or when it sends `null` for optional fields that aren't explicitly marked as nullable.

To address this, `SigmaTaskUpdate` has been robustified using the following patterns:

## 1. Top-Level Parallel Arrays (The v2.0 Protocol)

To keep the `todos` array from becoming a deeply nested tree (which causes "Schema Complexity Fatigue"), we use **three parallel top-level arrays** (`todos`, `grounding`, `grounding_evidence`) that correlate via a shared `id`.

- **Why this helps:** It reduces the nesting depth of the JSON schema. Gemini models often find it easier to generate multiple simple objects in separate arrays than one massive, deeply recursive object.
- **Implementation:** The `gemini-adk-tools.ts` and `openai-agent-tools.ts` providers both implement a "Merge-on-Read" pattern where they receive these parallel arrays and merge them into a single structure before passing them to the core execution logic.

## 2. Explicit Nullability (The "Null vs. Omission" Fix)

Gemini has a documented quirk where it often sends `null` for optional fields instead of simply omitting the key. If your schema defines a field but doesn't explicitly mark it as `nullable: true`, and the model sends `null`, the ADK/Gemini bridge throws a `MALFORMED_FUNCTION_CALL` before it even hits your `execute` function.

**Our Solution:**

- Ensure **every** optional field in the JSON Schema is explicitly `nullable: true`.
- In the tool's `execute` function, implement a sanitization pass that strips these `null` values or converts them to `undefined` before processing.

## 3. Flexible Type Coercion

Sometimes Gemini sends `"true"`/`"false"` as strings for boolean fields.

- **Our Solution:** Use `anyOf: [{ type: Type.BOOLEAN }, { type: Type.STRING }]` in the schema and use a `coerceBoolean()` helper in the implementation.

## 4. Use "Strict" String Enums

Gemini 2.x occasionally tries to be "creative" with enums if the description is too wordy.
**Recommendation:** Keep enum descriptions short and put complex instructions in the main tool description.

## 5. Reasoning-First Planning

Since we enforce `Reasoning First` in the system prompt, the agent "pre-calculates" the IDs and structure in its thinking block before attempting the tool call. This acts as a workspace to ensure IDs match across the parallel arrays.
