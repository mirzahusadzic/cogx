import fs from 'fs-extra';
import path from 'path';

export class ReverseDeps {
  constructor(private pgcRoot: string) {}

  async add(objectHash: string, transformId: string): Promise<void> {
    const reverseDepPath = this.getReverseDepPath(objectHash);
    await fs.ensureDir(path.dirname(reverseDepPath));

    const existingDeps: Set<string> = new Set();
    if (await fs.pathExists(reverseDepPath)) {
      const content = await fs.readFile(reverseDepPath, 'utf-8');
      content.split('\n').forEach((dep) => {
        const trimmedDep = dep.trim();
        if (trimmedDep) {
          existingDeps.add(trimmedDep);
        }
      });
    }

    if (!existingDeps.has(transformId)) {
      existingDeps.add(transformId);
      const newContent = Array.from(existingDeps).join('\n') + '\n';
      await fs.writeFile(reverseDepPath, newContent);
    }
  }

  private getReverseDepPath(hash: string): string {
    const dir = hash.slice(0, 2);
    const file = hash.slice(2);
    return path.join(this.pgcRoot, 'reverse_deps', dir, file);
  }
}
