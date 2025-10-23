import fs from 'fs-extra';
import path from 'path';
import { z } from 'zod';
import upath from 'upath';
import { lock } from 'proper-lockfile';

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

  async updateManifest(
    overlayType: string,
    symbolName: string,
    filePath: string
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

      let manifest: Record<string, string> = {};
      if (await fs.pathExists(manifestPath)) {
        manifest = await fs.readJSON(manifestPath);
      }
      manifest[symbolName] = filePath;
      await fs.writeJSON(manifestPath, manifest, { spaces: 2 });
    } finally {
      if (release) {
        await release();
      }
    }
  }

  public async getManifest(
    overlayType: string
  ): Promise<Record<string, string>> {
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
}
