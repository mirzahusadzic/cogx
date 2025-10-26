# Pattern Library: Reusable Extraction Patterns

> **Purpose**: Capture discovered patterns for reuse across document types. THIS DOCUMENT DOES NOT RECURSE - it's the termination point.

**Last Updated**: October 26, 2025
**Status**: Bootstrap complete, ready for community contributions

---

## How To Use This Library

### For Pattern Application (You Want To Extract Concepts)

1. **Identify your document type** (strategic doc, technical spec, API docs, etc.)
2. **Find matching patterns** in the sections below
3. **Tune parameters** for your doc type (see tuning guide)
4. **Run extraction** and verify with Oracle metrics
5. **Done** - don't recurse, just use the patterns

### For Pattern Discovery (You Found New Patterns)

1. **Observe your document structure** (what makes important concepts stand out?)
2. **Identify structural markers** (bold? specific headers? formatting?)
3. **Build extractor** for that marker
4. **Test and verify** quality with Oracle
5. **Document pattern here** (add to library below)
6. **Stop** - pattern is captured, extraction continues elsewhere

### Recursion Boundary

```text
┌─────────────────────────────────────────────────────────┐
│ THIS LIBRARY: Captures patterns (STATIC)                │
│                                                         │
│ EXTRACTORS: Apply patterns (DYNAMIC)                    │
│                                                         │
│ NEW DOCS: Get processed by extractors (CONSUMPTION)     │
│                                                         │
│ Don't recurse back to library - patterns are stable     │
└─────────────────────────────────────────────────────────┘
```

**Rule**: This library gets updated when NEW patterns are discovered, not from processing itself.

---

## Pattern Catalog

### Category 1: Strategic Document Patterns

**Source**: Discovered from VISION.md (October 26, 2025)

#### Pattern 1.1: Blockquote Essence

**Marker**: `> text` or `> _text_`

**Signal**: Blockquotes/epigraphs represent distilled essence - authors choose these for maximum impact

**Weight**: 1.0 (highest)

**Implementation**:

```typescript
private extractBlockquotes(content: string): string[] {
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.trim().startsWith('>')) {
      const text = line.substring(1).trim()
        .replace(/^[_*]+|[_*]+$/g, '');
      if (this.isValidConcept(text) && text.length > 15) {
        concepts.push(text);
      }
    }
  }
}
```

**Quality Gates**:

- Minimum 15 characters
- Must contain non-stop-words

**Example**:

```markdown
> _Augment human consciousness through verifiable AI-human symbiosis._
```

→ Extracts: "Augment human consciousness through verifiable AI-human symbiosis."

---

#### Pattern 1.2: Named Concept Headers

**Marker**: `###` or `####` headers (H3/H4)

**Signal**: Subsection headers are named concepts - they label ideas, not just organize

**Weight**: 0.95

**Implementation**:

```typescript
private extractSubHeaders(content: string): string[] {
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.trim().match(/^###\s+(.+)$/);
    if (match) {
      concepts.push(match[1].trim());
    }
  }
}
```

**Example**:

```markdown
### 1. Knowledge is a Lattice
```

→ Extracts: "Knowledge is a Lattice"

---

#### Pattern 1.3: Value Proposition Bullets

**Marker**: `- **Bold prefix** [—|,] context`

**Signal**: Structured value props combine concept label + explanation

**Weight**: 0.9

**Implementation**:

```typescript
private extractBulletPrefixes(content: string): string[] {
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^[-*•]\s+\*\*([^*]+)\*\*(?:[,—]\s*(.+?))?$/);
    if (match) {
      const prefix = match[1];
      const context = match[2]?.split(/[.!?]/)[0];
      concepts.push(context ? `${prefix}: ${context}` : prefix);
    }
  }
}
```

**Example**:

```markdown
- **AI reasoning is grounded in cryptographic truth**, anchoring intelligence in verifiable facts
```

→ Extracts: "AI reasoning is grounded in cryptographic truth: anchoring intelligence in verifiable facts"

---

#### Pattern 1.4: Emphatic Statements

**Marker**: `**Complete sentence.**`

**Signal**: Authors bold complete thoughts to emphasize key claims

**Weight**: 0.85

**Implementation**:

```typescript
private extractBoldSentences(content: string): string[] {
  const regex = /\*\*([^*]+[.!?])\*\*/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match[1].length >= 20) {
      concepts.push(match[1].trim());
    }
  }
}
```

**Example**:

```markdown
**Our mission is to establish verifiable AI-human symbiosis as foundational infrastructure.**
```

→ Extracts: "Our mission is to establish verifiable AI-human symbiosis as foundational infrastructure."

---

#### Pattern 1.5: Checklist Items

**Marker**: `[✅❌⚠️] **text** — explanation`

**Signal**: Emoji-prefixed items signal structured importance (requirements, status, decisions)

**Weight**: 0.8

**Implementation**:

