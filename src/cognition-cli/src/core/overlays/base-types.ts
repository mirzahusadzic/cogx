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
 * Common content fields shared by all overlay findings/concepts.
 * These are usually extracted by the analyzer.
 */
export interface IBaseOverlayFinding {
  /** Classification of the finding (replaces statementType, patternType, securityType, etc.) */
  type?: string;

  /** Semantic content for embedding and display */
  text: string;

  /** Importance score (0-1) */
  weight?: number;

  /** Frequency in source document */
  occurrences: number;

  /** Source section name */
  section: string;

  /** Section hash for provenance */
  sectionHash: string;

  /** Vector embedding (optional) */
  embedding?: number[];
}

/**
 * Full metadata for an overlay item in LanceDB, including provenance.
 */
export interface IBaseOverlayMetadata
  extends IBaseOverlayFinding, OverlayMetadata {
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

/**
 * Standard structure for overlay finding documents.
 * Standardizes the collection of findings/concepts/patterns.
 *
 * @example
 * interface SecurityOverlay extends IBaseOverlayFindings<SecurityMetadata, 'findings'> {}
 */
export type IBaseOverlayFindings<
  T extends IBaseOverlayFinding,
  K extends string = 'findings',
> = IBaseOverlayDocument & {
  [P in K]: T[];
};
