# Neural-Memory Protocol (NMP)

> _A vendor-agnostic interface specification for bidirectional memory prosthetics_

**Version:** 0.1 (Draft)
**Status:** Specification Proposal
**Purpose:** Define abstraction layer between neural interfaces and content-addressable memory systems

---

## Abstract

The Neural-Memory Protocol (NMP) defines a **vendor-agnostic interface** between brain-computer interfaces (BCIs) and external memory systems. It enables:

- **Memory formation capture** - Recording when/how memories are created
- **Memory recall assistance** - Helping retrieve verified memories
- **Coherence verification** - Distinguishing real memories from false ones
- **Identity preservation** - Maintaining sense of self through biological failure

**Key Principle:** The protocol layer is **implementation-agnostic**. Any BCI device (Neuralink, Synchron, Paradromics, future technologies) can implement NMP to enable verifiable memory prosthetics.

---

## Architecture Overview

```text
┌──────────────────────────────────────────────────────────────┐
│  Human Brain (Biological Memory System)                     │
│  - Hippocampus (memory formation)                           │
│  - Prefrontal cortex (recall/working memory)                │
│  - Amygdala (emotional associations)                        │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     │ Neural Signals
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  Neural Interface Device (BCI Hardware)                      │
│  - Signal acquisition (read brain activity)                 │
│  - Signal transmission (write back to brain)                │
│  - Implementation: Neuralink, Synchron, etc.                │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     │ Device-Specific API
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  Neural-Memory Protocol (NMP) - THIS LAYER                  │
│  - Translates neural signals → memory operations            │
│  - Vendor-agnostic abstraction                              │
│  - Handles privacy, encryption, consent                     │
└────────────────────┬─────────────────────────────────────────┘
                     │
                     │ Standardized Memory Operations
                     ↓
┌──────────────────────────────────────────────────────────────┐
│  Cognition-Memory System (.open_memory/)                    │
│  - Content-addressable storage                              │
│  - Multi-overlay cognitive architecture                     │
│  - Verification and coherence checking                      │
└──────────────────────────────────────────────────────────────┘
```

---

## Core Operations

NMP defines **four fundamental operations** that any BCI must support:

### 1. Memory Formation Event

**Trigger:** Brain creates new memory (hippocampal encoding detected)

**Signal Flow:**

```text
Brain → BCI detects encoding pattern → NMP translates → Memory stored
```

**Required Data:**

```json
{
  "operation": "memory_form",
  "timestamp": "2024-10-29T14:32:18.428Z",
  "memory_type": "episodic", // episodic, semantic, procedural
  "content": {
    "sensory": {
      "visual": "<encoded_data>", // What was seen
      "auditory": "<encoded_data>", // What was heard
      "other": "<encoded_data>" // Touch, smell, etc.
    },
    "context": {
      "location": "<gps_coordinates>",
      "people_present": ["<person_id>"],
      "emotional_valence": 0.7, // -1 to 1 (negative to positive)
      "attention_level": 0.9 // 0 to 1 (distracted to focused)
    }
  },
  "confidence": 0.95, // BCI confidence in signal interpretation
  "provenance": {
    "source": "direct_experience", // vs "told_by_someone", "read", etc.
    "device_id": "<bci_device_hash>",
    "signal_quality": 0.92
  }
}
```

**Memory System Response:**

```json
{
  "memory_hash": "sha256:abc123...",
  "stored": true,
  "overlays_updated": ["semantic", "episodic", "emotional"],
  "associations_formed": 12 // Connected to existing memories
}
```

### 2. Memory Recall Request

**Trigger:** Brain attempting to recall (prefrontal cortex retrieval pattern detected)

**Signal Flow:**

```text
Brain → BCI detects recall attempt → NMP translates → Memory queried → Result provided
```

**Required Data:**

