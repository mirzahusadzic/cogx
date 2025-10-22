import fs from 'fs-extra';
import path from 'path';
import { z } from 'zod';
import upath from 'upath';

export class Overlays {
  private overlaysPath: string;

  constructor(private pgcRoot: string) {
    this.overlaysPath = path.join(this.pgcRoot, 'overlays');
  }

  private getOverlayPath(overlayType: string, sourceFilePath: string): string {
    // Normalize path to use forward slashes for consistency
    const normalizedPath = upath.toUnix(sourceFilePath);
    return path.join(this.overlaysPath, overlayType, `${normalizedPath}.json`);
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
      this.overlaysPath,
      overlayType,
      'manifest.json'
    );
    let manifest: Record<string, string> = {};
    if (await fs.pathExists(manifestPath)) {
      manifest = await fs.readJSON(manifestPath);
    }
    manifest[symbolName] = filePath;
    await fs.writeJSON(manifestPath, manifest, { spaces: 2 });
  }
}