```typescript
private extractEmojiPrefixed(content: string): string[] {
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^[-*•]?\s*[✅❌✓✗⚠️🔥💡]\s+(.+)$/);
    if (match) {
      // Extract bold + context after em-dash
      concepts.push(extractBoldAndContext(match[1]));
    }
  }
}
```

**Example**:

```markdown
✅ **Structured, verifiable understanding is a public utility**
```

→ Extracts: "Structured, verifiable understanding is a public utility"

---

#### Pattern 1.6: Coined Terms

**Marker**: `"quoted text"`

**Signal**: Quoted phrases capture industry terms, jargon, specific references

**Weight**: 0.75

**Implementation**:

```typescript
private extractQuoted(content: string): string[] {
  const regex = /"([^"]+)"/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const text = match[1].trim();
    if (!text.endsWith('?') && text.length >= 15) {
      concepts.push(text);
    }
  }
}
```

**Quality Gates**:

- Skip questions (examples, not concepts)
- Minimum 15 characters

**Example**:

```markdown
"embrace, extend, extinguish"
```

→ Extracts: "embrace, extend, extinguish"

---

## Pattern Discovery Methodology

### The Meta-Pattern: How We Found These Patterns

**This is the pattern for finding patterns. Use this, don't recurse on it.**

#### Step 1: Observe Document Structure

- Read the document as a human
- Notice what stands out visually
- Identify formatting that signals importance

#### Step 2: Hypothesis Structural Markers

- Bold text?
- Headers?
- Bullet points?
- Quotes?
- Emojis?
- Indentation?

#### Step 3: Build Targeted Extractor

```typescript
private extractPattern(content: string): string[] {
  // Match the structural marker
  // Extract text with context
  // Apply quality filters
  // Return concepts
}
```

#### Step 4: Test & Measure (Oracle Phase)

```bash
- Concept count in range? (20-200)
- Extraction ratio healthy? (10-20%)
- Fragment ratio low? (<10%)
- Top concepts high quality? (weight >= 0.7)
```

#### Step 5: Document Pattern

- Add to this library
- Include: marker, signal, weight, implementation, example
- Stop - don't extract from this documentation

#### Step 6: Apply Pattern

- Use on new documents
- Pattern library stays stable
- Extraction continues

**TERMINATION**: Pattern discovery stops when Oracle validates. Don't recurse infinitely.

---

## Tuning Guide

### Parameter Knobs For Adaptation

**When adapting patterns to new document types, tune these:**

#### Length Thresholds

```typescript
// Strategic docs (verbose)
minBlockquoteLength: 15;
minBoldSentenceLength: 20;
minQuotedLength: 15;

// Technical specs (terse)
minBlockquoteLength: 10;
minBoldSentenceLength: 15;
minQuotedLength: 10;

// Marketing content (flowery)
minBlockquoteLength: 20;
minBoldSentenceLength: 30;
minQuotedLength: 20;
```

#### Pattern Weights

```typescript
// Strategic docs (narrative focus)
blockquotes: 1.0;
subsectionHeaders: 0.95;
bulletPrefixes: 0.9;

// Technical specs (structure focus)
subsectionHeaders: 1.0; // Bump up
bulletPrefixes: 0.95; // Bump up
blockquotes: 0.8; // Reduce
```

#### Section Whitelist

```typescript
// Strategic docs
['Vision', 'Mission', 'Principles', 'Strategic Intent'][
  // Technical specs
  ('Abstract', 'Motivation', 'Specification', 'Implementation')
][
  // API docs
  ('Overview', 'Usage', 'Examples', 'API Reference')
];
```

---

## Validation Metrics (Oracle)

### Quality Heuristics

**Use these to validate extraction quality:**

1. **Concept Count**: 20-200 (depends on doc size)
   - < 20: Too selective, missing concepts
   - > 200: Too noisy, lower thresholds

2. **Extraction Ratio**: 10-20% of document
   - < 10%: Under-extraction
   - > 30%: Over-extraction, noise

3. **Fragment Ratio**: < 10% generic short fragments
   - High fragments = quality filters too weak

4. **Top Concept Weight**: Average >= 0.7
   - Low weight = patterns not matching well

5. **Alignment Quality** (if using for O₃):
   - Before: ~50% similarity (noisy)
   - After: 70-85% similarity (clean)

### Test Template

```bash
# Run extraction
concepts = extractor.extract(doc)

# Check metrics
conceptCount = concepts.length
extractionRatio = totalChars / docChars
fragmentRatio = shortFragments / total
topWeight = avg(top10.weight)

# Validate
assert 20 <= conceptCount <= 200
assert 0.10 <= extractionRatio <= 0.20
assert fragmentRatio < 0.10
assert topWeight >= 0.7
```

---

## Known Working Configurations

### VISION.md (Strategic Document)

**Document**: Open Cognition VISION.md
**Size**: 11,899 chars
**Result**: 26 concepts, 13.1% extraction, 0.818 top weight

**Configuration**:

```typescript
patterns: [blockquotes, headers, bullets, boldSentences, emoji, quoted];
whitelist: [
  'Vision',
  'Mission',
  'Principles',
  'Strategic Intent',
  'Opportunity',
  'Solution',
  'Crossroads',
  'Path Forward',
];
minBlockquote: 15;
minBoldSentence: 20;
minQuoted: 15;
```