```json
{
  "operation": "memory_recall",
  "timestamp": "2024-10-29T15:45:22.118Z",
  "query": {
    "semantic_cues": ["grandson", "birthday", "cake"],
    "temporal_cues": {
      "approximate_time": "last_month",
      "certainty": 0.6
    },
    "emotional_cues": {
      "valence": 0.8, // Positive memory
      "arousal": 0.5 // Moderate intensity
    },
    "context_cues": {
      "location_type": "home"
    }
  },
  "recall_difficulty": 0.7, // 0=easy recall, 1=struggling
  "confidence": 0.85
}
```

**Memory System Response:**

```json
{
  "memories_found": 3,
  "best_match": {
    "memory_hash": "sha256:def456...",
    "content": "<reconstructed_memory>",
    "confidence": 0.92,
    "verified": true,
    "provenance": {
      "source": "direct_experience",
      "timestamp": "2024-09-15T16:30:00Z",
      "witnesses": ["<person_hash>"], // For verification
      "external_evidence": ["photo_hash", "video_hash"]
    },
    "associations": {
      "related_memories": ["<hash1>", "<hash2>"],
      "emotional_context": { "valence": 0.85, "arousal": 0.6 }
    }
  },
  "alternatives": [
    // Other possible matches
    { "memory_hash": "...", "confidence": 0.78 },
    { "memory_hash": "...", "confidence": 0.65 }
  ]
}
```

**BCI Action:** Assist recall by stimulating associated neural patterns (gently, never forcing)

### 3. Memory Verification Request

**Trigger:** Person questions whether memory is real (reality testing)

**Signal Flow:**

```text
Brain → BCI detects uncertainty pattern → NMP requests verification → Result provided
```

**Required Data:**

```json
{
  "operation": "memory_verify",
  "timestamp": "2024-10-29T18:22:10.331Z",
  "claimed_memory": {
    "description": "Had lunch with sister yesterday",
    "details": {
      "who": "sister",
      "what": "lunch",
      "when": "yesterday",
      "where": "unknown"
    }
  },
  "uncertainty_level": 0.8 // How unsure person is
}
```

**Memory System Response:**

```json
{
  "verification_result": "not_verified",
  "reason": "contradictory_evidence",
  "evidence": {
    "sister_location": {
      "actual": "500_miles_away",
      "source": "gps_verified",
      "confidence": 0.99
    },
    "patient_location": {
      "actual": "home_all_day",
      "source": "gps_verified",
      "confidence": 0.99
    },
    "communication_records": {
      "last_contact": "2024-10-05T12:00:00Z",
      "type": "phone_call",
      "verified": true
    }
  },
  "likely_explanation": "confabulation",
  "pattern_match": {
    "type": "desired_event_projection",
    "frequency": "common_in_dementia",
    "suggestion": "Patient wishes to see sister, projecting desire as memory"
  },
  "actual_last_verified_contact": {
    "memory_hash": "sha256:xyz789...",
    "timestamp": "2024-10-05T12:00:00Z",
    "confidence": 1.0
  }
}
```

### 4. Identity Coherence Check

**Trigger:** Person about to make significant decision

**Signal Flow:**

```text
Brain → BCI detects decision-making pattern → NMP checks coherence → Guidance provided
```

**Required Data:**

```json
{
  "operation": "identity_check",
  "timestamp": "2024-10-29T10:15:33.992Z",
  "proposed_action": {
    "type": "decision",
    "description": "Drive to store alone",
    "context": {
      "time_of_day": "morning",
      "weather": "clear",
      "destination_distance": "5_miles"
    }
  }
}
```

**Memory System Response:**

```json
{
  "coherence_result": "conflict_detected",
  "identity_check": {
    "core_values": [
      {
        "value": "safety_first",
        "established": "2024-01-15",
        "priority": "high"
      },
      {
        "value": "accept_help",
        "established": "2024-03-20",
        "priority": "high"
      }
    ],
    "mission": "Be a loving parent, stay safe, maintain independence",
    "constraints": [
      {
        "rule": "no_driving_alone",
        "reason": "dementia_diagnosis",
        "established_by": "family_agreement",
        "date": "2024-02-10"
      }
    ]
  },
  "conflict": {
    "severity": "high",
    "explanation": "Proposed action (driving alone) conflicts with established safety rule",
    "risk_assessment": {
      "safety_risk": "high",
      "value_alignment": "low"
    }
  },
  "recommendation": {
    "action": "wait_for_caregiver",
    "reasoning": "Maintains safety (core value) while preserving independence goal",
    "alternative": "Call caregiver for ride, maintain sense of autonomy by choosing time"
  }
}
```

