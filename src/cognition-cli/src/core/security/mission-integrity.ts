import { createHash } from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { MissionConcept } from '../analyzers/concept-extractor.js';
import { execSync } from 'child_process';

/**
 * Represents a single version of a mission document
 * Creates an immutable audit trail for drift detection
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
 * Git metadata for a file
 */
interface GitInfo {
  author?: string;
  commit?: string;
}

/**
 * MissionIntegrityMonitor
 *
 * PURPOSE:
 * Creates an immutable audit trail of all mission document versions.
 * Enables semantic drift detection by tracking embedding evolution over time.
 *
 * SECURITY ROLE:
 * - Prevents attackers from erasing evidence of gradual poisoning
 * - Provides forensic trail for investigating mission changes
 * - Enables "rewind" to previous mission state if needed
 *
 * STORAGE:
 * .open_cognition/mission_integrity/versions.json
 *
 * INVARIANTS:
 * - Versions are append-only (never deleted or modified)
 * - Version numbers are monotonically increasing
 * - Each version includes full snapshot of embeddings
 */
export class MissionIntegrityMonitor {
  private versionsPath: string;
  private versionsDir: string;

  constructor(private pgcRoot: string) {
    this.versionsDir = path.join(pgcRoot, 'mission_integrity');
    this.versionsPath = path.join(this.versionsDir, 'versions.json');
  }

  /**
   * Record a new version of a mission document
   *
   * ALGORITHM:
   * 1. Hash the document content (SHA-256)
   * 2. Get git metadata (author, commit) if available
   * 3. Compute semantic fingerprint from concept embeddings
   * 4. Create version record
   * 5. Append to immutable log
   *
   * SECURITY:
   * - Never overwrites existing versions
   * - Atomic writes (write to temp, then rename)
   * - Version numbers cannot go backwards
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

    // 7. Append to log (atomic operation)
    await this.appendVersion(version);

    return version;
  }

  /**
   * Get the latest mission version
   * Returns null if no versions exist (first ingestion)
   */
  async getLatestVersion(): Promise<MissionVersion | null> {
    const versions = await this.loadVersions();
    return versions.length > 0 ? versions[versions.length - 1] : null;
  }

  /**
   * Get all versions (for auditing/debugging)
   */
  async getAllVersions(): Promise<MissionVersion[]> {
    return await this.loadVersions();
  }

  /**
   * Get a specific version by number
   */
  async getVersion(versionNumber: number): Promise<MissionVersion | null> {
    const versions = await this.loadVersions();
    return versions.find((v) => v.version === versionNumber) || null;
  }

  /**
   * Compute semantic fingerprint from embeddings
   *
   * ALGORITHM:
   * 1. Take top 10 concepts by weight (or all if < 10)
   * 2. Compute centroid of their embeddings (768-dim average)
   * 3. Hash the centroid with 6 decimal precision
   *
   * WHY:
   * - Centroid represents "average meaning" of mission
   * - Hash creates compact, comparable identifier
   * - 6 decimal precision balances stability vs. sensitivity
   * - Changes to this fingerprint indicate semantic drift
   *
   * NOTE: We use all embeddings here, not just top 10, since concepts
   * are already weighted by the ConceptExtractor. Taking top 10 would
   * require weight information which we don't have access to here.
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
