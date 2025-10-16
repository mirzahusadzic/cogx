import fs from 'fs-extra';
import path from 'path';

export class ReverseDeps {
  constructor(private pgcRoot: string) {}

  async add(objectHash: string, transformId: string): Promise<void> {
    const reverseDepPath = this.getReverseDepPath(objectHash);
    await fs.ensureDir(path.dirname(reverseDepPath));
    await fs.appendFile(reverseDepPath, `${transformId}\n`);
  }

  private getReverseDepPath(hash: string): string {
    const dir = hash.slice(0, 2);
    const file = hash.slice(2);
    return path.join(this.pgcRoot, 'reverse_deps', dir, file);
  }
}