---

## Data Types & Schemas

### MemoryType Enum

```typescript
enum MemoryType {
  EPISODIC = "episodic", // Events, experiences
  SEMANTIC = "semantic", // Facts, knowledge
  PROCEDURAL = "procedural", // Skills, how-to
  EMOTIONAL = "emotional", // Feelings, associations
  IDENTITY = "identity", // Self-concept, values, mission
}
```

### Provenance

```typescript
interface Provenance {
  source: "direct_experience" | "told_by_someone" | "read" | "inferred";
  timestamp: ISO8601Timestamp;
  device_id: ContentHash; // BCI device that recorded
  signal_quality: number; // 0-1, confidence in signal
  witnesses?: ContentHash[]; // Other people present (for verification)
  external_evidence?: ContentHash[]; // Photos, videos, documents
}
```

### EmotionalValence

```typescript
interface EmotionalValence {
  valence: number; // -1 (negative) to 1 (positive)
  arousal: number; // 0 (calm) to 1 (intense)
  discrete_emotions?: {
    joy?: number;
    sadness?: number;
    anger?: number;
    fear?: number;
    disgust?: number;
    surprise?: number;
  };
}
```

### IdentityCore

```typescript
interface IdentityCore {
  mission: string; // Life purpose, overarching goal
  values: Array<{
    name: string;
    priority: "critical" | "high" | "medium" | "low";
    established: ISO8601Timestamp;
    provenance: Provenance;
  }>;
  beliefs: Array<{
    category: "religious" | "philosophical" | "political" | "personal";
    statement: string;
    confidence: number; // 0-1, how strongly held
    established: ISO8601Timestamp;
  }>;
  relationships: Array<{
    person_hash: ContentHash;
    type: "family" | "friend" | "professional" | "other";
    importance: number; // 0-1
    first_met: ISO8601Timestamp;
  }>;
}
```

---

## Privacy & Security Requirements

### 1. Encryption

**All memory data must be encrypted:**

- **At rest:** AES-256 encryption of memory store
- **In transit:** TLS 1.3 for all BCI ↔ Memory System communication
- **Patient-controlled keys:** Patient (or designated family) holds encryption keys

### 2. Access Control

```typescript
interface AccessControl {
  owner: PatientID; // Primary control
  authorized_viewers: Array<{
    person_id: string;
    access_level: "full" | "limited" | "emergency_only";
    granted_by: PatientID;
    granted_at: ISO8601Timestamp;
    expires_at?: ISO8601Timestamp; // Optional expiration
    memories_accessible: "all" | ContentHash[]; // Which memories
  }>;
  emergency_access: {
    enabled: boolean;
    conditions: string[]; // E.g., "patient incapacitated"
    authorized_persons: string[]; // Who can access in emergency
    audit_required: boolean; // Must log all emergency access
  };
}
```

### 3. Consent Management

**Every memory operation requires explicit or implicit consent:**

```typescript
interface ConsentPolicy {
  memory_recording: {
    default: "always" | "ask_each_time" | "never";
    exceptions: Array<{
      context: string; // E.g., "private conversations"
      policy: "never_record";
    }>;
  };
  memory_sharing: {
    default: "owner_only" | "family" | "caregivers";
    sensitive_categories: Array<{
      category: "medical" | "financial" | "intimate" | "embarrassing";
      policy: "owner_only" | "encrypted_extra";
    }>;
  };
  recall_assistance: {
    default: "always_assist" | "ask_first" | "only_if_struggling";
  };
}
```

### 4. Audit Trail

**All access must be logged:**