**Success Criteria Met**: ✅ All heuristics passed

---

### 09_Mission_Concept_Extraction.md (Technical Doc)

**Document**: Concept extraction system documentation
**Size**: 33,138 chars
**Result**: 14 concepts, 2.0% extraction

**Configuration**:

```typescript
patterns: [blockquotes, headers, bullets, boldSentences, quoted];
whitelist: [
  'Overview',
  'Architecture',
  'Meta',
  'Philosophy',
  'Patterns',
  'Strategy',
  'Design',
];
minBlockquote: 15;
minBoldSentence: 20;
```

**Special Note**: Extracted its own patterns ("Blockquotes represent distilled essence")

---

## Anti-Patterns (What NOT To Do)

### ❌ Anti-Pattern 1: Sliding Window N-Grams

**Bad Approach**:

```typescript
// Extract all 2-4 word combinations
for (let i = 0; i < words.length; i++) {
  concepts.push(words.slice(i, i + 2).join(' '));
  concepts.push(words.slice(i, i + 3).join(' '));
  concepts.push(words.slice(i, i + 4).join(' '));
}
```

**Result**: 1,076 fragments, 50% similarity (noise drowns signal)

**Why It Fails**: Creates overlapping fragments without respecting author intent

---

### ❌ Anti-Pattern 2: Extract Everything Bold

**Bad Approach**:

```typescript
// Extract all bold text regardless of context
const boldRegex = /\*\*([^*]+)\*\*/g;
```

**Result**: Includes emphasized words mid-sentence, not complete concepts

**Why It Fails**: Bold signals importance, but context determines concept boundaries

---

### ❌ Anti-Pattern 3: No Quality Filters

**Bad Approach**:

```typescript
// Accept all extracted text
concepts.push(text); // No validation
```

**Result**: Includes stop-word-only phrases, punctuation, fragments

**Why It Fails**: Extraction without validation creates garbage

---

## Contribution Guide

### Adding New Patterns To This Library

**When you discover a new pattern:**

1. **Test thoroughly** (validate with Oracle metrics)
2. **Document completely**:
   - Pattern name and marker
   - What it signals (why authors use it)
   - Weight relative to other patterns
   - Implementation code
   - Quality gates
   - Real example from your document
3. **Show validation**:
   - Document type it works for
   - Extraction metrics achieved
   - Comparison to alternative approaches
4. **Commit to library**:
   - Add to appropriate category
   - Include tuning guidance
   - Add to known configurations

**Don't**:

- Submit patterns without validation
- Recurse on pattern documentation
- Create overlapping patterns
- Skip quality filters

---

## Recursion Boundary (IMPORTANT)

### Where Recursion Stops

```text
Pattern Discovery → Pattern Documentation → Pattern Library (YOU ARE HERE)
                                                     ↓
                                            Pattern Application
                                                     ↓
                                            New Documents
                                                     ↓
                                            Extracted Concepts
                                                     ↓
                                            STOP (don't come back to library)
```

**This library is the termination point for pattern recursion.**

When you extract concepts from documents, the concepts don't feed back into pattern discovery unless:

1. You manually observe a NEW structural marker
2. You build a NEW extractor
3. You validate with Oracle
4. You document it HERE

**The library doesn't extract itself recursively - it's the stable foundation.**

---

## Timeline: From Chaos To Order

### October 26, 2025 - The Bootstrap

**Morning**: 1,076 concepts @ 50% similarity (noise)
**Afternoon**: Discovered 6 patterns through structural mining
**Evening**: 26 concepts @ 85% similarity (signal)
**Night**: Recursive validation - system extracted its own patterns

**Outcome**: Pattern library established, recursion boundary defined

**Key Insight**: You can use structural mining to build structural mining tools, but you must stop recursing at the pattern library level.

---

## Future Patterns (Placeholders)

### Category 2: Technical Specification Patterns

**TODO**: Add RFC/ADR patterns when discovered

### Category 3: API Documentation Patterns

**TODO**: Add code block, parameter list patterns

### Category 4: Academic Paper Patterns

**TODO**: Add abstract, conclusion, figure caption patterns

### Category 5: Legal Document Patterns

**TODO**: Add citation, defined term, section reference patterns

---

## Meta-Note

**This document exists to PREVENT infinite recursion.**

It captures patterns so you can USE them, not recurse on them.

When you read this doc, you learn the patterns.
When you apply the patterns, you extract concepts.
When you extract concepts, you DON'T come back here.

**The loop is closed. The bootstrap is complete.**

Use the patterns. Build extractors. Process documents. Move forward.

Don't recurse back to this library unless you've discovered something genuinely NEW.

---

_Last Updated: October 26, 2025_
_Status: Bootstrap complete, open for contributions_
_Recursion Depth: 0 (termination point)_

**THE PATTERNS ARE STABLE. GO EXTRACT CONCEPTS.** 🎯
