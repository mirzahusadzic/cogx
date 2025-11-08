import fs from 'fs-extra';
import path from 'path';
import { z } from 'zod';
import upath from 'upath';
import { lock } from 'proper-lockfile';
import crypto from 'crypto';

/**
 * Manifest entry for tracking overlay metadata with incremental update support
 */
export interface OverlayManifestEntry {
  // Common fields
  lastUpdated: string;

  // Type-specific fields (union for different overlay types)
  filePath?: string; // For code patterns (O₁, O₅)
  sourceHash?: string; // For code patterns - content hash for change detection
  documentHash?: string; // For doc-based overlays (O₂, O₄, O₆)
  sourceFile?: string; // For doc-based overlays
  dependencies?: Record<string, string>; // For computed overlays (O₇)

  // Additional metadata
  [key: string]: unknown; // Allow extensibility
}

/**
 * Raw manifest format supporting both old (string) and new (object) formats
 */
export type ManifestEntryRaw = string | OverlayManifestEntry;

/**
 * Manages overlay storage and retrieval for pattern metadata and manifests.
 * Supports backward-compatible manifest format migration.
 */
export class Overlays {
  private overlaysPath: string;

  constructor(private pgcRoot: string) {
    this.overlaysPath = path.join(this.pgcRoot, 'overlays');
  }

  public getOverlayPath(overlayType: string, sourceFilePath?: string): string {
    const normalizedPath = sourceFilePath ? upath.toUnix(sourceFilePath) : '';
    const finalPath = sourceFilePath ? `${normalizedPath}.json` : '';
    return path.join(this.overlaysPath, overlayType, finalPath);
  }

  async get<T>(
    overlayType: string,
    sourceFilePath: string,
    schema: z.ZodType<T>
  ): Promise<T | null> {
    const overlayPath = this.getOverlayPath(overlayType, sourceFilePath);
    if (await fs.pathExists(overlayPath)) {
      try {
        const rawData = await fs.readJSON(overlayPath);
        const result = schema.safeParse(rawData);
        if (result.success) {
          return result.data;
        }
      } catch (e) {
        // File might be corrupted or empty
        return null;
      }
    }
    return null;
  }

  async update<T>(
    overlayType: string,
    sourceFilePath: string,
    data: T
  ): Promise<void> {
    const overlayPath = this.getOverlayPath(overlayType, sourceFilePath);
    await fs.ensureDir(path.dirname(overlayPath));
    await fs.writeJSON(overlayPath, data, { spaces: 2 });
  }

  async exists(overlayType: string, sourceFilePath: string): Promise<boolean> {
    const overlayPath = this.getOverlayPath(overlayType, sourceFilePath);
    return fs.pathExists(overlayPath);
  }

  /**
   * Update manifest with new format (with metadata) or old format (string path)
   * @param overlayType - The type of overlay
   * @param symbolName - The symbol/entry name
   * @param entryData - Either a string path (old format) or full manifest entry (new format)
   */
  async updateManifest(
    overlayType: string,
    symbolName: string,
    entryData: string | OverlayManifestEntry
  ): Promise<void> {
    const manifestPath = path.join(
      this.getOverlayPath(overlayType), // Correctly get the directory
      'manifest.json'
    );
    await fs.ensureDir(path.dirname(manifestPath)); // Ensure directory exists at the very beginning

    // Ensure the manifest file exists before locking (proper-lockfile requires the file to exist)
    // Use a try-catch to handle race condition where multiple processes try to create the file
    if (!(await fs.pathExists(manifestPath))) {
      try {
        await fs.writeJSON(manifestPath, {}, { spaces: 2, flag: 'wx' }); // wx = write exclusive (fail if exists)
      } catch (err: unknown) {
        // File was created by another process, continue
        if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
          throw err;
        }
      }
    }

    let release;
    try {
      release = await lock(manifestPath, {
        retries: 5,
        stale: 5000,
        realpath: false,
      }); // Balanced retries for worker concurrency

      let manifest: Record<string, ManifestEntryRaw> = {};
      if (await fs.pathExists(manifestPath)) {
        manifest = await fs.readJSON(manifestPath);
      }
      manifest[symbolName] = entryData;
      await fs.writeJSON(manifestPath, manifest, { spaces: 2 });
    } finally {
      if (release) {
        await release();
      }
    }
  }

  /**
   * Get manifest with backward compatibility
   * Returns raw manifest data (supports both old string and new object formats)
   */
  public async getManifest(
    overlayType: string
  ): Promise<Record<string, ManifestEntryRaw>> {
    const manifestPath = path.join(
      this.getOverlayPath(overlayType),
      'manifest.json'
    );

    await fs.ensureDir(path.dirname(manifestPath)); // Ensure directory exists

    if (await fs.pathExists(manifestPath)) {
      return fs.readJSON(manifestPath);
    }

    return {};
  }

  /**
   * Parse a manifest entry, handling both old (string) and new (object) formats
   * @param entry - Raw manifest entry
   * @returns Normalized manifest entry with metadata
   */
  public parseManifestEntry(entry: ManifestEntryRaw): {
    filePath?: string;
    sourceHash?: string;
    documentHash?: string;
    sourceFile?: string;
    dependencies?: Record<string, string>;
    lastUpdated?: string;
    needsMigration: boolean;
  } {
    // Old format: "symbolName": "filePath"
    if (typeof entry === 'string') {
      return {
        filePath: entry,
        sourceHash: undefined, // Will trigger re-processing
        needsMigration: true,
      };
    }

    // New format: "symbolName": { filePath, sourceHash, ... }
    return {
      ...entry,
      needsMigration: false,
    };
  }

  /**
   * Get manifest entry for a specific symbol with backward compatibility
   */
  public async getManifestEntry(
    overlayType: string,
    symbolName: string
  ): Promise<ReturnType<typeof this.parseManifestEntry> | null> {
    const manifest = await this.getManifest(overlayType);
    const entry = manifest[symbolName];

    if (!entry) {
      return null;
    }

    return this.parseManifestEntry(entry);
  }

  /**
   * Compute hash for comparison (uses the same method as object store)
   */
  public computeHash(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }
}