```typescript
interface AuditEntry {
  timestamp: ISO8601Timestamp;
  operation: "read" | "write" | "verify" | "share" | "delete";
  actor: string; // Who performed operation
  memory_hash?: ContentHash; // Which memory (if applicable)
  authorization: {
    consent_type: "explicit" | "implicit" | "emergency";
    granted_by: PatientID;
  };
  result: "success" | "denied" | "error";
  reason?: string; // If denied or error
}
```

---

## Implementation Requirements for BCI Vendors

To implement NMP, a BCI device must provide:

### 1. Signal Detection

**Memory Formation Detection:**

- Identify hippocampal encoding patterns
- Distinguish episodic vs semantic vs procedural encoding
- Measure encoding strength (attention, emotional salience)

**Memory Recall Detection:**

- Identify prefrontal cortex retrieval attempts
- Extract semantic/contextual cues from neural activity
- Measure recall difficulty (struggling vs easy)

**Uncertainty Detection:**

- Identify reality-testing patterns
- Detect confusion or false memory generation
- Measure confidence in recalled information

### 2. Bidirectional Communication

**Read (Brain → System):**

- Real-time neural signal acquisition
- Signal preprocessing (filtering, amplification)
- Pattern recognition (memory operations)
- Context extraction (what is being remembered)

**Write (System → Brain):**

