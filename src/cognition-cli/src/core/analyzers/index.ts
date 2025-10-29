/**
 * Document Analysis and Extraction System
 *
 * This module provides the infrastructure for analyzing markdown documents
 * and extracting overlay-specific knowledge.
 *
 * ARCHITECTURE:
 * - DocumentClassifier: Determines document type
 * - ExtractorRegistry: Routes to appropriate extractor
 * - Extractors: Extract knowledge for specific overlays
 *
 * OVERLAYS:
 * - O₂ (Security): SecurityExtractor → Threat models, mitigations
 * - O₄ (Mission): StrategyExtractor → Vision, goals, principles
 * - O₅ (Operational): WorkflowExtractor → Quest patterns, sacred sequences
 * - O₆ (Mathematical): ProofExtractor → Theorems, proofs, axioms
 */

// Classification
export {
  DocumentClassifier,
  DocumentType,
  OVERLAY_ROUTING,
  type ClassificationResult,
} from './document-classifier.js';

// Extractor interfaces
export {
  type DocumentExtractor,
  type ExtractedKnowledge,
  type StrategyKnowledge,
  type OperationalKnowledge,
  type MathematicalKnowledge,
  type SecurityKnowledge,
  ExtractorRegistry,
} from './document-extractor.js';

// Concrete extractors
export { StrategyExtractor } from './strategy-extractor.js';
export { WorkflowExtractor } from './workflow-extractor.js';
export { SecurityExtractor } from './security-extractor.js';
export { ProofExtractor } from './proof-extractor.js';

// Legacy exports (backward compatibility)
export { ConceptExtractor, type MissionConcept } from './concept-extractor.js';

// Import for function implementation
import { ExtractorRegistry } from './document-extractor.js';
import { StrategyExtractor } from './strategy-extractor.js';
import { WorkflowExtractor } from './workflow-extractor.js';
import { SecurityExtractor } from './security-extractor.js';
import { ProofExtractor } from './proof-extractor.js';

/**
 * Create and configure the default extractor registry
 */
export function createDefaultExtractorRegistry(): ExtractorRegistry {
  const registry = new ExtractorRegistry();

  // Register all extractors
  registry.register(new StrategyExtractor());
  registry.register(new WorkflowExtractor());
  registry.register(new SecurityExtractor());
  registry.register(new ProofExtractor());

  return registry;
}
