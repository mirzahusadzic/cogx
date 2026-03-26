# Transform Compaction (Future: Phase 6)

As the transform log grows over months of development, it becomes massive. A compaction
strategy (analogous to `git gc`) is needed but not urgent — soft-delete means invalidated
transforms accumulate.

**Approach:** Squash intermediate transforms while preserving high-level intent chain.

```bash
cognition-cli transforms compact --before 2025-01-01 --dry-run

# Output:
# 1,247 transforms eligible for compaction
#   843 invalidated (will be purged)
#   404 intermediate (will be squashed into 67 summary transforms)
#   Intent chains preserved: 67 summary narratives generated
```

**Rules:**

- Never compact transforms with `source.type: 'ai_agent'` (reasoning is precious)
- Never compact transforms less than N days old (configurable, default 90)
- Always preserve chain endpoints (first and latest transform per file)
- Generate summary transforms that concatenate the intent chain into a single narrative
- Compaction is reversible if transform log is backed up (which it should be — it's append-only)

**Why parked:** With soft-delete, the log is append-only and immutable. It will be months
before any real project hits storage pressure. By then, usage patterns will inform the
compaction strategy better than upfront design.