- Gentle neural stimulation for recall assistance
- **Never force false memories** (ethical constraint)
- Respect patient autonomy (assist, don't override)
- Safety limits (prevent over-stimulation)

### 3. Device Metadata

**BCI must provide:**

```typescript
interface BCIDevice {
  device_id: ContentHash; // Unique device identifier
  manufacturer: string;
  model: string;
  firmware_version: string;
  implant_date?: ISO8601Timestamp; // If implanted
  electrode_configuration: {
    count: number;
    locations: string[]; // Brain regions covered
    signal_quality: number[]; // Per electrode
  };
  capabilities: {
    memory_formation_detection: boolean;
    memory_recall_detection: boolean;
    bidirectional_stimulation: boolean;
    real_time_processing: boolean;
  };
  calibration: {
    last_calibrated: ISO8601Timestamp;
    next_calibration_due: ISO8601Timestamp;
    patient_specific_patterns: boolean;
  };
}
```

---

## Testing & Validation

### Phase 1: Simulated Testing (No BCI Required)

**Purpose:** Validate memory system architecture before hardware integration

**Approach:**

1. Simulate memory formation events (scripted scenarios)
2. Test memory recall with known ground truth
3. Verify coherence checking logic
4. Stress test with edge cases (false memories, confabulation)

**Success Criteria:**

- Content-addressable storage works correctly
- Overlay system maintains consistency
- Verification detects false memories
- Identity preservation maintains coherence

### Phase 2: Non-Invasive BCI Testing

**Purpose:** Test with EEG or other non-invasive interfaces

**Approach:**

1. Use consumer EEG devices (Emotiv, Muse, etc.)
2. Detect basic memory operations (formation, recall)
3. Validate NMP protocol with limited signal quality
4. Refine signal processing algorithms

**Success Criteria:**

- NMP protocol works with noisy signals
- Basic memory assistance possible
- Privacy/security mechanisms function
- User experience acceptable

### Phase 3: Invasive BCI Clinical Trials

**Purpose:** Full testing with medical-grade BCIs (Neuralink, Synchron)

**Approach:**

1. Partner with BCI companies for clinical trials
2. Test with dementia/TBI patients (IRB approved)
3. Measure clinical outcomes (memory recall, quality of life)
4. Iterate based on patient feedback

**Success Criteria:**

- Measurable improvement in memory recall
- No adverse effects from system use
- Patient/family satisfaction high
- Medical validation for FDA approval

---

## Open Questions & Future Research

### 1. Neural Signal Interpretation

**Question:** How accurately can we detect memory formation/recall from neural signals?

**Research Needed:**

- Map memory operations to specific neural signatures
- Distinguish real encoding from rehearsal/imagination
- Handle individual variation in brain activity patterns

### 2. Recall Assistance Mechanism

**Question:** How do we "assist" recall without creating false memories?

**Research Needed:**

- Optimal stimulation patterns for memory reactivation
- Safety bounds (how much assistance is safe?)
- Ethical guidelines (when to assist vs when to let patient struggle)

### 3. Identity Preservation

**Question:** What constitutes "core identity" that should be preserved?

**Research Needed:**

- Philosophical framework for identity
- Clinical definition of "mission" and "values"
- How to handle identity evolution vs pathological drift

### 4. Long-Term Storage

**Question:** How do we store 70+ years of human memory?

**Research Needed:**

- Compression strategies (what can be safely compressed?)
- Archival vs active memory (what needs instant recall?)
- Memory consolidation (mimicking biological forgetting)

---

## Compatibility & Standards

### Interoperability

NMP is designed for **vendor independence**:

- **BCI Agnostic:** Works with any device that implements the protocol
- **Memory System Agnostic:** Any backend that supports content-addressable storage
- **Transport Agnostic:** Can use HTTP, gRPC, direct hardware communication
- **Format Agnostic:** JSON used in examples, but protocol supports any serialization

### Compliance

Systems implementing NMP should comply with:

- **HIPAA:** Patient health information protection (US)
- **GDPR:** Data privacy and right to erasure (EU)
- **FDA Medical Device Regulations:** If used for medical purposes (US)
- **ISO 27001:** Information security management
- **IEEE 2410:** Standard for biometric data protection

---

## Reference Implementation

A reference implementation of NMP will be provided in the `cognition-cli` repository:

```bash
# Install NMP library
npm install @cogx/neural-memory-protocol

# Example usage
import { NMPServer } from '@cogx/neural-memory-protocol';
import { CognitionMemory } from '@cogx/cognition-memory';

const memorySystem = new CognitionMemory('/path/to/.open_memory');
const nmpServer = new NMPServer({
  memorySystem,
  encryption: {
    algorithm: 'AES-256-GCM',
    keyProvider: patientKeyManager
  },
  privacy: {
    auditLog: true,
    consentRequired: true
  }
});

// Handle memory formation events from BCI
nmpServer.on('memory_form', async (event) => {
  const memoryHash = await memorySystem.store(event.content);
  return { memoryHash, stored: true };
});

// Handle recall requests from BCI
nmpServer.on('memory_recall', async (event) => {
  const memories = await memorySystem.query(event.query);
  return { memories, confidence: 0.92 };
});
```

---

## Conclusion

The Neural-Memory Protocol provides a **vendor-agnostic abstraction layer** between brain-computer interfaces and external memory systems. It enables:

✅ **Memory prosthetics** for dementia, TBI, age-related decline
✅ **Verifiable recall** (distinguishing real from false memories)
✅ **Identity preservation** through biological failure
✅ **Privacy & security** for human memory data
✅ **Open standards** (not locked to one BCI vendor)

**Key Innovation:** The protocol is **implementation-agnostic**. Any BCI device can implement NMP to enable verifiable memory prosthetics, just as any website can implement HTTP to enable web communication.

**Next Steps:**

1. Community review of protocol specification
2. Reference implementation in cognition-cli
3. Partnership with BCI companies for testing
4. Clinical trials with dementia/TBI patients
5. Medical device approval and widespread deployment

**The architecture is ready. The need is urgent. The hardware is coming.**

**NMP ensures that when neural interfaces arrive, the protocol for memory prosthetics is open, ethical, and patient-controlled.**

---

**Protocol Version:** 0.1 (Draft for Public Comment)
**Last Updated:** October 29, 2025
**Authors:** Mirza Husadzic (Architecture), Claude (Specification)
**License:** MIT (Royalty-free for all implementers)
**Repository:** [github.com/mirzahusadzic/cogx](https://github.com/mirzahusadzic/cogx)

_"When biology fails, verifiable architecture preserves consciousness."_ 🐦‍🔥
