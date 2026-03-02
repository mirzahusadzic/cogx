/**
 * Alignment scores for all 7 conversation overlays (O1-O7)
 */
export interface AlignmentScores {
  alignment_O1: number;
  alignment_O2: number;
  alignment_O3: number;
  alignment_O4: number;
  alignment_O5: number;
  alignment_O6: number;
  alignment_O7: number;
}

/**
 * Configuration for a specific conversation overlay
 */
export interface ConversationOverlayConfig {
  /** Overlay ID (e.g., "O1", "O2") */
  id: string;
  /** Human-readable name (e.g., "Structural") */
  name: string;
  /** Directory slug (e.g., "conversation-structural") */
  slug: string;
  /** Domain-specific keywords for semantic alignment */
  keywords: string[];
  /** High-level description for the registry */
  description: string;
}

/**
 * Configuration for conversation overlays (O1-O7).
 *
 * These configurations define the behavior and semantic alignment for each
 * conversation overlay, replacing the redundant manager classes.
 */
export const CONVERSATION_OVERLAY_CONFIGS: Record<
  string,
  ConversationOverlayConfig
> = {
  /**
   * Conversation Structural Overlay (O1)
   *
   * Tracks architecture, design patterns, and structural discussions in
   * conversation. This is the PRIMARY overlay that stores ALL conversation
   * turns to ensure complete conversation history in LanceDB.
   *
   * Purpose:
   * - Track architecture and design decisions
   * - Monitor structural patterns and refactoring
   * - Document component organization
   * - Store ALL turns for complete conversation record
   *
   * Alignment indicators:
   * - Architecture: "architecture", "design", "structure", "pattern"
   * - Components: "component", "module", "class", "interface"
   * - Organization: "refactor", "organize", "hierarchy", "layer"
   * - Relationships: "dependency", "coupling", "cohesion", "separation"
   *
   * SPECIAL BEHAVIOR:
   * - O1 stores ALL turns regardless of alignment score
   * - This ensures embeddings are always written to LanceDB
   * - Other overlays can reference O1's complete LanceDB data
   *
   * Use cases:
   * - Context reconstruction: preserve structural context
   * - Compression: maintain architectural decisions
   * - Query: find design patterns and component relationships
   */
  O1: {
    id: 'O1',
    name: 'Structural',
    slug: 'conversation-structural',
    keywords: [
      'structure',
      'pattern',
      'hierarchy',
      'order',
      'relationship',
      'node',
      'edge',
      'lattice',
      'graph',
      'tree',
      'architecture',
      'design',
      'component',
      'module',
      'class',
      'interface',
      'refactor',
      'organize',
      'layer',
      'dependency',
      'coupling',
      'cohesion',
      'separation',
    ],
    description: 'Architecture/design discussions',
  },
  /**
   * Conversation Security Overlay (O2)
   *
   * Tracks security, threat, vulnerability, and privacy discussions in
   * conversation. Captures turns related to authentication, authorization,
   * encryption, and security best practices.
   *
   * Purpose:
   * - Track security requirements and threats
   * - Monitor vulnerability discussions
   * - Document authentication/authorization patterns
   * - Capture security mitigation strategies
   *
   * Alignment indicators:
   * - Security: "security", "threat", "vulnerability", "breach"
   * - Auth: "authentication", "authorization", "encryption"
   * - Attacks: "attack", "exploit", "injection", "xss", "csrf"
   * - Protection: "sanitize", "validate", "mitigation", "malware"
   *
   * Use cases:
   * - Context reconstruction: preserve security context
   * - Compression: maintain critical security insights
   * - Query: find vulnerabilities and mitigations
   */
  O2: {
    id: 'O2',
    name: 'Security',
    slug: 'conversation-security',
    keywords: [
      'security',
      'vulnerability',
      'exploit',
      'threat',
      'risk',
      'safe',
      'policy',
      'compliance',
      'audit',
      'protection',
      'authentication',
      'authorization',
      'encryption',
      'attack',
      'injection',
      'xss',
      'csrf',
      'sanitize',
      'validate',
      'mitigation',
      'malware',
      'breach',
    ],
    description: 'Security concerns raised',
  },
  /**
   * Conversation Lineage Overlay (O3)
   *
   * Tracks knowledge evolution and historical references in conversation.
   * Captures turns that reference past discussions and document the progression
   * of ideas over time.
   *
   * Purpose:
   * - Track references to earlier discussions
   * - Monitor knowledge evolution and progression
   * - Document decision history and rationale changes
   * - Maintain temporal context and dependencies
   *
   * Alignment indicators:
   * - Temporal references: "earlier", "previously", "before", "mentioned"
   * - Evolution tracking: "history", "evolution", "lineage", "progression"
   * - Context references: "remember", "discussed", "context"
   * - Origin tracking: "derivation", "origin", "trace", "ancestor"
   *
   * Use cases:
   * - Context reconstruction: maintain historical context
   * - Compression: preserve key evolution points
   * - Query: find decision history and rationale
   */
  O3: {
    id: 'O3',
    name: 'Lineage',
    slug: 'conversation-lineage',
    keywords: [
      'lineage',
      'history',
      'source',
      'origin',
      'evolution',
      'provenance',
      'chain',
      'derivation',
      'attribution',
      'context',
      'earlier',
      'previously',
      'before',
      'mentioned',
      'remember',
      'discussed',
      'trace',
      'ancestor',
      'progression',
      'timeline',
    ],
    description: 'Knowledge evolution ("earlier we...")',
  },
  /**
   * Conversation Mission Overlay (O4)
   *
   * Tracks goals, objectives, requirements, and strategic vision discussed
   * in conversation. Captures turns related to project purpose, deliverables,
   * and success criteria.
   *
   * Purpose:
   * - Track project goals and objectives
   * - Monitor requirement discussions
   * - Document strategic vision and roadmap
   * - Capture success criteria and milestones
   *
   * Alignment indicators:
   * - Goals: "goal", "objective", "purpose", "target", "achieve"
   * - Vision: "mission", "vision", "strategy", "roadmap"
   * - Requirements: "requirement", "feature", "deliverable"
   * - Success: "milestone", "priority", "outcome", "success"
   *
   * Use cases:
   * - Context reconstruction: maintain goal context
   * - Compression: preserve strategic decisions
   * - Query: find requirements and objectives
   */
  O4: {
    id: 'O4',
    name: 'Mission',
    slug: 'conversation-mission',
    keywords: [
      'mission',
      'goal',
      'objective',
      'purpose',
      'intent',
      'outcome',
      'strategy',
      'alignment',
      'target',
      'vision',
      'requirement',
      'feature',
      'deliverable',
      'milestone',
      'priority',
      'success',
      'achieve',
      'roadmap',
    ],
    description: 'Goals/objectives for session',
  },
  /**
   * Conversation Operational Overlay (O5)
   *
   * Tracks commands, actions, workflows, and execution patterns discussed
   * in conversation. Captures turns related to implementation, deployment,
   * testing, and operational procedures.
   *
   * Purpose:
   * - Track command execution and actions
   * - Monitor workflow and process discussions
   * - Document deployment and testing procedures
   * - Capture automation and scripting patterns
   *
   * Alignment indicators:
   * - Commands: "command", "execute", "run", "deploy"
   * - Actions: "action", "implement", "build", "test", "debug"
   * - Workflows: "workflow", "process", "pipeline", "automation"
   * - Operations: "operation", "procedure", "script"
   *
   * Use cases:
   * - Context reconstruction: preserve operational context
   * - Compression: maintain critical execution details
   * - Query: find implementation and deployment patterns
   */
  O5: {
    id: 'O5',
    name: 'Operational',
    slug: 'conversation-operational',
    keywords: [
      'operational',
      'execution',
      'process',
      'workflow',
      'action',
      'performance',
      'efficiency',
      'status',
      'event',
      'state',
      'command',
      'execute',
      'run',
      'deploy',
      'implement',
      'build',
      'test',
      'debug',
      'pipeline',
      'automation',
      'operation',
      'procedure',
      'script',
    ],
    description: 'Commands/actions executed',
  },
  /**
   * Conversation Mathematical Overlay (O6)
   *
   * Tracks algorithms, logic, performance analysis, and mathematical discussions
   * in conversation. Captures turns related to computational complexity,
   * optimization, and algorithmic reasoning.
   *
   * Purpose:
   * - Track algorithm design and analysis
   * - Monitor complexity and performance discussions
   * - Document optimization strategies
   * - Capture mathematical/logical reasoning
   *
   * Alignment indicators:
   * - Algorithms: "algorithm", "complexity", "optimization", "recursive"
   * - Performance: "performance", "efficiency", "big-o"
   * - Math: "formula", "theorem", "proof", "mathematical"
   * - Logic: "logic", "computation", "calculate", "analysis"
   *
   * Use cases:
   * - Context reconstruction: preserve algorithm discussions
   * - Compression: maintain performance-critical insights
   * - Query: find optimization opportunities
   */
  O6: {
    id: 'O6',
    name: 'Mathematical',
    slug: 'conversation-mathematical',
    keywords: [
      'math',
      'logic',
      'formal',
      'proof',
      'theorem',
      'axiom',
      'set',
      'category',
      'algebra',
      'calculus',
      'algorithm',
      'complexity',
      'optimization',
      'recursive',
      'performance',
      'big-o',
      'formula',
      'mathematical',
      'computation',
      'calculate',
      'analysis',
      'iterate',
    ],
    description: 'Algorithms/logic discussed',
  },
  /**
   * Conversation Coherence Overlay (O7)
   *
   * Tracks conversation flow, topic transitions, and cross-overlay synthesis.
   * This is the meta-overlay that maintains conversational coherence across
   * all other overlays (O1-O6).
   *
   * Purpose:
   * - Monitor topic drift and conversation flow
   * - Track summaries and meta-discussions
   * - Detect conversation pivots and transitions
   * - Synthesize insights across all overlays
   *
   * Alignment indicators:
   * - Topic change keywords: "transition", "shift", "change focus"
   * - Summary keywords: "summary", "conclude", "overview", "recap"
   * - Meta keywords: "coherence", "consistency", "alignment"
   * - Synthesis keywords: "integrate", "unify", "overall"
   *
   * Use cases:
   * - Context reconstruction: prioritize turns that maintain flow
   * - Compression: preserve topic transitions and summaries
   * - Query: find conversation pivots and synthesis points
   */
  O7: {
    id: 'O7',
    name: 'Coherence',
    slug: 'conversation-coherence',
    keywords: [
      'coherence',
      'consistency',
      'link',
      'flow',
      'clarity',
      'connection',
      'unity',
      'harmony',
      'relevance',
      'focus',
      'transition',
      'shift',
      'change focus',
      'summary',
      'conclude',
      'overview',
      'recap',
      'alignment',
      'integrate',
      'unify',
      'overall',
      'synthesis',
      'topic',
    ],
    description: 'Topic drift and conversation flow',
  },
};
