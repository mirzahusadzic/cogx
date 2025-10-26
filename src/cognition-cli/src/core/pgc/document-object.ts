import { MarkdownDocument } from '../parsers/markdown-parser.js';
import { MissionConcept } from '../analyzers/concept-extractor.js';

/**
 * Document object stored in PGC objects/
 */
export interface DocumentObject {
  type: 'markdown_document';
  hash: string;
  filePath: string;
  content: string; // Original markdown
  ast: MarkdownDocument; // Parsed structure
  metadata: {
    title?: string;
    author?: string;
    created?: string;
    modified?: string;
  };
  embeddedConcepts?: MissionConcept[]; // Pre-embedded concepts from security validation (skip re-embedding)
}

/**
 * Transform result for documentation ingestion
 */
export interface TransformResult {
  transformId: string;
  outputHash: string;
  fidelity: number; // 1.0 for deterministic parsing
  verified: boolean;
}

/**
 * Transform log entry for provenance tracking
 */
export interface TransformLog {
  transform_id: string;
  type: 'genesis_doc';
  timestamp: string;
  method: string;
  inputs: {
    source_file: string;
  };
  outputs: Array<{
    hash: string;
    type: string;
    semantic_path: string;
  }>;
  fidelity: number;
  verified: boolean;
  provenance: {
    parser: string;
    oracle?: string;
    content_hash?: string;
  };
}
