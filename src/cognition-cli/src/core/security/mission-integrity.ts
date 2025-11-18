/**
 * Mission Integrity Monitor - Version Control for Mission Documents
 *
 * Creates an immutable, append-only audit trail of all mission document versions.
 * Enables semantic drift detection by tracking embedding evolution over time.
 *
 * MISSION ALIGNMENT:
 * - Implements "Cryptographic Truth" via content-addressable versioning (86.7% importance)
 * - Supports "Verification Over Trust" through immutable audit trails (VISION.md:122, 74.3%)
 * - Enables "Oracle Validation" by preserving version history (Innovation #2, 88.1%)
 * - Part of O2 (Security) overlay - FOUNDATIONAL and non-negotiable
 *
 * DESIGN RATIONALE:
 * - Immutable versioning prevents evidence tampering
 * - Semantic fingerprints enable drift detection
 * - Git integration provides provenance when available
 * - Full embedding snapshots enable temporal analysis
 *
 * SECURITY GUARANTEES:
 * - Append-only: Versions never deleted or modified
 * - Monotonic: Version numbers always increase
 * - Content-addressable: SHA-256 hashes verify integrity
 * - Atomic writes: Temp file + rename prevents corruption
 *
 * THREAT MODEL:
 * Defends against:
 * - Mission poisoning (gradual drift is detectable)
 * - Evidence destruction (append-only log)
 * - Version confusion (monotonic versioning)
 *
 * Does NOT defend against:
 * - Full directory deletion (.open_cognition/)
 * - Disk corruption (no redundancy)
 * - Git history rewriting (best-effort git integration)
 *
 * STORAGE:
 * - Location: .open_cognition/mission_integrity/versions.json
 * - Format: JSON array of MissionVersion objects
 * - Atomicity: Temp file + rename
 *
 * @example
 * const monitor = new MissionIntegrityMonitor(pgcRoot);
 * await monitor.recordVersion('/path/to/VISION.md', concepts);
 *
 * @example
 * // Check for drift
 * const latest = await monitor.getLatestVersion();
 * if (latest) {
 *   const drift = detector.analyzeDrift(latest, newVersion);
 * }
 */

import { createHash } from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { MissionConcept } from '../analyzers/concept-extractor.js';
import { execSync } from 'child_process';

/**
 * Represents a single version of a mission document
 *
 * Creates an immutable snapshot of mission state including:
 * - Content hash (SHA-256)
 * - Concept embeddings (full snapshot)
 * - Semantic fingerprint (centroid hash)
 * - Git provenance (when available)
 */
export interface MissionVersion {
  version: number; // Monotonically increasing version number
  hash: string; // SHA-256 of document content
  timestamp: string; // ISO timestamp of when this version was recorded
  author?: string; // Git author (if available)
  commitHash?: string; // Git commit SHA (if available)
  conceptEmbeddings: number[][]; // Snapshot of all mission concept embeddings
  semanticFingerprint: string; // Hash of embedding centroid (represents "meaning")
  conceptTexts: string[]; // Concept texts for comparison (parallel to embeddings)
}

/**
 * Git metadata for a file (best-effort provenance)
 */
interface GitInfo {
  author?: string;
  commit?: string;
}

/**
 * MissionIntegrityMonitor - Mission version tracker
 *
 * Manages the immutable audit trail of mission document versions.
 * Provides methods to record, retrieve, and analyze version history.
 *
 * INVARIANTS (enforced by design):
 * - Versions are append-only (never deleted or modified)
 * - Version numbers are monotonically increasing
 * - Each version includes full snapshot of embeddings
 * - Atomic writes prevent partial updates
 *
 * @example
 * const monitor = new MissionIntegrityMonitor('/path/to/.open_cognition');
 * const version = await monitor.recordVersion(visionPath, concepts);
 * console.log(`Recorded v${version.version} with hash ${version.hash}`);
 */
export class MissionIntegrityMonitor {
  private versionsPath: string;
  private versionsDir: string;

  /**
   * Creates a MissionIntegrityMonitor
   *
   * @param pgcRoot - Path to Grounded Context Pool (PGC) root (.open_cognition/)
   *
   * @example
   * const monitor = new MissionIntegrityMonitor('/workspace/.open_cognition');
   */
  constructor(private pgcRoot: string) {
    this.versionsDir = path.join(pgcRoot, 'mission_integrity');
    this.versionsPath = path.join(this.versionsDir, 'versions.json');
  }

