import { MarkdownDocument } from '../parsers/markdown-parser.js';

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
