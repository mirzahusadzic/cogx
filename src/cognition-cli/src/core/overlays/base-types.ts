import { OverlayMetadata } from '../algebra/overlay-algebra.js';
import { z } from 'zod';

/**
 * Zod schema for base overlay metadata.
 * Used for runtime validation of PGC overlay items.
 */
export const BaseOverlayMetadataSchema = z.object({
  text: z.string(),
  type: z.string().optional(),
  weight: z.number().min(0).max(1),
  occurrences: z.number().int().nonnegative(),
  section: z.string(),
  sectionHash: z.string(),
  documentHash: z.string(),
});

/**
 * Base metadata fields shared by all overlay items.
 *
 * Extends the fundamental OverlayMetadata from overlay-algebra with
 * common provenance and importance fields used across all document-based
 * overlays (O2, O4, O5, O6).
 */
export interface IBaseOverlayMetadata extends OverlayMetadata {
  /** Semantic content for embedding and display */
  text: string;

  /** Importance score (0-1) */
  weight: number;

  /** Frequency in source document */
  occurrences: number;

  /** Source section name */
  section: string;

  /** Section hash for provenance */
  sectionHash: string;

  /** Document hash for provenance */
  documentHash: string;
}

/**
 * Base document structure for all PGC overlays stored in YAML.
 *
 * Provides common provenance and versioning fields for the root
 * object of an overlay YAML file.
 */
export interface IBaseOverlayDocument {
  /** Content hash of source document */
  document_hash: string;

  /** Path to source markdown file */
  document_path: string;

  /** ISO timestamp of generation */
  generated_at: string;

  /** ID of the transform that generated this overlay */
  transform_id: string;

  /** Schema version (2 = LanceDB embeddings, 1 = YAML embeddings) */
  format_version?: number;

  /** Source project for imported .cogx files */
  source_project?: string;

  /** Source commit hash for provenance */
  source_commit?: string;
}