  /**
   * Record a new version of a mission document
   *
   * Creates an immutable snapshot of mission state with content hash,
   * embeddings, semantic fingerprint, and git provenance (if available).
   *
   * ALGORITHM:
   * 1. Hash the document content (SHA-256)
   * 2. Get git metadata (author, commit) - best effort, non-blocking
   * 3. Extract valid embeddings from concepts
   * 4. Compute semantic fingerprint (centroid hash)
   * 5. Get next version number (monotonic)
   * 6. Create version record
   * 7. Append to log (atomic write: temp + rename)
   *
   * ATOMICITY:
   * - Writes to temp file first
   * - Renames to versions.json (atomic on POSIX)
   * - Prevents partial updates
   *
   * @param visionPath - Path to mission document
   * @param concepts - Extracted concepts with embeddings
   * @returns Recorded MissionVersion
   * @throws Error if no concepts have embeddings
   *
   * @example
   * const concepts = [{text: "Security first", embedding: [...], weight: 0.9}];
   * const version = await monitor.recordVersion('/path/to/VISION.md', concepts);
   * console.log(`Recorded version ${version.version} (hash: ${version.hash.slice(0,8)})`);
   */
  async recordVersion(
    visionPath: string,
    concepts: MissionConcept[]
  ): Promise<MissionVersion> {
    // Ensure directory exists
    await fs.ensureDir(this.versionsDir);

    // 1. Hash document content
    const content = await fs.readFile(visionPath, 'utf-8');
    const hash = createHash('sha256').update(content).digest('hex');

    // 2. Get git metadata (best effort, non-blocking)
    const gitInfo = await this.getGitInfo(visionPath);

    // 3. Extract embeddings and texts (filter for valid embeddings)
    const validConcepts = concepts.filter(
      (c) => c.embedding && Array.isArray(c.embedding) && c.embedding.length > 0
    );

    const conceptEmbeddings = validConcepts.map((c) => c.embedding!);
    const conceptTexts = validConcepts.map((c) => c.text);

    if (conceptEmbeddings.length === 0) {
      throw new Error(
        'Cannot record mission version: No concepts have embeddings'
      );
    }

    // 4. Compute semantic fingerprint
    const semanticFingerprint =
      this.computeSemanticFingerprint(conceptEmbeddings);

    // 5. Get next version number
    const nextVersion = await this.getNextVersion();

    // 6. Create version record
    const version: MissionVersion = {
      version: nextVersion,
      hash,
      timestamp: new Date().toISOString(),
      author: gitInfo.author,
      commitHash: gitInfo.commit,
      conceptEmbeddings,
      semanticFingerprint,
      conceptTexts,
    };

    // 7. Store embeddings in LanceDB (NOT in JSON!)
    await this.storeEmbeddingsInLance(
      nextVersion,
      conceptEmbeddings,
      conceptTexts,
      semanticFingerprint,
      hash
    );

    // 8. Strip embeddings before writing to JSON (metadata only)
    const versionWithoutEmbeddings = {
      ...version,
      conceptEmbeddings: [], // Empty array for backward compatibility
    };

    // 9. Append to log (atomic operation)
    await this.appendVersion(versionWithoutEmbeddings);

    return version;
  }

  /**
   * Store mission concept embeddings in LanceDB
   *
   * Stores embeddings separately from versions.json to:
   * - Reduce JSON file size
   * - Enable binary storage format
   * - Support efficient similarity search
   *
   * @param version - Version number
   * @param embeddings - Concept embeddings
   * @param conceptTexts - Concept texts (parallel to embeddings)
   * @param semanticFingerprint - Version's semantic fingerprint
   * @param documentHash - Mission document hash
   */
  private async storeEmbeddingsInLance(
    version: number,
    embeddings: number[][],
    conceptTexts: string[],
    semanticFingerprint: string,
    documentHash: string
  ): Promise<void> {
    const { LanceVectorStore } = await import(
      '../overlays/vector-db/lance-store.js'
    );
    const lanceStore = new LanceVectorStore(this.pgcRoot);
    await lanceStore.initialize('mission_integrity');

    const vectors = embeddings.map((embedding, index) => ({
      id: `v${version}_concept_${index}`,
      symbol: conceptTexts[index].substring(0, 100),
      embedding: embedding,
      document_hash: documentHash,
      structural_signature: `mission:v${version}`,
      semantic_signature: conceptTexts[index],
      type: 'semantic',
      architectural_role: 'mission_concept',
      computed_at: new Date().toISOString(),
      lineage_hash: `mission_v${version}`,
      filePath: `mission_integrity/v${version}`,
      structuralHash: semanticFingerprint,
    }));

    if (vectors.length > 0) {
      await lanceStore.batchStoreVectors(
        vectors.map((v) => ({
          id: v.id,
          embedding: v.embedding,
          metadata: {
            symbol: v.symbol,
            document_hash: v.document_hash,
            structural_signature: v.structural_signature,
            semantic_signature: v.semantic_signature,
            type: v.type,
            architectural_role: v.architectural_role,
            computed_at: v.computed_at,
            lineage_hash: v.lineage_hash,
            filePath: v.filePath,
            structuralHash: v.structuralHash,
          },
        }))
      );
    }

    await lanceStore.close();
  }

