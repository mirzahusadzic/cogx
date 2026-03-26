import path from 'path';
import fs from 'fs-extra';

export interface RehydrationManifestData {
  last_rehydrated_commit: string | null;
  total_commits_processed: number;
  total_transforms_recorded: number;
  rehydrated_at: string;
  branch: string;
  depth: number | null;
  since: string | null;
}

export class RehydrationManifest {
  private manifestPath: string;

  constructor(pgcRoot: string) {
    this.manifestPath = path.join(pgcRoot, 'rehydration', 'manifest.json');
  }

  async read(): Promise<RehydrationManifestData | null> {
    try {
      if (!(await fs.pathExists(this.manifestPath))) {
        return null;
      }
      const content = await fs.readFile(this.manifestPath, 'utf-8');
      return JSON.parse(content) as RehydrationManifestData;
    } catch {
      return null;
    }
  }

  async write(data: RehydrationManifestData): Promise<void> {
    await fs.ensureDir(path.dirname(this.manifestPath));
    await fs.writeFile(
      this.manifestPath,
      JSON.stringify(data, null, 2),
      'utf-8'
    );
  }
}
