/**
 * Document Object Types for Grounded Context Pool (PGC)
 *
 * Defines the schema for documentation objects stored in PGC's object store.
 * These objects represent parsed and analyzed markdown documents that form
 * the strategic and operational knowledge base.
 *
 * DESIGN:
 * - Content-Addressed Storage: Documents are hashed and deduplicated
 * - AST Preservation: Full parsed structure enables rich queries
 * - Metadata Extraction: Title, author, dates extracted from frontmatter
 * - Document Classification: Strategic/operational/security/mathematical types
 * - Concept Pre-embedding: Security-validated concepts cached to avoid re-embedding
 *
 * DOCUMENT LIFECYCLE:
 * 1. Genesis: Raw markdown file ingested via genesis:docs oracle
 * 2. Parsing: Markdown parsed into AST structure
 * 3. Classification: Document type inferred from content/structure
 * 4. Concept Extraction: Key concepts identified and embedded
 * 5. Storage: Stored in objects/ with content-based hash
 * 6. Indexing: Registered in index/docs/ for retrieval
 *
 * PROVENANCE:
 * Every document object tracks:
 * - Original file path
 * - Content hash (for change detection)
 * - Transform that created it (genesis_doc)
 * - Parser version
 * - Timestamp
 *
 * @example
 * // Store a document in PGC
 * const doc: DocumentObject = {
 *   type: 'markdown_document',
 *   hash: contentHash,
 *   filePath: 'docs/security/authentication.md',
 *   content: rawMarkdown,
 *   ast: parsedAst,
 *   metadata: {
 *     title: 'Authentication Guidelines',
 *     documentType: 'security',
 *     documentTypeConfidence: 0.95
 *   }
 * };
 * await objectStore.store(doc.hash, doc);
 *
 * @example
 * // Retrieve and analyze document
 * const docBuffer = await objectStore.retrieve(docHash);
 * const doc = JSON.parse(docBuffer.toString()) as DocumentObject;
 * console.log(`Document: ${doc.metadata.title}`);
 * console.log(`Type: ${doc.metadata.documentType} (${doc.metadata.documentTypeConfidence})`);
 * console.log(`Concepts: ${doc.embeddedConcepts?.length || 0}`);
 */

import { MarkdownDocument } from '../parsers/markdown-parser.js';
import { MissionConcept } from '../analyzers/concept-extractor.js';

/**
 * Document object stored in Grounded Context Pool (PGC) objects/
 *
 * Represents a parsed and analyzed markdown document with full AST,
 * metadata, and pre-extracted concepts.
 */
export interface DocumentObject {
  /** Object type discriminator (always 'markdown_document') */
  type: 'markdown_document';

  /** Content-based hash of the document (SHA-256) */
  hash: string;

  /** Original file path relative to project root */
  filePath: string;

  /** Raw markdown content (preserved for re-parsing if needed) */
  content: string;

  /** Parsed AST structure (enables structural queries) */
  ast: MarkdownDocument;

  /** Extracted and inferred metadata */
  metadata: {
    /** Document title (from frontmatter or first H1) */
    title?: string;

    /** Author name (from frontmatter) */
    author?: string;

    /** Creation date (from frontmatter or file stats) */
    created?: string;

    /** Last modified date (from file stats) */
    modified?: string;

    /** Classified document type (strategic, operational, security, mathematical) */
    documentType?: string;

    /** Classification confidence score (0-1) */
    documentTypeConfidence?: number;
  };

  /**
   * Pre-embedded concepts from security validation
   *
   * Cached to avoid re-embedding during overlay generation.
   * Populated during genesis:docs transform if document contains
   * security-relevant concepts.
   */
  embeddedConcepts?: MissionConcept[];
}

/**
 * Transform result for documentation ingestion
 *
 * Returned by genesis:docs oracle after successfully ingesting a document.
 * Used to track provenance and verify integrity.
 */
export interface TransformResult {
  /** Unique identifier for this transform (content-based hash) */
  transformId: string;

  /** Hash of the DocumentObject created by this transform */
  outputHash: string;

  /**
   * Fidelity score (always 1.0 for deterministic parsing)
   *
   * Lower fidelity would indicate lossy transforms or approximations.
   * Document parsing is lossless, so this is always 1.0.
   */
  fidelity: number;

  /**
   * Whether the transform passed integrity checks
   *
   * Verified means:
   * - AST can be serialized and deserialized
   * - Content hash matches stored object
   * - Metadata extraction succeeded
   */
  verified: boolean;
}

/**
 * Transform log entry for provenance tracking
 *
 * Records the complete history of a genesis:docs transform.
 * Stored in PGC's transform log for auditability and reproducibility.
 */
export interface TransformLog {
  /** Unique transform identifier (same as TransformResult.transformId) */
  transform_id: string;

  /** Transform type (always 'genesis_doc' for document ingestion) */
  type: 'genesis_doc';

  /** ISO 8601 timestamp of transform execution */
  timestamp: string;

  /** Oracle method that performed the transform ('genesis:docs') */
  method: string;

  /** Input files consumed by this transform */
  inputs: {
    /** Path to source markdown file */
    source_file: string;
  };

  /** Output objects produced by this transform */
  outputs: Array<{
    /** Hash of the DocumentObject */
    hash: string;

    /** Object type ('markdown_document') */
    type: string;

    /** Semantic path for indexing (e.g., 'docs/security/auth') */
    semantic_path: string;
  }>;

  /** Fidelity score (1.0 for lossless parsing) */
  fidelity: number;

  /** Integrity verification status */
  verified: boolean;

  /** Provenance metadata for reproducibility */
  provenance: {
    /** Parser implementation used ('markdown-parser@1.0.0') */
    parser: string;

    /** Oracle version that executed the transform */
    oracle?: string;

    /** Hash of input content (for change detection) */
    content_hash?: string;
  };
}