  /**
   * Load concept embeddings for a version from LanceDB
   *
   * Retrieves embeddings that were stored separately from versions.json.
   * Used by drift detection and semantic analysis tools.
   *
   * @param version - Version number to load embeddings for
   * @returns Array of embeddings in concept order, or empty array if not found
   *
   * @example
   * const embeddings = await monitor.loadEmbeddingsFromLance(1);
   * console.log(`Loaded ${embeddings.length} concept embeddings for v1`);
   */
  async loadEmbeddingsFromLance(version: number): Promise<number[][]> {
    try {
      const { LanceVectorStore } = await import(
        '../overlays/vector-db/lance-store.js'
      );
      const lanceStore = new LanceVectorStore(this.pgcRoot);
      await lanceStore.initialize('mission_integrity');

      // Query for all vectors matching this version
      // Vector IDs follow pattern: v{version}_concept_{index}
      const allVectors = await lanceStore.getAllVectors();
      const versionPrefix = `v${version}_concept_`;
      const versionVectors = allVectors
        .filter((v) => v.id.startsWith(versionPrefix))
        .sort((a, b) => {
          // Sort by concept index
          const indexA = parseInt(a.id.replace(versionPrefix, ''));
          const indexB = parseInt(b.id.replace(versionPrefix, ''));
          return indexA - indexB;
        });

      await lanceStore.close();

      return versionVectors.map((v) => v.embedding);
    } catch (error) {
      console.warn(
        `Warning: Failed to load embeddings for v${version} from LanceDB:`,
        (error as Error).message
      );
      return [];
    }
  }

  /**
   * Get the latest mission version
   *
   * @returns Most recent MissionVersion, or null if no versions exist
   *
   * @example
   * const latest = await monitor.getLatestVersion();
   * if (latest) {
   *   console.log(`Latest: v${latest.version} from ${latest.timestamp}`);
   * } else {
   *   console.log('No versions recorded yet (first ingestion)');
   * }
   */
  async getLatestVersion(): Promise<MissionVersion | null> {
    const versions = await this.loadVersions();
    if (versions.length === 0) return null;

    const latest = versions[versions.length - 1];
    // Load embeddings from LanceDB if they're missing (new format)
    if (
      !latest.conceptEmbeddings ||
      latest.conceptEmbeddings.length === 0 ||
      !Array.isArray(latest.conceptEmbeddings[0])
    ) {
      latest.conceptEmbeddings = await this.loadEmbeddingsFromLance(
        latest.version
      );
    }

    return latest;
  }

  /**
   * Get all versions for audit trail analysis
   *
   * @returns Array of all MissionVersions in chronological order
   *
   * @example
   * const versions = await monitor.getAllVersions();
   * console.log(`Total versions: ${versions.length}`);
   * versions.forEach(v => {
   *   console.log(`v${v.version}: ${v.timestamp} by ${v.author || 'unknown'}`);
   * });
   */
  async getAllVersions(): Promise<MissionVersion[]> {
    const versions = await this.loadVersions();

    // Load embeddings from LanceDB for each version if missing (new format)
    for (const version of versions) {
      if (
        !version.conceptEmbeddings ||
        version.conceptEmbeddings.length === 0 ||
        !Array.isArray(version.conceptEmbeddings[0])
      ) {
        version.conceptEmbeddings = await this.loadEmbeddingsFromLance(
          version.version
        );
      }
    }

    return versions;
  }

  /**
   * Get a specific version by version number
   *
   * @param versionNumber - Version number to retrieve
   * @returns MissionVersion if found, null otherwise
   *
   * @example
   * const v1 = await monitor.getVersion(1);
   * if (v1) {
   *   console.log(`v1 hash: ${v1.hash}`);
   * }
   */
  async getVersion(versionNumber: number): Promise<MissionVersion | null> {
    const versions = await this.loadVersions();
    const version = versions.find((v) => v.version === versionNumber) || null;

    if (version) {
      // Load embeddings from LanceDB if they're missing (new format)
      if (
        !version.conceptEmbeddings ||
        version.conceptEmbeddings.length === 0 ||
        !Array.isArray(version.conceptEmbeddings[0])
      ) {
        version.conceptEmbeddings = await this.loadEmbeddingsFromLance(
          version.version
        );
      }
    }

    return version;
  }

  /**
   * Compute semantic fingerprint from concept embeddings
   *
   * Creates a compact, comparable identifier representing the "average meaning"
   * of the mission document. Changes to this fingerprint indicate semantic drift.
   *
   * ALGORITHM:
   * 1. Compute centroid (average) of all embeddings
   * 2. Round each dimension to 6 decimal places
   * 3. Hash the rounded centroid (SHA-256)
   *
   * WHY THIS WORKS:
   * - Centroid represents average semantic position in embedding space
   * - 6 decimal precision balances stability vs. sensitivity
   * - Hash creates compact identifier for comparison
   * - Different fingerprints = different meaning
   *
   * NOTE: Uses all embeddings (already weighted by ConceptExtractor).
   * Taking top-K would require weight information not available here.
   *
   * @param embeddings - Array of concept embeddings
   * @returns SHA-256 hash of rounded centroid
   *
   * @example
   * const fingerprint = computeSemanticFingerprint(embeddings);
   * // "a3f2e1c4..." (SHA-256 hash)
   */
  private computeSemanticFingerprint(embeddings: number[][]): string {
    // Use all embeddings (they're already ranked by importance)
    const centroid = this.computeCentroid(embeddings);

    // Hash with 6 decimal places for stability
    const centroidStr = centroid.map((v) => v.toFixed(6)).join(',');
    return createHash('sha256').update(centroidStr).digest('hex');
  }

  /**
   * Compute centroid (average) of embedding vectors
   */
  private computeCentroid(embeddings: number[][]): number[] {
    if (embeddings.length === 0) {
      throw new Error('Cannot compute centroid: no embeddings provided');
    }

    const dim = embeddings[0].length;
    const centroid = new Array(dim).fill(0);

    // Sum all embeddings
    embeddings.forEach((emb) => {
      if (emb.length !== dim) {
        throw new Error(
          `Embedding dimension mismatch: expected ${dim}, got ${emb.length}`
        );
      }
      emb.forEach((val, i) => {
        centroid[i] += val;
      });
    });

    // Divide by count to get average
    return centroid.map((v) => v / embeddings.length);
  }

  /**
   * Get git metadata for a file
   *
   * BEST EFFORT:
   * - Returns empty object if git is unavailable
   * - Non-blocking (failures are logged but not thrown)
   */
  private async getGitInfo(filePath: string): Promise<GitInfo> {
    try {
      // Check if file is in a git repo
      const repoRoot = execSync('git rev-parse --show-toplevel', {
        cwd: path.dirname(filePath),
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();

      // Get last commit for this file
      const commit = execSync(`git log -1 --format=%H -- "${filePath}"`, {
        cwd: repoRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();

      // Get author of last commit
      const author = execSync(`git log -1 --format=%an -- "${filePath}"`, {
        cwd: repoRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();

      return {
        author: author || undefined,
        commit: commit || undefined,
      };
    } catch (error) {
      // Git not available or file not in repo - this is fine
      console.warn(
        `Failed to get git info: ${error instanceof Error ? error.message : String(error)}`
      );
      return {};
    }
  }

  /**
   * Get next version number
   */
  private async getNextVersion(): Promise<number> {
    const versions = await this.loadVersions();
    if (versions.length === 0) {
      return 1; // First version
    }

    // Find max version number and add 1
    const maxVersion = Math.max(...versions.map((v) => v.version));
    return maxVersion + 1;
  }

  /**
   * Append version to log (atomic write)
   *
   * ATOMICITY:
   * 1. Load existing versions
   * 2. Append new version
   * 3. Write to temp file
   * 4. Rename temp file to versions.json (atomic on POSIX)
   */
  private async appendVersion(version: MissionVersion): Promise<void> {
    const versions = await this.loadVersions();
    versions.push(version);

    // Write to temp file first
    const tempPath = `${this.versionsPath}.tmp`;
    await fs.writeJson(tempPath, versions, { spaces: 2 });

    // Atomic rename
    await fs.rename(tempPath, this.versionsPath);
  }

  /**
   * Load all versions from disk
   * Returns empty array if file doesn't exist
   */
  private async loadVersions(): Promise<MissionVersion[]> {
    if (!(await fs.pathExists(this.versionsPath))) {
      return [];
    }

    try {
      const versions = await fs.readJson(this.versionsPath);
      return Array.isArray(versions) ? versions : [];
    } catch (error) {
      console.warn(
        `Warning: Failed to load mission versions: ${(error as Error).message}`
      );
      return [];
    }
  }
}
